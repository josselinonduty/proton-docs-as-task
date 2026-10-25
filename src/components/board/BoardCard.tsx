import {
  linksOf,
  openBlockers,
  openSubtasks,
  parentOf,
  subtasksOf,
  type BoardTask,
} from '@/lib/model';
import { EditableTaskCard } from '@/components/EditableTaskCard';
import { useBoard } from './BoardContext';
import type { CardPlace } from './boardLayout';

interface BoardCardProps {
  task: BoardTask;
  /** The card's column, for moves within it and Shift-click ranges. */
  place: CardPlace;
}

/** One card on the board, wired to the board's state and actions. */
export function BoardCard({ task, place }: BoardCardProps) {
  const board = useBoard();
  const { model, settings, view, tasks, dnd, selected } = board;
  const subs = subtasksOf(model, task);
  return (
    <EditableTaskCard
      task={task}
      statuses={model.statuses}
      density={settings.density}
      showDescriptionPreview={settings.showDescriptionPreview}
      cardFields={settings.cardFields}
      dateFormat={settings.dateFormat}
      view={view}
      now={board.now}
      focus={board.focusTaskId === task.id}
      active={board.activeTaskId === task.id}
      blockedBy={openBlockers(model, task).length}
      blocking={linksOf(model, task).blocks.filter((blocked) => !tasks.isDone(blocked)).length}
      subtasks={
        subs.length
          ? {
              done: subs.filter(tasks.isDone).length,
              total: subs.length,
              open: openSubtasks(model, task).length,
            }
          : undefined
      }
      parentTitle={parentOf(model, task)?.title}
      highlight={board.highlightId === task.id}
      selection={
        selected
          ? {
              selected: selected.has(task.id),
              onToggle: (e) => board.toggleSelect(task, place.colKey, place.ids, e.shiftKey),
            }
          : null
      }
      dragDisabled={board.sortActive || view === 'list'}
      onFocusCard={() => board.cardFocused(task.id)}
      onFocusHandled={board.focusHandled}
      onToggleDone={() => tasks.toggleDone(task)}
      onOpen={() => board.openDetails(task.id)}
      onMoveWithin={(delta) => tasks.moveWithin(place.tasks, place.colLabel, task, delta)}
      onDragStartCard={() => dnd.start(task.id)}
      dragging={dnd.draggingId === task.id}
      onDragEndCard={dnd.end}
    />
  );
}
