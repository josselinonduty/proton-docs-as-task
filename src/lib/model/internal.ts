/** Helpers shared by the model modules; not part of the public API. */

import type { BoardModel, BoardTask } from './types';

/** Keep every task's `order` equal to its array index. Returns a new model. */
export function reindex(model: BoardModel): BoardModel {
  return { ...model, tasks: model.tasks.map((t, i) => (t.order === i ? t : { ...t, order: i })) };
}

export const hasKey = (task: BoardTask, key?: string) => !!key && task.key === key;

/** Returns a function giving a task's key, inventing a fresh unique one when it has none. */
export function keyAssigner(model: BoardModel): (id: string) => string {
  const taken = new Set(model.tasks.map((t) => t.key));
  return (id) => {
    const existing = model.tasks.find((t) => t.id === id)!.key;
    if (existing) return existing;
    let key: string;
    do key = Math.random().toString(36).slice(2, 6);
    while (key.length < 4 || taken.has(key));
    taken.add(key);
    return key;
  };
}
