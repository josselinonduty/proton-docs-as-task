/**
 * Playground stand-in for WXT's `#imports` storage API: items live in
 * `localStorage` so settings survive a reload, and `watch` fires on writes from
 * this page (e.g. the playground's settings controls).
 */
type Listener<T> = (value: T) => void;

const listeners = new Map<string, Set<Listener<unknown>>>();

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(`pdt-playground:${key}`);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export const storage = {
  defineItem<T>(key: string, opts: { fallback: T }) {
    return {
      async getValue(): Promise<T> {
        return read(key, opts.fallback);
      },
      async setValue(value: T): Promise<void> {
        try {
          localStorage.setItem(`pdt-playground:${key}`, JSON.stringify(value));
        } catch {
          // Storage unavailable (private mode); keep running in memory.
        }
        listeners.get(key)?.forEach((fn) => fn(value));
      },
      watch(fn: Listener<T>) {
        const set = listeners.get(key) ?? new Set();
        set.add(fn as Listener<unknown>);
        listeners.set(key, set);
        return () => set.delete(fn as Listener<unknown>);
      },
    };
  },
};
