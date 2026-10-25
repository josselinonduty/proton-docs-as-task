/**
 * The page-world side of the editor bridge. Runs inside the Proton Docs editor
 * frame next to Proton's own code and drives its Lexical editor directly:
 *
 * - **Reading** subscribes to Lexical's update listener, so every change —
 *   ours, a collaborator's, an undo — arrives as a state with its origin,
 *   taken from Lexical's update tags rather than guessed from DOM timing.
 * - **Writing** runs one tagged `editor.update()` that applies the minimal
 *   block edits from `editorDoc.ts`. That is the same path Proton's own
 *   features use, so its Yjs collaboration, history and saving pick the change
 *   up exactly as if it were typed.
 *
 * Lexical stores the editor instance on its root element (`__lexicalEditor`),
 * which only page scripts can see — hence this script runs in the MAIN world.
 */

import {
  BOARD_UPDATE_TAG,
  REQUEST_EVENT,
  RESPONSE_EVENT,
  STATE_EVENT,
  isBridgeRequest,
  readDetail,
  type ApplyResult,
  type BridgeResponse,
  type EditorOrigin,
  type EditorStateMessage,
} from './bridgeProtocol';
import {
  blockFromNode,
  blocksFromLines,
  blockToJSON,
  isNoop,
  itemToJSON,
  linesFromEditorState,
  planEdits,
  textNodeJSON,
  type BlockOp,
  type ItemOp,
  type ListType,
  type SerializedEditorState,
  type SerializedNode,
} from './editorDoc';
import { mergeLines } from './lineMerge';

/** The public Lexical node methods the bridge relies on. */
export interface LexicalNodeLike {
  getType(): string;
  exportJSON(): SerializedNode;
  getChildren?(): LexicalNodeLike[];
  getFirstChild?(): LexicalNodeLike | null;
  append?(...nodes: LexicalNodeLike[]): LexicalNodeLike;
  insertAfter(node: LexicalNodeLike): LexicalNodeLike;
  insertBefore(node: LexicalNodeLike): LexicalNodeLike;
  remove(preserveEmptyParent?: boolean): void;
  setTextContent?(text: string): LexicalNodeLike;
  setChecked?(checked: boolean): LexicalNodeLike;
}

interface UpdatePayload {
  editorState: { toJSON(): SerializedEditorState };
  tags: Set<string>;
  dirtyElements: Map<string, unknown>;
  dirtyLeaves: Set<string>;
}

/**
 * The slice of a Lexical editor the bridge uses. `_nodes` (the node registry)
 * and `editorState._nodeMap` are internal but stable fields — Lexical's own
 * packages and devtools depend on them.
 */
export interface LexicalEditorLike {
  getEditorState(): {
    toJSON(): SerializedEditorState;
    _nodeMap: Map<string, LexicalNodeLike>;
  };
  update(fn: () => void, options?: { discrete?: boolean; tag?: string | string[] }): void;
  isEditable(): boolean;
  registerUpdateListener(listener: (payload: UpdatePayload) => void): () => void;
  registerEditableListener(listener: (editable: boolean) => void): () => void;
  getRootElement(): HTMLElement | null;
  _nodes: Map<string, { klass: { importJSON(json: SerializedNode): LexicalNodeLike } }>;
  _parentEditor?: unknown;
}

/** Read the document text from the editor. */
export function readEditorText(editor: LexicalEditorLike): string {
  return linesFromEditorState(editor.getEditorState().toJSON()).join('\n');
}

export function originFromTags(tags: Set<string>): EditorOrigin {
  if (tags.has(BOARD_UPDATE_TAG)) return 'self';
  if (tags.has('collaboration')) return 'remote';
  if (tags.has('historic')) return 'history';
  return 'local';
}

// ---------------------------------------------------------------------------
// Executing a plan
// ---------------------------------------------------------------------------

