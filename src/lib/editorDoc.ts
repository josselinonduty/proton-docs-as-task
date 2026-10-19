/**
 * Maps between Proton's Lexical editor state and the line-based document text
 * the parser understands — in both directions, and as minimal edits.
 *
 * Reading works on Lexical's serialized JSON (`editorState.toJSON()`), so it
 * sees the real document structure (headings, check lists and their checked
 * state) rather than whatever the DOM happens to render.
 *
 * Writing describes the target document as native Lexical blocks — `## Title`
 * becomes a heading, `- [ ] Task` a check-list item — and plans the smallest
 * set of block / list-item edits that turns the current document into it.
 * Untouched blocks keep their Lexical nodes, so Proton's Yjs sync only ships
 * the lines that actually changed and concurrent edits elsewhere survive.
 *
 * Everything here is pure; `editorBridge.ts` executes the plan in the page.
 */

import { lcsPairs } from './lineMerge';

/** A Lexical node as produced by `exportJSON()` (only the fields we read). */
export interface SerializedNode {
  type: string;
  children?: SerializedNode[];
  text?: string;
  tag?: string;
  listType?: string;
  checked?: boolean;
  [key: string]: unknown;
}

export interface SerializedEditorState {
  root: SerializedNode;
}

export type ListType = 'check' | 'bullet' | 'number';

export interface DocItem {
  text: string;
  checked: boolean;
  /** Safe to edit in place (no nested list, single line). */
  patchable: boolean;
}

/** One top-level block of the document. */
export interface DocBlock {
  kind: 'paragraph' | 'heading' | 'list' | 'other';
  /** Heading tag (`h1`..`h6`). */
  tag?: string;
  listType?: ListType;
  /** Paragraph / heading text. */
  text?: string;
  /** List items, flattened. */
  items?: DocItem[];
  /** The document lines this block contributes. */
  lines: string[];
  /** Safe to edit in place rather than replace. */
  patchable: boolean;
}

// ---------------------------------------------------------------------------
// Reading: Lexical JSON → blocks → lines
// ---------------------------------------------------------------------------

function inlineText(node: SerializedNode): string {
  if (typeof node.text === 'string') return node.text;
  if (node.type === 'linebreak') return '\n';
  return (node.children ?? []).map(inlineText).join('');
}

function isListNode(node: SerializedNode): boolean {
  return typeof node.listType === 'string' && Array.isArray(node.children);
}

function asListType(value: string | undefined): ListType {
  return value === 'check' || value === 'number' ? value : 'bullet';
}

function itemLine(item: Pick<DocItem, 'text' | 'checked'>, listType: ListType): string {
  if (listType !== 'check') return `- ${item.text}`;
  return `- [${item.checked ? 'x' : ' '}]${item.text ? ` ${item.text}` : ''}`;
}

/** Flatten a (possibly nested) list into items; returns true if it nested. */
function collectItems(list: SerializedNode, listType: ListType, items: DocItem[]): boolean {
  let nested = false;
  for (const item of list.children ?? []) {
    const children = item.children ?? [];
    const sublists = children.filter(isListNode);
    const own = children.filter((c) => !isListNode(c));
    // A list item holding only a nested list is Lexical's indentation wrapper.
    if (own.length > 0 || sublists.length === 0) {
      const text = own.map(inlineText).join('');
      items.push({
        text,
        checked: item.checked === true,
        patchable: sublists.length === 0 && !text.includes('\n'),
      });
    }
    for (const sub of sublists) {
      nested = true;
      collectItems(sub, listType, items);
    }
  }
  return nested;
}

