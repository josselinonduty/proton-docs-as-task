/**
 * Per-document, per-browser-session view preferences.
 *
 * These are UI preferences — selected view, sort, active filters, collapsed
 * columns and section rows, and the last-used quick-add section — that must
 * *never* be written into the Proton document. They live in the browser's
 * ephemeral session storage, keyed by a stable document identifier taken from
 * the URL (never from document content). When no stable identifier is
 * available, the caller keeps the preferences in memory for the life of the
 * tab only; nothing here derives identity from what the document says.
 */

import type { BoardView } from './types';
import { EMPTY_FILTERS, normalizeFilters, type FilterState } from './filters';
import { MANUAL_SORT, type SortState } from './sorting';

export interface SessionPrefs {
  view: BoardView | null;
  sort: SortState;
  filters: FilterState;
  /** Column keys (status keys or section names) collapsed by the user. */
  collapsedColumns: string[];
  /** Section-row keys collapsed in Swimlane view. */
  collapsedRows: string[];
  /** The section the quick-add form defaulted to most recently. */
  lastQuickAddSection: string | null;
}

export const DEFAULT_SESSION: SessionPrefs = {
  view: null,
  sort: MANUAL_SORT,
  filters: { ...EMPTY_FILTERS },
  collapsedColumns: [],
  collapsedRows: [],
  lastQuickAddSection: null,
};

const VALID_VIEWS: BoardView[] = ['workflow', 'sections', 'swimlane'];
const VALID_SORT_KEYS = new Set(['manual', 'due', 'priority', 'title', 'assignee', 'created']);

function normalizeSort(raw: unknown): SortState {
  if (!raw || typeof raw !== 'object') return { ...MANUAL_SORT };
  const r = raw as Partial<SortState>;
  const key = VALID_SORT_KEYS.has(r.key as string) ? (r.key as SortState['key']) : 'manual';
  const dir = r.dir === 'desc' ? 'desc' : 'asc';
  return { key, dir };
}

function stringList(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : [];
}

/** Coerce a possibly-partial, possibly-legacy stored object into SessionPrefs. */
export function normalizeSessionPrefs(raw?: Partial<SessionPrefs> | null): SessionPrefs {
  const r = raw ?? {};
  return {
    view: VALID_VIEWS.includes(r.view as BoardView) ? (r.view as BoardView) : null,
    sort: normalizeSort(r.sort),
    filters: normalizeFilters(r.filters),
    collapsedColumns: stringList(r.collapsedColumns),
    collapsedRows: stringList(r.collapsedRows),
    lastQuickAddSection: typeof r.lastQuickAddSection === 'string' ? r.lastQuickAddSection : null,
  };
}

/** Merge a partial update over existing prefs, returning a new object. */
export function mergeSessionPrefs(base: SessionPrefs, patch: Partial<SessionPrefs>): SessionPrefs {
  return { ...base, ...patch };
}

/** Toggle membership of `key` in a collapsed-set list. */
export function toggleInList(list: string[], key: string): string[] {
  return list.includes(key) ? list.filter((k) => k !== key) : [...list, key];
}

/**
 * Derive a stable, content-independent document key from a page URL. Returns
 * null when the URL carries no explicit document identifier, signalling the
 * caller to keep preferences in memory for the tab's lifetime instead.
 */
export function documentKey(url?: string | null): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (!/(^|\.)proton\.me$/i.test(u.hostname)) return null;
  const p = u.searchParams;
  const linkId = p.get('linkId') ?? p.get('linkID') ?? p.get('link');
  const volumeId = p.get('volumeId') ?? p.get('volumeID') ?? p.get('volume');
  if (linkId) return `link:${volumeId ?? ''}:${linkId}`;
  const id = p.get('documentId') ?? p.get('docId') ?? p.get('id');
  if (id) return `id:${id}`;
  return null;
}
