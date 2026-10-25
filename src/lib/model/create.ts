/** Creating a board model: new ids and tasks, the starter board, parsed documents. */

import { statusesForFlow } from '@/lib/statuses';
import type { ParseResult, StatusFlow, StatusKey, Task } from '@/lib/types';
import type { BoardModel, BoardTask } from './types';

export const DEFAULT_SECTION = 'Tasks';

let idCounter = 0;

/** Generate a process-unique id for a section or task. */
export function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter}`;
}

/** A brand-new task in the given section and status. */
export function createTask(section: string, status: StatusKey, title = ''): BoardTask {
  return { id: createId('task'), title, status, section, labels: [], order: 0 };
}

/** The board seeded when a blank document is converted to a task board. */
export function createStarterModel(flow: StatusFlow = 'standard'): BoardModel {
  return {
    title: undefined,
    sections: [DEFAULT_SECTION],
    statuses: statusesForFlow(flow),
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
    parent: task.parent,
    order,
  };
}
