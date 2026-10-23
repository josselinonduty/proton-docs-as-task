import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { BoardTask } from '../lib/model';
import { dueBadgeText, dueState, dueStateLabel } from '../lib/dates';
import type {
  BoardView,
  CardDensity,
  CardFieldVisibility,
  DateFormat,
  StatusDef,
} from '../lib/types';
import { findStatus } from '../lib/statuses';
import { Icon } from './Icon';
import { PRIORITY_ICON, priorityLabel } from './taskFields';

interface EditableTaskCardProps {
  task: BoardTask;
  statuses: StatusDef[];
  density: CardDensity;
  showDescriptionPreview: boolean;
  cardFields: CardFieldVisibility;
  dateFormat: DateFormat;
  /** Which board view the card is shown in (drives section/status chips). */
  view: BoardView;
  now: Date;
  /** When true, the card grabs DOM focus once (used after a move). */
  focus: boolean;
  /** Unfinished tasks blocking this one, and tasks it blocks. */
  blockedBy?: number;
  blocking?: number;
  /** Direct sub-tasks done / total, and open ones at any depth (absent without sub-tasks). */
  subtasks?: { done: number; total: number; open: number };
  /** Title of the task this one is a sub-task of. */
  parentTitle?: string;
  /** True while this card's details are open in the side panel. */
  active?: boolean;
  /** Bulk-selection state; when non-null the card shows a selection checkbox. */
  selection?: { selected: boolean; onToggle: (e: React.MouseEvent) => void } | null;
  /** Disable drag handles (e.g. while a non-manual sort is active). */
  dragDisabled?: boolean;
  /** Hide the card while it is being dragged; the drop placeholder stands in for it. */
  dragging?: boolean;
  /** Briefly highlight this card (after quick-add creation). */
  highlight?: boolean;
  /** Report that this card received DOM focus (keyboard navigation cursor). */
  onFocusCard?: () => void;
  onFocusHandled: () => void;
  onToggleDone: () => void;
  /** Open the card's details panel. */
  onOpen: () => void;
  onMoveWithin: (delta: number) => void;
  onDragStartCard: () => void;
  onDragEndCard: () => void;
}

/**
 * A compact, scannable task card. Clicking it (or Enter) opens the task in
 * the details panel; the checkbox completes it in place. In selection mode a
 * click toggles selection instead.
 */
