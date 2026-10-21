import { useEffect, useLayoutEffect, useRef } from 'react';
import type { BoardTask, LinkKind, TaskLinks } from '../lib/model';
import type { Suggestion } from '../lib/suggestions';
import type { DateFormat, Priority, StatusDef, StatusKey } from '../lib/types';
import { findStatus, isDoneStatus } from '../lib/statuses';
import { Combobox } from './Combobox';
import { LabelInput } from './LabelInput';
import { DueDateControl } from './DueDateControl';
import { Icon } from './Icon';
import { PRIORITY_OPTIONS } from './taskFields';
import { TaskRelations } from './TaskRelations';

/** Which control to focus when the panel opens (E → title, M → section). */
export type DetailsFocus = 'panel' | 'title' | 'section';

interface TaskDetailsPanelProps {
  task: BoardTask;
  statuses: StatusDef[];
  sections: string[];
  assigneeSuggestions: Suggestion[];
  labelSuggestions: Suggestion[];
  now: Date;
  dateFormat: DateFormat;
  /** Position of the task in its visible column, for Move up/down. */
  position: { index: number; count: number } | null;
  /** Re-applied whenever `focusRequest` changes. */
  focusTarget: DetailsFocus;
  focusRequest: number;
  links: TaskLinks;
  /** Number of unfinished tasks standing in the way of this one. */
  openBlockers: number;
  linkCandidates: (kind: LinkKind) => BoardTask[];
  /** Present when the panel was reached through a link. */
  onBack?: () => void;
  onOpenLinked: (id: string) => void;
  onLink: (kind: LinkKind, id: string) => void;
  onUnlink: (id: string) => void;
  onPatch: (patch: Partial<Omit<BoardTask, 'id' | 'order'>>) => void;
  onToggleDone: () => void;
  onSetStatus: (status: StatusKey) => void;
  onSetSection: (section: string) => void;
  onMoveWithin: (delta: number) => void;
  onDuplicate: () => void;
  onCopyMarkdown: () => void;
  onDelete: () => void;
  onClose: () => void;
}

/**
 * Side panel for viewing and editing one task — Proton's drawer pattern. It
 * is non-modal: the board stays usable next to it, and opening another card
 * swaps its content. Escape closes it and returns focus to the card.
 */
