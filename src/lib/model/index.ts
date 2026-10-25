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
 *
 * Each concern lives in its own module; this barrel re-exports the public API,
 * so import from `@/lib/model` rather than from a module.
 */

export type { BoardColumn, BoardModel, BoardTask } from './types';
export {
  createId,
  createStarterModel,
  createTask,
  DEFAULT_SECTION,
  fromParseResult,
} from './create';
export { columnsForView } from './views';
export {
  addSection,
  moveSection,
  removeSection,
  removeSectionMovingTasks,
  renameSection,
  reorderSections,
  setTitle,
  toggleDefaultSection,
} from './sections';
export {
  addTask,
  duplicateTask,
  removeTask,
  reorderColumn,
  setTaskSection,
  setTaskStatus,
  updateTask,
} from './tasks';
export {
  canLink,
  canSetStatus,
  linksOf,
  linkTasks,
  openBlockers,
  unlinkTasks,
  type LinkKind,
  type TaskLinks,
} from './links';
export {
  addSubtask,
  canSetParent,
  descendantsOf,
  openSubtasks,
  parentOf,
  setParent,
  subtasksOf,
} from './subtasks';
export { applyBulkAction, countTasks, type BulkAction } from './bulk';
export {
  addStatus,
  canChangeStatusCategory,
  canRemoveStatus,
  isStatusLabelAvailable,
  isTaskDone,
  moveStatus,
  moveTasksToStatus,
  orphanStatuses,
  removeStatus,
  updateStatus,
  type OrphanStatus,
} from './statuses';
export { serializeModel, serializeTaskLine } from './serialize';
