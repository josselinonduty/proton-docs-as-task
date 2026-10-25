import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { EMPTY_FILTERS, type FilterState } from '@/lib/filters';
import { MANUAL_SORT, type SortState } from '@/lib/sorting';
import { DEFAULT_SESSION, documentKey, type SessionPrefs } from '@/lib/session';
import { readDocPrefs, writeDocPrefs } from '@/lib/sessionStore';
import type { BoardView } from '@/lib/types';

/**
 * Per-document session preferences (view, sort, filters, collapsed sets):
 * loaded once for the open document, then persisted whenever they change
 * (session storage only). `seedCollapsed` gives the collapsed columns to
 * start with when none are stored.
 */
export function useSessionPrefs(initialView: BoardView, seedCollapsed: () => string[]) {
  const [view, setView] = useState<BoardView>(initialView);
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS });
  const [sort, setSort] = useState<SortState>(MANUAL_SORT);
  const [collapsedColumns, setCollapsedColumns] = useState<string[]>([]);
  const [collapsedRows, setCollapsedRows] = useState<string[]>([]);
  const [lastQuickAddSection, setLastQuickAddSection] = useState<string | null>(null);

  const docKey = useMemo(
    () => (typeof window !== 'undefined' ? documentKey(window.location.href) : null),
    [],
  );
  const sessionReady = useRef(false);

  const applyPrefs = useEffectEvent((prefs: SessionPrefs) => {
    if (prefs.view) setView(prefs.view);
    setSort(prefs.sort);
    setFilters(prefs.filters);
    setCollapsedColumns(prefs.collapsedColumns.length ? prefs.collapsedColumns : seedCollapsed());
    setCollapsedRows(prefs.collapsedRows);
    setLastQuickAddSection(prefs.lastQuickAddSection);
    sessionReady.current = true;
  });

  // Load stored preferences once (per document key, else start from defaults).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const prefs = docKey ? await readDocPrefs(docKey) : DEFAULT_SESSION;
      if (!cancelled) applyPrefs(prefs);
    })();
    return () => {
      cancelled = true;
    };
  }, [docKey]);

  // Persist preferences whenever they change.
  useEffect(() => {
    if (!sessionReady.current || !docKey) return;
    const prefs: SessionPrefs = {
      view,
      sort,
      filters,
      collapsedColumns,
      collapsedRows,
      lastQuickAddSection,
    };
    void writeDocPrefs(docKey, prefs);
  }, [docKey, view, sort, filters, collapsedColumns, collapsedRows, lastQuickAddSection]);

  return {
    view,
    setView,
    filters,
    setFilters,
    sort,
    setSort,
    collapsedColumns,
    setCollapsedColumns,
    collapsedRows,
    setCollapsedRows,
    lastQuickAddSection,
    setLastQuickAddSection,
  };
}
