import { useTranslation } from 'react-i18next';
import { SORT_OPTIONS, describeSort, isActiveSort, type SortState } from '@/lib/sorting';
import { Icon } from './Icon';
import { useMenuButton } from './useMenuButton';

interface SortMenuProps {
  sort: SortState;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChange: (sort: SortState) => void;
  /** Bake the current sorted order into the document (undoable). */
  onApplyToDocument: () => void;
}

/**
 * A menu (the menu button pattern, see `useMenuButton`) for choosing the
 * (non-destructive) sort key and direction. Picking a key or a direction keeps
 * it open, so both can be set in one go.
 */
export function SortMenu({ sort, open, onOpenChange, onChange, onApplyToDocument }: SortMenuProps) {
  const { t } = useTranslation();
  const active = isActiveSort(sort);
  const { wrapRef, triggerRef, menuRef, triggerProps, menuProps, close } = useMenuButton(
    open,
    onOpenChange,
  );

  const option = SORT_OPTIONS.find((o) => o.key === sort.key);

  return (
    <div className="pdt-sortmenu" ref={wrapRef}>
      <button
        type="button"
        className={`pdt-btn ${active ? 'pdt-btn-selected' : ''}`}
        title={describeSort(sort)}
        ref={triggerRef}
        {...triggerProps}
      >
        {active && option
          ? t('sort.buttonActive', { label: t(option.labelKey) })
          : t('sort.button')}
      </button>

      {open && (
        <div
          className="pdt-sortmenu__panel"
          ref={menuRef}
          {...menuProps}
          aria-labelledby={undefined}
          aria-label={t('sort.menuLabel')}
        >
          {SORT_OPTIONS.map((o) => {
            const selected = o.key === sort.key;
            return (
              <button
                key={o.key}
                type="button"
                role="menuitemradio"
                aria-checked={selected}
                tabIndex={-1}
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
                role="menuitemradio"
                aria-checked={sort.dir === 'asc'}
                tabIndex={-1}
                className={`pdt-btn pdt-btn-sm ${sort.dir === 'asc' ? 'pdt-btn-selected' : ''}`}
                onClick={() => onChange({ ...sort, dir: 'asc' })}
              >
                {t('sort.ascending')}
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={sort.dir === 'desc'}
                tabIndex={-1}
                className={`pdt-btn pdt-btn-sm ${sort.dir === 'desc' ? 'pdt-btn-selected' : ''}`}
                onClick={() => onChange({ ...sort, dir: 'desc' })}
              >
                {t('sort.descending')}
              </button>
            </div>
          )}

          <div className="pdt-sortmenu__foot" role="none">
            <button
              type="button"
              role="menuitem"
              tabIndex={-1}
              className="pdt-btn pdt-btn-sm"
              disabled={!active}
              onClick={() => {
                close();
                onApplyToDocument();
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
