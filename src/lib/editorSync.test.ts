// @vitest-environment jsdom
/**
 * Board writes travel to other devices through Proton's Yjs collaboration.
 * These tests wire two real Lexical editors together with `@lexical/yjs`, the
 * same way Proton's CollaborationPlugin does, and check that board writes sync
 * and that concurrent edits from two devices merge instead of clobbering.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { $createParagraphNode, $getRoot, createEditor, type LexicalEditor } from 'lexical';
import { ListItemNode, ListNode } from '@lexical/list';
import { HeadingNode } from '@lexical/rich-text';
import {
  createBinding,
  syncLexicalUpdateToYjs,
  syncYjsChangesToLexical,
  type Provider,
} from '@lexical/yjs';
import * as Y from 'yjs';
import { applyLines, readEditorText, type LexicalEditorLike } from './editorBridge';

const fakeProvider = (): Provider =>
  ({
    awareness: {
      getLocalState: () => null,
      setLocalState: () => {},
      getStates: () => new Map(),
      on: () => {},
      off: () => {},
    },
    connect: () => {},
    disconnect: () => {},
    on: () => {},
    off: () => {},
  }) as unknown as Provider;

interface Device {
  editor: LexicalEditor;
  doc: Y.Doc;
  tags: string[][];
}

/** A Lexical editor bound to its own Y.Doc, like one Proton Docs tab. */
function device(): Device {
  const editor = createEditor({
    namespace: 'test',
    nodes: [HeadingNode, ListNode, ListItemNode],
    onError: (error) => {
      throw error;
    },
  });
  const doc = new Y.Doc();
  const docMap = new Map([['main', doc]]);
  const provider = fakeProvider();
  const binding = createBinding(editor, provider, 'main', doc, docMap);
  const tags: string[][] = [];

  binding.root.getSharedType().observeDeep((events, transaction) => {
    if (transaction.origin !== binding) {
      syncYjsChangesToLexical(binding, provider, events, false);
    }
  });
  editor.registerUpdateListener(
    ({ prevEditorState, editorState, dirtyElements, dirtyLeaves, normalizedNodes, tags: t }) => {
      tags.push([...t]);
      syncLexicalUpdateToYjs(
        binding,
        provider,
        prevEditorState,
        editorState,
        dirtyElements,
        dirtyLeaves,
        normalizedNodes,
        t,
      );
    },
  );
  return { editor, doc, tags };
}

/** Relay Yjs updates between devices; `online = false` queues them. */
function network(a: Device, b: Device) {
  let online = true;
  const queue: Array<() => void> = [];
  const relay = (from: Device, to: Device) =>
    from.doc.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin === 'network') return;
      const deliver = () => Y.applyUpdate(to.doc, update, 'network');
      if (online) deliver();
      else queue.push(deliver);
    });
  relay(a, b);
  relay(b, a);
  return {
    offline: () => (online = false),
    online: () => {
      online = true;
      queue.splice(0).forEach((deliver) => deliver());
    },
  };
}

const lines = (d: Device) => readEditorText(d.editor as unknown as LexicalEditorLike).split('\n');
const flushUpdates = () => new Promise((resolve) => setTimeout(resolve, 0));
const write = (d: Device, base: string[], target: string[]) =>
  applyLines(d.editor as unknown as LexicalEditorLike, base, target);

const DOC = ['#!tasks Board', '', '## A', '- [ ] one', '- [ ] two', '', '## B', '- [ ] three'];
const tick = (doc: string[], ...titles: string[]) =>
  doc.map((line) =>
    titles.some((t) => line === `- [ ] ${t}`) ? line.replace('[ ]', '[x]') : line,
  );

describe('board writes over Proton-style Yjs collaboration', () => {
  let a: Device;
  let b: Device;
  let net: ReturnType<typeof network>;

  beforeEach(async () => {
    a = device();
    b = device();
    net = network(a, b);
    a.editor.update(() => $getRoot().append($createParagraphNode()), { discrete: true });
    await flushUpdates();
    expect(write(a, [''], DOC).ok).toBe(true);
    await flushUpdates();
  });

  it('syncs a board write to the other device as a collaboration update', async () => {
    expect(lines(b)).toEqual(DOC);
    expect(b.tags.some((t) => t.includes('collaboration'))).toBe(true);
  });

  it('merges concurrent edits to different tasks from two devices', async () => {
    net.offline();
    expect(write(a, DOC, tick(DOC, 'one')).ok).toBe(true);
    expect(write(b, DOC, tick(DOC, 'three')).ok).toBe(true);
    net.online();
    await flushUpdates();
    expect(lines(a)).toEqual(tick(DOC, 'one', 'three'));
    expect(lines(b)).toEqual(tick(DOC, 'one', 'three'));
  });

  it('merges a task added on one device with a tick on the other in the same section', async () => {
    net.offline();
    const added = [...DOC.slice(0, 5), '- [ ] four', ...DOC.slice(5)];
    expect(write(a, DOC, added).ok).toBe(true);
    expect(write(b, DOC, tick(DOC, 'two')).ok).toBe(true);
    net.online();
    await flushUpdates();
    const expected = tick(added, 'two');
    expect(lines(a)).toEqual(expected);
    expect(lines(b)).toEqual(expected);
  });

  it('folds a change that already arrived into a write based on an older document', async () => {
    expect(write(b, DOC, tick(DOC, 'three')).ok).toBe(true);
    await flushUpdates();
    // Device A's board still holds DOC as its base when it ticks "one".
    const res = write(a, DOC, tick(DOC, 'one'));
    await flushUpdates();
    expect(res.ok && res.lines).toEqual(tick(DOC, 'one', 'three'));
    expect(lines(b)).toEqual(tick(DOC, 'one', 'three'));
  });
});
