/**
 * The editable board model.
 *
 * The board is "authoritative" while open: user edits mutate this in-memory
 * model, and the whole model is re-serialized to plain document text and
 * written back into the Proton (Lexical) editor. On (re)open the model is
 * rebuilt from the freshly parsed document, so the doc stays the source of
 * truth between sessions.
 *
 * Unlike v0.4, `status` and `section` are **independent** properties of a task.
 * The same flat task collection is projected into two different column layouts:
 *
 *   - Workflow view — columns are the board's statuses (defined per document).
 *   - Sections view — columns are the document's `## Headings`.
 *
 * The model's `tasks` array is the canonical ordering; each task's `order`
 * mirrors its array index. When serializing, tasks are grouped by section (in
 * `sections` order) and emitted in `order` within each section, so card
 * ordering survives closing and reopening the board.
 */

import { encodeDescription } from './parser';
import {
  DEFAULT_STATUSES,
  defaultStatus,
  findStatus,
  isDoneStatus,
  isLastOfRequiredCategory,
  serializeStatusSetting,
  uniqueStatusKey,
} from './statuses';
import type { BoardView, ParseResult, Priority, StatusDef, StatusKey, Task } from './types';

export const DEFAULT_SECTION = 'Tasks';

export interface BoardTask {
  id: string;
  title: string;
  /** Workflow stage — independent of `section`. */
  status: StatusKey;
  /** Document heading the task lives under — independent of `status`. */
  section: string;
  priority?: Priority;
  /** Free-form due date string, as the author would type it. */
  due?: string;
  assignee?: string;
  description?: string;
  labels: string[];
  /** Reference other tasks link to; assigned on first link, written as `@id`. */
  key?: string;
  /** Keys of the tasks this one blocks. */
  blocks?: string[];
  /** Keys of loosely related tasks. */
  related?: string[];
  /** Ordering rank; kept in sync with the array index by {@link reindex}. */
  order: number;
}

export interface BoardModel {
  title?: string;
  /** Section headings in display / document order. */
  sections: string[];
  /** Section marked `@default`; the List view shows only its tasks. */
  defaultSection?: string;
  /** Workflow statuses in column order; always has a Not started and a Done one. */
  statuses: StatusDef[];
  /** Flat task collection; array order is canonical. */
  tasks: BoardTask[];
}

/** A projected column (status or section) with its tasks in display order. */
export interface BoardColumn {
  /** Status key (workflow) or section name (sections). */
  key: string;
  label: string;
  /** Present only in Workflow view. */
  status?: StatusKey;
  /** Present only in Sections view. */
  section?: string;
  tasks: BoardTask[];
}

let idCounter = 0;

/** Generate a process-unique id for a section or task. */
export function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** Keep every task's `order` equal to its array index. Returns a new model. */
function reindex(model: BoardModel): BoardModel {
  return { ...model, tasks: model.tasks.map((t, i) => (t.order === i ? t : { ...t, order: i })) };
}

/** A brand-new task in the given section and status. */
export function createTask(section: string, status: StatusKey, title = ''): BoardTask {
  return { id: createId('task'), title, status, section, labels: [], order: 0 };
}

/** The board seeded when a blank document is converted to a task board. */
export function createStarterModel(): BoardModel {
  return {
    title: undefined,
    sections: [DEFAULT_SECTION],
    statuses: DEFAULT_STATUSES.map((s) => ({ ...s })),
    tasks: [],
  };
}

/** Build an editable model from a parsed document. */
export function fromParseResult(result: ParseResult): BoardModel {
  const sections = result.sections.length > 0 ? [...result.sections] : [DEFAULT_SECTION];
  const tasks: BoardTask[] = result.tasks.map((task, i) => toBoardTask(task, i));
  // Make sure every referenced section exists as a column, in first-seen order.
  for (const task of tasks) {
    if (!sections.includes(task.section)) sections.push(task.section);
  }
  return {
    title: result.boardTitle,
    sections,
    defaultSection: result.defaultSection,
    statuses: result.statuses.map((s) => ({ ...s })),
    tasks,
  };
}