/** Describe one top-level Lexical node as a document block. */
export function blockFromNode(node: SerializedNode): DocBlock {
  if (isListNode(node)) {
    const listType = asListType(node.listType);
    const items: DocItem[] = [];
    const nested = collectItems(node, listType, items);
    return {
      kind: 'list',
      listType,
      items,
      lines: items.flatMap((item) => itemLine(item, listType).split('\n')),
      patchable: !nested && items.every((item) => item.patchable),
    };
  }

  const text = inlineText(node);
  const heading = node.type === 'heading' && /^h[1-6]$/.test(node.tag ?? '');
  if (heading && !text.includes('\n')) {
    const level = Number(node.tag!.slice(1));
    return {
      kind: 'heading',
      tag: node.tag,
      text,
      lines: [`${'#'.repeat(level)} ${text}`],
      patchable: true,
    };
  }

  const lines = text.split('\n');
  if (node.type === 'paragraph') {
    return { kind: 'paragraph', text, lines, patchable: lines.length === 1 };
  }
  return { kind: 'other', lines, patchable: false };
}

/** The document lines of a serialized editor state. */
export function linesFromEditorState(state: SerializedEditorState): string[] {
  return (state.root.children ?? []).flatMap((node) => blockFromNode(node).lines);
}

// ---------------------------------------------------------------------------
// Writing: lines → target blocks
// ---------------------------------------------------------------------------

