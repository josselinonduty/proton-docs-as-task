import { useEffect, useRef, useState } from 'react';
import type { BoardTask } from '../lib/model';
import { dueBucket, type DueBucket } from '../lib/filters';
import type { CardDensity, Priority, StatusKey } from '../lib/types';

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

/** Short, non-color label + glyph for each due bucket (color is never the only cue). */
const DUE_META: Record<Exclude<DueBucket, 'none'>, { glyph: string; word: string }> = {
  overdue: { glyph: '⚠', word: 'Overdue' },
  today: { glyph: '★', word: 'Due today' },
  soon: { glyph: '◷', word: 'Due soon' },
  upcoming: { glyph: '◇', word: 'Due' },
};

const PRIORITY_GLYPH: Record<Priority, string> = { high: '⚑', medium: '▲', low: '▽' };

interface EditableTaskCardProps {
  task: BoardTask;
  statusColumns: { key: StatusKey; label: string }[];
  sections: string[];
  density: CardDensity;
  showDescriptionPreview: boolean;
  now: Date;
  /** Position of this card within its column (for Move up/down and announcements). */
  position: { index: number; count: number };
  /** When true, the card grabs DOM focus once (used after a move). */
  focus: boolean;
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
    now,
    position,
    focus,
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
  const done = task.status === 'done';
  const bucket = dueBucket(task.due, now);
  const statusLabel = statusColumns.find((c) => c.key === task.status)?.label ?? task.status;

  useEffect(() => {
    if (focus && articleRef.current) {
      articleRef.current.focus();
      onFocusHandled();
    }
  }, [focus, onFocusHandled]);

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
  if (bucket !== 'none' && !done) stateWords.push(DUE_META[bucket].word);
  if (task.priority === 'high' && !done) stateWords.push('High priority');
  const ariaLabel =
    `Task: ${task.title || 'Untitled'}. ${statusLabel}, section ${task.section}.` +
    (stateWords.length ? ` ${stateWords.join(', ')}.` : '');

  return (
    <article
      ref={articleRef}
      className={`pdt-taskcard pdt-taskcard--${task.status} ${
        density === 'compact' ? 'pdt-taskcard--compact' : ''
      } ${done ? 'is-done' : ''}`}
      role="listitem"
      tabIndex={0}
      aria-label={ariaLabel}
      draggable
      onDragStart={(e) => {
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
        {task.priority && (
          <span
            className={`pdt-tag pdt-prio--${task.priority}`}
            title={`${task.priority} priority`}
          >
            <span aria-hidden="true">{PRIORITY_GLYPH[task.priority]}</span>{' '}
            {task.priority[0]!.toUpperCase() + task.priority.slice(1)}
          </span>
        )}
        {task.due && (
          <span
            className={`pdt-tag pdt-due--${bucket}`}
            title={`${bucket === 'none' ? 'Due' : DUE_META[bucket].word}: ${task.due}`}
          >
            {bucket !== 'none' && <span aria-hidden="true">{DUE_META[bucket].glyph} </span>}
            {bucket === 'overdue' || bucket === 'today' || bucket === 'soon'
              ? `${DUE_META[bucket].word}`
              : task.due}
          </span>
        )}
        {task.assignee && (
          <span className="pdt-tag pdt-tag--who" title={`Assignee: ${task.assignee}`}>
            <span aria-hidden="true">@</span>
            {task.assignee}
          </span>
        )}
        {task.labels.map((label) => (
          <span key={label} className="pdt-tag pdt-tag--label" title={`Label: ${label}`}>
            #{label}
          </span>
        ))}
        {task.description && (
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
            <label className="pdt-field pdt-field--grow">
              <span className="pdt-field-label">Due date</span>
              <input
                type="date"
                className="pdt-input"
                value={isoDate(task.due)}
                onChange={(e) => onPatch({ due: e.target.value || undefined })}
              />
            </label>
          </div>

          <label className="pdt-field">
            <span className="pdt-field-label">Assignee</span>
            <input
              className="pdt-input"
              value={task.assignee ?? ''}
              placeholder="e.g. Sam Rivera"
              onChange={(e) => onPatch({ assignee: e.target.value.trim() || undefined })}
            />
          </label>

          <label className="pdt-field">
            <span className="pdt-field-label">Labels</span>
            <input
              className="pdt-input"
              value={task.labels.join(', ')}
              placeholder="comma, separated"
              onChange={(e) => onPatch({ labels: parseLabels(e.target.value) })}
            />
          </label>

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

/** Coerce a stored due value into `yyyy-mm-dd` for the date input, else ''. */
function isoDate(value?: string): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) return value.trim();
  return '';
}

function parseLabels(value: string): string[] {
  return value
    .split(',')
    .map((l) => l.trim().replace(/^#/, ''))
    .filter(Boolean);
}

function truncate(text: string, max: number): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}
