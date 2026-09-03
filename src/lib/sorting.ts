/**
 * Non-destructive sorting for the board's columns.
 *
 * Sorting only reorders how cards are *displayed*; it never mutates the model
 * or the document until the user explicitly chooses "Apply this order to
 * document". While a non-manual sort is active, drag-and-drop reordering is
 * disabled (there is nothing meaningful to drag against a computed order), and
 * switching back to Manual restores the saved document order verbatim.
 */

import { reorderColumn, type BoardColumn, type BoardModel, type BoardTask } from './model';
import { parseISODate } from './dates';
import type { Priority } from './types';

export type SortKey = 'manual' | 'due' | 'priority' | 'title' | 'assignee' | 'created';
export type SortDir = 'asc' | 'desc';

export interface SortState {
  key: SortKey;
  dir: SortDir;
}

export const MANUAL_SORT: SortState = { key: 'manual', dir: 'asc' };

export interface SortOption {
  key: SortKey;
  label: string;
  /** Whether the direction toggle is meaningful for this key. */
  directional: boolean;
  /** The direction a user most likely wants when first picking this key. */
  defaultDir: SortDir;
}

export const SORT_OPTIONS: SortOption[] = [
  { key: 'manual', label: 'Manual order', directional: false, defaultDir: 'asc' },
  { key: 'due', label: 'Due date', directional: true, defaultDir: 'asc' },
  { key: 'priority', label: 'Priority', directional: true, defaultDir: 'desc' },
  { key: 'title', label: 'Title', directional: true, defaultDir: 'asc' },
  { key: 'assignee', label: 'Assignee', directional: true, defaultDir: 'asc' },
  { key: 'created', label: 'Recently created', directional: true, defaultDir: 'desc' },
];

/** True when a sort actually reorders cards (i.e. anything but Manual). */
export function isActiveSort(sort: SortState): boolean {
  return sort.key !== 'manual';
}

const PRIORITY_RANK: Record<Priority, number> = { low: 1, medium: 2, high: 3 };

/**
 * The monotonic creation counter encoded in a task id (`task-<time>-<n>`).
 * Higher means created later. Ids without the suffix sort as oldest.
 */
function createdRank(id: string): number {
  const n = Number(id.slice(id.lastIndexOf('-') + 1));
  return Number.isFinite(n) ? n : 0;
}

/**
 * Whether a task has no meaningful value for the sort key. Empty due dates and
 * empty assignees are "missing" and always sink to the bottom, independent of
 * direction. (Priority has no missing concept — an unset priority is simply the
 * lowest rank and reverses with direction like any other value.)
 */
function isMissing(task: BoardTask, key: SortKey): boolean {
  if (key === 'due') return !parseISODate(task.due);
  if (key === 'assignee') return !task.assignee?.trim();
  return false;
}

/** Compare two present values by the given key in ascending order. */
function compareAsc(a: BoardTask, b: BoardTask, key: SortKey): number {
  switch (key) {
    case 'due':
      return (parseISODate(a.due)?.getTime() ?? 0) - (parseISODate(b.due)?.getTime() ?? 0);
    case 'priority': {
      const pa = a.priority ? PRIORITY_RANK[a.priority] : 0;
      const pb = b.priority ? PRIORITY_RANK[b.priority] : 0;
      return pa - pb;
    }
    case 'title':
      return a.title.trim().localeCompare(b.title.trim(), undefined, { sensitivity: 'base' });
    case 'assignee':
      return (a.assignee?.trim() ?? '').localeCompare(b.assignee?.trim() ?? '', undefined, {
        sensitivity: 'base',
      });
    case 'created':
      return createdRank(a.id) - createdRank(b.id);
    case 'manual':
      return 0;
  }
}

/**
 * Return a new array of `tasks` sorted per `sort`. Manual order returns the
 * input order unchanged. The sort is stable: equal keys keep their incoming
 * (manual) order, and that tiebreak is *not* reversed by descending so cards
 * don't jitter for keys they share. Missing due dates / assignees stay last in
 * both directions.
 */
export function sortTasks(tasks: BoardTask[], sort: SortState): BoardTask[] {
  if (sort.key === 'manual') return tasks.slice();
  const dir = sort.dir === 'desc' ? -1 : 1;
  const decorated = tasks.map((task, index) => ({ task, index }));
  decorated.sort((x, y) => {
    const mx = isMissing(x.task, sort.key);
    const my = isMissing(y.task, sort.key);
    if (mx && my) return x.index - y.index;
    if (mx) return 1; // missing always last
    if (my) return -1;
    const primary = compareAsc(x.task, y.task, sort.key) * dir;
    if (primary !== 0) return primary;
    return x.index - y.index; // stable tiebreak, never reversed
  });
  return decorated.map((d) => d.task);
}

/** Apply {@link sortTasks} to each column's task list, returning new columns. */
export function sortColumns(columns: BoardColumn[], sort: SortState): BoardColumn[] {
  if (sort.key === 'manual') return columns;
  return columns.map((col) => ({ ...col, tasks: sortTasks(col.tasks, sort) }));
}

/**
 * Bake the current sorted order into the model so it becomes the persisted
 * manual order. Each column is reordered in place (cards keep their column
 * membership); the result is a new model whose document serialization reflects
 * the sort. Returns the model unchanged for a manual sort.
 */
export function applySortToModel(
  model: BoardModel,
  columns: BoardColumn[],
  sort: SortState,
): BoardModel {
  if (sort.key === 'manual') return model;
  let next = model;
  for (const col of columns) {
    const orderedIds = sortTasks(col.tasks, sort).map((t) => t.id);
    if (orderedIds.length > 1) next = reorderColumn(next, orderedIds);
  }
  return next;
}

/** Human summary of a sort, e.g. "Priority (high → low)". */
export function describeSort(sort: SortState): string {
  const option = SORT_OPTIONS.find((o) => o.key === sort.key);
  if (!option || sort.key === 'manual') return 'Manual order';
  const arrow = sort.dir === 'asc' ? 'ascending' : 'descending';
  return `${option.label}, ${arrow}`;
}
