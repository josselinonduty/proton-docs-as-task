/**
 * The content-script side of the editor bridge (see `bridgeProtocol.ts`).
 * Tracks the document state the bridge broadcasts and forwards writes to it.
 */

import {
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

const HELLO_INTERVAL_MS = 500;

export function connectEditor(doc: Document = document): EditorClient {
  let state: EditorStateMessage | null = null;
  const listeners = new Set<(state: EditorStateMessage) => void>();
  let nextId = 1;
  let resolveReady!: (state: EditorStateMessage) => void;
  const ready = new Promise<EditorStateMessage>((resolve) => (resolveReady = resolve));

  const onState = (event: Event) => {
    try {
      state = JSON.parse(String((event as CustomEvent).detail)) as EditorStateMessage;
    } catch {
      return;
    }
    resolveReady(state);
    listeners.forEach((listener) => listener(state!));
  };

  const request = (
    body: Omit<Extract<BridgeRequest, { type: 'apply' }>, 'id'> | { type: 'hello' },
  ) => {
    const id = nextId++;
    let response: BridgeResponse | null = null;
    const onResponse = (event: Event) => {
      try {
        const parsed = JSON.parse(String((event as CustomEvent).detail)) as BridgeResponse;
        if (parsed.id === id) response = parsed;
      } catch {
        // not ours
      }
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

  // The bridge may load before or after us; ask until it answers with a state.
  const hello = () => {
    if (state) return;
    request({ type: 'hello' });
  };
  hello();
  const timer = setInterval(() => (state ? clearInterval(timer) : hello()), HELLO_INTERVAL_MS);

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
      clearInterval(timer);
      doc.removeEventListener(STATE_EVENT, onState);
      listeners.clear();
    },
  };
}
