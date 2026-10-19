import { useEffect, useRef } from 'react';
import type { BoardTask } from '../lib/model';
import { dueBadgeText, dueState, dueStateLabel } from '../lib/dates';
import type { CardDensity, CardFieldVisibility, DateFormat, StatusKey } from '../lib/types';
import { Icon } from './Icon';
import { PRIORITY_ICON, priorityLabel } from './taskFields';

interface EditableTaskCardProps {
  task: BoardTask;
  statusColumns: { key: StatusKey; label: string }[];
  density: CardDensity;
  showDescriptionPreview: boolean;
  cardFields: CardFieldVisibility;
  dateFormat: DateFormat;
  /** Which board view the card is shown in (drives section/status chips). */
  view: 'workflow' | 'sections' | 'swimlane';
  now: Date;
  /** When true, the card grabs DOM focus once (used after a move). */
  focus: boolean;
  /** True while this card's details are open in the side panel. */
  active?: boolean;
  /** Bulk-selection state; when non-null the card shows a selection checkbox. */
  selection?: { selected: boolean; onToggle: (e: React.MouseEvent) => void } | null;
  /** Disable drag handles (e.g. while a non-manual sort is active). */
  dragDisabled?: boolean;
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
  onDropOnCard: () => void;
}

/**
 * A compact, scannable task card. Clicking it (or Enter) opens the task in
 * the details panel; the checkbox completes it in place. In selection mode a
 * click toggles selection instead.
 */
export function EditableTaskCard(props: EditableTaskCardProps) {
  const {
    task,
    statusColumns,
    density,
    showDescriptionPreview,
    cardFields,
    dateFormat,
    view,
    now,
    focus,
    active,
    selection,
    dragDisabled,
    highlight,
    onFocusCard,
    onFocusHandled,
    onToggleDone,
    onOpen,
    onMoveWithin,
    onDragStartCard,
    onDropOnCard,
  } = props;

  const articleRef = useRef<HTMLElement>(null);
  const done = task.status === 'done';
  const state = dueState(task.due, now, done);
  const statusLabel = statusColumns.find((c) => c.key === task.status)?.label ?? task.status;

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
  if (done) stateWords.push('Completed');
  if (state !== 'none' && !done) stateWords.push(dueStateLabel(state));
  if (task.priority === 'high' && !done) stateWords.push('High priority');
  const ariaLabel =
    `${task.title || 'Untitled task'}. ${statusLabel}, section ${task.section}.` +
    (selection ? ` ${selection.selected ? 'Selected' : 'Not selected'}.` : '') +
    (stateWords.length ? ` ${stateWords.join(', ')}.` : '');

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
        `pdt-taskcard--${task.status}`,
        density === 'compact' ? 'pdt-taskcard--compact' : '',
        done ? 'is-done' : '',
        selection?.selected ? 'is-selected' : '',
        highlight ? 'is-new' : '',
        active ? 'is-active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="listitem"
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
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onDropOnCard();
      }}
      onKeyDown={onKeyDown}
    >
      <div className="pdt-card__top">
        {selection ? (
          <input
            type="checkbox"
            className="pdt-native-check pdt-card__select"
            checked={selection.selected}
            aria-label={selection.selected ? 'Deselect task' : 'Select task'}
            onChange={() => {}}
            onClick={(e) => selection.onToggle(e)}
          />
        ) : (
          <button
            type="button"
            className={`pdt-check ${done ? 'pdt-check--on' : ''}`}
            onClick={onToggleDone}
            aria-pressed={done}
            aria-label={done ? 'Mark as not done' : 'Mark as done'}
            title={done ? 'Mark as not done (X)' : 'Mark as done (X)'}
          >
            {done && <Icon name="checkmark" size={12} />}
          </button>
        )}
        <span className={`pdt-card__title ${done ? 'pdt-card__title--done' : ''}`}>
          {task.title || <span className="pdt-card__untitled">Untitled task</span>}
        </span>
      </div>

      {descriptionText && <p className="pdt-card__desc">{descriptionText}</p>}

      {/* Metadata row. Each state carries an icon + text, not color alone. */}
      <div className="pdt-card__tags">
        {showSection && (
          <span className="pdt-tag" title={`Section: ${task.section}`}>
            <Icon name="list" size={12} />
            {task.section}
          </span>
        )}
        {showStatus && (
          <span className="pdt-tag" title={`Status: ${statusLabel}`}>
            {statusLabel}
          </span>
        )}
        {cardFields.priority && task.priority && (
          <span
            className={`pdt-tag pdt-prio--${task.priority}`}
            title={`${priorityLabel(task.priority)} priority`}
          >
            <Icon name={PRIORITY_ICON} size={12} />
            {priorityLabel(task.priority)}
          </span>
        )}
        {cardFields.due && task.due && (
          <span
            className={`pdt-tag pdt-due--${state}`}
            title={`${dueStateLabel(state)}: ${task.due}`}
          >
            <Icon name="calendar" size={12} />
            {dueBadgeText(task.due, state, dateFormat)}
          </span>
        )}
        {cardFields.labels &&
          task.labels.map((label) => (
            <span key={label} className="pdt-tag pdt-tag--label" title={`Label: ${label}`}>
              #{label}
            </span>
          ))}
        {cardFields.description && task.description && !showDescriptionPreview && (
          <span className="pdt-tag" title={task.description}>
            <Icon name="note" size={12} />
            Note
          </span>
        )}
        {cardFields.assignee && task.assignee && (
          <span className="pdt-tag pdt-tag--who" title={`Assignee: ${task.assignee}`}>
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
