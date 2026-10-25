/**
 * The content-script side of the editor bridge (see `bridgeProtocol.ts`).
 * Tracks the document state the bridge broadcasts and forwards writes to it.
 */

import {
  isBridgeResponse,
  isEditorStateMessage,
  readDetail,
  REQUEST_EVENT,
  RESPONSE_EVENT,
  STATE_EVENT,
  type ApplyResult,
  type BridgeRequest,
  type BridgeResponse,
  type EditorStateMessage,
} from './bridgeProtocol';

export interface EditorClient {
  /** The latest document state, or null before the bridge reported one. */
  readonly state: EditorStateMessage | null;
  /** Resolves with the first state the bridge reports. */
  readonly ready: Promise<EditorStateMessage>;
  subscribe(listener: (state: EditorStateMessage) => void): () => void;
  /**
   * Write `target` into the document, merged with any change made since
   * `base`. Synchronous: the result — and the resulting state broadcast —
   * are in before this returns.
   */
  apply(base: string[], target: string[]): ApplyResult;
  stop(): void;
}

/**
 * Delays between `hello`s: 500 ms doubling up to 10 s, then the client stops
 * asking. A bridge that finds an editor later broadcasts it on its own, so
 * a late editor still connects; asking only covers a bridge that attached
 * before this script listened.
 */
export const HELLO_DELAYS_MS = [500, 1000, 2000, 4000, 8000, 10_000, 10_000, 10_000];

export function connectEditor(doc: Document = document): EditorClient {
  let state: EditorStateMessage | null = null;
  const listeners = new Set<(state: EditorStateMessage) => void>();
  let nextId = 1;
  let resolveReady!: (state: EditorStateMessage) => void;
  const ready = new Promise<EditorStateMessage>((resolve) => (resolveReady = resolve));

  const onState = (event: Event) => {
    const next = readDetail(event);
    if (!isEditorStateMessage(next)) return;
    state = next;
    resolveReady(next);
    listeners.forEach((listener) => listener(next));
  };

  const request = (
    body: Omit<Extract<BridgeRequest, { type: 'apply' }>, 'id'> | { type: 'hello' },
  ) => {
    const id = nextId++;
    let response: BridgeResponse | null = null;
    const onResponse = (event: Event) => {
      const parsed = readDetail(event);
      if (isBridgeResponse(parsed) && parsed.id === id) response = parsed;
    };
    doc.addEventListener(RESPONSE_EVENT, onResponse);
    try {
      doc.dispatchEvent(
        new CustomEvent(REQUEST_EVENT, { detail: JSON.stringify({ ...body, id }) }),
      );
    } finally {
      doc.removeEventListener(RESPONSE_EVENT, onResponse);
    }
    return response as BridgeResponse | null;
  };

  doc.addEventListener(STATE_EVENT, onState);

  // The bridge may load before or after us; ask, backing off, until it
  // answers with a state.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const hello = (attempt: number) => {
    if (state) return;
    request({ type: 'hello' });
    const delay = HELLO_DELAYS_MS[attempt];
    if (delay !== undefined) timer = setTimeout(() => hello(attempt + 1), delay);
  };
  hello(0);

  return {
    get state() {
      return state;
    },
    ready,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    apply(base, target) {
      const response = request({ type: 'apply', base, target });
      if (!response) return { ok: false, reason: 'no-editor' };
      return response.result as ApplyResult;
    },
    stop() {
      clearTimeout(timer);
      doc.removeEventListener(STATE_EVENT, onState);
      listeners.clear();
    },
  };
}
