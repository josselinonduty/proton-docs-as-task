import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardTask } from '@/lib/model';
import { Icon } from './Icon';

export interface TaskSubtasksProps {
  /** The task the open one is a sub-task of, if any. */
  parent?: BoardTask;
  /** Direct sub-tasks of the open task, in board order. */
  subtasks: BoardTask[];
  /** Whether a task is completed (in a Done status). */
  isDone: (task: BoardTask) => boolean;
  /** Tasks the open one may be moved under without creating a cycle. */
  parentCandidates: () => BoardTask[];
  onOpen: (id: string) => void;
  onAdd: (title: string) => void;
  onToggleDone: (id: string) => void;
  /** Detach a sub-task from the open task; it stays on the board. */
  onDetach: (id: string) => void;
  onDelete: (id: string) => void;
  /** Move the open task under another one, or detach it from its parent. */
  onSetParent: (id: string | undefined) => void;
}

/** The open task's place in the sub-task tree: its parent and its own sub-tasks. */
export function TaskSubtasks({
  parent,
  subtasks,
  isDone,
  parentCandidates,
  onOpen,
  onAdd,
  onToggleDone,
  onDetach,
  onDelete,
  onSetParent,
}: TaskSubtasksProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [query, setQuery] = useState('');
  const needle = query.trim().toLowerCase();
  const matches = needle
    ? parentCandidates()
        .filter((task) => task.title.toLowerCase().includes(needle))
        .slice(0, 6)
    : [];
  const done = subtasks.filter(isDone).length;
  const titleOf = (task: BoardTask) => task.title || t('card.untitled');

  const submit = () => {
    const title = draft.trim();
    if (!title) return;
    onAdd(title);
    setDraft('');
  };

  return (
    <>
      <div className="pdt-field">
        <span className="pdt-field-label" id="pdt-subtasks-label">
          {t('subtasks.title')}
          {subtasks.length > 0 && (
            <span className="pdt-text-weak">
              {' · '}
              {t('subtasks.progress', { done, count: subtasks.length })}
            </span>
          )}
        </span>
        {subtasks.length > 0 && (
          <ul className="pdt-rel__list" aria-labelledby="pdt-subtasks-label">
            {subtasks.map((task) => (
              <li key={task.id} className="pdt-rel__item">
                <button
                  type="button"
                  className={`pdt-check ${isDone(task) ? 'pdt-check--on' : ''}`}
                  aria-pressed={isDone(task)}
                  aria-label={t(isDone(task) ? 'subtasks.markNotDone' : 'subtasks.markDone', {
                    title: titleOf(task),
                  })}
                  onClick={() => onToggleDone(task.id)}
                >
                  {isDone(task) && <Icon name="checkmark" size={12} />}
                </button>
                <button
                  type="button"
                  className="pdt-rel__open"
                  title={t('relations.open')}
                  onClick={() => onOpen(task.id)}
                >
                  <span className={isDone(task) ? 'pdt-card__title--done' : ''}>
                    {titleOf(task)}
                  </span>
                </button>
                <button
                  type="button"
                  className="pdt-btn pdt-btn-icon pdt-btn-sm"
                  aria-label={t('subtasks.detachAria', { title: titleOf(task) })}
                  title={t('subtasks.detach')}
                  onClick={() => onDetach(task.id)}
                >
                  <Icon name="cross" size={12} />
                </button>
                <button
                  type="button"
                  className="pdt-btn pdt-btn-icon pdt-btn-sm"
                  aria-label={t('subtasks.deleteAria', { title: titleOf(task) })}
                  title={t('subtasks.delete')}
                  onClick={() => onDelete(task.id)}
                >
                  <Icon name="trash" size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <input
          className="pdt-input"
          value={draft}
          placeholder={t('subtasks.addPlaceholder')}
          aria-label={t('subtasks.add')}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            submit();
          }}
        />
      </div>

      <div className="pdt-field">
        <span className="pdt-field-label">{t('subtasks.parent')}</span>
        {parent ? (
          <div className="pdt-rel__item">
            <button
              type="button"
              className="pdt-rel__open"
              title={t('relations.open')}
              onClick={() => onOpen(parent.id)}
            >
              <Icon name={isDone(parent) ? 'checkmark-circle' : 'subtasks'} size={14} />
              <span className={isDone(parent) ? 'pdt-card__title--done' : ''}>
                {titleOf(parent)}
              </span>
            </button>
            <button
              type="button"
              className="pdt-btn pdt-btn-icon pdt-btn-sm"
              aria-label={t('subtasks.removeParentAria', { title: titleOf(parent) })}
              title={t('subtasks.removeParent')}
              onClick={() => onSetParent(undefined)}
            >
              <Icon name="cross" size={12} />
            </button>
          </div>
        ) : (
          <>
            <input
              className="pdt-input"
              type="search"
              value={query}
              placeholder={t('subtasks.parentPlaceholder')}
              aria-label={t('subtasks.parentSearch')}
              onChange={(e) => setQuery(e.target.value)}
            />
            {needle && (
              <ul className="pdt-rel__list" aria-label={t('relations.matching')}>
                {matches.length ? (
                  matches.map((task) => (
                    <li key={task.id}>
                      <button
                        type="button"
                        className="pdt-rel__open"
                        onClick={() => {
                          onSetParent(task.id);
                          setQuery('');
                        }}
                      >
                        <Icon name="plus" size={14} />
                        <span>{titleOf(task)}</span>
                        <span className="pdt-text-weak">{task.section}</span>
                      </button>
                    </li>
                  ))
                ) : (
                  <li className="pdt-text-weak pdt-details__hint">{t('subtasks.noParent')}</li>
                )}
              </ul>
            )}
          </>
        )}
      </div>
    </>
  );
}
