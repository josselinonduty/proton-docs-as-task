import type { Priority, Task } from '../lib/types';

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

export function TaskCard({ task }: { task: Task }) {
  return (
    <article className={`pdt-card pdt-card--${task.status}`}>
      <div className="pdt-card__top">
        <span
          className={`pdt-check ${task.checked ? 'pdt-check--on' : ''}`}
          aria-hidden="true"
        >
          {task.checked ? '✓' : ''}
        </span>
        <p className={`pdt-card__title ${task.checked ? 'pdt-card__title--done' : ''}`}>
          {task.title || <em className="pdt-muted">(untitled)</em>}
        </p>
      </div>

      {(task.priority || task.due || task.assignee || task.labels.length > 0) && (
        <div className="pdt-card__meta">
          {task.priority && (
            <span className={`pdt-badge pdt-badge--prio-${task.priority}`}>
              {PRIORITY_LABEL[task.priority]}
            </span>
          )}
          {task.due && <span className="pdt-badge pdt-badge--due">📅 {task.due}</span>}
          {task.assignee && (
            <span className="pdt-badge pdt-badge--who">@{task.assignee}</span>
          )}
          {task.labels.map((label) => (
            <span key={label} className="pdt-badge pdt-badge--label">
              #{label}
            </span>
          ))}
        </div>
      )}
    </article>
  );
}
