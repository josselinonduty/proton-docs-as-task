/**
 * Search and filtering over the board's flat task collection.
 *
 * Filtering only ever changes *visibility* — it never mutates the model or the
 * document. Multiple filters combine with AND across dimensions and OR within a
 * dimension (e.g. status "todo" OR "doing", AND priority "high").
 */

import type { BoardModel, BoardTask } from './model';
import type { Priority, StatusKey } from './types';
import { parseISODate } from './dates';
import type { SortDir, SortKey } from './sorting';

/** Due-date buckets used by both card badges and the due-date filter. */
export type DueBucket = 'none' | 'overdue' | 'today' | 'soon' | 'upcoming';

/** Filter option for the due-date dimension (collapses `soon` into `upcoming`). */
export type DueFilter = 'overdue' | 'today' | 'upcoming' | 'none';

export type Completion = 'all' | 'complete' | 'incomplete';

/** How to filter by the presence of an assignee. */
export type Assignment = 'any' | 'unassigned';

export interface FilterState {
  search: string;
  statuses: StatusKey[];
  sections: string[];
  priorities: Priority[];
  assignees: string[];
  labels: string[];
  due: DueFilter[];
  completion: Completion;
  /** Exclude tasks whose status is in this list (e.g. "not Done"). */
  excludeStatuses: StatusKey[];
  /** Restrict by assignee presence ("without assignee"). */
  assignment: Assignment;
  /** Keep only tasks due within this many days from today (0 = today only). */
  dueWithinDays: number | null;
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
  excludeStatuses: [],
  assignment: 'any',
  dueWithinDays: null,
};

/**
 * Coerce a possibly-partial stored filter object into a complete FilterState.
 * Session preferences may have been written by an older build that lacked the
 * newer dimensions, so every field falls back to its empty value.
 */
export function normalizeFilters(stored?: Partial<FilterState> | null): FilterState {
  return { ...EMPTY_FILTERS, ...(stored ?? {}) };
}

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
    f.completion !== 'all' ||
    f.excludeStatuses.length > 0 ||
    f.assignment !== 'any' ||
    f.dueWithinDays != null
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
    (f.completion !== 'all' ? 1 : 0) +
    f.excludeStatuses.length +
    (f.assignment !== 'any' ? 1 : 0) +
    (f.dueWithinDays != null ? 1 : 0)
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
  if (f.excludeStatuses.length && f.excludeStatuses.includes(task.status)) return false;
  if (f.assignment === 'unassigned' && task.assignee?.trim()) return false;
  if (f.dueWithinDays != null) {
    const date = parseISODate(task.due);
    if (!date) return false;
    const diff = Math.round((startOfDay(date) - startOfDay(now)) / 86_400_000);
    if (diff < 0 || diff > f.dueWithinDays) return false;
  }
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

/** Per-value usage counts, for showing "(n)" next to each filter option. */
export interface FacetCounts {
  statuses: Record<string, number>;
  sections: Record<string, number>;
  priorities: Record<string, number>;
  assignees: Record<string, number>;
  labels: Record<string, number>;
  unassigned: number;
}

/** Count how many tasks carry each filterable value. */
export function facetCounts(model: BoardModel): FacetCounts {
  const counts: FacetCounts = {
    statuses: {},
    sections: {},
    priorities: {},
    assignees: {},
    labels: {},
    unassigned: 0,
  };
  const bump = (bag: Record<string, number>, key: string) => {
    bag[key] = (bag[key] ?? 0) + 1;
  };
  for (const task of model.tasks) {
    bump(counts.statuses, task.status);
    bump(counts.sections, task.section);
    if (task.priority) bump(counts.priorities, task.priority);
    if (task.assignee?.trim()) bump(counts.assignees, task.assignee);
    else counts.unassigned += 1;
    for (const label of task.labels) bump(counts.labels, label);
  }
  return counts;
}

// ---------------------------------------------------------------------------
// One-click filter presets.
// ---------------------------------------------------------------------------

export type PresetId =
  'my-open' | 'overdue' | 'due-this-week' | 'high-priority' | 'unassigned' | 'recently-completed';

export interface PresetContext {
  /** The assignee name the user configured, enabling "My open tasks". */
  userAssignee?: string;
  /** Whether a reliable creation order exists (enables "Recently completed"). */
  canUseCreated?: boolean;
}

export interface Preset {
  id: PresetId;
  label: string;
  available: boolean;
  /** Why the preset is unavailable, for a disabled tooltip. */
  reason?: string;
  filters: FilterState;
  /** A sort that best presents the preset, applied alongside the filters. */
  recommendedSort?: { key: SortKey; dir: SortDir };
}

/** Build every preset for the given context, marking unavailable ones. */
export function buildPresets(ctx: PresetContext = {}): Preset[] {
  const base = () => ({ ...EMPTY_FILTERS });
  const presets: Preset[] = [
    {
      id: 'my-open',
      label: 'My open tasks',
      available: Boolean(ctx.userAssignee?.trim()),
      reason: 'Set your name in settings to use this.',
      filters: {
        ...base(),
        assignees: ctx.userAssignee?.trim() ? [ctx.userAssignee.trim()] : [],
        completion: 'incomplete',
      },
    },
    {
      id: 'overdue',
      label: 'Overdue',
      available: true,
      filters: { ...base(), due: ['overdue'], completion: 'incomplete' },
      recommendedSort: { key: 'due', dir: 'asc' },
    },
    {
      id: 'due-this-week',
      label: 'Due this week',
      available: true,
      filters: { ...base(), dueWithinDays: 7, completion: 'incomplete' },
      recommendedSort: { key: 'due', dir: 'asc' },
    },
    {
      id: 'high-priority',
      label: 'High priority',
      available: true,
      filters: { ...base(), priorities: ['high'], completion: 'incomplete' },
      recommendedSort: { key: 'priority', dir: 'desc' },
    },
    {
      id: 'unassigned',
      label: 'Unassigned',
      available: true,
      filters: { ...base(), assignment: 'unassigned' },
    },
    {
      id: 'recently-completed',
      label: 'Recently completed',
      available: ctx.canUseCreated !== false,
      reason: 'Reliable creation order is unavailable.',
      filters: { ...base(), completion: 'complete' },
      recommendedSort: { key: 'created', dir: 'desc' },
    },
  ];
  return presets;
}

/** Look up a single preset by id. */
export function getPreset(id: PresetId, ctx: PresetContext = {}): Preset | undefined {
  return buildPresets(ctx).find((p) => p.id === id);
}

/**
 * Whether `filters` exactly equals the preset's filter payload — used to show a
 * preset chip as active. Compared field-by-field, order-insensitively.
 */
export function matchesPreset(filters: FilterState, preset: Preset): boolean {
  const a = filters;
  const b = preset.filters;
  const sameSet = (x: string[], y: string[]) =>
    x.length === y.length && [...x].sort().join(' ') === [...y].sort().join(' ');
  return (
    a.search.trim() === b.search.trim() &&
    sameSet(a.statuses, b.statuses) &&
    sameSet(a.sections, b.sections) &&
    sameSet(a.priorities, b.priorities) &&
    sameSet(a.assignees, b.assignees) &&
    sameSet(a.labels, b.labels) &&
    sameSet(a.due, b.due) &&
    a.completion === b.completion &&
    sameSet(a.excludeStatuses, b.excludeStatuses) &&
    a.assignment === b.assignment &&
    a.dueWithinDays === b.dueWithinDays
  );
}
