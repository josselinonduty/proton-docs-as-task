import { useEffect, useRef } from 'react';
import { SORT_OPTIONS, describeSort, isActiveSort, type SortState } from '../lib/sorting';

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
  const wrapRef = useRef<HTMLDivElement>(null);
  const active = isActiveSort(sort);

  useEffect(() => {
    if (!open) return;
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onOpenChange(false);
    };
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) onOpenChange(false);
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
        className={`pdt-btn ${active ? 'pdt-btn-primary' : ''}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        title={describeSort(sort)}
      >
        Sort{active ? `: ${option?.label}` : ''}
      </button>

      {open && (
        <div className="pdt-sortmenu__panel" role="menu" aria-label="Sort tasks">
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
                <span>{o.label}</span>
                {selected && o.directional && <span aria-hidden="true">✓</span>}
              </button>
            );
          })}

          {active && option?.directional && (
            <div className="pdt-sortmenu__dir" role="group" aria-label="Sort direction">
              <button
                type="button"
                className={`pdt-btn pdt-btn-sm ${sort.dir === 'asc' ? 'pdt-btn-primary' : ''}`}
                aria-pressed={sort.dir === 'asc'}
                onClick={() => onChange({ ...sort, dir: 'asc' })}
              >
                Ascending
              </button>
              <button
                type="button"
                className={`pdt-btn pdt-btn-sm ${sort.dir === 'desc' ? 'pdt-btn-primary' : ''}`}
                aria-pressed={sort.dir === 'desc'}
                onClick={() => onChange({ ...sort, dir: 'desc' })}
              >
                Descending
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
              Apply this order to document
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