export function EditableTaskCard(props: EditableTaskCardProps) {
  const {
    task,
    statuses,
    density,
    showDescriptionPreview,
    cardFields,
    dateFormat,
    view,
    now,
    focus,
    active,
    blockedBy = 0,
    blocking = 0,
    subtasks,
    parentTitle,
    selection,
    dragDisabled,
    dragging,
    highlight,
    onFocusCard,
    onFocusHandled,
    onToggleDone,
    onOpen,
    onMoveWithin,
    onDragStartCard,
    onDragEndCard,
  } = props;

  const { t } = useTranslation();
  const articleRef = useRef<HTMLElement>(null);
  const status = findStatus(statuses, task.status);
  const done = status?.category === 'done';
  const state = dueState(task.due, now, done);
  const statusLabel = status?.label ?? task.status;

  useEffect(() => {
    if (focus && articleRef.current) {
      articleRef.current.focus();
      onFocusHandled();
    }
  }, [focus, onFocusHandled]);

  // Alt+Arrow moves the card without a mouse; Enter opens it. Only handled on
  // the card itself, not on its checkbox.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.target !== e.currentTarget) return;
    if (e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      onMoveWithin(-1);
    } else if (e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      onMoveWithin(1);
    }
  };

  const onClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button, input')) return;
    if (selection) selection.onToggle(e);
    else onOpen();
  };

  const stateWords: string[] = [];
  if (done) stateWords.push(t('due.completed'));
  if (state !== 'none' && !done) stateWords.push(dueStateLabel(state));
  if (task.priority === 'high' && !done) stateWords.push(t('card.highPriority'));
  if (blockedBy && !done) stateWords.push(t('card.blockedByCount', { count: blockedBy }));
  if (blocking) stateWords.push(t('card.blocksCount', { count: blocking }));
  if (subtasks)
    stateWords.push(t('card.subtasksDone', { done: subtasks.done, count: subtasks.total }));
  if (parentTitle !== undefined)
    stateWords.push(t('card.subtaskOf', { title: parentTitle || t('card.untitled') }));
  const ariaLabel = [
    t('card.aria', {
      title: task.title || t('card.untitled'),
      status: statusLabel,
      section: task.section,
    }),
    selection && t(selection.selected ? 'card.selected' : 'card.notSelected'),
    stateWords.length && `${stateWords.join(', ')}.`,
  ]
    .filter(Boolean)
    .join(' ');

  const showSection = view === 'workflow' && cardFields.sectionInWorkflow;
  const showStatus = view === 'sections' && cardFields.statusInSections;
  const descriptionText =
    cardFields.description && task.description && showDescriptionPreview
      ? truncate(task.description, 90)
      : null;

  return (
    <article
      ref={articleRef}
      className={[
        'pdt-taskcard',
        `pdt-taskcard--${status?.category ?? 'todo'}`,
        density === 'compact' ? 'pdt-taskcard--compact' : '',
        done ? 'is-done' : '',
        selection?.selected ? 'is-selected' : '',
        highlight ? 'is-new' : '',
        active ? 'is-active' : '',
        dragging ? 'is-dragging' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="listitem"
      data-task-id={task.id}
      tabIndex={0}
      aria-label={ariaLabel}
      aria-selected={selection ? selection.selected : undefined}
      aria-current={active ? 'true' : undefined}
      onFocus={(e) => e.target === e.currentTarget && onFocusCard?.()}
      onClick={onClick}
      draggable={!dragDisabled}
      onDragStart={(e) => {
        if (dragDisabled) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStartCard();
      }}
      onDragEnd={onDragEndCard}
      onKeyDown={onKeyDown}
    >
      <div className="pdt-card__top">
        {selection ? (
          <input
            type="checkbox"
            className="pdt-native-check pdt-card__select"
            checked={selection.selected}
            aria-label={selection.selected ? t('card.deselect') : t('card.select')}
            onChange={() => {}}
            onClick={(e) => selection.onToggle(e)}
          />
        ) : (
          <button
            type="button"
            className={`pdt-check ${done ? 'pdt-check--on' : ''}`}
            onClick={onToggleDone}
            aria-disabled={(blockedBy > 0 || (subtasks?.open ?? 0) > 0) && !done}
            aria-pressed={done}
            aria-label={done ? t('card.markNotDone') : t('card.markDone')}
            title={done ? t('card.markNotDoneKey') : t('card.markDoneKey')}
          >
            {done && <Icon name="checkmark" size={12} />}
          </button>
        )}
        <span className={`pdt-card__title ${done ? 'pdt-card__title--done' : ''}`}>
          {task.title || <span className="pdt-card__untitled">{t('card.untitled')}</span>}
        </span>
      </div>

      {descriptionText && <p className="pdt-card__desc">{descriptionText}</p>}

      {/* Metadata row. Each state carries an icon + text, not color alone. */}
      <div className="pdt-card__tags">
        {blockedBy > 0 && !done && (
          <span
            className="pdt-tag pdt-tag--blocked"
            title={t('card.blockedByOpen', { count: blockedBy })}
          >
            <Icon name="lock" size={12} />
            {t('card.blocked')}
          </span>
        )}
        {blocking > 0 && !done && (
          <span className="pdt-tag" title={t('card.blocksTasks', { count: blocking })}>
            <Icon name="link" size={12} />
            {t('card.blocksCount', { count: blocking })}
          </span>
        )}
        {subtasks && (
          <span
            className={`pdt-tag ${subtasks.done === subtasks.total ? 'pdt-tag--complete' : ''}`}
            title={t('card.subtasksDone', { done: subtasks.done, count: subtasks.total })}
          >
            <Icon name="subtasks" size={12} />
            {subtasks.done}/{subtasks.total}
          </span>
        )}
        {parentTitle !== undefined && (
          <span
            className="pdt-tag pdt-tag--parent"
            title={t('card.subtaskOf', { title: parentTitle || t('card.untitled') })}
          >
            <Icon name="arrow-up" size={12} />
            <span className="pdt-tag__text">{parentTitle || t('card.untitled')}</span>
          </span>
        )}
        {showSection && (
          <span className="pdt-tag" title={t('card.sectionTitle', { section: task.section })}>
            <Icon name="list" size={12} />
            {task.section}
          </span>
        )}
        {showStatus && (
          <span className="pdt-tag" title={t('card.statusTitle', { status: statusLabel })}>
            {statusLabel}
          </span>
        )}
        {cardFields.priority && task.priority && (
          <span
            className={`pdt-tag pdt-prio--${task.priority}`}
            title={t('filters.priorityChip', { priority: priorityLabel(task.priority) })}
          >
            <Icon name={PRIORITY_ICON} size={12} />
            {priorityLabel(task.priority)}
          </span>
        )}
        {cardFields.due && task.due && (
          <span
            className={`pdt-tag pdt-due--${state}`}
            title={t('card.dueTitle', { state: dueStateLabel(state), date: task.due })}
          >
            <Icon name="calendar" size={12} />
            {dueBadgeText(task.due, state, dateFormat)}
          </span>
        )}
        {cardFields.labels &&
          task.labels.map((label) => (
            <span
              key={label}
              className="pdt-tag pdt-tag--label"
              title={t('card.labelTitle', { label })}
            >
              #{label}
            </span>
          ))}
        {cardFields.description && task.description && !showDescriptionPreview && (
          <span className="pdt-tag" title={task.description}>
            <Icon name="note" size={12} />
            {t('card.note')}
          </span>
        )}
        {cardFields.assignee && task.assignee && (
          <span
            className="pdt-tag pdt-tag--who"
            title={t('card.assigneeTitle', { assignee: task.assignee })}
          >
            <span className="pdt-avatar" aria-hidden="true">
              {initials(task.assignee)}
            </span>
            {task.assignee}
          </span>
        )}
      </div>
    </article>
  );
}

function initials(name: string): string {
  const parts = name
    .trim()
    .split(/[\s._-]+/)
    .filter(Boolean);
  const letters = parts.length > 1 ? parts[0]![0]! + parts[1]![0]! : name.slice(0, 2);
  return letters.toUpperCase();
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
