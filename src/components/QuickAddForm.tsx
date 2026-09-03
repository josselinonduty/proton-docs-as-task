import { useEffect, useRef, useState } from 'react';
import type { Suggestion } from '../lib/suggestions';
import type { DateFormat, Priority, StatusKey } from '../lib/types';
import { Combobox } from './Combobox';
import { LabelInput } from './LabelInput';
import { DueDateControl } from './DueDateControl';

export interface QuickAddPayload {
  title: string;
  status: StatusKey;
  section: string;
  due?: string;
  priority?: Priority;
  assignee?: string;
  labels: string[];
}

interface QuickAddFormProps {
  sections: string[];
  statusColumns: { key: StatusKey; label: string }[];
  assigneeSuggestions: Suggestion[];
  labelSuggestions: Suggestion[];
  /** The section to default to (remembered across the board session). */
  defaultSection: string;
  now: Date;
  dateFormat: DateFormat;
  onSubmit: (payload: QuickAddPayload) => void;
  onClose: () => void;
}

const PRIORITY_OPTIONS: { value: '' | Priority; label: string }[] = [
  { value: '', label: 'No priority' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

/**
 * The board-header quick-capture form. Only the title is required; status
 * defaults to To Do and the section defaults to the remembered/last section.
 * Cmd/Ctrl+Enter (or Enter in the title) creates the task; Escape closes.
 */
export function QuickAddForm({
  sections,
  statusColumns,
  assigneeSuggestions,
  labelSuggestions,
  defaultSection,
  now,
  dateFormat,
  onSubmit,
  onClose,
}: QuickAddFormProps) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<StatusKey>('todo');
  const [section, setSection] = useState(defaultSection);
  const [due, setDue] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState<'' | Priority>('');
  const [assignee, setAssignee] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  // Follow the remembered section if it changes and the user hasn't overridden.
  useEffect(() => {
    setSection((s) => (sections.includes(s) ? s : defaultSection));
  }, [defaultSection, sections]);

  const submit = () => {
    const clean = title.trim();
    if (!clean) {
      titleRef.current?.focus();
      return;
    }
    onSubmit({
      title: clean,
      status,
      section,
      due,
      priority: priority || undefined,
      assignee: assignee.trim() || undefined,
      labels,
    });
    // Reset for rapid entry, keeping status + section.
    setTitle('');
    setDue(undefined);
    setPriority('');
    setAssignee('');
    setLabels([]);
    titleRef.current?.focus();
  };

  const onFormKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      submit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  };

  return (
    <div
      className="pdt-quickadd-form"
      role="dialog"
      aria-label="Add task"
      onKeyDown={onFormKeyDown}
    >
      <div className="pdt-quickadd-form__row">
        <input
          ref={titleRef}
          className="pdt-input pdt-quickadd-form__title"
          value={title}
          placeholder="Task title…"
          aria-label="Task title (required)"
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
      </div>

      <div className="pdt-quickadd-form__grid">
        <label className="pdt-field">
          <span className="pdt-field-label">Status</span>
          <select
            className="pdt-input"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusKey)}
          >
            {statusColumns.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="pdt-field">
          <span className="pdt-field-label">Section</span>
          <select
            className="pdt-input"
            value={section}
            onChange={(e) => setSection(e.target.value)}
          >
            {sections.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>

        <label className="pdt-field">
          <span className="pdt-field-label">Priority</span>
          <select
            className="pdt-input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as '' | Priority)}
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>

        <div className="pdt-field">
          <span className="pdt-field-label">Due date</span>
          <DueDateControl
            value={due}
            onChange={setDue}
            now={now}
            format={dateFormat}
            ariaLabel="Due date"
          />
        </div>

        <div className="pdt-field">
          <span className="pdt-field-label">Assignee</span>
          <Combobox
            value={assignee}
            suggestions={assigneeSuggestions}
            onChange={setAssignee}
            placeholder="Assignee"
            ariaLabel="Assignee"
            showCounts
          />
        </div>

        <div className="pdt-field pdt-quickadd-form__labels">
          <span className="pdt-field-label">Labels</span>
          <LabelInput
            labels={labels}
            suggestions={labelSuggestions}
            onChange={setLabels}
            ariaLabel="Labels"
          />
        </div>
      </div>

      <div className="pdt-quickadd-form__foot">
        <span className="pdt-quickadd-form__hint">
          <kbd>⌘/Ctrl</kbd>+<kbd>Enter</kbd> to add · <kbd>Esc</kbd> to close
        </span>
        <div className="pdt-quickadd-form__actions">
          <button type="button" className="pdt-btn pdt-btn-sm" onClick={onClose}>
            Close
          </button>
          <button
            type="button"
            className="pdt-btn pdt-btn-sm pdt-btn-primary"
            disabled={!title.trim()}
            onClick={submit}
          >
            Add task
          </button>
        </div>
      </div>
    </div>
  );
}