function toBoardTask(task: Task, order: number): BoardTask {
  return {
    id: createId('task'),
    title: task.title,
    status: task.status,
    section: task.section,
    priority: task.priority,
    due: task.due,
    assignee: task.assignee,
    description: task.description,
    labels: [...task.labels],
    key: task.key,
    blocks: task.blocks.length ? task.blocks : undefined,
    related: task.related.length ? task.related : undefined,
    order,
  };
}

// ---------------------------------------------------------------------------
// Projections into the two board views.
// ---------------------------------------------------------------------------

/** Project the model into the columns for a given view. Empty columns kept. */
export function columnsForView(model: BoardModel, view: BoardView): BoardColumn[] {
  if (view === 'list') {
    const rank = (t: BoardTask) => model.sections.indexOf(t.section);
    const { defaultSection } = model;
    const tasks = defaultSection
      ? model.tasks.filter((t) => t.section === defaultSection)
      : model.tasks;
    return [
      {
        key: 'list',
        label: defaultSection ?? 'Tasks',
        tasks: tasks.toSorted((a, b) => rank(a) - rank(b)),
      },
    ];
  }
  if (view === 'workflow') {
    return model.statuses.map((col) => ({
      key: col.key,
      label: col.label,
      status: col.key,
      tasks: model.tasks.filter((t) => t.status === col.key),
    }));
  }
  return model.sections.map((name) => ({
    key: name,
    label: name,
    section: name,
    tasks: model.tasks.filter((t) => t.section === name),
  }));
}

// ---------------------------------------------------------------------------
// Immutable mutation helpers. Each returns a new model so React re-renders.
// ---------------------------------------------------------------------------

export function setTitle(model: BoardModel, title: string): BoardModel {
  return { ...model, title: title.trim() || undefined };
}

