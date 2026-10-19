/**
 * Contract between the content script (isolated world) and the editor bridge
 * (page / main world), which is the only side that can reach Proton's Lexical
 * editor instance.
 *
 * Both sides talk through `CustomEvent`s on the editor frame's `document`.
 * `dispatchEvent` is synchronous across worlds, so a request is answered —
 * and the resulting document state broadcast — before `dispatchEvent`
 * returns. Payloads are JSON strings so they cross the world boundary
 * unchanged in every browser.
 */

/** Bridge → content script: the document changed (or was requested). */
export const STATE_EVENT = 'pdt:editor-state';
/** Content script → bridge: a request. */
export const REQUEST_EVENT = 'pdt:editor-request';
/** Bridge → content script: the answer to a request. */
export const RESPONSE_EVENT = 'pdt:editor-response';

/** Lexical update tag marking the board's own writes. */
export const BOARD_UPDATE_TAG = 'pdt-board';

/**
 * Who changed the document:
 * - `initial` — first state after the bridge attached to the editor,
 * - `self`    — the board's own write,
 * - `remote`  — a collaborator or another device, via Proton's Yjs sync,
 * - `history` — undo / redo in Proton,
 * - `local`   — typing in Proton's editor in this tab.
 */
export type EditorOrigin = 'initial' | 'self' | 'remote' | 'history' | 'local';

export interface EditorStateMessage {
  /** Document text, one line per block / list item. */
  text: string;
  /** False while Proton has editing locked (loading, offline, read-only access). */
  editable: boolean;
  origin: EditorOrigin;
}

export type BridgeRequest =
  | { id: number; type: 'hello' }
  | {
      id: number;
      type: 'apply';
      /** The document lines the board's change is based on. */
      base: string[];
      /** The document lines the board wants. */
      target: string[];
    };

export type ApplyFailure = 'no-editor' | 'readonly' | 'failed';

export type ApplyResult =
  { ok: true; lines: string[] } | { ok: false; reason: ApplyFailure; message?: string };

export interface BridgeResponse {
  id: number;
  result: ApplyResult | { ok: true };
}
