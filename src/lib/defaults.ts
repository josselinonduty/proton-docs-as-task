import type { ColumnDef, Settings } from './types';

export const DEFAULT_COLUMNS: ColumnDef[] = [
  { key: 'todo', label: 'To Do' },
  { key: 'doing', label: 'In Progress' },
  { key: 'done', label: 'Done' },
];

/**
 * Default activation markers. The first non-empty line of a document must
 * start with one of these (trimmed, case-insensitive) for the board to show.
 */
export const DEFAULT_MARKERS = ['#!tasks', '#!task', ':::tasks'];

export const DEFAULT_SETTINGS: Settings = {
  enabled: true,
  markers: DEFAULT_MARKERS,
  columns: DEFAULT_COLUMNS,
  grouping: 'status',
  autoShow: true,
};

/** Merge stored settings over the defaults, guarding against empty arrays. */
export function withDefaults(stored?: Partial<Settings> | null): Settings {
  const merged = { ...DEFAULT_SETTINGS, ...(stored ?? {}) };
  if (!merged.markers || merged.markers.length === 0) merged.markers = DEFAULT_MARKERS;
  if (!merged.columns || merged.columns.length === 0) merged.columns = DEFAULT_COLUMNS;
  return merged;
}
