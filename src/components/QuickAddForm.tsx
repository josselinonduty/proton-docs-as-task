import { useEffect, useRef, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import type { Suggestion } from '../lib/suggestions';
import { defaultStatus } from '../lib/statuses';
import type { DateFormat, Priority, StatusDef, StatusKey } from '../lib/types';
import { Combobox } from './Combobox';
import { LabelInput } from './LabelInput';
import { DueDateControl } from './DueDateControl';
import { PRIORITY_OPTIONS, priorityOptionLabel } from './taskFields';

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
  statuses: StatusDef[];
  assigneeSuggestions: Suggestion[];
  labelSuggestions: Suggestion[];
  /** The section to default to (remembered across the board session). */
  defaultSection: string;
  now: Date;
  dateFormat: DateFormat;
  onSubmit: (payload: QuickAddPayload) => void;
  onClose: () => void;
}

/**
 * The board-header quick-capture form. Only the title is required; status
 * defaults to To Do and the section defaults to the remembered/last section.
 * Cmd/Ctrl+Enter (or Enter in the title) creates the task; Escape closes.
 */
export function QuickAddForm({
  sections,
  statuses,
  assigneeSuggestions,
  labelSuggestions,
  defaultSection,
  now,
  dateFormat,
  onSubmit,
  onClose,
}: QuickAddFormProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<StatusKey>(() => defaultStatus(statuses, false));
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
    <div className="pdt-quickadd-form" onKeyDown={onFormKeyDown}>
      <div className="pdt-quickadd-form__row">
        <input
          ref={titleRef}
          className="pdt-input pdt-quickadd-form__title"
          value={title}
          placeholder={t('quickAdd.placeholder')}
          aria-label={t('quickAdd.titleRequired')}
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
          <span className="pdt-field-label">{t('quickAdd.status')}</span>
          <select
            className="pdt-select"
            value={status}
            onChange={(e) => setStatus(e.target.value as StatusKey)}
          >
            {statuses.map((c) => (
              <option key={c.key} value={c.key}>
                {c.label}
              </option>
            ))}
          </select>
        </label>

        <label className="pdt-field">
          <span className="pdt-field-label">{t('quickAdd.section')}</span>
          <select
            className="pdt-select"
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
          <span className="pdt-field-label">{t('quickAdd.priority')}</span>
          <select
            className="pdt-select"
            value={priority}
            onChange={(e) => setPriority(e.target.value as '' | Priority)}
          >
            {PRIORITY_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {priorityOptionLabel(o)}
              </option>
            ))}
          </select>
        </label>

        <div className="pdt-field">
          <span className="pdt-field-label">{t('quickAdd.due')}</span>
          <DueDateControl
            value={due}
            onChange={setDue}
            now={now}
            format={dateFormat}
            ariaLabel={t('quickAdd.due')}
          />
        </div>

        <div className="pdt-field">
          <span className="pdt-field-label">{t('quickAdd.assignee')}</span>
          <Combobox
            value={assignee}
            suggestions={assigneeSuggestions}
            onChange={setAssignee}
            placeholder={t('quickAdd.assignee')}
            ariaLabel={t('quickAdd.assignee')}
            showCounts
          />
        </div>

        <div className="pdt-field pdt-quickadd-form__labels">
          <span className="pdt-field-label">{t('quickAdd.labels')}</span>
          <LabelInput
            labels={labels}
            suggestions={labelSuggestions}
            onChange={setLabels}
            ariaLabel={t('quickAdd.labels')}
          />
        </div>
      </div>

      <div className="pdt-quickadd-form__foot">
        <span className="pdt-quickadd-form__hint">
          <Trans i18nKey="quickAdd.hint" components={{ kbd: <kbd /> }} />
        </span>
        <div className="pdt-quickadd-form__actions">
          <button type="button" className="pdt-btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="pdt-btn pdt-btn-primary"
            disabled={!title.trim()}
            onClick={submit}
          >
            {t('quickAdd.add')}
          </button>
        </div>
      </div>
    </div>
  );
}