export function TaskDetailsPanel({
  task,
  statuses,
  sections,
  assigneeSuggestions,
  labelSuggestions,
  now,
  dateFormat,
  position,
  focusTarget,
  focusRequest,
  links,
  openBlockers,
  linkCandidates,
  onBack,
  onOpenLinked,
  onLink,
  onUnlink,
  onPatch,
  onToggleDone,
  onSetStatus,
  onSetSection,
  onMoveWithin,
  onDuplicate,
  onCopyMarkdown,
  onDelete,
  onClose,
}: TaskDetailsPanelProps) {
  const panelRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const sectionRef = useRef<HTMLSelectElement>(null);
  const done = isDoneStatus(statuses, task.status);
  const blocked = openBlockers > 0;

  useEffect(() => {
    const target =
      focusTarget === 'title'
        ? titleRef.current
        : focusTarget === 'section'
          ? sectionRef.current
          : panelRef.current;
    target?.focus();
    if (focusTarget === 'title') titleRef.current?.select();
  }, [focusTarget, focusRequest, task.id]);

  useLayoutEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
  }, [task.title]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
    // Keep board shortcuts (N, X, Delete…) from acting on the board while
    // working in the panel; only the command palette stays global.
    const palette = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
    if (!palette) e.stopPropagation();
  };

  return (
    <aside
      ref={panelRef}
      className="pdt-details"
      aria-label={`Task details: ${task.title || 'Untitled task'}`}
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <header className="pdt-details__head">
        {onBack && (
          <button
            type="button"
            className="pdt-btn pdt-btn-icon pdt-btn-sm"
            aria-label="Back to previous task"
            title="Back"
            onClick={onBack}
          >
            <Icon name="arrow-left" size={14} />
          </button>
        )}
        <button
          type="button"
          className={`pdt-btn pdt-btn-sm ${done ? 'pdt-btn-selected' : ''}`}
          aria-pressed={done}
          disabled={blocked && !done}
          onClick={onToggleDone}
        >
          <Icon name="checkmark" size={14} />
          {done ? 'Completed' : 'Mark complete'}
        </button>
        <span className="pdt-board__spacer" />
        <button
          type="button"
          className="pdt-btn pdt-btn-icon pdt-btn-sm"
          aria-label="Duplicate task"
          title="Duplicate"
          onClick={onDuplicate}
        >
          <Icon name="squares" />
        </button>
        <button
          type="button"
          className="pdt-btn pdt-btn-icon pdt-btn-sm"
          aria-label="Copy task as Markdown"
          title="Copy as Markdown"
          onClick={onCopyMarkdown}
        >
          <Icon name="code" />
        </button>
        <button
          type="button"
          className="pdt-btn pdt-btn-icon pdt-btn-sm"
          aria-label="Close task details"
          title="Close (Esc)"
          onClick={onClose}
        >
          <Icon name="cross" />
        </button>
      </header>

      <div className="pdt-details__body">
        {blocked && (
          <p className="pdt-rel__blocked" role="status">
            <Icon name="lock" size={14} />
            Blocked by {openBlockers} open {openBlockers === 1 ? 'task' : 'tasks'}. Finish{' '}
            {openBlockers === 1 ? 'it' : 'them'} first.
          </p>
        )}
        <textarea
          ref={titleRef}
          className={`pdt-details__title ${done ? 'pdt-card__title--done' : ''}`}
          value={task.title}
          rows={1}
          placeholder="Task title"
          aria-label="Task title"
          onChange={(e) => onPatch({ title: e.target.value.replace(/\n/g, ' ') })}
          onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
        />

        <dl className="pdt-details__props">
          <Prop label="Status" icon="checkmark-circle">
            <select
              className="pdt-select"
              aria-label="Status"
              value={task.status}
              onChange={(e) => onSetStatus(e.target.value as StatusKey)}
            >
              {!findStatus(statuses, task.status) && (
                <option value={task.status} disabled>
                  {task.status} (missing)
                </option>
              )}
              {statuses.map((c) => (
                <option
                  key={c.key}
                  value={c.key}
                  disabled={blocked && c.category !== 'todo' && c.key !== task.status}
                >
                  {c.label}
                </option>
              ))}
            </select>
          </Prop>
          <Prop label="Section" icon="list">
            <select
              ref={sectionRef}
              className="pdt-select"
              aria-label="Section"
              value={task.section}
              onChange={(e) => onSetSection(e.target.value)}
            >
              {sections.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </Prop>
          <Prop label="Priority" icon="flag">
            <select
              className="pdt-select"
              aria-label="Priority"
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
          </Prop>
          <Prop label="Due date" icon="calendar">
            <DueDateControl
              value={task.due}
              onChange={(due) => onPatch({ due })}
              now={now}
              format={dateFormat}
              completed={done}
              ariaLabel="Due date"
            />
          </Prop>
          <Prop label="Assignee" icon="user">
            <Combobox
              value={task.assignee ?? ''}
              suggestions={assigneeSuggestions}
              onChange={(assignee) => onPatch({ assignee: assignee.trim() || undefined })}
              placeholder="Unassigned"
              ariaLabel="Assignee"
              showCounts
            />
          </Prop>
          <Prop label="Labels" icon="tag">
            <LabelInput
              labels={task.labels}
              suggestions={labelSuggestions}
              onChange={(labels) => onPatch({ labels })}
              ariaLabel="Labels"
            />
          </Prop>
        </dl>

        <label className="pdt-field">
          <span className="pdt-field-label">Description</span>
          <textarea
            className="pdt-textarea"
            rows={5}
            value={task.description ?? ''}
            placeholder="Add more detail…"
            onChange={(e) => onPatch({ description: e.target.value || undefined })}
          />
        </label>

        <TaskRelations
          links={links}
          isDone={(t) => isDoneStatus(statuses, t.status)}
          candidates={linkCandidates}
          onOpen={onOpenLinked}
          onLink={onLink}
          onUnlink={onUnlink}
        />

        {position && position.count > 1 && (
          <div className="pdt-field">
            <span className="pdt-field-label" id="pdt-details-order">
              Order in column
            </span>
            <div className="pdt-details__row" role="group" aria-labelledby="pdt-details-order">
              <button
                type="button"
                className="pdt-btn pdt-btn-sm"
                disabled={position.index <= 0}
                onClick={() => onMoveWithin(-1)}
              >
                <Icon name="arrow-up" size={14} /> Move up
              </button>
              <button
                type="button"
                className="pdt-btn pdt-btn-sm"
                disabled={position.index >= position.count - 1}
                onClick={() => onMoveWithin(1)}
              >
                <Icon name="arrow-down" size={14} /> Move down
              </button>
              <span className="pdt-text-weak pdt-details__hint">
                {position.index + 1} of {position.count}
              </span>
            </div>
          </div>
        )}
      </div>

      <footer className="pdt-details__foot">
        <button type="button" className="pdt-btn pdt-btn-sm pdt-btn-danger" onClick={onDelete}>
          <Icon name="trash" size={14} />
          Delete task
        </button>
      </footer>
    </aside>
  );
}

function Prop({
  label,
  icon,
  children,
}: {
  label: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  children: React.ReactNode;
}) {
  return (
    <div className="pdt-details__prop">
      <dt>
        <Icon name={icon} size={14} />
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  );
}
