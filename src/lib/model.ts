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
 *   - Workflow view — columns are the three canonical statuses.
 *   - Sections view — columns are the document's `## Headings`.
 *
 * The model's `tasks` array is the canonical ordering; each task's `order`
 * mirrors its array index. When serializing, tasks are grouped by section (in
 * `sections` order) and emitted in `order` within each section, so card
 * ordering survives closing and reopening the board.
 */

import { encodeDescription } from './parser';
import type { BoardView, ParseResult, Priority, StatusKey, Task } from './types';

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
  /** Ordering rank; kept in sync with the array index by {@link reindex}. */
  order: number;
}

export interface BoardModel {
  title?: string;
  /** Section headings in display / document order. */
  sections: string[];
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

/** A brand-new task in the given section, defaulting to the "todo" status. */
export function createTask(section: string, status: StatusKey = 'todo', title = ''): BoardTask {
  return { id: createId('task'), title, status, section, labels: [], order: 0 };
}

/** The board seeded when a blank document is converted to a task board. */
export function createStarterModel(): BoardModel {
  return { title: undefined, sections: [DEFAULT_SECTION], tasks: [] };
}

/** Build an editable model from a parsed document. */
export function fromParseResult(result: ParseResult): BoardModel {
  const sections = result.sections.length > 0 ? [...result.sections] : [DEFAULT_SECTION];
  const tasks: BoardTask[] = result.tasks.map((task, i) => toBoardTask(task, i));
  // Make sure every referenced section exists as a column, in first-seen order.
  for (const task of tasks) {
    if (!sections.includes(task.section)) sections.push(task.section);
  }
  return { title: result.boardTitle, sections, tasks };
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
    order,
  };
}

// ---------------------------------------------------------------------------
// Projections into the two board views.
// ---------------------------------------------------------------------------

/** Project the model into the columns for a given view. Empty columns kept. */
export function columnsForView(
  model: BoardModel,
  view: BoardView,
  statusColumns: { key: StatusKey; label: string }[],
): BoardColumn[] {
  if (view === 'workflow') {
    return statusColumns.map((col) => ({
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
    return { ...model, sections: model.sections.map((s) => (s === from ? to : s)) };
  }
  return {
    ...model,
    sections: model.sections.map((s) => (s === from ? clean : s)),
    tasks: model.tasks.map((t) => (t.section === from ? { ...t, section: clean } : t)),
  };
}

/** Delete a section and every task under it. */
export function removeSection(model: BoardModel, name: string): BoardModel {
  return reindex({
    ...model,
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
  const task = createTask(section, opts.status ?? 'todo', opts.title ?? '');
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
  const copy: BoardTask = { ...source, id: createId('task'), labels: [...source.labels] };
  const tasks = [...model.tasks.slice(0, idx + 1), copy, ...model.tasks.slice(idx + 1)];
  return { model: reindex({ ...model, tasks }), taskId: copy.id };
}

/** Change a task's status (Workflow move). Keeps its array position. */
export function setTaskStatus(model: BoardModel, taskId: string, status: StatusKey): BoardModel {
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
      return mapSelected(model, ids, (t) => ({ ...t, status: action.status }));
    case 'complete':
      return mapSelected(model, ids, (t) => ({ ...t, status: 'done' }));
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

/** Total and completed (`status === 'done'`) task counts. */
export function countTasks(model: BoardModel): { total: number; done: number } {
  let done = 0;
  for (const task of model.tasks) if (task.status === 'done') done += 1;
  return { total: model.tasks.length, done };
}

// ---------------------------------------------------------------------------
// Serialization back to the plain document text the parser understands.
// ---------------------------------------------------------------------------

/** Render a metadata value as `@key(value)` (spaces) or `@key:value` (simple). */
function tokenFor(key: string, value: string): string {
  return /\s/.test(value) ? `@${key}(${value})` : `@${key}:${value}`;
}

/** Serialize a single task to its Markdown checklist line (for "Copy as Markdown"). */
export function serializeTaskLine(task: BoardTask): string {
  return serializeTask(task);
}

function serializeTask(task: BoardTask): string {
  const checkbox = task.status === 'done' ? 'x' : ' ';
  const parts: string[] = [];
  const title = task.title.trim();
  if (title) parts.push(title);

  // `done`/`todo` are implied by the checkbox; only `doing` needs a token.
  if (task.status === 'doing') parts.push('@status:doing');
  if (task.priority) parts.push(`@priority:${task.priority}`);
  if (task.due?.trim()) parts.push(tokenFor('due', task.due.trim()));
  if (task.assignee?.trim()) parts.push(tokenFor('who', task.assignee.trim()));
  for (const label of task.labels) {
    const clean = label.trim().replace(/^#/, '');
    if (clean) parts.push(`#${clean}`);
  }
  const description = task.description ? encodeDescription(task.description) : '';
  if (description) parts.push(`@desc(${description})`);

  return `- [${checkbox}] ${parts.join(' ')}`.trimEnd();
}

/**
 * Serialize a board model into the plain document text the parser understands.
 * `marker` is the activation marker to lead with (e.g. `#!tasks`).
 */
export function serializeModel(model: BoardModel, marker: string): string {
  const lines: string[] = [];
  const title = model.title?.trim();
  lines.push(title ? `${marker} ${title}` : marker);

  // Every section, plus any orphan section referenced only by a task.
  const sections = [...model.sections];
  for (const task of model.tasks) {
    if (!sections.includes(task.section)) sections.push(task.section);
  }

  for (const section of sections) {
    lines.push('');
    lines.push(`## ${section.trim() || 'Untitled'}`);
    const inSection = model.tasks
      .filter((t) => t.section === section)
      .sort((a, b) => a.order - b.order);
    for (const task of inSection) lines.push(serializeTask(task));
  }

  return lines.join('\n');
}
