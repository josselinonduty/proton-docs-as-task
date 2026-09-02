/**
 * Writes plain text back into the Proton Docs (Lexical) editor.
 *
 * The board is authoritative while open, so every edit re-serializes the whole
 * model and replaces the document content wholesale. Proton renders inside a
 * Lexical contenteditable; the most reliable way to hand it structured,
 * multi-paragraph text (so headings and task lines land on their own blocks)
 * is a synthetic `paste` — Lexical listens for paste events and rebuilds nodes
 * from the `text/plain` payload. We fall back to `insertText` if nothing
 * handles the paste.
 */

/**
 * Simulate the platform "select all" keyboard shortcut on `root`.
 *
 * Rich-text editors like Lexical keep their own internal selection model —
 * they don't read the native DOM `Selection` synchronously. They resync it
 * from the browser's `selectionchange` event, which fires asynchronously, so
 * a `Range`/`Selection` set immediately before a synthetic `paste` is still
 * stale from the editor's point of view: the paste lands at whatever the
 * editor's internal cursor last was (often the end of the document) instead
 * of replacing the selection, which is what turns every write into an append
 * rather than a replace. Dispatching a real Ctrl/Cmd+A keydown instead runs
 * the editor's own select-all handler synchronously against its internal
 * model, so the selection is actually current by the time paste fires.
 */
function dispatchSelectAllShortcut(root: HTMLElement, win: Window & typeof globalThis): void {
  const event = new win.KeyboardEvent('keydown', {
    key: 'a',
    code: 'KeyA',
    ctrlKey: true,
    metaKey: true,
    bubbles: true,
    cancelable: true,
  });
  root.dispatchEvent(event);
}

/** Select the entire editor content so the next insertion replaces it. */
function selectAll(root: HTMLElement): Selection | null {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  const selection = win?.getSelection() ?? null;
  root.focus();
  if (win) dispatchSelectAllShortcut(root, win);
  if (!selection) return null;
  const range = doc.createRange();
  range.selectNodeContents(root);
  selection.removeAllRanges();
  selection.addRange(range);
  return selection;
}

/**
 * Replace the editor's whole content with `text`. Returns true when a write
 * strategy was dispatched. Callers treat the doc as authoritative afterwards.
 */
export function replaceEditorContent(root: HTMLElement, text: string): boolean {
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  if (!win) return false;
  if (!selectAll(root)) return false;

  // Strategy 1: synthetic paste. Lexical reconstructs blocks from the
  // newline-delimited plain text, replacing the current selection.
  try {
    const data = new win.DataTransfer();
    data.setData('text/plain', text);
    const pasteEvent = new win.ClipboardEvent('paste', {
      clipboardData: data,
      bubbles: true,
      cancelable: true,
    });
    // dispatchEvent returns false when a listener called preventDefault —
    // i.e. the editor consumed the paste and is rebuilding its content.
    if (!root.dispatchEvent(pasteEvent)) return true;
  } catch {
    // Some engines forbid constructing a populated ClipboardEvent — fall through.
  }

  // Strategy 2: execCommand insertText on the still-selected content.
  try {
    if (doc.execCommand('insertText', false, text)) return true;
  } catch {
    // ignore — reported below
  }
  return false;
}

type CaretHolder = HTMLInputElement | HTMLTextAreaElement;

/** Drill through open shadow roots to find the truly focused element. */
function deepActiveElement(doc: Document): Element | null {
  let el: Element | null = doc.activeElement;
  while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
  return el;
}

function isCaretHolder(el: Element | null): el is CaretHolder {
  return el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement;
}

/**
 * Replace the editor content while preserving the caret in whatever board input
 * the user is editing. Writing to the editor necessarily focuses it, which
 * would otherwise steal focus from the overlay mid-edit, so we snapshot the
 * focused control and its selection and restore them synchronously afterwards.
 */
export function writePreservingFocus(root: HTMLElement, text: string): boolean {
  const doc = root.ownerDocument;
  const active = deepActiveElement(doc);
  let restore: (() => void) | undefined;
  if (isCaretHolder(active) && active !== root) {
    const start = active.selectionStart;
    const end = active.selectionEnd;
    restore = () => {
      try {
        active.focus();
        if (start != null && end != null) active.setSelectionRange(start, end);
      } catch {
        // element may have unmounted — nothing to restore
      }
    };
  }

  const wrote = replaceEditorContent(root, text);
  restore?.();
  return wrote;
}
