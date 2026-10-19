// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  createEditor,
  type LexicalEditor,
  type LexicalNode,
} from 'lexical';
import {
  $isListNode,
  ListItemNode,
  ListNode,
  type ListType,
  type SerializedListNode,
} from '@lexical/list';
import { HeadingNode } from '@lexical/rich-text';
import {
  applyLines,
  findLexicalEditor,
  startEditorBridge,
  type LexicalEditorLike,
} from './editorBridge';
import { connectEditor, type EditorClient } from './editorClient';
import type { EditorStateMessage } from './bridgeProtocol';

/** Proton replaces Lexical's ListNode with its own `custom-list` node. */
class CustomListNode extends ListNode {
  static override getType() {
    return 'custom-list';
  }
  static override clone(node: CustomListNode) {
    return new CustomListNode(node.__listType, node.__start, node.__key);
  }
  static override importJSON(json: SerializedListNode) {
    return new CustomListNode(json.listType, json.start).updateFromJSON(json);
  }
}

/** An editor configured with the nodes Proton registers for task documents. */
function protonLikeEditor(): LexicalEditor {
  return createEditor({
    namespace: 'test',
    onError: (error) => {
      throw error;
    },
    nodes: [
      HeadingNode,
      ListNode,
      ListItemNode,
      CustomListNode,
      {
        replace: ListNode,
        with: (node: ListNode) => new CustomListNode(node.__listType as ListType, node.__start),
        withKlass: CustomListNode,
      },
    ],
  });
}

const lexical = (editor: LexicalEditor) => editor as unknown as LexicalEditorLike;

function seedParagraphs(editor: LexicalEditor, lines: string[]) {
  editor.update(
    () => {
      const root = $getRoot();
      root.clear();
      for (const line of lines) {
        const p = $createParagraphNode();
        if (line) p.append($createTextNode(line));
        root.append(p);
      }
    },
    { discrete: true },
  );
}

/** Node keys of the root's children and of each list's items. */
function shape(editor: LexicalEditor): Array<[string, string, string[]]> {
  return editor.getEditorState().read(() =>
    $getRoot()
      .getChildren()
      .map((node: LexicalNode) => [
        node.getType(),
        node.getKey(),
        $isListNode(node) ? node.getChildren().map((i) => i.getKey()) : [],
      ]),
  );
}

const DOC = ['#!tasks Board', '', '## A', '- [ ] one', '- [ ] two', '', '## B', '- [ ] three'];

describe('applyLines', () => {
  let editor: LexicalEditor;

  beforeEach(() => {
    editor = protonLikeEditor();
    seedParagraphs(editor, ['']);
  });

  const apply = (base: string[], target: string[]) => applyLines(lexical(editor), base, target);

  it('writes native headings and check lists', () => {
    const res = apply([''], DOC);
    expect(res).toEqual({ ok: true, lines: DOC });
    expect(shape(editor).map(([type]) => type)).toEqual([
      'paragraph',
      'paragraph',
      'heading',
      'custom-list',
      'paragraph',
      'heading',
      'custom-list',
    ]);
  });

  it('only touches what changed, keeping every other Lexical node', () => {
    apply([''], DOC);
    const before = shape(editor);
    const next = DOC.map((line) => (line === '- [ ] one' ? '- [x] one' : line));
    expect(apply(DOC, next)).toEqual({ ok: true, lines: next });
    // Same nodes, same keys — the item was ticked in place.
    expect(shape(editor)).toEqual(before);
  });

  it('moves a task between sections without recreating the other items', () => {
    apply([''], DOC);
    const before = shape(editor);
    const next = ['#!tasks Board', '', '## A', '- [ ] two', '', '## B', '- [ ] three', '- [ ] one'];
    expect(apply(DOC, next)).toEqual({ ok: true, lines: next });
    const after = shape(editor);
    expect(after.map(([type, key]) => [type, key])).toEqual(
      before.map(([type, key]) => [type, key]),
    );
    expect(after[3]![2]).toEqual([before[3]![2][1]]);
    expect(after[6]![2].slice(0, 1)).toEqual(before[6]![2]);
  });

  it('merges a change made elsewhere instead of overwriting it', () => {
    apply([''], DOC);
    // A collaborator ticks "three" while the board still holds the old document.
    const remote = DOC.map((line) => (line === '- [ ] three' ? '- [x] three' : line));
    expect(apply(DOC, remote).ok).toBe(true);
    // The board, based on DOC, ticks "one".
    const board = DOC.map((line) => (line === '- [ ] one' ? '- [x] one' : line));
    const res = apply(DOC, board);
    expect(res.ok && res.lines).toEqual(
      DOC.map((line) =>
        line === '- [ ] one' ? '- [x] one' : line === '- [ ] three' ? '- [x] three' : line,
      ),
    );
  });

  it('converts legacy plain-paragraph boards to native blocks with the same text', () => {
    seedParagraphs(editor, DOC);
    expect(apply(DOC, DOC)).toEqual({ ok: true, lines: DOC });
    expect(shape(editor).map(([type]) => type)).toContain('custom-list');
  });

  it('refuses to write while Proton has editing locked', () => {
    seedParagraphs(editor, DOC);
    editor.setEditable(false);
    expect(apply(DOC, ['#!tasks'])).toEqual({ ok: false, reason: 'readonly' });
  });

  it('is a no-op when the document already matches', () => {
    apply([''], DOC);
    const before = editor.getEditorState();
    expect(apply(DOC, DOC)).toEqual({ ok: true, lines: DOC });
    expect(editor.getEditorState()).toBe(before);
  });
});

