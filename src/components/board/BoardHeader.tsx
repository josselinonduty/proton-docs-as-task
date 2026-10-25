import type { ComponentProps, RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { EMPTY_FILTERS, type Facets, type FilterState, type Preset } from '@/lib/filters';
import type { SortState } from '@/lib/sorting';
import { BOARD_VIEWS, type BoardView, type SaveState, type StatusDef } from '@/lib/types';
import { FilterBar } from '@/components/FilterBar';
import { FilterPanel } from '@/components/FilterPanel';
import { Icon } from '@/components/Icon';
import { SortMenu } from '@/components/SortMenu';
import { BoardMenu } from './BoardMenu';

interface BoardHeaderProps {
  title: string | undefined;
  progress: { done: number; total: number };
  saveState: SaveState;
  view: BoardView;
  filters: FilterState;
  facets: Facets;
  presets: Preset[];
  statuses: StatusDef[];
  sort: SortState;
  sortOpen: boolean;
  searchRef: RefObject<HTMLInputElement | null>;
  filterBtnRef: RefObject<HTMLButtonElement | null>;
  menu: ComponentProps<typeof BoardMenu>;
  announce: (message: string) => void;
  onClose: () => void;
  onRetry: () => void;
  onAddTask: () => void;
  onViewChange: (view: BoardView) => void;
  onFiltersChange: (filters: FilterState) => void;
  onSortOpenChange: (open: boolean) => void;
  onSortChange: (sort: SortState) => void;
  onApplySortToDocument: () => void;
  onOpenSettings: () => void;
}

/** The board's header: back, title and progress, save state, add and menu; then the tools row. */
export function BoardHeader({ searchRef, filterBtnRef, ...props }: BoardHeaderProps) {
  const { t } = useTranslation();
  const { filters, onFiltersChange, onSortChange } = props;
  return (
    <header className="pdt-board__header">
      <div className="pdt-board__row pdt-board__row--top">
        <button
          type="button"
          className="pdt-btn pdt-btn-ghost pdt-btn-sm pdt-board__back"
          onClick={props.onClose}
          title={t('board.back')}
        >
          <Icon name="arrow-left" size={14} />
          <span>{t('board.document')}</span>
        </button>

        <div className="pdt-board__titlewrap">
          <h1 className="pdt-board__title">{props.title || t('board.defaultTitle')}</h1>
          <BoardProgress done={props.progress.done} total={props.progress.total} />
        </div>

        <div className="pdt-board__spacer" />

        <SaveIndicator state={props.saveState} onRetry={props.onRetry} />

        <button
          className="pdt-btn pdt-btn-primary"
          onClick={props.onAddTask}
          aria-haspopup="dialog"
          title={t('board.addTaskKey')}
        >
          <Icon name="plus" size={16} />
          {t('quickAdd.add')}
        </button>

        <BoardMenu {...props.menu} />
      </div>

      <div className="pdt-board__row pdt-board__row--tools">
        <div className="pdt-segment" role="tablist" aria-label={t('board.viewLabel')}>
          {BOARD_VIEWS.map((v) => (
            <button
              key={v}
              role="tab"
              aria-selected={props.view === v}
              className={`pdt-segment__btn ${props.view === v ? 'is-active' : ''}`}
              title={t(`views.${v}.hint`)}
              onClick={() => props.onViewChange(v)}
            >
              {t(`views.${v}.label`)}
            </button>
          ))}
        </div>

        <div className="pdt-search">
          <Icon name="magnifier" size={16} className="pdt-search__icon" />
          <input
            ref={searchRef}
            type="search"
            className="pdt-input pdt-search__input"
            value={filters.search}
            placeholder={t('board.search')}
            aria-label={t('board.search')}
            aria-keyshortcuts="/"
            onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
            onKeyDown={(e) => {
              if (e.key === 'Escape' && filters.search) {
                e.stopPropagation();
                onFiltersChange({ ...filters, search: '' });
              }
            }}
          />
          <kbd className="pdt-search__kbd" aria-hidden="true">
            /
          </kbd>
        </div>

        <FilterPanel
          filters={filters}
          facets={props.facets}
          statuses={props.statuses}
          triggerRef={filterBtnRef}
          onChange={onFiltersChange}
          onClear={() => onFiltersChange({ ...EMPTY_FILTERS })}
        />

        <SortMenu
          sort={props.sort}
          open={props.sortOpen}
          onOpenChange={props.onSortOpenChange}
          onChange={onSortChange}
          onApplyToDocument={props.onApplySortToDocument}
        />

        <FilterBar
          filters={filters}
          presets={props.presets}
          statuses={props.statuses}
          onChange={onFiltersChange}
          onApplyPreset={(preset: Preset) => {
            onFiltersChange(preset.filters);
            if (preset.recommendedSort) onSortChange(preset.recommendedSort);
          }}
          onUnavailablePreset={(preset: Preset) => {
            props.announce(
              preset.reason
                ? t(`presets.reason.${preset.reason}`)
                : t('presets.unavailable', { label: t(`presets.${preset.id}`) }),
            );
            props.onOpenSettings();
          }}
        />
      </div>
    </header>
  );
}

/** Board completion summary next to the title: "4 of 12 done" with a bar. */
function BoardProgress({ done, total }: { done: number; total: number }) {
  const { t } = useTranslation();
  if (total === 0) return null;
  const pct = Math.round((done / total) * 100);
  return (
    <span className="pdt-progress" title={t('board.percent', { pct })}>
      <span
        className="pdt-progress__bar"
        role="progressbar"
        aria-label={t('board.completedAria')}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
      >
        <span className="pdt-progress__fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="pdt-progress__text">{t('board.progress', { done, total })}</span>
    </span>
  );
}

/**
 * Save state indicator. Proton Docs shows its own "Saved / Saving" status, so
 * the board only surfaces the states Proton can't: a failed write (with a
 * retry action) and edits waiting for Proton to unlock editing. The normal
 * saved/saving states render nothing.
 */
function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  const { t } = useTranslation();
  if (state === 'error') {
    return (
      <span className="pdt-save pdt-save--error" role="status">
        <Icon name="exclamation-circle" size={14} /> {t('board.saveFailed')}
        <button type="button" className="pdt-link" onClick={onRetry}>
          {t('board.retry')}
        </button>
      </span>
    );
  }
  if (state === 'paused') {
    return (
      <span className="pdt-save pdt-save--warning" role="status" title={t('board.pausedTitle')}>
        <Icon name="exclamation-circle" size={14} /> {t('board.waiting')}
      </span>
    );
  }
  return null;
}
