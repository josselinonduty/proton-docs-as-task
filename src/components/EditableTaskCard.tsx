import { useState } from 'react';
import type { EditableTask, BoardColumn } from '../lib/model';
import type { Priority, StatusKey } from '../lib/types';

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

interface EditableTaskCardProps {
  task: EditableTask;
  columns: BoardColumn[];
  columnId: string;
  onChange: (patch: Partial<EditableTask>) => void;
  onDelete: () => void;
  onMove: (toColumnId: string) => void;
}

export function EditableTaskCard({
  task,
  columns,
  columnId,
  onChange,
  onDelete,
  onMove,
}: EditableTaskCardProps) {
  const [open, setOpen] = useState(false);
  const done = task.status === 'done';

  const toggleDone = () => onChange({ status: done ? 'todo' : 'done' });

  return (
    <article className={`pdt-taskcard pdt-taskcard--${task.status}`}>
      <div className="pdt-card__top">
        <button
          type="button"
          className={`pdt-check ${done ? 'pdt-check--on' : ''}`}
          onClick={toggleDone}
          aria-pressed={done}
          aria-label={done ? 'Mark as not done' : 'Mark as done'}
        >
          {done ? '✓' : ''}
        </button>
        <input
          className={`pdt-card__title-input ${done ? 'pdt-card__title--done' : ''}`}
          value={task.title}
          placeholder="Task title…"
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <button
          type="button"
          className="pdt-btn pdt-btn-icon"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          title="Task details"
        >
          {open ? '▾' : '⋯'}
        </button>
      </div>

      <div className="pdt-card__quickmeta">
        <select
          className="pdt-mini-select"
          value={task.status}
          onChange={(e) => onChange({ status: e.target.value as StatusKey })}
          aria-label="Status"
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          className={`pdt-mini-select ${task.priority ? `pdt-prio--${task.priority}` : ''}`}
          value={task.priority ?? ''}
          onChange={(e) =>
            onChange({ priority: (e.target.value || undefined) as Priority | undefined })
          }
          aria-label="Priority"
        >
          {PRIORITY_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          className="pdt-mini-date"
          value={isoDate(task.due)}
          onChange={(e) => onChange({ due: e.target.value || undefined })}
          aria-label="Due date"
          title={task.due ? `Due ${task.due}` : 'Set due date'}
        />
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
              onChange={(e) => onChange({ description: e.target.value || undefined })}
            />
          </label>

          <label className="pdt-field">
            <span className="pdt-field-label">Assignee</span>
            <input
              className="pdt-input"
              value={task.assignee ?? ''}
              placeholder="e.g. Sam Rivera"
              onChange={(e) => onChange({ assignee: e.target.value.trim() || undefined })}
            />
          </label>

          <label className="pdt-field">
            <span className="pdt-field-label">Labels</span>
            <input
              className="pdt-input"
              value={task.labels.join(', ')}
              placeholder="comma, separated"
              onChange={(e) => onChange({ labels: parseLabels(e.target.value) })}
            />
          </label>

          <div className="pdt-field pdt-field--row">
            <label className="pdt-field pdt-field--grow">
              <span className="pdt-field-label">Column</span>
              <select
                className="pdt-input"
                value={columnId}
                onChange={(e) => onMove(e.target.value)}
              >
                {columns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || 'Untitled'}
                  </option>
                ))}
              </select>
            </label>
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
