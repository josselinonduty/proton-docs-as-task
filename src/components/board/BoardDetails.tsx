import { useTranslation } from 'react-i18next';
import {
  addSubtask,
  canLink,
  canSetParent,
  linksOf,
  linkTasks,
  openBlockers,
  openSubtasks,
  parentOf,
  setParent,
  subtasksOf,
  unlinkTasks,
  type BoardTask,
} from '@/lib/model';
import type { Suggestion } from '@/lib/suggestions';
import { TaskDetailsPanel } from '@/components/TaskDetailsPanel';
import { useBoard } from './BoardContext';
import type { CardPlace } from './boardLayout';
import type { DetailsTarget } from './useDetailsNavigation';

interface BoardDetailsProps {
  task: BoardTask;
  target: DetailsTarget;
  /** The card's column, when it's on screen. */
  place: CardPlace | undefined;
  assigneeSuggestions: Suggestion[];
  labelSuggestions: Suggestion[];
  onBack: (() => void) | undefined;
  onOpenLinked: (id: string) => void;
  onClose: () => void;
}

/** The details panel for `task`, with its links, sub-tasks and edits wired to the board. */
export function BoardDetails({ task, target, place, ...props }: BoardDetailsProps) {
  const { t } = useTranslation();
  const { model, settings, now, onChange, announce, tasks, requestDelete } = useBoard();
  return (
    <TaskDetailsPanel
      task={task}
      statuses={model.statuses}
      sections={model.sections}
      assigneeSuggestions={props.assigneeSuggestions}
      labelSuggestions={props.labelSuggestions}
      now={now}
      dateFormat={settings.dateFormat}
      position={place ? { index: place.ids.indexOf(task.id), count: place.ids.length } : null}
      focusTarget={target.focus}
      focusRequest={target.nonce}
      links={linksOf(model, task)}
      openBlockers={openBlockers(model, task).length}
      linkCandidates={(kind) =>
        model.tasks.filter((candidate) => canLink(model, task.id, candidate.id, kind))
      }
      openSubtasks={openSubtasks(model, task).length}
      subtasks={{
        parent: parentOf(model, task),
        subtasks: subtasksOf(model, task),
        parentCandidates: () =>
          model.tasks.filter((candidate) => canSetParent(model, task.id, candidate.id)),
        onOpen: props.onOpenLinked,
        onAdd: (title) => {
          const { model: next } = addSubtask(model, task.id, title);
          onChange(next, t('board.undo.subtaskAdded'));
          announce(t('board.subtaskAdded', { title, parent: tasks.taskName(task) }));
        },
        onToggleDone: (id) => {
          const sub = model.tasks.find((candidate) => candidate.id === id);
          if (sub) tasks.toggleDone(sub);
        },
        onDetach: (id) => {
          onChange(setParent(model, id, undefined), t('board.undo.subtaskDetached'));
          announce(t('board.subtaskDetached'));
        },
        onDelete: (id) => {
          const sub = model.tasks.find((candidate) => candidate.id === id);
          if (sub) requestDelete(sub);
        },
        onSetParent: (id) => {
          onChange(
            setParent(model, task.id, id),
            t(id ? 'board.undo.parentSet' : 'board.undo.parentRemoved'),
          );
          announce(t(id ? 'board.parentSet' : 'board.parentRemoved'));
        },
      }}
      onBack={props.onBack}
      onOpenLinked={props.onOpenLinked}
      onLink={(kind, id) => {
        onChange(linkTasks(model, task.id, id, kind), t('board.undo.linked'));
        announce(t('board.linked'));
      }}
      onUnlink={(id) => onChange(unlinkTasks(model, task.id, id), t('board.undo.unlinked'))}
      onPatch={(patch) => tasks.patch(task.id, patch)}
      onToggleDone={() => tasks.toggleDone(task)}
      onSetStatus={(st) => tasks.setStatus(task, st)}
      onSetSection={(sec) => tasks.setSection(task, sec)}
      onMoveWithin={(delta) => {
        if (place) tasks.moveWithin(place.tasks, place.colLabel, task, delta);
      }}
      onDuplicate={() => tasks.duplicate(task)}
      onCopyMarkdown={() => void tasks.copyMarkdown(task)}
      onDelete={() => requestDelete(task)}
      onClose={props.onClose}
    />
  );
}
