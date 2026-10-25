import { useRef, useState } from 'react';

/**
 * Multi-select for bulk actions. Selection mode shows each card's checkbox;
 * Shift-clicking selects the range from the card last toggled, within the
 * same column.
 */
export function useBoardSelection() {
  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const anchor = useRef<{ id: string; colKey: string } | null>(null);

  /** Toggle `id`, or with `shift`, add the run of `colIds` from the anchor to it. */
  const toggle = (id: string, colKey: string, colIds: string[], shift: boolean) => {
    setSelectionMode(true);
    setSelected((prev) => {
      const next = new Set(prev);
      const from = anchor.current;
      if (shift && from && from.colKey === colKey) {
        const a = colIds.indexOf(from.id);
        const b = colIds.indexOf(id);
        if (a >= 0 && b >= 0) {
          const [lo, hi] = a < b ? [a, b] : [b, a];
          for (let i = lo; i <= hi; i++) next.add(colIds[i]!);
          anchor.current = { id, colKey };
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      anchor.current = { id, colKey };
      return next;
    });
  };

  /** Enter selection mode with exactly `ids` selected. */
  const select = (ids: Set<string>) => {
    setSelected(ids);
    setSelectionMode(true);
  };

  const start = () => setSelectionMode(true);
  const clear = () => setSelected(new Set());

  /** Leave selection mode, keeping the Shift-click anchor (after a bulk delete). */
  const leave = () => {
    setSelected(new Set());
    setSelectionMode(false);
  };

  /** Leave selection mode and forget the anchor. */
  const exit = () => {
    leave();
    anchor.current = null;
  };

  return { selectionMode, selected, toggle, select, start, clear, leave, exit };
}