function exportNode(node: LexicalNodeLike): SerializedNode {
  const json = node.exportJSON();
  if (typeof node.getChildren === 'function') json.children = node.getChildren().map(exportNode);
  return json;
}

function createNode(editor: LexicalEditorLike, json: SerializedNode): LexicalNodeLike {
  const registered = editor._nodes.get(json.type);
  if (!registered) throw new Error(`Node type "${json.type}" is not registered`);
  const node = registered.klass.importJSON(json);
  for (const child of json.children ?? []) node.append?.(createNode(editor, child));
  return node;
}

/** Insert `node` after `cursor`, or first in `parent` when there is none. */
function place(parent: LexicalNodeLike, cursor: LexicalNodeLike | null, node: LexicalNodeLike) {
  if (cursor) {
    cursor.insertAfter(node);
    return;
  }
  const first = parent.getFirstChild?.() ?? null;
  if (first) first.insertBefore(node);
  else parent.append?.(node);
}

/** Replace an element's text, editing a lone text node in place when possible. */
function setElementText(editor: LexicalEditorLike, element: LexicalNodeLike, text: string) {
  const children = element.getChildren?.() ?? [];
  const only = children.length === 1 ? children[0] : undefined;
  if (only && only.getType() === 'text' && text !== '') {
    // Lexical's Yjs binding turns this into a character-level diff.
    only.setTextContent?.(text);
    return;
  }
  if (text !== '') element.append?.(createNode(editor, textNodeJSON(text)));
  for (const child of children) child.remove(true);
}

function applyItemOps(
  editor: LexicalEditorLike,
  list: LexicalNodeLike,
  listType: ListType,
  ops: ItemOp[],
) {
  const items = list.getChildren?.() ?? [];
  let cursor: LexicalNodeLike | null = null;
  for (const op of ops) {
    if (op.op === 'insert') {
      const node = createNode(editor, itemToJSON(op.item, listType));
      place(list, cursor, node);
      cursor = node;
      continue;
    }
    const item = items[op.index]!;
    if (op.op === 'remove') {
      // Keep the list alive even if every original item goes.
      item.remove(true);
      continue;
    }
    if (op.op === 'set') {
      if (op.text !== undefined) setElementText(editor, item, op.text);
      if (op.checked !== undefined) item.setChecked?.(op.checked);
    }
    cursor = item;
  }
}

function applyBlockOps(editor: LexicalEditorLike, root: LexicalNodeLike, ops: BlockOp[]) {
  const blocks = root.getChildren?.() ?? [];
  let cursor: LexicalNodeLike | null = null;
  for (const op of ops) {
    if (op.op === 'insert') {
      const node = createNode(editor, blockToJSON(op.block));
      place(root, cursor, node);
      cursor = node;
      continue;
    }
    const block = blocks[op.index]!;
    if (op.op === 'remove') {
      block.remove();
      continue;
    }
    if (op.op === 'setText') setElementText(editor, block, op.text);
    if (op.op === 'patchList') applyItemOps(editor, block, op.listType, op.items);
    cursor = block;
  }
}

/**
 * Make the document say `target`, merged with whatever changed in it since
 * `base`, as a single tagged Lexical update.
 */
export function applyLines(
  editor: LexicalEditorLike,
  base: string[],
  target: string[],
): ApplyResult {
  if (!editor.isEditable()) return { ok: false, reason: 'readonly' };

  let failure: string | null = null;
  try {
    editor.update(
      () => {
        const root = editor.getEditorState()._nodeMap.get('root');
        if (!root?.getChildren) {
          failure = 'The editor has no root node';
          return;
        }
        let ops: BlockOp[];
        try {
          const current = root.getChildren().map(exportNode);
          const currentLines = linesFromEditorState({ root: { type: 'root', children: current } });
          const merged = mergeLines(base, target, currentLines);
          ops = planEdits(current.map(blockFromNode), blocksFromLines(merged));
        } catch (error) {
          // Planning is pure — fail before touching the document.
          failure = error instanceof Error ? error.message : String(error);
          return;
        }
        if (!isNoop(ops)) applyBlockOps(editor, root, ops);
      },
      {
        discrete: true,
        tag: [BOARD_UPDATE_TAG, 'skip-scroll-into-view', 'skip-dom-selection'],
      },
    );
  } catch (error) {
    failure = error instanceof Error ? error.message : String(error);
  }

  if (failure) return { ok: false, reason: 'failed', message: failure };
  return { ok: true, lines: linesFromEditorState(editor.getEditorState().toJSON()) };
}

