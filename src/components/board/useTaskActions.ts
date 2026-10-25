import { useTranslation } from 'react-i18next';
import {
  canSetStatus,
  duplicateTask,
  isTaskDone,
  openBlockers,
  openSubtasks,
  reorderColumn,
  serializeTaskLine,
  setTaskSection,
  setTaskStatus,
  updateTask,
  type BoardColumn,
  type BoardModel,
  type BoardTask,
} from '@/lib/model';
import { defaultStatus, findStatus } from '@/lib/statuses';
import type { BoardView, StatusKey } from '@/lib/types';

interface TaskActionsOptions {
  model: BoardModel;
  view: BoardView;
  /** Manual reordering and drag and drop are off while a sort is active. */
  sortActive: boolean;
  onChange: (next: BoardModel, undoLabel?: string) => void;
  announce: (message: string) => void;
  /** Show why a move was refused (open blockers or sub-tasks). */
  onBlocked: (message: string) => void;
  /** Keep keyboard focus on a card that just moved. */
  focusTask: (id: string) => void;
}

/** Edits to single tasks, each announced and (where it matters) undoable. */
export function useTaskActions({
  model,
  view,
  sortActive,
  onChange,
  announce,
  onBlocked,
  focusTask,
}: TaskActionsOptions) {
  const { t } = useTranslation();
  const { statuses } = model;
  const taskName = (task: BoardTask) => task.title || t('board.task');
  const isDone = (task: BoardTask) => isTaskDone(model, task);

  const patch = (id: string, changes: Partial<Omit<BoardTask, 'id' | 'order'>>) =>
    onChange(updateTask(model, id, changes));

  /** True when `task` may take `status`; otherwise explains which tasks stand in the way. */
  const allowStatus = (task: BoardTask, status: StatusKey) => {
    if (canSetStatus(model, task, status)) return true;
    const blockers = openBlockers(model, task);
    const names = (blockers.length ? blockers : openSubtasks(model, task)).map(
      (b) => `“${b.title || t('card.untitled')}”`,
    );
    const message = t(blockers.length ? 'board.blocked' : 'board.openSubtasks', {
      names: names.join(', '),
      count: names.length,
    });
    onBlocked(message);
    announce(message);
    return false;
  };

  const toggleDone = (task: BoardTask) => {
    const wasDone = isDone(task);
    const next = defaultStatus(statuses, !wasDone);
    if (!allowStatus(task, next)) return;
    onChange(
      setTaskStatus(model, task.id, next),
      t(wasDone ? 'board.undo.reopened' : 'board.undo.completed'),
    );
    announce(t(wasDone ? 'board.reopened' : 'board.completed', { title: taskName(task) }));
  };

  const setStatus = (task: BoardTask, status: StatusKey) => {
    if (status === task.status || !allowStatus(task, status)) return;
    const label = findStatus(statuses, status)?.label ?? status;
    onChange(setTaskStatus(model, task.id, status), t('board.undo.movedTo', { to: label }));
    announce(t('board.movedTo', { title: taskName(task), to: label }));
    focusTask(task.id);
  };

  const setSection = (task: BoardTask, section: string) => {
    if (section === task.section) return;
    onChange(setTaskSection(model, task.id, section), t('board.undo.movedTo', { to: section }));
    announce(t('board.movedTo', { title: taskName(task), to: section }));
    focusTask(task.id);
  };

  /** Swap `task` with its neighbour among `colTasks` (the column's shown cards). */
  const moveWithin = (colTasks: BoardTask[], label: string, task: BoardTask, delta: number) => {
    if (sortActive) return;
    const ids = colTasks.map((colTask) => colTask.id);
    const i = ids.indexOf(task.id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    [next[i], next[j]] = [next[j]!, next[i]!];
    onChange(reorderColumn(model, next));
    announce(
      t(delta < 0 ? 'board.movedUp' : 'board.movedDown', { title: taskName(task), column: label }),
    );
    focusTask(task.id);
  };

  const duplicate = (task: BoardTask) => {
    const { model: next, taskId } = duplicateTask(model, task.id);
    onChange(next);
    if (taskId) focusTask(taskId);
    announce(t('board.duplicated', { title: taskName(task) }));
  };

  const copyMarkdown = async (task: BoardTask) => {
    try {
      await navigator.clipboard.writeText(serializeTaskLine(task, statuses));
      announce(t('board.taskCopied'));
    } catch {
      announce(t('board.copyFailed'));
    }
  };

  /** A card dropped on a column: reorder within it, or move to its status or section. */
  const dropOnColumn = (col: BoardColumn, id: string, beforeId: string | null) => {
    if (sortActive) return;
    const dragged = model.tasks.find((task) => task.id === id);
    if (!dragged) return;
    const inThisColumn =
      view === 'workflow' ? dragged.status === col.status : dragged.section === col.section;
    if (inThisColumn) {
      const ids = col.tasks.map((task) => task.id).filter((x) => x !== id);
      let at = beforeId ? ids.indexOf(beforeId) : ids.length;
      if (at < 0) at = ids.length;
      ids.splice(at, 0, id);
      onChange(reorderColumn(model, ids));
      announce(t('board.reordered', { title: taskName(dragged), column: col.label }));
    } else if (view === 'workflow' && col.status) {
      if (!allowStatus(dragged, col.status)) return;
      onChange(setTaskStatus(model, id, col.status), t('board.undo.movedTo', { to: col.label }));
      announce(t('board.movedTo', { title: taskName(dragged), to: col.label }));
    } else if (view === 'sections' && col.section) {
      onChange(setTaskSection(model, id, col.section), t('board.undo.movedTo', { to: col.label }));
      announce(t('board.movedTo', { title: taskName(dragged), to: col.label }));
    }
    focusTask(id);
  };

  /** Swimlane drop: a cell fixes both status and section at once. */
  const dropOnCell = (section: string, status: StatusKey, id: string) => {
    if (sortActive) return;
    const dragged = model.tasks.find((task) => task.id === id);
    if (!dragged) return;
    if (dragged.status !== status && !allowStatus(dragged, status)) return;
    let next = model;
    if (dragged.status !== status) next = setTaskStatus(next, id, status);
    if (dragged.section !== section) next = setTaskSection(next, id, section);
    if (next !== model) {
      const label = findStatus(statuses, status)?.label ?? status;
      onChange(next, t('board.undo.movedTo', { to: `${section} / ${label}` }));
      announce(t('board.movedTo', { title: taskName(dragged), to: `${section}, ${label}` }));
    }
    focusTask(id);
  };

  return {
    taskName,
    isDone,
    patch,
    toggleDone,
    setStatus,
    setSection,
    moveWithin,
    duplicate,
    copyMarkdown,
    dropOnColumn,
    dropOnCell,
  };
}

export type TaskActions = ReturnType<typeof useTaskActions>;