/** Return a section name that does not yet exist, based on `base`. */
function uniqueSectionName(model: BoardModel, base: string): string {
  if (!model.sections.includes(base)) return base;
  let n = 2;
  while (model.sections.includes(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export function addSection(model: BoardModel, name = 'New section'): BoardModel {
  const clean = uniqueSectionName(model, name.trim() || 'New section');
  return { ...model, sections: [...model.sections, clean] };
}

export function renameSection(model: BoardModel, from: string, to: string): BoardModel {
  const clean = to.trim();
  if (!clean || from === clean) {
    // Keep the (possibly whitespace-only) edit locally so the input reflects it,
    // but never collapse two sections into one silently.
    return {
      ...model,
      sections: model.sections.map((s) => (s === from ? to : s)),
      defaultSection: model.defaultSection === from ? to : model.defaultSection,
    };
  }
  return {
    ...model,
    defaultSection: model.defaultSection === from ? clean : model.defaultSection,
    sections: model.sections.map((s) => (s === from ? clean : s)),
    tasks: model.tasks.map((t) => (t.section === from ? { ...t, section: clean } : t)),
  };
}

/** Mark `name` as the List view's section, or clear the mark when it already is. */
export function toggleDefaultSection(model: BoardModel, name: string): BoardModel {
  return { ...model, defaultSection: model.defaultSection === name ? undefined : name };
}

/** Delete a section and every task under it. */
export function removeSection(model: BoardModel, name: string): BoardModel {
  return reindex({
    ...model,
    defaultSection: model.defaultSection === name ? undefined : model.defaultSection,
    sections: model.sections.filter((s) => s !== name),
    tasks: model.tasks.filter((t) => t.section !== name),
  });
}

/** Delete a section, relocating its tasks to `target` (kept at that section's end). */
export function removeSectionMovingTasks(
  model: BoardModel,
  name: string,
  target: string,
): BoardModel {
  if (!model.sections.includes(target) || target === name) {
    // No valid destination — fall back to deleting outright.
    return removeSection(model, name);
  }
  const moved = model.tasks
    .filter((t) => t.section === name)
    .map((t) => ({ ...t, section: target }));
  const kept = model.tasks.filter((t) => t.section !== name);
  // Place relocated tasks after the last existing task of the target section.
  let insertAt = kept.length;
  kept.forEach((t, i) => {
    if (t.section === target) insertAt = i + 1;
  });
  const tasks = [...kept.slice(0, insertAt), ...moved, ...kept.slice(insertAt)];
  return reindex({
    ...model,
    defaultSection: model.defaultSection === name ? undefined : model.defaultSection,
    sections: model.sections.filter((s) => s !== name),
    tasks,
  });
}

/** Move a section by `delta` positions (negative = earlier). */
export function moveSection(model: BoardModel, name: string, delta: number): BoardModel {
  const from = model.sections.indexOf(name);
  if (from < 0) return model;
  const to = Math.max(0, Math.min(model.sections.length - 1, from + delta));
  if (to === from) return model;
  const sections = [...model.sections];
  sections.splice(from, 1);
  sections.splice(to, 0, name);
  return { ...model, sections };
}

/** Reorder sections to exactly `orderedNames` (must be a permutation). */
export function reorderSections(model: BoardModel, orderedNames: string[]): BoardModel {
  const known = new Set(model.sections);
  const next = orderedNames.filter((n) => known.has(n));
  for (const s of model.sections) if (!next.includes(s)) next.push(s);
  return { ...model, sections: next };
}

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
  return reindex({ ...model, tasks: model.tasks.filter((t) => t.id !== taskId) });
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

// ---------------------------------------------------------------------------
// Relationships. Links are stored on one task only (`blocks`, `related`) and
// referenced by key; the inverse side ("blocked by") is derived.
// ---------------------------------------------------------------------------

export type LinkKind = 'blockedBy' | 'blocks' | 'related';

export interface TaskLinks {
  blockedBy: BoardTask[];
  blocks: BoardTask[];
  related: BoardTask[];
}

const hasKey = (task: BoardTask, key?: string) => !!key && task.key === key;

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

/** True when `task` sits in a Done status. */
export function isTaskDone(model: BoardModel, task: BoardTask): boolean {
  return isDoneStatus(model.statuses, task.status);
}

/** Tasks that still have to be completed before `task` may advance. */
export function openBlockers(model: BoardModel, task: BoardTask): BoardTask[] {
  return linksOf(model, task).blockedBy.filter((t) => !isTaskDone(model, t));
}

/** A blocked task may not leave Not started until every blocker is done. */
export function canSetStatus(model: BoardModel, task: BoardTask, status: StatusKey): boolean {
  return (
    status === task.status ||
    findStatus(model.statuses, status)?.category === 'todo' ||
    openBlockers(model, task).length === 0
  );
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
  const taken = new Set(model.tasks.map((t) => t.key));
  const keyFor = (id: string) => {
    const existing = model.tasks.find((t) => t.id === id)!.key;
    if (existing) return existing;
    let key: string;
    do key = Math.random().toString(36).slice(2, 6);
    while (key.length < 4 || taken.has(key));
    taken.add(key);
    return key;
  };
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
function pruneLinks(model: BoardModel): BoardModel {
  const known = new Set(model.tasks.map((t) => t.key));
  const live = (keys?: string[]) => {
    const kept = keys?.filter((k) => known.has(k));
    return kept?.length ? kept : undefined;
  };
  const linked = model.tasks.map((t) => ({
    ...t,
    blocks: live(t.blocks),
    related: live(t.related),
  }));
  const referenced = new Set(linked.flatMap((t) => [...(t.blocks ?? []), ...(t.related ?? [])]));
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

// ---------------------------------------------------------------------------
// Bulk operations. Each returns a single new model so the change is one
// document write and one undo step across every affected task.
// ---------------------------------------------------------------------------

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
    case 'delete': {
      const set = ids instanceof Set ? ids : new Set(ids);
      return reindex({ ...model, tasks: model.tasks.filter((t) => !set.has(t.id)) });
    }
  }
}

/** Total and completed (in a Done status) task counts. */
export function countTasks(model: BoardModel): { total: number; done: number } {
  let done = 0;
  for (const task of model.tasks) if (isTaskDone(model, task)) done += 1;
  return { total: model.tasks.length, done };
}

// ---------------------------------------------------------------------------
// Status management. A board always keeps at least one Not started and one
// Done status; helpers that would break that return the model unchanged.
// ---------------------------------------------------------------------------

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
  category: StatusDef['category'],
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
  if (patch.label !== undefined) {
    const label = patch.label.trim();
    if (!label || !isStatusLabelAvailable(model, key, label)) return model;
    patch = { ...patch, label };
  }
  if (patch.category && !canChangeStatusCategory(model, key, patch.category)) return model;
  let newKey = key;
  if (patch.label !== undefined) {
    const others = model.statuses.filter((s) => s.key !== key);
    newKey = uniqueStatusKey(others, patch.label);
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

// ---------------------------------------------------------------------------
// Serialization back to the plain document text the parser understands.
// ---------------------------------------------------------------------------

/** Render a metadata value as `@key(value)` (spaces) or `@key:value` (simple). */
function tokenFor(key: string, value: string): string {
  return /\s/.test(value) ? `@${key}(${value})` : `@${key}:${value}`;
}

/** Serialize a single task to its Markdown checklist line (for "Copy as Markdown"). */
export function serializeTaskLine(task: BoardTask, statuses: readonly StatusDef[]): string {
  const done = isDoneStatus(statuses, task.status);
  const checkbox = done ? 'x' : ' ';
  const parts: string[] = [];
  const title = task.title.trim();
  if (title) parts.push(title);

  // The checkbox implies the first Not started / Done status; others need a token.
  if (task.status !== defaultStatus(statuses, done)) parts.push(tokenFor('status', task.status));
  if (task.priority) parts.push(`@priority:${task.priority}`);
  if (task.due?.trim()) parts.push(tokenFor('due', task.due.trim()));
  if (task.assignee?.trim()) parts.push(tokenFor('who', task.assignee.trim()));
  for (const label of task.labels) {
    const clean = label.trim().replace(/^#/, '');
    if (clean) parts.push(`#${clean}`);
  }
  if (task.key) parts.push(`@id:${task.key}`);
  if (task.blocks?.length) parts.push(`@blocks:${task.blocks.join(',')}`);
  if (task.related?.length) parts.push(`@rel:${task.related.join(',')}`);
  const description = task.description ? encodeDescription(task.description) : '';
  if (description) parts.push(`@desc(${description})`);

  return `- [${checkbox}] ${parts.join(' ')}`.trimEnd();
}

/**
 * Serialize a board model into the plain document text the parser understands.
 * `marker` is the activation marker to lead with (e.g. `#!tasks`).
 */
export function serializeModel(source: BoardModel, marker: string): string {
  const model = pruneLinks(source);
  const lines: string[] = [];
  const title = model.title?.trim();
  lines.push(title ? `${marker} ${title}` : marker);
  for (const status of model.statuses) lines.push(serializeStatusSetting(status));

  // Every section, plus any orphan section referenced only by a task.
  const sections = [...model.sections];
  for (const task of model.tasks) {
    if (!sections.includes(task.section)) sections.push(task.section);
  }

  for (const section of sections) {
    lines.push('');
    lines.push(
      `## ${section.trim() || 'Untitled'}${section === model.defaultSection ? ' @default' : ''}`,
    );
    const inSection = model.tasks
      .filter((t) => t.section === section)
      .sort((a, b) => a.order - b.order);
    for (const task of inSection) lines.push(serializeTaskLine(task, model.statuses));
  }

  return lines.join('\n');
}
