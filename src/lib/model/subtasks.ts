/**
 * Sub-tasks. A sub-task is an ordinary task that names its parent by key
 * (`@parent:key`), so it keeps its own status, section and card. Nesting has
 * no depth limit; cycles are refused when linking and ignored when reading.
 */

import { defaultStatus } from '@/lib/statuses';
import { createTask } from './create';
import { hasKey, keyAssigner, reindex } from './internal';
import { isTaskDone } from './statuses';
import type { BoardModel, BoardTask } from './types';

/** The task `task` is a sub-task of, if it still exists. */
export function parentOf(model: BoardModel, task: BoardTask): BoardTask | undefined {
  const parent = linkedParent(model, task);
  // A parent link that leads back to `task` (typed by hand) is ignored.
  const seen = new Set<BoardTask>();
  for (let up = parent; up && !seen.has(up); up = linkedParent(model, up)) {
    if (up === task) return undefined;
    seen.add(up);
  }
  return parent;
}

/** The task `task.parent` names, cycles included. */
function linkedParent(model: BoardModel, task: BoardTask): BoardTask | undefined {
  if (!task.parent) return undefined;
  return model.tasks.find((t) => t !== task && hasKey(t, task.parent));
}

/** Direct sub-tasks of `task`, in board order. */
export function subtasksOf(model: BoardModel, task: BoardTask): BoardTask[] {
  if (!task.key) return [];
  return model.tasks.filter((t) => t.parent === task.key && parentOf(model, t) === task);
}

/** Every sub-task below `task`, at any depth, each listed once. */
export function descendantsOf(model: BoardModel, task: BoardTask): BoardTask[] {
  const seen = new Set<BoardTask>([task]);
  const result: BoardTask[] = [];
  const stack = subtasksOf(model, task);
  while (stack.length) {
    const next = stack.shift()!;
    if (seen.has(next)) continue;
    seen.add(next);
    result.push(next);
    stack.push(...subtasksOf(model, next));
  }
  return result;
}

/** Unfinished sub-tasks, at any depth, keeping `task` from reaching Done. */
export function openSubtasks(model: BoardModel, task: BoardTask): BoardTask[] {
  return descendantsOf(model, task).filter((t) => !isTaskDone(model, t));
}

/** Whether `childId` may become a sub-task of `parentId` without creating a cycle. */
export function canSetParent(model: BoardModel, childId: string, parentId: string): boolean {
  const child = model.tasks.find((t) => t.id === childId);
  const parent = model.tasks.find((t) => t.id === parentId);
  if (!child || !parent || child === parent) return false;
  if (parentOf(model, child) === parent) return false;
  return !descendantsOf(model, child).includes(parent);
}

/**
 * Make `childId` a sub-task of `parentId`, or detach it from its parent when
 * `parentId` is undefined. Moves that would create a cycle are refused.
 */
export function setParent(
  model: BoardModel,
  childId: string,
  parentId: string | undefined,
): BoardModel {
  if (parentId === undefined) {
    return {
      ...model,
      tasks: model.tasks.map((t) => (t.id === childId ? { ...t, parent: undefined } : t)),
    };
  }
  if (!canSetParent(model, childId, parentId)) return model;
  const parentKey = keyAssigner(model)(parentId);
  return {
    ...model,
    tasks: model.tasks.map((t) => {
      if (t.id === parentId) return { ...t, key: parentKey };
      return t.id === childId ? { ...t, parent: parentKey } : t;
    }),
  };
}

/**
 * Create a sub-task of `parentId` in the parent's section, in the first Not
 * started status, right after the parent's last sub-task in that section.
 */
export function addSubtask(
  model: BoardModel,
  parentId: string,
  title: string,
): { model: BoardModel; taskId?: string } {
  const parent = model.tasks.find((t) => t.id === parentId);
  if (!parent) return { model };
  const parentKey = keyAssigner(model)(parentId);
  const task: BoardTask = {
    ...createTask(parent.section, defaultStatus(model.statuses, false), title.trim()),
    parent: parentKey,
  };
  const siblings = new Set([parent, ...subtasksOf(model, parent)]);
  let at = 0;
  model.tasks.forEach((t, i) => {
    if (siblings.has(t) && t.section === parent.section) at = i + 1;
  });
  const keyed = model.tasks.map((t) => (t.id === parentId ? { ...t, key: parentKey } : t));
  const tasks = [...keyed.slice(0, at), task, ...keyed.slice(at)];
  return { model: reindex({ ...model, tasks }), taskId: task.id };
}
