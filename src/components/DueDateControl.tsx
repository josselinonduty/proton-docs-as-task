import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
import { Icon } from './Icon';

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

/** Width of the popover, kept in sync with `.pdt-duedate__panel` in CSS. */
const PANEL_WIDTH = 240;

/**
 * A lightweight due-date control: a trigger styled like the other form inputs,
 * and a popover with deterministic quick options plus an exact date picker.
 * The popover is positioned with `position: fixed` against the trigger so it
 * floats above the scrolling card body instead of being clipped inside it.
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
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const state: DueState = dueState(value, now, completed);

  // Position the fixed popover just under the trigger, clamped to the viewport.
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const left = Math.max(8, Math.min(rect.left, window.innerWidth - PANEL_WIDTH - 8));
      setPos({ top: rect.bottom + 4, left });
    };
    place();
    // Track scrolling of any ancestor (capture) and viewport resizes.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    const onDocClick = (e: MouseEvent) => {
      // composedPath crosses the shadow-root boundary (the document-level
      // target is retargeted to the shadow host otherwise).
      const path = e.composedPath();
      if (
        (wrapRef.current && path.includes(wrapRef.current)) ||
        (panelRef.current && path.includes(panelRef.current))
      ) {
        return;
      }
      setOpen(false);
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
        ref={triggerRef}
        type="button"
        className={`pdt-input pdt-duedate__trigger ${value ? `pdt-duedate__trigger--${state}` : ''}`}
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
        <span className="pdt-duedate__value">{triggerText}</span>
        <Icon name="chevron-down" size={14} />
      </button>

      {open && (
        <div
          ref={panelRef}
          className="pdt-duedate__panel"
          role="dialog"
          aria-label="Choose a due date"
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
        >
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
