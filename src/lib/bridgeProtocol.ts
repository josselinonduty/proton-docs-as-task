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

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------
//
// Any script on the page can dispatch these events, so each side checks a
// payload's shape before using it and drops anything else.

type Fields<T> = { [K in keyof T]?: unknown };

const ORIGINS: readonly string[] = ['initial', 'self', 'remote', 'history', 'local'];
const APPLY_FAILURES: readonly string[] = ['no-editor', 'readonly', 'failed'];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isLines = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((line) => typeof line === 'string');

const isId = (value: unknown): value is number => Number.isSafeInteger(value);

export function isEditorStateMessage(data: unknown): data is EditorStateMessage {
  if (!isObject(data)) return false;
  const message = data as Fields<EditorStateMessage>;
  return (
    typeof message.text === 'string' &&
    typeof message.editable === 'boolean' &&
    ORIGINS.includes(message.origin as string)
  );
}

export function isBridgeRequest(data: unknown): data is BridgeRequest {
  if (!isObject(data) || !isId(data.id)) return false;
  if (data.type === 'hello') return true;
  const request = data as Fields<Extract<BridgeRequest, { type: 'apply' }>>;
  return request.type === 'apply' && isLines(request.base) && isLines(request.target);
}

function isResult(data: unknown): data is BridgeResponse['result'] {
  if (!isObject(data)) return false;
  if (data.ok === true) return data.lines === undefined || isLines(data.lines);
  const failure = data as Fields<Extract<ApplyResult, { ok: false }>>;
  return (
    failure.ok === false &&
    APPLY_FAILURES.includes(failure.reason as string) &&
    (failure.message === undefined || typeof failure.message === 'string')
  );
}

export function isBridgeResponse(data: unknown): data is BridgeResponse {
  return isObject(data) && isId(data.id) && isResult(data.result);
}

/** The JSON payload of a bridge event, or undefined when it isn't JSON text. */
export function readDetail(event: Event): unknown {
  const detail = (event as CustomEvent).detail;
  if (typeof detail !== 'string') return undefined;
  try {
    return JSON.parse(detail);
  } catch {
    return undefined;
  }
}
