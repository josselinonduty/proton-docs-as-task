import { useId, useRef, useState } from 'react';
import { canonicalize, matchSuggestions, type Suggestion } from '../lib/suggestions';

interface ComboboxProps {
  /** Current committed value. */
  value: string;
  /** Suggestion index (already memoized by the caller). */
  suggestions: Suggestion[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
  /** Show a usage-count next to each suggestion. */
  showCounts?: boolean;
}

/**
 * An accessible single-value combobox (WAI-ARIA 1.2 pattern) whose suggestions
 * are drawn from the current document. Typing filters the list; the value can
 * be any of the suggestions or a brand-new entry. Committing reuses an existing
 * capitalization when one matches case-insensitively.
 */
export function Combobox({
  value,
  suggestions,
  onChange,
  placeholder,
  ariaLabel,
  className,
  showCounts,
}: ComboboxProps) {
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keep the draft in sync when the committed value changes externally.
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setDraft(value);
  }

  const matches = matchSuggestions(suggestions, draft, { limit: 8 });

  const commit = (raw: string) => {
    const next = canonicalize(suggestions, raw);
    onChange(next);
    setDraft(next);
    setOpen(false);
    setActive(-1);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((a) => Math.min(a + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, -1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      commit(active >= 0 && matches[active] ? matches[active].value : draft);
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        setActive(-1);
      }
    }
  };

  const activeId = active >= 0 && matches[active] ? `${listId}-opt-${active}` : undefined;

  return (
    <div className="pdt-combobox">
      <input
        ref={inputRef}
        className={className ?? 'pdt-input'}
        role="combobox"
        aria-expanded={open && matches.length > 0}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={activeId}
        aria-label={ariaLabel}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => {
          setDraft(e.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => {
          // Commit free text on blur, after any option click has registered.
          window.setTimeout(() => {
            setOpen(false);
            if (draft.trim() !== value) commit(draft);
          }, 120);
        }}
        onKeyDown={onKeyDown}
      />
      {open && matches.length > 0 && (
        <ul className="pdt-combobox__list" role="listbox" id={listId} aria-label={ariaLabel}>
          {matches.map((s, i) => (
            <li
              key={s.value}
              id={`${listId}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              className={`pdt-combobox__opt ${i === active ? 'is-active' : ''}`}
              // Use mousedown so the option commits before the input's blur.
              onMouseDown={(e) => {
                e.preventDefault();
                commit(s.value);
              }}
              onMouseEnter={() => setActive(i)}
            >
              <span className="pdt-combobox__opt-value">{s.value}</span>
              {showCounts && <span className="pdt-combobox__opt-count">{s.count}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
