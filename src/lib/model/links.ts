/**
 * Relationships. Links are stored on one task only (`blocks`, `related`) and
 * referenced by key; the inverse side ("blocked by") is derived.
 */

import { findStatus } from '@/lib/statuses';
import type { StatusKey } from '@/lib/types';
import { hasKey, keyAssigner } from './internal';
import { isTaskDone } from './statuses';
import { openSubtasks, parentOf } from './subtasks';
import type { BoardModel, BoardTask } from './types';

export type LinkKind = 'blockedBy' | 'blocks' | 'related';

export interface TaskLinks {
  blockedBy: BoardTask[];
  blocks: BoardTask[];
  related: BoardTask[];
}

/** Every task linked to `task`, grouped by relationship. */
export function linksOf(model: BoardModel, task: BoardTask): TaskLinks {
  const blocks = task.blocks ?? [];
  const related = task.related ?? [];
  return {
    blockedBy: model.tasks.filter((t) => task.key && t.blocks?.includes(task.key)),
    blocks: model.tasks.filter((t) => t.key && blocks.includes(t.key)),
    related: model.tasks.filter(
      (t) =>
        (t.key && related.includes(t.key)) || (task.key && t.related?.includes(task.key)) || false,
    ),
  };
}

/** Tasks that still have to be completed before `task` may advance. */
export function openBlockers(model: BoardModel, task: BoardTask): BoardTask[] {
  return linksOf(model, task).blockedBy.filter((t) => !isTaskDone(model, t));
}

/**
 * A blocked task may not leave Not started until every blocker is done, and a
 * parent task may not reach Done while any of its sub-tasks is still open.
 */
export function canSetStatus(model: BoardModel, task: BoardTask, status: StatusKey): boolean {
  if (status === task.status) return true;
  const category = findStatus(model.statuses, status)?.category;
  if (category === 'todo') return true;
  if (openBlockers(model, task).length > 0) return false;
  return category !== 'done' || openSubtasks(model, task).length === 0;
}

/** True when following `blocks` links from `fromKey` reaches `targetKey`. */
function reaches(model: BoardModel, fromKey: string, targetKey: string): boolean {
  const seen = new Set<string>();
  const stack = [fromKey];
  while (stack.length) {
    const key = stack.pop()!;
    if (key === targetKey) return true;
    if (seen.has(key)) continue;
    seen.add(key);
    stack.push(...(model.tasks.find((t) => hasKey(t, key))?.blocks ?? []));
  }
  return false;
}

/** Whether `a` and `b` may be linked: distinct, unlinked, and no blocking cycle. */
export function canLink(model: BoardModel, aId: string, bId: string, kind: LinkKind): boolean {
  const a = model.tasks.find((t) => t.id === aId);
  const b = model.tasks.find((t) => t.id === bId);
  if (!a || !b || a === b) return false;
  const links = linksOf(model, a);
  if ([...links.blockedBy, ...links.blocks, ...links.related].includes(b)) return false;
  if (kind === 'related') return true;
  const [blocker, blocked] = kind === 'blocks' ? [a, b] : [b, a];
  return !(blocked.key && blocker.key && reaches(model, blocked.key, blocker.key));
}

/** Link `aId` to `bId` ("a blocks b", "a is blocked by b" or "a relates to b"). */
export function linkTasks(model: BoardModel, aId: string, bId: string, kind: LinkKind): BoardModel {
  if (!canLink(model, aId, bId, kind)) return model;
  const [ownerId, targetId] = kind === 'blockedBy' ? [bId, aId] : [aId, bId];
  const field = kind === 'related' ? 'related' : 'blocks';
  const keyFor = keyAssigner(model);
  const ownerKey = keyFor(ownerId);
  const targetKey = keyFor(targetId);
  return {
    ...model,
    tasks: model.tasks.map((t) => {
      if (t.id === ownerId)
        return { ...t, key: ownerKey, [field]: [...(t[field] ?? []), targetKey] };
      return t.id === targetId ? { ...t, key: targetKey } : t;
    }),
  };
}

/** Drop links to tasks that no longer exist, and keys nobody references. */
export function pruneLinks(model: BoardModel): BoardModel {
  const known = new Set(model.tasks.map((t) => t.key));
  const live = (keys?: string[]) => {
    const kept = keys?.filter((k) => known.has(k));
    return kept?.length ? kept : undefined;
  };
  const linked = model.tasks.map((t) => ({
    ...t,
    blocks: live(t.blocks),
    related: live(t.related),
    parent: parentOf(model, t) ? t.parent : undefined,
  }));
  const referenced = new Set(
    linked.flatMap((t) => [
      ...(t.blocks ?? []),
      ...(t.related ?? []),
      ...(t.parent ? [t.parent] : []),
    ]),
  );
  return {
    ...model,
    tasks: linked.map((t) => (t.key && !referenced.has(t.key) ? { ...t, key: undefined } : t)),
  };
}

/** Remove every link between two tasks. */
export function unlinkTasks(model: BoardModel, aId: string, bId: string): BoardModel {
  const a = model.tasks.find((t) => t.id === aId);
  const b = model.tasks.find((t) => t.id === bId);
  if (!a || !b) return model;
  const strip = (owner: BoardTask, other: BoardTask): BoardTask => ({
    ...owner,
    blocks: owner.blocks?.filter((k) => k !== other.key),
    related: owner.related?.filter((k) => k !== other.key),
  });
  return {
    ...model,
    tasks: model.tasks.map((t) => (t === a ? strip(a, b) : t === b ? strip(b, a) : t)),
  };
}
