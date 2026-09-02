// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { replaceEditorContent } from './docwriter';

/**
 * jsdom implements neither `DataTransfer` nor `ClipboardEvent` (they require
 * a real rendering/clipboard stack), so the code under test would otherwise
 * throw at `new win.DataTransfer()` and silently fall through every write
 * strategy. Install minimal stand-ins before the suite runs — just enough
 * for `docwriter.ts` to construct a paste event and read the pasted text
 * back out of it, same as a real browser would provide.
 */
beforeAll(() => {
  class FakeDataTransfer {
    private data = new Map<string, string>();
    setData(type: string, value: string): void {
      this.data.set(type, value);
    }
    getData(type: string): string {
      return this.data.get(type) ?? '';
    }
  }

  class FakeClipboardEvent extends Event {
    clipboardData: FakeDataTransfer | null;
    constructor(type: string, init?: EventInit & { clipboardData?: FakeDataTransfer }) {
      super(type, init);
      this.clipboardData = init?.clipboardData ?? null;
    }
  }

  Object.assign(window, { DataTransfer: FakeDataTransfer, ClipboardEvent: FakeClipboardEvent });
});

/**
 * A minimal stand-in for a Lexical-style editor: it keeps its own internal
 * "is everything selected" flag rather than trusting the native DOM
 * `Selection`, and only replaces its content on `paste` when that internal
 * flag says so — otherwise it appends, exactly like the real editor did when
 * the write path only set a native `Range`/`Selection` without ever running
 * the editor's own select-all handling. This reproduces the reported bug:
 * every board edit re-serializes the *whole* model (see `serializeModel`),
 * so if a write appends instead of replaces, the document accumulates every
 * prior full snapshot back to back.
 */
function createFakeLexicalEditor(initialText: string): HTMLElement {
  const root = document.createElement('div');
  root.contentEditable = 'true';
  root.textContent = initialText;
  document.body.appendChild(root);

  let internallySelectedAll = false;

  root.addEventListener('keydown', (event) => {
    const ke = event as KeyboardEvent;
    if ((ke.ctrlKey || ke.metaKey) && ke.key.toLowerCase() === 'a') {
      internallySelectedAll = true;
      ke.preventDefault();
    }
  });

  root.addEventListener('paste', (event) => {
    const ce = event as ClipboardEvent;
    const pasted = ce.clipboardData?.getData('text/plain') ?? '';
    root.textContent = internallySelectedAll ? pasted : (root.textContent ?? '') + pasted;
    internallySelectedAll = false;
    ce.preventDefault();
  });

  return root;
}

describe('replaceEditorContent', () => {
  it('replaces the whole document instead of appending on an editor with its own internal selection model', () => {
    const root = createFakeLexicalEditor('#!tasks\n\n## To Do\n\n## Done');

    const ok = replaceEditorContent(root, '#!tasks\n\n## To Do\n- [ ] first\n\n## Done');
    expect(ok).toBe(true);
    expect(root.textContent).toBe('#!tasks\n\n## To Do\n- [ ] first\n\n## Done');

    // A second write must still fully replace, not pile on top of the first.
    const ok2 = replaceEditorContent(
      root,
      '#!tasks\n\n## To Do\n- [ ] first\n- [ ] second\n\n## Done',
    );
    expect(ok2).toBe(true);
    expect(root.textContent).toBe('#!tasks\n\n## To Do\n- [ ] first\n- [ ] second\n\n## Done');
  });
});
