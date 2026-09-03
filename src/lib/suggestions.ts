/**
 * Local, document-derived autocomplete indexes for assignees and labels.
 *
 * There is no external directory or contact lookup: every suggestion comes from
 * values already present in the current board. Matching is case-insensitive but
 * the *existing* capitalization is always preserved, so "Sam" and "sam" collapse
 * to whichever the author wrote first. Labels are stored without their leading
 * `#`. Indexes are cheap to build and meant to be memoized from the task
 * collection by the caller.
 */

import type { BoardModel } from './model';

export interface Suggestion {
  /** The value in its canonical (first-seen) capitalization. */
  value: string;
  /** How many tasks currently use it. */
  count: number;
}

/** Strip a leading `#` (or several) and surrounding whitespace from a label. */
export function normalizeLabel(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim();
}

/**
 * Fold a list of raw values into distinct suggestions, keyed case-insensitively,
 * keeping the first capitalization seen and counting occurrences. Sorted by
 * usage (desc) then alphabetically.
 */
function foldCounts(values: string[]): Suggestion[] {
  const byKey = new Map<string, Suggestion>();
  for (const raw of values) {
    const value = raw.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    const existing = byKey.get(key);
    if (existing) existing.count += 1;
    else byKey.set(key, { value, count: 1 });
  }
  return [...byKey.values()].sort(
    (a, b) =>
      b.count - a.count || a.value.localeCompare(b.value, undefined, { sensitivity: 'base' }),
  );
}

/** Distinct assignees present in the model, with usage counts. */
export function buildAssigneeIndex(model: BoardModel): Suggestion[] {
  return foldCounts(model.tasks.map((t) => t.assignee ?? '').filter(Boolean));
}

/** Distinct labels present in the model (without `#`), with usage counts. */
export function buildLabelIndex(model: BoardModel): Suggestion[] {
  const labels: string[] = [];
  for (const task of model.tasks)
    for (const label of task.labels) labels.push(normalizeLabel(label));
  return foldCounts(labels);
}

export interface MatchOptions {
  /** Cap the number of returned suggestions. */
  limit?: number;
  /** Values (case-insensitive) to omit — e.g. labels already on the task. */
  exclude?: string[];
}

/**
 * Filter and rank an index against a query. An empty query returns the whole
 * index (respecting `exclude`/`limit`). Prefix matches rank above interior
 * matches; within a tier the index's usage ordering is kept.
 */
export function matchSuggestions(
  index: Suggestion[],
  query: string,
  options: MatchOptions = {},
): Suggestion[] {
  const excluded = new Set((options.exclude ?? []).map((v) => v.trim().toLowerCase()));
  const q = query.trim().toLowerCase();
  const pool = index.filter((s) => !excluded.has(s.value.toLowerCase()));
  const ranked = q
    ? pool
        .filter((s) => s.value.toLowerCase().includes(q))
        .sort((a, b) => {
          const ap = a.value.toLowerCase().startsWith(q) ? 0 : 1;
          const bp = b.value.toLowerCase().startsWith(q) ? 0 : 1;
          return ap - bp; // stable sort keeps usage order within a tier
        })
    : pool;
  return options.limit != null ? ranked.slice(0, options.limit) : ranked;
}

/**
 * Return the canonical capitalization for a typed value if the index already
 * knows it (case-insensitively); otherwise the trimmed input. Used so picking
 * or retyping "sam" reuses the existing "Sam".
 */
export function canonicalize(index: Suggestion[], raw: string): string {
  const value = raw.trim();
  const found = index.find((s) => s.value.toLowerCase() === value.toLowerCase());
  return found ? found.value : value;
}

/**
 * Add a label to a task's label list, preventing case-insensitive duplicates
 * and reusing the existing capitalization when the label is already present
 * anywhere in the index. Returns the same array reference when nothing changes.
 */
export function addLabel(labels: string[], raw: string, index: Suggestion[] = []): string[] {
  const clean = normalizeLabel(raw);
  if (!clean) return labels;
  const lower = clean.toLowerCase();
  if (labels.some((l) => l.toLowerCase() === lower)) return labels; // already on the task
  const canonical = canonicalize(index, clean);
  return [...labels, canonical];
}

/** Remove a label (case-insensitive) from a task's label list. */
export function removeLabel(labels: string[], raw: string): string[] {
  const lower = normalizeLabel(raw).toLowerCase();
  return labels.filter((l) => l.toLowerCase() !== lower);
}
