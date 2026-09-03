import { useId, useState } from 'react';
import {
  addLabel,
  matchSuggestions,
  normalizeLabel,
  removeLabel,
  type Suggestion,
} from '../lib/suggestions';

interface LabelInputProps {
  /** Current labels (stored without a leading `#`). */
  labels: string[];
  /** Label suggestion index (memoized by the caller). */
  suggestions: Suggestion[];
  onChange: (labels: string[]) => void;
  ariaLabel?: string;
}

/**
 * A multi-value label editor. Labels display as removable chips; the text input
 * offers document-derived suggestions with usage counts. Enter or comma accepts
 * the highlighted suggestion (or the typed text); Backspace on an empty input
 * removes the last chip. Duplicates (case-insensitive) are prevented and labels
 * are always shown with a leading `#` but stored without one.
 */
export function LabelInput({ labels, suggestions, onChange, ariaLabel }: LabelInputProps) {
  const [draft, setDraft] = useState('');
  const [active, setActive] = useState(-1);
  const [open, setOpen] = useState(false);
  const listId = useId();

  const matches = matchSuggestions(suggestions, draft, { limit: 8, exclude: labels });

  const accept = (raw: string) => {
    const next = addLabel(labels, raw, suggestions);
    if (next !== labels) onChange(next);
    setDraft('');
    setActive(-1);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const picked = active >= 0 && matches[active] ? matches[active].value : draft;
      if (normalizeLabel(picked)) accept(picked);
    } else if (e.key === 'Backspace' && draft === '' && labels.length > 0) {
      e.preventDefault();
      onChange(labels.slice(0, -1));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
      setActive(-1);
    }
  };

  const activeId = active >= 0 && matches[active] ? `${listId}-opt-${active}` : undefined;

  return (
    <div className="pdt-labelinput">
      <div className="pdt-labelinput__chips">
        {labels.map((label) => (
          <span key={label} className="pdt-chip pdt-chip--label">
            #{label}
            <button
              type="button"
              className="pdt-chip__x"
              aria-label={`Remove label ${label}`}
              onClick={() => onChange(removeLabel(labels, label))}
            >
              ✕
            </button>
          </span>
        ))}
        <input
          className="pdt-labelinput__input"
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeId}
          aria-label={ariaLabel ?? 'Add label'}
          value={draft}
          placeholder={labels.length ? 'Add label…' : 'Add labels…'}
          onChange={(e) => {
            setDraft(e.target.value.replace(/,/g, ''));
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
        />
      </div>
      {open && matches.length > 0 && (
        <ul
          className="pdt-combobox__list"
          role="listbox"
          id={listId}
          aria-label="Label suggestions"
        >
          {matches.map((s, i) => (
            <li
              key={s.value}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`pdt-combobox__opt ${i === active ? 'is-active' : ''}`}
              onMouseDown={(e) => {
                e.preventDefault();
                accept(s.value);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="pdt-combobox__opt-value">#{s.value}</span>
              <span className="pdt-combobox__opt-count">{s.count}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
