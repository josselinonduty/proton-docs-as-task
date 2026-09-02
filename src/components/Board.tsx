import { useMemo } from 'react';
import { groupBySection, groupByStatus, summarize } from '../lib/board';
import type { ParseResult, Settings } from '../lib/types';
import { TaskCard } from './TaskCard';

interface BoardProps {
  result: ParseResult;
  settings: Settings;
  grouping: 'status' | 'section';
  onGroupingChange: (grouping: 'status' | 'section') => void;
  onClose: () => void;
}

export function Board({
  result,
  settings,
  grouping,
  onGroupingChange,
  onClose,
}: BoardProps) {
  const groups = useMemo(
    () =>
      grouping === 'status'
        ? groupByStatus(result.tasks, settings.columns)
        : groupBySection(result.tasks, result.sections),
    [grouping, result, settings.columns],
  );

  const summary = useMemo(() => summarize(result), [result]);
  const pct = Math.round(summary.progress * 100);

  return (
    <section className="pdt-board" role="dialog" aria-label="Task board">
      <header className="pdt-board__header">
        <div className="pdt-board__titlewrap">
          <span className="pdt-logo" aria-hidden="true">
            ✓
          </span>
          <h1 className="pdt-board__title">
            {result.boardTitle || 'Tasks'}
          </h1>
          <span className="pdt-board__count">
            {summary.done}/{summary.total} done
          </span>
        </div>

        <div className="pdt-board__controls">
          <div className="pdt-segment" role="tablist" aria-label="Group by">
            <button
              role="tab"
              aria-selected={grouping === 'status'}
              className={grouping === 'status' ? 'pdt-segment__btn is-active' : 'pdt-segment__btn'}
              onClick={() => onGroupingChange('status')}
            >
              Status
            </button>
            <button
              role="tab"
              aria-selected={grouping === 'section'}
              className={grouping === 'section' ? 'pdt-segment__btn is-active' : 'pdt-segment__btn'}
              onClick={() => onGroupingChange('section')}
            >
              Section
            </button>
          </div>
          <button className="pdt-close" onClick={onClose} aria-label="Close board">
            Back to doc ✕
          </button>
        </div>
      </header>

      <div className="pdt-progress" aria-hidden="true">
        <div className="pdt-progress__bar" style={{ width: `${pct}%` }} />
      </div>

      {result.tasks.length === 0 ? (
        <div className="pdt-empty">
          <p>No tasks yet.</p>
          <p className="pdt-muted">
            Add lines like <code>- [ ] Write the report @due:2026-09-10 @priority:high</code>{' '}
            below the marker.
          </p>
        </div>
      ) : (
        <div className="pdt-columns">
          {groups.map((group) => (
            <div className="pdt-column" key={group.key}>
              <div className="pdt-column__head">
                <span className="pdt-column__label">{group.label}</span>
                <span className="pdt-column__count">{group.tasks.length}</span>
              </div>
              <div className="pdt-column__body">
                {group.tasks.map((task) => (
                  <TaskCard key={task.id} task={task} />
                ))}
                {group.tasks.length === 0 && (
                  <p className="pdt-column__empty pdt-muted">Nothing here</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
