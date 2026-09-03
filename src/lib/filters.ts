/**
 * Search and filtering over the board's flat task collection.
 *
 * Filtering only ever changes *visibility* — it never mutates the model or the
 * document. Multiple filters combine with AND across dimensions and OR within a
 * dimension (e.g. status "todo" OR "doing", AND priority "high").
 */

import type { BoardModel, BoardTask } from './model';
import type { Priority, StatusKey } from './types';

/** Due-date buckets used by both card badges and the due-date filter. */
export type DueBucket = 'none' | 'overdue' | 'today' | 'soon' | 'upcoming';

/** Filter option for the due-date dimension (collapses `soon` into `upcoming`). */
export type DueFilter = 'overdue' | 'today' | 'upcoming' | 'none';

export type Completion = 'all' | 'complete' | 'incomplete';

export interface FilterState {
  search: string;
  statuses: StatusKey[];
  sections: string[];
  priorities: Priority[];
  assignees: string[];
  labels: string[];
  due: DueFilter[];
  completion: Completion;
}

export const EMPTY_FILTERS: FilterState = {
  search: '',
  statuses: [],
  sections: [],
  priorities: [],
  assignees: [],
  labels: [],
  due: [],
  completion: 'all',
};

/** Days within which an upcoming due date is considered "soon". */
const SOON_DAYS = 3;

/** Local midnight for a Date, so day comparisons ignore the time of day. */
function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/**
 * Classify a task's due date relative to `now`. Only well-formed `yyyy-mm-dd`
 * dates get calendar semantics; any other non-empty value is treated as an
 * (untimed) upcoming due date, and an empty value as `none`.
 */
export function dueBucket(due: string | undefined, now: Date = new Date()): DueBucket {
  const value = due?.trim();
  if (!value) return 'none';
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return 'upcoming';
  const dueDay = startOfDay(new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const today = startOfDay(now);
  if (dueDay < today) return 'overdue';
  if (dueDay === today) return 'today';
  const days = Math.round((dueDay - today) / 86_400_000);
  return days <= SOON_DAYS ? 'soon' : 'upcoming';
}

/** Map a bucket to the coarser filter dimension (`soon` → `upcoming`). */
function bucketToFilter(bucket: DueBucket): DueFilter {
  return bucket === 'soon' ? 'upcoming' : bucket;
}

/** True when any filter (including search) is active. */
export function hasActiveFilters(f: FilterState): boolean {
  return (
    f.search.trim() !== '' ||
    f.statuses.length > 0 ||
    f.sections.length > 0 ||
    f.priorities.length > 0 ||
    f.assignees.length > 0 ||
    f.labels.length > 0 ||
    f.due.length > 0 ||
    f.completion !== 'all'
  );
}

/** Number of active filter chips (search counts as one). */
export function activeFilterCount(f: FilterState): number {
  return (
    (f.search.trim() ? 1 : 0) +
    f.statuses.length +
    f.sections.length +
    f.priorities.length +
    f.assignees.length +
    f.labels.length +
    f.due.length +
    (f.completion !== 'all' ? 1 : 0)
  );
}

function matchesSearch(task: BoardTask, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const haystack = [
    task.title,
    task.description ?? '',
    task.assignee ?? '',
    task.labels.join(' '),
    task.section,
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(q);
}

/** True when a task passes every active filter dimension. */
export function matchesFilters(task: BoardTask, f: FilterState, now: Date = new Date()): boolean {
  if (!matchesSearch(task, f.search)) return false;
  if (f.statuses.length && !f.statuses.includes(task.status)) return false;
  if (f.sections.length && !f.sections.includes(task.section)) return false;
  if (f.priorities.length && (!task.priority || !f.priorities.includes(task.priority)))
    return false;
  if (f.assignees.length && (!task.assignee || !f.assignees.includes(task.assignee))) return false;
  if (f.labels.length && !task.labels.some((l) => f.labels.includes(l))) return false;
  if (f.due.length && !f.due.includes(bucketToFilter(dueBucket(task.due, now)))) return false;
  if (f.completion === 'complete' && task.status !== 'done') return false;
  if (f.completion === 'incomplete' && task.status === 'done') return false;
  return true;
}

/** The subset of tasks matching the filters, preserving order. */
export function applyFilters(
  tasks: BoardTask[],
  f: FilterState,
  now: Date = new Date(),
): BoardTask[] {
  if (!hasActiveFilters(f)) return tasks;
  return tasks.filter((t) => matchesFilters(t, f, now));
}

export interface Facets {
  sections: string[];
  priorities: Priority[];
  assignees: string[];
  labels: string[];
}

/** Distinct filterable values present in the model, for building the filter UI. */
export function collectFacets(model: BoardModel): Facets {
  const priorityOrder: Priority[] = ['high', 'medium', 'low'];
  const assignees = new Set<string>();
  const labels = new Set<string>();
  const priorities = new Set<Priority>();
  for (const task of model.tasks) {
    if (task.assignee) assignees.add(task.assignee);
    if (task.priority) priorities.add(task.priority);
    for (const label of task.labels) labels.add(label);
  }
  return {
    sections: [...model.sections],
    priorities: priorityOrder.filter((p) => priorities.has(p)),
    assignees: [...assignees].sort((a, b) => a.localeCompare(b)),
    labels: [...labels].sort((a, b) => a.localeCompare(b)),
  };
}