describe('editor bridge ↔ client', () => {
  let editor: LexicalEditor;
  let stopBridge: () => void;
  let client: EditorClient;
  let states: EditorStateMessage[];

  beforeEach(() => {
    const root = document.createElement('div');
    root.contentEditable = 'true';
    root.setAttribute('data-lexical-editor', 'true');
    root.className = 'DocumentEditor';
    document.body.append(root);
    editor = protonLikeEditor();
    editor.setRootElement(root);
    seedParagraphs(editor, DOC);

    client = connectEditor(document);
    stopBridge = startEditorBridge(document);
    states = [];
    client.subscribe((s) => states.push(s));
  });

  afterEach(() => {
    client.stop();
    stopBridge();
    editor.setRootElement(null);
    document.body.innerHTML = '';
  });

  it('reports the initial document', async () => {
    const initial = await client.ready;
    expect(initial).toEqual({ text: DOC.join('\n'), editable: true, origin: 'initial' });
  });

  it('writes synchronously and tags the resulting state as the board’s own', () => {
    const next = DOC.map((line) => (line === '- [ ] two' ? '- [x] two' : line));
    expect(client.apply(DOC, next)).toEqual({ ok: true, lines: next });
    expect(states.at(-1)).toEqual({ text: next.join('\n'), editable: true, origin: 'self' });
  });

  it('tells collaborator updates apart from local typing', () => {
    editor.update(
      () => {
        $getRoot()
          .getFirstChild()!
          .insertAfter($createParagraphNode().append($createTextNode('x')));
      },
      { discrete: true, tag: 'collaboration' },
    );
    expect(states.at(-1)?.origin).toBe('remote');
    editor.update(
      () => {
        $getRoot()
          .getFirstChild()!
          .insertAfter($createParagraphNode().append($createTextNode('y')));
      },
      { discrete: true },
    );
    expect(states.at(-1)?.origin).toBe('local');
  });

  it('reports editing locks', () => {
    editor.setEditable(false);
    expect(states.at(-1)?.editable).toBe(false);
    expect(client.apply(DOC, ['#!tasks'])).toEqual({ ok: false, reason: 'readonly' });
  });
});

describe('findLexicalEditor', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('ignores Lexical editors that are not the document editor (e.g. in Sheets)', () => {
    const root = document.createElement('div');
    root.contentEditable = 'true';
    root.setAttribute('data-lexical-editor', 'true');
    document.body.append(root);
    const editor = protonLikeEditor();
    editor.setRootElement(root);

    expect(findLexicalEditor(document)).toBeNull();

    root.className = 'DocumentEditor';
    expect(findLexicalEditor(document)).not.toBeNull();
    editor.setRootElement(null);
  });
});
