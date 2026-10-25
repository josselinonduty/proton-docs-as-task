import { useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  colorCss,
  isSwatch,
  normalizeColor,
  STATUS_SWATCHES,
  type ColorRole,
} from '@/lib/statuses';
import type { StatusDef } from '@/lib/types';
import { Icon } from './Icon';
import { useDismiss } from './useDismiss';

/** Expose a status's colours to CSS as `--pdt-status-text` / `--pdt-status-bg`. */
export function statusStyle(status: Pick<StatusDef, 'color' | 'bg'>): React.CSSProperties {
  return {
    '--pdt-status-text': colorCss(status.color, 'text'),
    '--pdt-status-bg': colorCss(status.bg, 'bg'),
  };
}

interface ColorSwatchesProps {
  /** Accessible name of the group, e.g. "Text colour". */
  label: string;
  role: ColorRole;
  /** A swatch name or `#rrggbb`; undefined for no colour. */
  value?: string;
  onChange: (value: string | undefined) => void;
}

/**
 * Pick a status colour: none, one of the theme-aware swatches, or a custom
 * hex colour. Swatches adapt to light and dark mode with readable text; a
 * custom colour is used as is in both.
 */
export function ColorSwatches({ label, role, value, onChange }: ColorSwatchesProps) {
  const { t } = useTranslation();
  const custom = value && !isSwatch(value) ? value : undefined;
  const [hex, setHex] = useState(custom ?? '');
  const [syncedCustom, setSyncedCustom] = useState(custom);
  const hexId = useId();

  // Reset the draft whenever the stored colour changes.
  if (custom !== syncedCustom) {
    setSyncedCustom(custom);
    setHex(custom ?? '');
  }

  const commitHex = () => {
    const next = normalizeColor(hex);
    if (next && !isSwatch(next)) onChange(next);
    else setHex(custom ?? '');
  };

  return (
    <div className="pdt-swatches">
      <div className="pdt-swatches__row" role="radiogroup" aria-label={label}>
        <button
          type="button"
          role="radio"
          aria-checked={!value}
          aria-label={t('color.none')}
          title={t('color.none')}
          className="pdt-swatch pdt-swatch--none pdt-focusable"
          onClick={() => onChange(undefined)}
        />
        {STATUS_SWATCHES.map((name) => (
          <button
            key={name}
            type="button"
            role="radio"
            aria-checked={value === name}
            aria-label={t(`color.${name}`)}
            title={t(`color.${name}`)}
            className="pdt-swatch pdt-focusable"
            style={{ background: colorCss(name, role) }}
            onClick={() => onChange(name)}
          />
        ))}
      </div>
      <div className="pdt-swatches__custom">
        <input
          type="color"
          className="pdt-swatches__native"
          aria-label={t('color.custom', { label })}
          value={custom ?? '#6d4aff'}
          onChange={(e) => onChange(normalizeColor(e.target.value))}
        />
        <label className="pdt-sr-only" htmlFor={hexId}>
          {t('color.hex', { label })}
        </label>
        <input
          id={hexId}
          className="pdt-input pdt-swatches__hex"
          value={hex}
          placeholder="#rrggbb"
          spellCheck={false}
          onChange={(e) => setHex(e.target.value)}
          onBlur={commitHex}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commitHex();
            }
          }}
        />
      </div>
    </div>
  );
}

interface StatusColorPickerProps extends ColorSwatchesProps {
  /** The other colour of the pair, for the trigger's preview. */
  pairedValue?: string;
}

/** A compact trigger that opens {@link ColorSwatches} in a popover. */
export function StatusColorPicker({ pairedValue, ...swatches }: StatusColorPickerProps) {
  const { label, role, value } = swatches;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useDismiss(open, [rootRef], () => setOpen(false));

  const text = role === 'text' ? value : pairedValue;
  const bg = role === 'bg' ? value : pairedValue;

  return (
    <div
      className="pdt-colorpicker"
      ref={rootRef}
      onKeyDown={(e) => {
        if (e.key === 'Escape' && open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="pdt-btn pdt-btn-sm pdt-colorpicker__trigger"
        aria-haspopup="dialog"
        aria-expanded={open}
        title={label}
        onClick={() => setOpen((v) => !v)}
      >
        <span
          className="pdt-colorpicker__preview"
          aria-hidden="true"
          style={{ color: colorCss(text, 'text'), background: colorCss(bg, 'bg') }}
        >
          {role === 'text' ? 'A' : ''}
        </span>
        <span>{label}</span>
        <Icon name="chevron-down" size={12} />
      </button>
      {open && (
        <div className="pdt-colorpicker__panel" role="dialog" aria-label={label}>
          <ColorSwatches {...swatches} />
        </div>
      )}
    </div>
  );
}
