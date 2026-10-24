import type { ReactNode, RefObject } from 'react';
import { useTranslation } from 'react-i18next';

interface ProgressProps {
  current: number;
  total: number;
}

/** "Step 1 of 2" as text, plus a segmented bar exposed as a progressbar. */
export function Progress({ current, total }: ProgressProps) {
  const { t } = useTranslation();
  const label = t('welcome.step', { current, total });
  return (
    <div
      className="wl-progress"
      role="progressbar"
      aria-label={t('welcome.progress')}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={current}
      aria-valuetext={label}
    >
      <span className="wl-progress__label">{label}</span>
      <span className="wl-progress__bar" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={i < current ? 'wl-progress__seg is-done' : 'wl-progress__seg'} />
        ))}
      </span>
    </div>
  );
}

interface ChoiceGroupProps<T extends string> {
  title: string;
  hint: string;
  /** Receives focus when the step appears, so screen readers announce it. */
  headingRef: RefObject<HTMLHeadingElement | null>;
  name: string;
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  optionName: (option: T) => string;
  optionHint: (option: T) => string;
  /** Decorative illustration; the name and hint carry the meaning. */
  optionVisual: (option: T) => ReactNode;
}

/**
 * One question as a radio group of large cards. Native radios give the
 * arrow-key navigation and single tab stop for free; the input is visually
 * hidden and the card styles itself from its state.
 */
export function ChoiceGroup<T extends string>({
  title,
  hint,
  headingRef,
  name,
  value,
  options,
  onChange,
  optionName,
  optionHint,
  optionVisual,
}: ChoiceGroupProps<T>) {
  return (
    <div>
      <h2 id={`wl-${name}-title`} className="wl-title" ref={headingRef} tabIndex={-1}>
        {title}
      </h2>
      <p id={`wl-${name}-hint`} className="wl-hint">
        {hint}
      </p>
      <div
        className="wl-choices"
        role="radiogroup"
        aria-labelledby={`wl-${name}-title`}
        aria-describedby={`wl-${name}-hint`}
      >
        {options.map((option) => (
          <label key={option} className="wl-choice">
            <input
              type="radio"
              className="wl-choice__input"
              name={name}
              value={option}
              checked={option === value}
              onChange={() => onChange(option)}
            />
            <span className="wl-choice__visual">{optionVisual(option)}</span>
            <span className="wl-choice__name">{optionName(option)}</span>
            <span className="wl-choice__hint">{optionHint(option)}</span>
          </label>
        ))}
      </div>
    </div>
  );
}
