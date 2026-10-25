/**
 * The board's side of document sync: a small store, free of React, that keeps
 * the open board and the Proton document in step.
 *
 * The document is the single source of truth and the board follows it live:
 * - A board edit is written through the editor bridge as one tagged Lexical
 *   update, merged with anything that changed in the document since the board
 *   last read it — so Proton's own Yjs sync and saving carry it, and nothing
 *   written elsewhere is overwritten.
 * - A change made anywhere else (another device, a collaborator, typing or
 *   undo in Proton) is folded into the open board immediately, unless a board
 *   edit is still pending — then the merge at write time takes care of it.
 * - While Proton has editing locked, edits stay pending and are written as
 *   soon as it unlocks.
 *
 * The UI reads it through `subscribe` / `getSnapshot` (`useSyncExternalStore`);
 * a snapshot is a new object only when something in it changed.
 */

import type { ApplyResult, EditorStateMessage } from './bridgeProtocol';
import type { EditorClient } from './editorClient';
import { fromParseResult, serializeModel, type BoardModel } from './model';
import { parseDocument } from './parser';
import { canonicalDoc, canonicalModel, hasRedundantStatus, reconcileIds } from './sync';
import type { ParseResult, SaveState } from './types';

/** Coalesces keystroke-level edits (e.g. typing a title) into one write. */
export const WRITE_DEBOUNCE_MS = 300;
/** How long an undo stays on offer. */
export const UNDO_TIMEOUT_MS = 9000;

export interface UndoEntry {
  /** The board as it was before the edit. */
  model: BoardModel;
  label: string;
}

/** Something worth telling the user (the UI turns it into an announcement). */
export type BoardNotice = 'updated' | 'undone' | 'reloaded';

export interface BoardSessionSnapshot {
  /** The latest document state the bridge reported. */
  docState: EditorStateMessage;
  /** The board shown, or null while it is closed. */
  model: BoardModel | null;
  saveState: SaveState;
  undo: UndoEntry | null;
}

export interface BoardSessionOptions {
  /** The editor bridge, or a stand-in for it. Only `state`, `subscribe` and `apply` are used. */
  client: Pick<EditorClient, 'state' | 'subscribe' | 'apply'>;
  /** The document state the board starts from. */
  initialState: EditorStateMessage;
  /** The activation markers in use (`settings.markers`). */
  markers: string[];
}

export interface BoardSession {
  subscribe(listener: () => void): () => void;
  getSnapshot(): BoardSessionSnapshot;
  /** Listen for notices; returns the unsubscribe function. */
  onNotice(listener: (notice: BoardNotice) => void): () => void;

  /** Follow the document. Catches up on any state reported since `initialState`. */
  start(): void;
  /** Write any pending edit and stop following the document. `start` may be called again. */
  dispose(): void;
  setMarkers(markers: string[]): void;

  /** Show the board, from a pending edit if one waits, else from the document. */
  open(): void;
  /** Write any pending edit and drop the board. */
  close(): void;
  /** Drop the board without writing (the document stopped being a task board). */
  clear(): void;
  /** Turn the (empty) document into a task board with `starter`. */
  convert(starter: BoardModel): void;

  /** A board edit from the UI: show it, offer to undo it when labelled, write it debounced. */
  edit(next: BoardModel, undoLabel?: string): void;
  /**
   * Show `next` and write it (debounced unless `immediate`). Returns false
   * when an immediate write failed; the edit then stays pending.
   */
  commit(next: BoardModel, immediate?: boolean): boolean;
  /** Write the pending edit now. Returns false when it couldn't be written. */
  flush(): boolean;
  /** Revert the last labelled edit. */
  undo(): void;
  /** Retry a failed write (or clear a stale error). */
  retry(): void;
  /** Discard any pending edit and show the board as the document has it. */
  reload(): void;

  /** The current document, parsed with the session's markers. */
  readDocument(): ParseResult;
  /** Write `next` straight into the document, bypassing the board (used while it is closed). */
  write(next: BoardModel): ApplyResult;
  /** True while a board edit is not yet in the document. */
  hasPending(): boolean;
}