// ---------------------------------------------------------------------------
// Page wiring
// ---------------------------------------------------------------------------

type EditorElement = HTMLElement & { __lexicalEditor?: LexicalEditorLike | null };

function area(el: Element): number {
  const r = el.getBoundingClientRect();
  return r.width * r.height;
}

/**
 * Proton's document editor carries this class (`Containers/Docs/Editor.tsx` in
 * ProtonMail/WebClients). Sheets also mounts small Lexical editors (comments,
 * dialogs) with no document behind them; without this check they read as an
 * empty document.
 */
const DOCUMENT_EDITOR_SELECTOR = '[data-lexical-editor].DocumentEditor';

/** The document's main (top-level, largest) Lexical editor, if mounted. */
export function findLexicalEditor(doc: Document): LexicalEditorLike | null {
  const candidates = Array.from(doc.querySelectorAll<EditorElement>(DOCUMENT_EDITOR_SELECTOR))
    .filter((el) => el.__lexicalEditor && !el.__lexicalEditor._parentEditor)
    .sort((a, b) => area(b) - area(a));
  return candidates[0]?.__lexicalEditor ?? null;
}

const REATTACH_INTERVAL_MS = 1000;

/**
 * Attach to the editor in `doc` (re-attaching whenever Proton remounts it),
 * broadcast its state on every change, and serve requests from the content
 * script.
 */
export function startEditorBridge(doc: Document = document): () => void {
  let editor: LexicalEditorLike | null = null;
  let unregister: Array<() => void> = [];
  let lastSent: string | null = null;

  const send = (origin: EditorOrigin, force = false) => {
    if (!editor) return;
    const message: EditorStateMessage = {
      text: readEditorText(editor),
      editable: editor.isEditable(),
      origin,
    };
    const key = `${message.editable}\n${message.text}`;
    if (!force && key === lastSent) return;
    lastSent = key;
    doc.dispatchEvent(new CustomEvent(STATE_EVENT, { detail: JSON.stringify(message) }));
  };

  const attach = () => {
    const found = findLexicalEditor(doc);
    if (found === editor) return;
    unregister.forEach((fn) => fn());
    unregister = [];
    editor = found;
    lastSent = null;
    if (!editor) return;
    unregister = [
      editor.registerUpdateListener(({ tags, dirtyElements, dirtyLeaves }) => {
        // Selection-only updates don't change the document.
        if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;
        send(originFromTags(tags));
      }),
      editor.registerEditableListener(() => send('local')),
    ];
    send('initial', true);
  };

  const onRequest = (event: Event) => {
    const request = readDetail(event);
    if (!isBridgeRequest(request)) return;
    attach();
    let result: BridgeResponse['result'];
    if (request.type === 'hello') {
      send('initial', true);
      result = { ok: true };
    } else if (!editor) {
      result = { ok: false, reason: 'no-editor' };
    } else {
      result = applyLines(editor, request.base, request.target);
    }
    const response: BridgeResponse = { id: request.id, result };
    doc.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: JSON.stringify(response) }));
  };

  doc.addEventListener(REQUEST_EVENT, onRequest);
  attach();
  const timer = setInterval(attach, REATTACH_INTERVAL_MS);

  return () => {
    clearInterval(timer);
    doc.removeEventListener(REQUEST_EVENT, onRequest);
    unregister.forEach((fn) => fn());
  };
}
