/**
 * Bulk operations. Each returns a single new model so the change is one
 * document write and one undo step across every affected task.
 */

import { defaultStatus } from '@/lib/statuses';
import type { Priority, StatusKey } from '@/lib/types';
import { canSetStatus } from './links';
import { isTaskDone } from './statuses';
import { removeTasks } from './tasks';
import type { BoardModel, BoardTask } from './types';

/** Apply `fn` to every task whose id is in `ids`, adding any new sections. */
function mapSelected(
  model: BoardModel,
  ids: Iterable<string>,
  fn: (task: BoardTask) => BoardTask,
  extraSections: string[] = [],
): BoardModel {
  const set = ids instanceof Set ? ids : new Set(ids);
  let sections = model.sections;
  for (const s of extraSections) {
    if (s && !sections.includes(s)) sections = [...sections, s];
  }
  return {
    ...model,
    sections,
    tasks: model.tasks.map((t) => (set.has(t.id) ? fn(t) : t)),
  };
}

/** Normalized (no leading `#`, trimmed) label value. */
function cleanLabel(raw: string): string {
  return raw.trim().replace(/^#+/, '').trim();
}

/** Add a label to a list, skipping case-insensitive duplicates. */
function withLabel(labels: string[], raw: string): string[] {
  const clean = cleanLabel(raw);
  if (!clean) return labels;
  if (labels.some((l) => l.toLowerCase() === clean.toLowerCase())) return labels;
  return [...labels, clean];
}

/** Every distinct bulk action the selection toolbar / command palette can run. */
export type BulkAction =
  | { kind: 'status'; status: StatusKey }
  | { kind: 'complete' }
  | { kind: 'section'; section: string }
  | { kind: 'priority'; priority?: Priority }
  | { kind: 'assignee'; assignee?: string }
  | { kind: 'due'; due?: string }
  | { kind: 'addLabel'; label: string }
  | { kind: 'removeLabel'; label: string }
  | { kind: 'delete' };

/** Apply a {@link BulkAction} to the selected tasks, returning a new model. */
export function applyBulkAction(
  model: BoardModel,
  ids: Iterable<string>,
  action: BulkAction,
): BoardModel {
  switch (action.kind) {
    case 'status':
      return mapSelected(model, ids, (t) =>
        canSetStatus(model, t, action.status) ? { ...t, status: action.status } : t,
      );
    case 'complete': {
      const done = defaultStatus(model.statuses, true);
      return mapSelected(model, ids, (t) =>
        isTaskDone(model, t) || !canSetStatus(model, t, done) ? t : { ...t, status: done },
      );
    }
    case 'section':
      return mapSelected(model, ids, (t) => ({ ...t, section: action.section }), [action.section]);
    case 'priority':
      return mapSelected(model, ids, (t) => ({ ...t, priority: action.priority }));
    case 'assignee':
      return mapSelected(model, ids, (t) => ({
        ...t,
        assignee: action.assignee?.trim() || undefined,
      }));
    case 'due':
      return mapSelected(model, ids, (t) => ({ ...t, due: action.due?.trim() || undefined }));
    case 'addLabel':
      return mapSelected(model, ids, (t) => ({ ...t, labels: withLabel(t.labels, action.label) }));
    case 'removeLabel': {
      const lower = cleanLabel(action.label).toLowerCase();
      return mapSelected(model, ids, (t) => ({
        ...t,
        labels: t.labels.filter((l) => l.toLowerCase() !== lower),
      }));
    }
    case 'delete':
      return removeTasks(model, ids instanceof Set ? ids : new Set(ids));
  }
}

/** Total and completed (in a Done status) task counts. */
export function countTasks(model: BoardModel): { total: number; done: number } {
  let done = 0;
  for (const task of model.tasks) if (isTaskDone(model, task)) done += 1;
  return { total: model.tasks.length, done };
}