export function createBoardSession({
  client,
  initialState,
  markers: initialMarkers,
}: BoardSessionOptions): BoardSession {
  let snapshot: BoardSessionSnapshot = {
    docState: initialState,
    model: null,
    saveState: 'saved',
    undo: null,
  };
  const listeners = new Set<() => void>();
  const noticeListeners = new Set<(notice: BoardNotice) => void>();

  let markers = initialMarkers;
  /** The latest document lines, updated synchronously by the bridge. */
  let docLines = initialState.text.split('\n');
  /** The document lines the board's model reflects — the merge base for writes. */
  let baseLines = docLines;
  /** A board model not yet written to the document. */
  let pending: BoardModel | null = null;
  let writeTimer: ReturnType<typeof setTimeout> | undefined;
  let undoTimer: ReturnType<typeof setTimeout> | undefined;
  /** The last state handled, so `start` only catches up on newer ones. */
  let seenState = initialState;
  let unsubscribe: (() => void) | null = null;

  let parsedText: string | null = null;
  let parsedMarkers: string[] | null = null;
  let parsed!: ParseResult;
  const parse = (text: string) => {
    if (text !== parsedText || markers !== parsedMarkers) {
      parsed = parseDocument(text, markers);
      parsedText = text;
      parsedMarkers = markers;
    }
    return parsed;
  };

  // The marker board writes start with. Like the board's own view of the
  // document, it moves on once a reported state has been handled.
  const markerOf = (text: string) => parse(text).matchedMarker ?? markers[0] ?? '#!tasks';
  let marker = markerOf(initialState.text);

  const update = (patch: Partial<BoardSessionSnapshot>) => {
    const keys = Object.keys(patch) as (keyof BoardSessionSnapshot)[];
    if (keys.every((key) => snapshot[key] === patch[key])) return;
    if ('undo' in patch && patch.undo !== snapshot.undo) scheduleUndoExpiry(patch.undo ?? null);
    snapshot = { ...snapshot, ...patch };
    listeners.forEach((listener) => listener());
  };

  const notify = (notice: BoardNotice) => noticeListeners.forEach((listener) => listener(notice));

  // Auto-dismiss an undo after a while; a newer one restarts the clock.
  const scheduleUndoExpiry = (entry: UndoEntry | null) => {
    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = entry ? setTimeout(() => update({ undo: null }), UNDO_TIMEOUT_MS) : undefined;
  };

  const clearWriteTimer = () => {
    if (writeTimer) clearTimeout(writeTimer);
    writeTimer = undefined;
  };

  /**
   * Bring the open board in line with `lines` (the current document) — a
   * no-op when they already mean the same board. Returns true if it changed.
   */
  const followDocument = (lines: string[]) => {
    baseLines = lines;
    const current = snapshot.model;
    if (!current) return false;
    const docText = lines.join('\n');
    if (canonicalDoc(docText, markers) === canonicalModel(current, marker)) return false;
    // An undo snapshot would now also revert the change made elsewhere.
    update({ model: reconcileIds(current, fromParseResult(parse(docText))), undo: null });
    return true;
  };

  const flush = () => {
    clearWriteTimer();
    const next = pending;
    if (!next) return true;

    const target = serializeModel(next, marker).split('\n');
    const res = client.apply(baseLines, target);
    if (!res.ok) {
      // Keep the edit pending: it is retried when Proton unlocks editing, or
      // from the Retry action.
      update({ saveState: res.reason === 'readonly' ? 'paused' : 'error' });
      if (res.reason !== 'readonly') console.warn('[proton-docs-as-task] write failed', res);
      return false;
    }
    pending = null;
    docLines = res.lines;
    update({ saveState: 'saved' });
    // The merge may have folded in changes made elsewhere; show them.
    if (snapshot.model === next) {
      if (followDocument(res.lines)) notify('updated');
    } else {
      baseLines = res.lines;
    }
    return true;
  };

  const commit = (next: BoardModel, immediate = false) => {
    update({ model: next });
    pending = next;
    clearWriteTimer();
    if (immediate) return flush();
    update({ saveState: 'saving' });
    writeTimer = setTimeout(flush, WRITE_DEBOUNCE_MS);
    return true;
  };

  const handleState = (state: EditorStateMessage) => {
    seenState = state;
    const lines = state.text.split('\n');
    docLines = lines;
    update({ docState: state });
    // Our own write — `flush` already accounted for it.
    if (state.origin === 'self') return;
    if (pending) {
      // Editing just unlocked: write what queued up meanwhile.
      if (state.editable && !writeTimer) flush();
      return;
    }
    if (followDocument(lines)) notify('updated');
  };
  const onState = (state: EditorStateMessage) => {
    handleState(state);
    marker = markerOf(state.text);
  };

  const readDocument = () => parse(docLines.join('\n'));

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    getSnapshot: () => snapshot,
    onNotice(listener) {
      noticeListeners.add(listener);
      return () => void noticeListeners.delete(listener);
    },

    start() {
      if (unsubscribe) return;
      unsubscribe = client.subscribe(onState);
      // Catch up on anything reported before we subscribed (e.g. Proton still
      // loading the document while the overlay mounted).
      if (client.state && client.state !== seenState) onState(client.state);
    },
    dispose() {
      flush();
      unsubscribe?.();
      unsubscribe = null;
      scheduleUndoExpiry(null);
    },
    setMarkers(next) {
      markers = next;
      marker = markerOf(snapshot.docState.text);
    },

    open() {
      if (snapshot.model) return;
      // An edit still waiting for Proton to unlock is newer than the document.
      if (pending) {
        update({ model: pending });
        return;
      }
      const doc = readDocument();
      baseLines = docLines;
      const next = fromParseResult(doc);
      update({ model: next });
      // Normalize hand-written status tokens into the checkbox right away.
      if (hasRedundantStatus(doc)) commit(next, true);
    },
    close() {
      flush();
      update({ model: null, undo: null });
    },
    clear() {
      update({ model: null });
    },
    convert(starter) {
      baseLines = docLines;
      commit(starter, true);
    },

    edit(next, undoLabel) {
      if (undoLabel && snapshot.model)
        update({ undo: { model: snapshot.model, label: undoLabel } });
      commit(next);
    },
    commit,
    flush,
    undo() {
      const entry = snapshot.undo;
      if (!entry) return;
      commit(entry.model);
      update({ undo: null });
      notify('undone');
    },
    retry() {
      if (pending) flush();
      else update({ saveState: 'saved' });
    },
    reload() {
      clearWriteTimer();
      pending = null;
      baseLines = docLines;
      update({ model: fromParseResult(readDocument()), undo: null, saveState: 'saved' });
      notify('reloaded');
    },

    readDocument,
    write(next) {
      const res = client.apply(docLines, serializeModel(next, marker).split('\n'));
      if (res.ok) docLines = res.lines;
      return res;
    },
    hasPending: () => pending != null,
  };
}
