import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { SORT_OPTIONS, describeSort, isActiveSort, type SortState } from '../lib/sorting';
import { Icon } from './Icon';

interface SortMenuProps {
  sort: SortState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (sort: SortState) => void;
  /** Bake the current sorted order into the document (undoable). */
  onApplyToDocument: () => void;
}

/** A dropdown for choosing the (non-destructive) sort key and direction. */
export function SortMenu({ sort, open, onOpenChange, onChange, onApplyToDocument }: SortMenuProps) {
  const { t } = useTranslation();
  const wrapRef = useRef<HTMLDivElement>(null);
  const active = isActiveSort(sort);

  useEffect(() => {
    if (!open) return;
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    const onDocClick = (e: MouseEvent) => {
      // composedPath crosses the shadow boundary; `e.target` at the document
      // level is retargeted to the shadow host and would misread as outside.
      if (wrapRef.current && !e.composedPath().includes(wrapRef.current)) onOpenChange(false);
    };
    document.addEventListener('keydown', onDocKey);
    document.addEventListener('mousedown', onDocClick);
    return () => {
      document.removeEventListener('keydown', onDocKey);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [open, onOpenChange]);

  const option = SORT_OPTIONS.find((o) => o.key === sort.key);

  return (
    <div className="pdt-sortmenu" ref={wrapRef}>
      <button
        type="button"
        className={`pdt-btn ${active ? 'pdt-btn-selected' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        title={describeSort(sort)}
      >
        {active && option
          ? t('sort.buttonActive', { label: t(option.labelKey) })
          : t('sort.button')}
      </button>

      {open && (
        <div className="pdt-sortmenu__panel" role="menu" aria-label={t('sort.menuLabel')}>
          {SORT_OPTIONS.map((o) => {
            const selected = o.key === sort.key;
            return (
              <button
                key={o.key}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                className={`pdt-menu__item ${selected ? 'is-active' : ''}`}
                onClick={() => onChange({ key: o.key, dir: selected ? sort.dir : o.defaultDir })}
              >
                <span>{t(o.labelKey)}</span>
                {selected && o.directional && <Icon name="checkmark" size={14} />}
              </button>
            );
          })}

          {active && option?.directional && (
            <div className="pdt-sortmenu__dir" role="group" aria-label={t('sort.direction')}>
              <button
                type="button"
                className={`pdt-btn pdt-btn-sm ${sort.dir === 'asc' ? 'pdt-btn-selected' : ''}`}
                aria-pressed={sort.dir === 'asc'}
                onClick={() => onChange({ ...sort, dir: 'asc' })}
              >
                {t('sort.ascending')}
              </button>
              <button
                type="button"
                className={`pdt-btn pdt-btn-sm ${sort.dir === 'desc' ? 'pdt-btn-selected' : ''}`}
                aria-pressed={sort.dir === 'desc'}
                onClick={() => onChange({ ...sort, dir: 'desc' })}
              >
                {t('sort.descending')}
              </button>
            </div>
          )}

          <div className="pdt-sortmenu__foot">
            <button
              type="button"
              className="pdt-btn pdt-btn-sm"
              disabled={!active}
              onClick={() => {
                onApplyToDocument();
                onOpenChange(false);
              }}
            >
              {t('sort.apply')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
