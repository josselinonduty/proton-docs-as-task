import { useEffect, useRef, useState } from 'react';
import type { BoardTask } from '../lib/model';
import { dueBadgeText, dueState, dueStateLabel } from '../lib/dates';
import type { Suggestion } from '../lib/suggestions';
import type {
  CardDensity,
  CardFieldVisibility,
  DateFormat,
  Priority,
  StatusKey,
} from '../lib/types';
import { Combobox } from './Combobox';
import { LabelInput } from './LabelInput';
import { DueDateControl } from './DueDateControl';

const STATUS_OPTIONS: { value: StatusKey; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'doing', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS: { value: '' | Priority; label: string }[] = [
  { value: '', label: 'No priority' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

const PRIORITY_GLYPH: Record<Priority, string> = { high: '⚑', medium: '▲', low: '▽' };

interface EditableTaskCardProps {
  task: BoardTask;
  statusColumns: { key: StatusKey; label: string }[];
  sections: string[];
  density: CardDensity;
  showDescriptionPreview: boolean;
  cardFields: CardFieldVisibility;
  dateFormat: DateFormat;
  /** Which board view the card is shown in (drives section/status chips). */
  view: 'workflow' | 'sections' | 'swimlane';
  assigneeSuggestions: Suggestion[];
  labelSuggestions: Suggestion[];
  now: Date;
  /** Position of this card within its column (for Move up/down and announcements). */
  position: { index: number; count: number };
  /** When true, the card grabs DOM focus once (used after a move). */
  focus: boolean;
  /** Bulk-selection state; when non-null the card shows a selection checkbox. */
  selection?: { selected: boolean; onToggle: (e: React.MouseEvent) => void } | null;
  /** Disable drag handles (e.g. while a non-manual sort is active). */
  dragDisabled?: boolean;
  /** Briefly highlight this card (after quick-add creation). */
  highlight?: boolean;
  /**
   * Keyboard-driven imperative signals, present only on the focused card.
   * Bumping a counter expands details / focuses the title / focuses the move
   * control, matching the E, Enter and M shortcuts.
   */
  signals?: { open: number; edit: number; move: number };
  /** Report that this card received DOM focus (keyboard navigation cursor). */
  onFocusCard?: () => void;
  onFocusHandled: () => void;
  onToggleDone: () => void;
  onPatch: (patch: Partial<Omit<BoardTask, 'id' | 'order'>>) => void;
  onSetStatus: (status: StatusKey) => void;
  onSetSection: (section: string) => void;
  onMoveWithin: (delta: number) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onCopyMarkdown: () => void;
  onDragStartCard: () => void;
  onDropOnCard: () => void;
}

export function EditableTaskCard(props: EditableTaskCardProps) {
  const {
    task,
    statusColumns,
    sections,
    density,
    showDescriptionPreview,
    cardFields,
    dateFormat,
    view,
    assigneeSuggestions,
    labelSuggestions,
    now,
    position,
    focus,
    selection,
    dragDisabled,
    highlight,
    signals,
    onFocusCard,
    onFocusHandled,
    onToggleDone,
    onPatch,
    onSetStatus,
    onSetSection,
    onMoveWithin,
    onDuplicate,
    onDelete,
    onCopyMarkdown,
    onDragStartCard,
    onDropOnCard,
  } = props;

  const [open, setOpen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const sectionRef = useRef<HTMLSelectElement>(null);
  const done = task.status === 'done';
  const state = dueState(task.due, now, done);
  const statusLabel = statusColumns.find((c) => c.key === task.status)?.label ?? task.status;

  useEffect(() => {
    if (focus && articleRef.current) {
      articleRef.current.focus();
      onFocusHandled();
    }
  }, [focus, onFocusHandled]);

  // React to keyboard shortcut signals from the board (E / Enter / M).
  const openSig = signals?.open ?? 0;
  const editSig = signals?.edit ?? 0;
  const moveSig = signals?.move ?? 0;
  useEffect(() => {
    if (openSig > 0) setOpen(true);
  }, [openSig]);
  useEffect(() => {
    if (editSig > 0) titleRef.current?.focus();
  }, [editSig]);
  useEffect(() => {
    if (moveSig > 0) {
      setOpen(true);
      window.setTimeout(() => sectionRef.current?.focus(), 0);
    }
  }, [moveSig]);

  // Keyboard movement: Alt+Arrow moves the card without a mouse.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!e.altKey) return;
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onMoveWithin(-1);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onMoveWithin(1);
    }
  };

  const stateWords: string[] = [];
  if (done) stateWords.push('Completed');
  if (state !== 'none' && !done) stateWords.push(dueStateLabel(state));
  if (task.priority === 'high' && !done) stateWords.push('High priority');
  const ariaLabel =
    `Task: ${task.title || 'Untitled'}. ${statusLabel}, section ${task.section}.` +
    (selection ? ` ${selection.selected ? 'Selected' : 'Not selected'}.` : '') +
    (stateWords.length ? ` ${stateWords.join(', ')}.` : '');

  return (
    <article
      ref={articleRef}
      className={`pdt-taskcard pdt-taskcard--${task.status} ${
        density === 'compact' ? 'pdt-taskcard--compact' : ''
      } ${done ? 'is-done' : ''} ${selection?.selected ? 'is-selected' : ''} ${
        highlight ? 'is-new' : ''
      }`}
      role="listitem"
      tabIndex={0}
      aria-label={ariaLabel}
      aria-selected={selection ? selection.selected : undefined}
      onFocus={onFocusCard}
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
        {selection && (
          <input
            type="checkbox"
            className="pdt-native-check pdt-card__select"
            checked={selection.selected}
            aria-label={selection.selected ? 'Deselect task' : 'Select task'}
            onChange={() => {}}
            onClick={(e) => selection.onToggle(e)}
          />
        )}
        <button
          type="button"
          className={`pdt-check ${done ? 'pdt-check--on' : ''}`}
          onClick={onToggleDone}
          aria-pressed={done}
          aria-label={done ? 'Mark as not done' : 'Mark as done'}
        >
          {done ? '✓' : ''}
        </button>
        <input
          ref={titleRef}
          className={`pdt-card__title-input ${done ? 'pdt-card__title--done' : ''}`}
          value={task.title}
          placeholder="Task title…"
          aria-label="Task title"
          onChange={(e) => onPatch({ title: e.target.value })}
        />
        <button
          type="button"
          className="pdt-btn pdt-btn-icon"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Hide task details' : 'Show task details'}
          title="Task details"
        >
          {open ? '▾' : '⋯'}
        </button>
      </div>

      {/* Collapsed metadata row. Each state carries a glyph + text, not color alone. */}
      <div className="pdt-card__tags">
        {view === 'workflow' && cardFields.sectionInWorkflow && (
          <span className="pdt-tag pdt-tag--section" title={`Section: ${task.section}`}>
            <span aria-hidden="true">▤ </span>
            {task.section}
          </span>
        )}
        {view === 'sections' && cardFields.statusInSections && (
          <span className="pdt-tag pdt-tag--status" title={`Status: ${statusLabel}`}>
            {statusLabel}
          </span>
        )}
        {cardFields.priority && task.priority && (
          <span
            className={`pdt-tag pdt-prio--${task.priority}`}
            title={`${task.priority} priority`}
          >
            <span aria-hidden="true">{PRIORITY_GLYPH[task.priority]}</span>{' '}
            {task.priority[0]!.toUpperCase() + task.priority.slice(1)}
          </span>
        )}
        {cardFields.due && task.due && (
          <span
            className={`pdt-tag pdt-due--${state}`}
            title={`${dueStateLabel(state)}: ${task.due}`}
          >
            <span aria-hidden="true">◇ </span>
            {dueBadgeText(task.due, state, dateFormat)}
          </span>
        )}
        {cardFields.assignee && task.assignee && (
          <span className="pdt-tag pdt-tag--who" title={`Assignee: ${task.assignee}`}>
            <span aria-hidden="true">@</span>
            {task.assignee}
          </span>
        )}
        {cardFields.labels &&
          task.labels.map((label) => (
            <span key={label} className="pdt-tag pdt-tag--label" title={`Label: ${label}`}>
              #{label}
            </span>
          ))}
        {cardFields.description && task.description && (
          <span className="pdt-tag pdt-tag--desc" title={task.description}>
            <span aria-hidden="true">🗎 </span>
            {showDescriptionPreview ? truncate(task.description, 40) : 'Note'}
          </span>
        )}
      </div>

      {open && (
        <div className="pdt-card__details">
          <label className="pdt-field">
            <span className="pdt-field-label">Description</span>
            <textarea
              className="pdt-textarea"
              rows={3}
              value={task.description ?? ''}
              placeholder="Add a description…"
              onChange={(e) => onPatch({ description: e.target.value || undefined })}
            />
          </label>

          <div className="pdt-field pdt-field--row">
            <label className="pdt-field pdt-field--grow">
              <span className="pdt-field-label">Status</span>
              <select
                className="pdt-input"
                value={task.status}
                onChange={(e) => onSetStatus(e.target.value as StatusKey)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {statusColumns.find((c) => c.key === o.value)?.label ?? o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="pdt-field pdt-field--grow">
              <span className="pdt-field-label">Section</span>
              <select
                ref={sectionRef}
                className="pdt-input"
                value={task.section}
                onChange={(e) => onSetSection(e.target.value)}
              >
                {sections.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="pdt-field pdt-field--row">
            <label className="pdt-field pdt-field--grow">
              <span className="pdt-field-label">Priority</span>
              <select
                className="pdt-input"
                value={task.priority ?? ''}
                onChange={(e) =>
                  onPatch({ priority: (e.target.value || undefined) as Priority | undefined })
                }
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="pdt-field pdt-field--grow">
              <span className="pdt-field-label">Due date</span>
              <DueDateControl
                value={task.due}
                onChange={(due) => onPatch({ due })}
                now={now}
                format={dateFormat}
                completed={done}
                ariaLabel="Due date"
              />
            </div>
          </div>

          <div className="pdt-field">
            <span className="pdt-field-label">Assignee</span>
            <Combobox
              value={task.assignee ?? ''}
              suggestions={assigneeSuggestions}
              onChange={(assignee) => onPatch({ assignee: assignee.trim() || undefined })}
              placeholder="e.g. Sam Rivera"
              ariaLabel="Assignee"
              showCounts
            />
          </div>

          <div className="pdt-field">
            <span className="pdt-field-label">Labels</span>
            <LabelInput
              labels={task.labels}
              suggestions={labelSuggestions}
              onChange={(labels) => onPatch({ labels })}
              ariaLabel="Labels"
            />
          </div>

          <div className="pdt-card__move">
            <span className="pdt-field-label">Move</span>
            <div className="pdt-card__move-row">
              <button
                type="button"
                className="pdt-btn pdt-btn-sm"
                disabled={position.index <= 0}
                onClick={() => onMoveWithin(-1)}
                aria-label="Move up"
              >
                ↑ Up
              </button>
              <button
                type="button"
                className="pdt-btn pdt-btn-sm"
                disabled={position.index >= position.count - 1}
                onClick={() => onMoveWithin(1)}
                aria-label="Move down"
              >
                ↓ Down
              </button>
            </div>
          </div>

          <div className="pdt-card__actions">
            <button type="button" className="pdt-btn pdt-btn-sm" onClick={onDuplicate}>
              Duplicate
            </button>
            <button type="button" className="pdt-btn pdt-btn-sm" onClick={onCopyMarkdown}>
              Copy as Markdown
            </button>
            <button type="button" className="pdt-btn pdt-btn-sm pdt-btn-danger" onClick={onDelete}>
              Delete
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
