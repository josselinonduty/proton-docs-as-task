/**
 * The editable board model.
 *
 * The board is "authoritative" while open: user edits mutate this in-memory
 * model, and the whole model is re-serialized to plain document text and
 * written back into the Proton (Lexical) editor. On (re)open the model is
 * rebuilt from the freshly parsed document, so the doc stays the source of
 * truth between sessions.
 *
 * Columns map to document sections (`## Heading`); a task's metadata maps to
 * the inline tokens `@status` / `@priority` / `@due` / `@who` / `#label` and a
 * hidden single-line `@desc(...)`. That keeps everything round-trippable
 * through the existing parser while the user never has to see the raw text.
 */

import { encodeDescription } from './parser';
import type { ParseResult, Priority, StatusKey, Task } from './types';

export interface EditableTask {
  id: string;
  title: string;
  status: StatusKey;
  priority?: Priority;
  /** Free-form due date string, as the author would type it. */
  due?: string;
  assignee?: string;
  description?: string;
  labels: string[];
}

export interface BoardColumn {
  id: string;
  /** Column heading — serialized as a `## Section`. */
  name: string;
  tasks: EditableTask[];
}

export interface BoardModel {
  title?: string;
  columns: BoardColumn[];
}

let idCounter = 0;

/** Generate a process-unique id for a column or task. */
export function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** A brand-new task in the "todo" state. */
export function createTask(title = ''): EditableTask {
  return { id: createId('task'), title, status: 'todo', labels: [] };
}

/** A brand-new, empty column. */
export function createColumn(name: string): BoardColumn {
  return { id: createId('col'), name, tasks: [] };
}

/** The board seeded when a blank document is converted to a task board. */
export function createStarterModel(): BoardModel {
  return {
    title: undefined,
    columns: [createColumn('To Do'), createColumn('In Progress'), createColumn('Done')],
  };
}

/** Build an editable model from a parsed document (columns = sections). */
export function fromParseResult(result: ParseResult): BoardModel {
  const order = result.sections.length > 0 ? result.sections : ['Tasks'];
  const columns = new Map<string, BoardColumn>();
  for (const name of order) columns.set(name, createColumn(name));

  for (const task of result.tasks) {
    let column = columns.get(task.section);
    if (!column) {
      column = createColumn(task.section);
      columns.set(task.section, column);
    }
    column.tasks.push(toEditableTask(task));
  }

  return { title: result.boardTitle, columns: Array.from(columns.values()) };
}

function toEditableTask(task: Task): EditableTask {
  return {
    id: createId('task'),
    title: task.title,
    status: task.status,
    priority: task.priority,
    due: task.due,
    assignee: task.assignee,
    description: task.description,
    labels: [...task.labels],
  };
}

// ---------------------------------------------------------------------------
// Immutable mutation helpers. Each returns a new model so React re-renders.
// ---------------------------------------------------------------------------

export function setTitle(model: BoardModel, title: string): BoardModel {
  return { ...model, title: title.trim() || undefined };
}

export function addColumn(model: BoardModel, name = 'New column'): BoardModel {
  return { ...model, columns: [...model.columns, createColumn(name)] };
}

export function renameColumn(model: BoardModel, columnId: string, name: string): BoardModel {
  return {
    ...model,
    columns: model.columns.map((c) => (c.id === columnId ? { ...c, name } : c)),
  };
}

export function removeColumn(model: BoardModel, columnId: string): BoardModel {
  return { ...model, columns: model.columns.filter((c) => c.id !== columnId) };
}

export function addTask(model: BoardModel, columnId: string, title = ''): BoardModel {
  return {
    ...model,
    columns: model.columns.map((c) =>
      c.id === columnId ? { ...c, tasks: [...c.tasks, createTask(title)] } : c,
    ),
  };
}

export function updateTask(
  model: BoardModel,
  taskId: string,
  patch: Partial<EditableTask>,
): BoardModel {
  return {
    ...model,
    columns: model.columns.map((c) => ({
      ...c,
      tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
    })),
  };
}

export function removeTask(model: BoardModel, taskId: string): BoardModel {
  return {
    ...model,
    columns: model.columns.map((c) => ({
      ...c,
      tasks: c.tasks.filter((t) => t.id !== taskId),
    })),
  };
}

/** Move a task to the end of another column (no-op if already there). */
export function moveTask(model: BoardModel, taskId: string, toColumnId: string): BoardModel {
  let moved: EditableTask | undefined;
  const stripped = model.columns.map((c) => {
    const found = c.tasks.find((t) => t.id === taskId);
    if (found) moved = found;
    return { ...c, tasks: c.tasks.filter((t) => t.id !== taskId) };
  });
  if (!moved) return model;
  return {
    ...model,
    columns: stripped.map((c) => (c.id === toColumnId ? { ...c, tasks: [...c.tasks, moved!] } : c)),
  };
}

/** Total and completed task counts across all columns. */
export function countTasks(model: BoardModel): { total: number; done: number } {
  let total = 0;
  let done = 0;
  for (const column of model.columns) {
    for (const task of column.tasks) {
      total += 1;
      if (task.status === 'done') done += 1;
    }
  }
  return { total, done };
}

/** Render a metadata value as `@key(value)` (spaces) or `@key:value` (simple). */
function tokenFor(key: string, value: string): string {
  return /\s/.test(value) ? `@${key}(${value})` : `@${key}:${value}`;
}

function serializeTask(task: EditableTask): string {
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

  for (const column of model.columns) {
    lines.push('');
    lines.push(`## ${column.name.trim() || 'Untitled'}`);
    for (const task of column.tasks) lines.push(serializeTask(task));
  }

  return lines.join('\n');
}