const HEADING_LINE = /^(#{1,6}) (.*)$/;
const CHECK_LINE = /^- \[([ xX])\](?: (.*))?$/;
const BULLET_LINE = /^- (.*)$/;

/** Describe the target document as native blocks (headings, check lists…). */
export function blocksFromLines(lines: string[]): DocBlock[] {
  const blocks: DocBlock[] = [];
  const pushItem = (listType: ListType, item: DocItem) => {
    const last = blocks[blocks.length - 1];
    if (last?.kind === 'list' && last.listType === listType) {
      last.items!.push(item);
      last.lines.push(itemLine(item, listType));
    } else {
      blocks.push({
        kind: 'list',
        listType,
        items: [item],
        lines: [itemLine(item, listType)],
        patchable: true,
      });
    }
  };

  for (const line of lines) {
    const heading = HEADING_LINE.exec(line);
    if (heading) {
      const text = heading[2]!;
      blocks.push({
        kind: 'heading',
        tag: `h${heading[1]!.length}`,
        text,
        lines: [`${heading[1]} ${text}`],
        patchable: true,
      });
      continue;
    }
    const check = CHECK_LINE.exec(line);
    if (check) {
      pushItem('check', { text: check[2] ?? '', checked: check[1] !== ' ', patchable: true });
      continue;
    }
    const bullet = BULLET_LINE.exec(line);
    if (bullet) {
      pushItem('bullet', { text: bullet[1]!, checked: false, patchable: true });
      continue;
    }
    blocks.push({ kind: 'paragraph', text: line, lines: [line], patchable: true });
  }
  return blocks;
}

// ---------------------------------------------------------------------------
// Writing: blocks → Lexical JSON for new nodes
// ---------------------------------------------------------------------------

export function textNodeJSON(text: string): SerializedNode {
  return { type: 'text', version: 1, text, format: 0, detail: 0, mode: 'normal', style: '' };
}

function elementJSON(
  type: string,
  text: string | undefined,
  extra: Record<string, unknown> = {},
  children?: SerializedNode[],
): SerializedNode {
  return {
    type,
    version: 1,
    direction: null,
    format: '',
    indent: 0,
    textFormat: 0,
    textStyle: '',
    children: children ?? (text ? [textNodeJSON(text)] : []),
    ...extra,
  };
}

export function itemToJSON(item: DocItem, listType: ListType, value = 1): SerializedNode {
  return elementJSON('listitem', item.text, {
    value,
    ...(listType === 'check' ? { checked: item.checked } : {}),
  });
}

/** Lexical JSON for a brand-new block. */
export function blockToJSON(block: DocBlock): SerializedNode {
  switch (block.kind) {
    case 'heading':
      return elementJSON('heading', block.text, { tag: block.tag });
    case 'list': {
      const listType = block.listType ?? 'bullet';
      return elementJSON(
        'list',
        undefined,
        { listType, start: 1, tag: listType === 'number' ? 'ol' : 'ul' },
        (block.items ?? []).map((item, i) => itemToJSON(item, listType, i + 1)),
      );
    }
    default:
      return elementJSON('paragraph', block.lines.join(' '));
  }
}

// ---------------------------------------------------------------------------
// Planning minimal edits
// ---------------------------------------------------------------------------

export type ItemOp =
  | { op: 'keep'; index: number }
  | { op: 'remove'; index: number }
  | { op: 'insert'; item: DocItem }
  | { op: 'set'; index: number; text?: string; checked?: boolean };

export type BlockOp =
  | { op: 'keep'; index: number }
  | { op: 'remove'; index: number }
  | { op: 'insert'; block: DocBlock }
  | { op: 'setText'; index: number; text: string }
  | { op: 'patchList'; index: number; listType: ListType; items: ItemOp[] };

function signature(block: DocBlock): string {
  return `${block.kind}|${block.tag ?? ''}|${block.listType ?? ''}\n${block.lines.join('\n')}`;
}

function compatible(current: DocBlock, target: DocBlock): boolean {
  if (!current.patchable || !target.patchable || current.kind !== target.kind) return false;
  if (current.kind === 'heading') return current.tag === target.tag;
  if (current.kind === 'list') return current.listType === target.listType;
  return current.kind === 'paragraph';
}

function planItems(current: DocItem[], target: DocItem[], listType: ListType): ItemOp[] {
  const line = (item: DocItem) => itemLine(item, listType);
  const anchors = lcsPairs(current.map(line), target.map(line));
  const ops: ItemOp[] = [];
  let c = 0;
  let t = 0;
  for (const [ac, at] of [...anchors, [current.length, target.length] as [number, number]]) {
    // Pair the changed items in this gap positionally, then add/remove the rest.
    while (t < at) {
      if (c < ac) {
        const before = current[c]!;
        const after = target[t]!;
        ops.push({
          op: 'set',
          index: c,
          ...(before.text !== after.text ? { text: after.text } : {}),
          ...(before.checked !== after.checked ? { checked: after.checked } : {}),
        });
        c += 1;
      } else {
        ops.push({ op: 'insert', item: target[t]! });
      }
      t += 1;
    }
    while (c < ac) ops.push({ op: 'remove', index: c++ });
    if (ac < current.length) ops.push({ op: 'keep', index: ac });
    c = ac + 1;
    t = at + 1;
  }
  return ops;
}

/**
 * Plan the edits that turn `current` into `target`. Ops are listed in target
 * order: `keep`/`setText`/`patchList` reuse an existing block (by index into
 * `current`), `insert` creates one, and `remove` drops one.
 */
export function planEdits(current: DocBlock[], target: DocBlock[]): BlockOp[] {
  const anchors = lcsPairs(current.map(signature), target.map(signature));
  const ops: BlockOp[] = [];
  let c = 0;
  let t = 0;
  for (const [ac, at] of [...anchors, [current.length, target.length] as [number, number]]) {
    for (; t < at; t += 1) {
      const block = target[t]!;
      let match = c;
      while (match < ac && !compatible(current[match]!, block)) match += 1;
      if (match === ac) {
        ops.push({ op: 'insert', block });
        continue;
      }
      for (; c < match; c += 1) ops.push({ op: 'remove', index: c });
      const existing = current[match]!;
      if (block.kind === 'list') {
        const listType = block.listType ?? 'bullet';
        ops.push({
          op: 'patchList',
          index: match,
          listType,
          items: planItems(existing.items ?? [], block.items ?? [], listType),
        });
      } else if (existing.text !== block.text) {
        ops.push({ op: 'setText', index: match, text: block.text ?? '' });
      } else {
        ops.push({ op: 'keep', index: match });
      }
      c = match + 1;
    }
    for (; c < ac; c += 1) ops.push({ op: 'remove', index: c });
    if (ac < current.length) ops.push({ op: 'keep', index: ac });
    c = ac + 1;
    t = at + 1;
  }
  return ops;
}

/** True when a plan changes nothing. */
export function isNoop(ops: BlockOp[]): boolean {
  return ops.every(
    (op) =>
      op.op === 'keep' ||
      (op.op === 'patchList' &&
        op.items.every(
          (item) =>
            item.op === 'keep' ||
            (item.op === 'set' && item.text === undefined && item.checked === undefined),
        )),
  );
}
