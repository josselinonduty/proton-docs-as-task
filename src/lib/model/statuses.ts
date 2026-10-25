/**
 * Status management. A board always keeps at least one Not started and one
 * Done status; helpers that would break that return the model unchanged.
 */

import {
  findStatus,
  isDoneStatus,
  isLastOfRequiredCategory,
  uniqueStatusKey,
} from '@/lib/statuses';
import type { StatusCategory, StatusDef, StatusKey } from '@/lib/types';
import type { BoardModel, BoardTask } from './types';

/** True when `task` sits in a Done status. */
export function isTaskDone(model: BoardModel, task: BoardTask): boolean {
  return isDoneStatus(model.statuses, task.status);
}

/** Append a status, keyed after its label. Returns the new key too. */
export function addStatus(
  model: BoardModel,
  init: Partial<Omit<StatusDef, 'key'>> = {},
): { model: BoardModel; key: StatusKey } {
  const label = uniqueStatusLabel(model, init.label?.trim() || 'New status');
  const key = uniqueStatusKey(model.statuses, label);
  const status: StatusDef = { ...init, key, label, category: init.category ?? 'doing' };
  return { model: { ...model, statuses: [...model.statuses, status] }, key };
}

/** Return a status label no other status uses yet, based on `base`. */
function uniqueStatusLabel(model: BoardModel, base: string): string {
  const taken = new Set(model.statuses.map((s) => s.label.toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  let n = 2;
  while (taken.has(`${base} ${n}`.toLowerCase())) n += 1;
  return `${base} ${n}`;
}

/** Whether `label` is free for status `key` (labels are unique, case-insensitively). */
export function isStatusLabelAvailable(model: BoardModel, key: StatusKey, label: string): boolean {
  const clean = label.trim().toLowerCase();
  return !model.statuses.some((s) => s.key !== key && s.label.toLowerCase() === clean);
}

/** Whether status `key` may switch to `category` without leaving one empty. */
export function canChangeStatusCategory(
  model: BoardModel,
  key: StatusKey,
  category: StatusCategory,
): boolean {
  const status = findStatus(model.statuses, key);
  if (!status) return false;
  return status.category === category || !isLastOfRequiredCategory(model.statuses, key);
}

/**
 * Change a status's label, category or colours. Renaming also re-derives its
 * key from the new label (slugified, suffixed to stay unique) and moves the
 * tasks using it along. An empty or duplicate label, or a category change
 * that would leave the board without a Not started or Done status, is refused.
 */
export function updateStatus(
  model: BoardModel,
  key: StatusKey,
  patch: Partial<Omit<StatusDef, 'key'>>,
): BoardModel {
  if (patch.category && !canChangeStatusCategory(model, key, patch.category)) return model;
  let newKey = key;
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (!label || !isStatusLabelAvailable(model, key, label)) return model;
    patch = { ...patch, label };
    newKey = uniqueStatusKey(
      model.statuses.filter((s) => s.key !== key),
      label,
    );
  }
  return {
    ...model,
    tasks:
      newKey === key
        ? model.tasks
        : model.tasks.map((t) => (t.status === key ? { ...t, status: newKey } : t)),
    statuses: model.statuses.map((s) => {
      if (s.key !== key) return s;
      const next: StatusDef = { ...s, ...patch, key: newKey };
      // `undefined` in the patch clears a colour.
      if (!next.color) delete next.color;
      if (!next.bg) delete next.bg;
      return next;
    }),
  };
}

/** Move a status column by `delta` positions (negative = earlier). */
export function moveStatus(model: BoardModel, key: StatusKey, delta: number): BoardModel {
  const from = model.statuses.findIndex((s) => s.key === key);
  if (from < 0) return model;
  const to = Math.max(0, Math.min(model.statuses.length - 1, from + delta));
  if (to === from) return model;
  const statuses = [...model.statuses];
  const [moved] = statuses.splice(from, 1);
  statuses.splice(to, 0, moved!);
  return { ...model, statuses };
}

/** Whether status `key` may be deleted (it isn't the last Not started / Done one). */
export function canRemoveStatus(model: BoardModel, key: StatusKey): boolean {
  return (
    !!findStatus(model.statuses, key) &&
    model.statuses.length > 1 &&
    !isLastOfRequiredCategory(model.statuses, key)
  );
}

/** Give every task in status `from` the status `to`, keeping their positions. */
export function moveTasksToStatus(model: BoardModel, from: StatusKey, to: StatusKey): BoardModel {
  if (from === to || !findStatus(model.statuses, to)) return model;
  return {
    ...model,
    tasks: model.tasks.map((t) => (t.status === from ? { ...t, status: to } : t)),
  };
}

/** Delete a status, moving its tasks to `target` first (required when it has any). */
export function removeStatus(model: BoardModel, key: StatusKey, target?: StatusKey): BoardModel {
  if (!canRemoveStatus(model, key)) return model;
  let next = model;
  if (model.tasks.some((t) => t.status === key)) {
    if (!target || target === key || !findStatus(model.statuses, target)) return model;
    next = moveTasksToStatus(model, key, target);
  }
  return { ...next, statuses: next.statuses.filter((s) => s.key !== key) };
}

/** A status key referenced by tasks but not defined by the board. */
export interface OrphanStatus {
  key: StatusKey;
  count: number;
}

/** Status keys tasks use that the board doesn't define, in first-seen order. */
export function orphanStatuses(model: BoardModel): OrphanStatus[] {
  const counts = new Map<StatusKey, number>();
  for (const task of model.tasks) {
    if (findStatus(model.statuses, task.status)) continue;
    counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
  }
  return [...counts].map(([key, count]) => ({ key, count }));
}
