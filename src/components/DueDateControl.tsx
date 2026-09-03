import { useEffect, useRef, useState } from 'react';
import {
  dueBadgeText,
  dueState,
  dueStateLabel,
  formatDate,
  isISODate,
  quickDate,
  type DateFormat,
  type DueState,
  type QuickDateOption,
} from '../lib/dates';

interface DueDateControlProps {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  now: Date;
  format: DateFormat;
  /** True when the owning task is complete (affects the state label). */
  completed?: boolean;
  ariaLabel?: string;
}

const QUICK: { option: QuickDateOption; label: string }[] = [
  { option: 'today', label: 'Today' },
  { option: 'tomorrow', label: 'Tomorrow' },
  { option: 'weekend', label: 'This weekend' },
  { option: 'next-week', label: 'Next week' },
];

/**
 * A lightweight due-date control: a trigger showing the current relative state,
 * and a popover with deterministic quick options plus an exact date picker.
 * Dates are stored as `YYYY-MM-DD`; relative labels use the local timezone.
 */
export function DueDateControl({
  value,
  onChange,
  now,
  format,
  completed,
  ariaLabel,
}: DueDateControlProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const state: DueState = dueState(value, now, completed);

  useEffect(() => {
    if (!open) return;
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onDocKey, true);
    document.addEventListener('mousedown', onDocClick);
    return () => {
      document.removeEventListener('keydown', onDocKey, true);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [open]);

  const pick = (option: QuickDateOption) => {
    onChange(quickDate(option, now));
    setOpen(false);
  };

  const triggerText = value ? dueBadgeText(value, state, format) : 'Set due date';
  const fullDate = value ? formatDate(value, format) : '';

  return (
    <div className="pdt-duedate" ref={wrapRef}>
      <button
        type="button"
        className={`pdt-btn pdt-btn-sm pdt-duedate__trigger pdt-due--${state}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={
          value
            ? `${ariaLabel ?? 'Due date'}: ${dueStateLabel(state)}, ${fullDate}`
            : (ariaLabel ?? 'Set due date')
        }
        title={value ? `${dueStateLabel(state)} · ${fullDate}` : 'Set a due date'}
        onClick={() => setOpen((v) => !v)}
      >
        <span aria-hidden="true">◇</span> {triggerText}
      </button>

      {open && (
        <div className="pdt-duedate__panel" role="dialog" aria-label="Choose a due date">
          <div className="pdt-duedate__quick">
            {QUICK.map((q) => (
              <button
                key={q.option}
                type="button"
                className="pdt-btn pdt-btn-sm"
                onClick={() => pick(q.option)}
              >
                {q.label}
              </button>
            ))}
          </div>
          <label className="pdt-field">
            <span className="pdt-field-label">Choose date</span>
            <input
              type="date"
              className="pdt-input"
              value={isISODate(value) ? value! : ''}
              onChange={(e) => onChange(e.target.value || undefined)}
            />
          </label>
          <div className="pdt-duedate__foot">
            <button
              type="button"
              className="pdt-btn pdt-btn-sm pdt-btn-danger"
              disabled={!value}
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Clear date
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
