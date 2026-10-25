/**
 * Adding, editing, moving and removing tasks. Each returns a new model so React
 * re-renders.
 */

import { defaultStatus } from '@/lib/statuses';
import type { StatusKey } from '@/lib/types';
import { createId, createTask } from './create';
import { reindex } from './internal';
import { canSetStatus } from './links';
import type { BoardModel, BoardTask } from './types';

/** Add a new task to a section (optionally at the top). */
export function addTask(
  model: BoardModel,
  section: string,
  opts: { status?: StatusKey; title?: string; atTop?: boolean } = {},
): { model: BoardModel; taskId: string } {
  const task = createTask(
    section,
    opts.status ?? defaultStatus(model.statuses, false),
    opts.title ?? '',
  );
  const sections = model.sections.includes(section) ? model.sections : [...model.sections, section];
  let tasks: BoardTask[];
  if (opts.atTop) {
    // Just before the first existing task of the section.
    const idx = model.tasks.findIndex((t) => t.section === section);
    const at = idx < 0 ? model.tasks.length : idx;
    tasks = [...model.tasks.slice(0, at), task, ...model.tasks.slice(at)];
  } else {
    let at = model.tasks.length;
    model.tasks.forEach((t, i) => {
      if (t.section === section) at = i + 1;
    });
    tasks = [...model.tasks.slice(0, at), task, ...model.tasks.slice(at)];
  }
  return { model: reindex({ ...model, sections, tasks }), taskId: task.id };
}

export function updateTask(
  model: BoardModel,
  taskId: string,
  patch: Partial<Omit<BoardTask, 'id' | 'order'>>,
): BoardModel {
  let sections = model.sections;
  if (patch.section && !sections.includes(patch.section)) sections = [...sections, patch.section];
  return {
    ...model,
    sections,
    tasks: model.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
  };
}

export function removeTask(model: BoardModel, taskId: string): BoardModel {
  return removeTasks(model, new Set([taskId]));
}

/** Remove tasks; their sub-tasks stay on the board, detached from them. */
export function removeTasks(model: BoardModel, ids: ReadonlySet<string>): BoardModel {
  const gone = new Set(
    model.tasks.filter((t) => ids.has(t.id) && t.key).map((t) => t.key as string),
  );
  const tasks = model.tasks
    .filter((t) => !ids.has(t.id))
    .map((t) => (t.parent && gone.has(t.parent) ? { ...t, parent: undefined } : t));
  return reindex({ ...model, tasks });
}

/** Insert a copy of a task directly after it. Returns the new task id too. */
export function duplicateTask(
  model: BoardModel,
  taskId: string,
): { model: BoardModel; taskId?: string } {
  const idx = model.tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return { model };
  const source = model.tasks[idx]!;
  const copy: BoardTask = {
    ...source,
    id: createId('task'),
    labels: [...source.labels],
    key: undefined,
    blocks: undefined,
    related: undefined,
  };
  const tasks = [...model.tasks.slice(0, idx + 1), copy, ...model.tasks.slice(idx + 1)];
  return { model: reindex({ ...model, tasks }), taskId: copy.id };
}

/** Change a task's status (Workflow move). Keeps its array position. */
export function setTaskStatus(model: BoardModel, taskId: string, status: StatusKey): BoardModel {
  const task = model.tasks.find((t) => t.id === taskId);
  if (task && !canSetStatus(model, task, status)) return model;
  return {
    ...model,
    tasks: model.tasks.map((t) => (t.id === taskId ? { ...t, status } : t)),
  };
}

/** Move a task to another section (Sections move), landing at that section's end. */
export function setTaskSection(model: BoardModel, taskId: string, section: string): BoardModel {
  const idx = model.tasks.findIndex((t) => t.id === taskId);
  if (idx < 0) return model;
  const task = { ...model.tasks[idx]!, section };
  const rest = model.tasks.filter((t) => t.id !== taskId);
  let insertAt = rest.length;
  rest.forEach((t, i) => {
    if (t.section === section) insertAt = i + 1;
  });
  const tasks = [...rest.slice(0, insertAt), task, ...rest.slice(insertAt)];
  const sections = model.sections.includes(section) ? model.sections : [...model.sections, section];
  return reindex({ ...model, sections, tasks });
}

/**
 * Reorder the tasks of one column to `orderedIds`. The column's tasks are
 * permuted among the array slots they already occupy, so tasks in other columns
 * keep their positions. Within a section this persists to the document; across
 * sections (in Workflow view) it is a view-only nicety.
 */
export function reorderColumn(model: BoardModel, orderedIds: string[]): BoardModel {
  const idSet = new Set(orderedIds);
  const slots: number[] = [];
  model.tasks.forEach((t, i) => {
    if (idSet.has(t.id)) slots.push(i);
  });
  if (slots.length !== orderedIds.length) return model;
  const byId = new Map(model.tasks.map((t) => [t.id, t] as const));
  const tasks = model.tasks.slice();
  orderedIds.forEach((id, k) => {
    const slot = slots[k]!;
    const task = byId.get(id);
    if (task) tasks[slot] = task;
  });
  return reindex({ ...model, tasks });
}
