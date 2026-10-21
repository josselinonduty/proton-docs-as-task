import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import {
  EMPTY_FILTERS,
  hasActiveFilters,
  matchesPreset,
  type FilterState,
  type Preset,
} from '../lib/filters';
import type { Priority, StatusDef, StatusKey } from '../lib/types';
import { Icon } from './Icon';

interface FilterBarProps {
  filters: FilterState;
  presets: Preset[];
  statuses: StatusDef[];
  onChange: (filters: FilterState) => void;
  onApplyPreset: (preset: Preset) => void;
  /** A preset that needs setup (e.g. "My open tasks" without a name) was chosen. */
  onUnavailablePreset?: (preset: Preset) => void;
}

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

function statusLabel(cols: StatusDef[], key: StatusKey): string {
  return cols.find((c) => c.key === key)?.label ?? key;
}

/** Enumerate the active filters as removable chips. */
function buildChips(
  f: FilterState,
  cols: StatusDef[],
  onChange: (f: FilterState) => void,
  t: TFunction,
): Chip[] {
  const chips: Chip[] = [];
  const drop = <K extends keyof FilterState>(
    dim: K,
    value: FilterState[K] extends (infer T)[] ? T : never,
  ) => onChange({ ...f, [dim]: (f[dim] as unknown as unknown[]).filter((v) => v !== value) });

  if (f.search.trim())
    chips.push({
      key: 'search',
      label: `“${f.search.trim()}”`,
      onRemove: () => onChange({ ...f, search: '' }),
    });
  for (const s of f.statuses)
    chips.push({
      key: `st-${s}`,
      label: statusLabel(cols, s),
      onRemove: () => drop('statuses', s),
    });
  for (const s of f.sections)
    chips.push({ key: `sec-${s}`, label: s, onRemove: () => drop('sections', s) });
  for (const p of f.priorities)
    chips.push({
      key: `pr-${p}`,
      label: t('filters.priorityChip', { priority: t(`priority.${p as Priority}`) }),
      onRemove: () => drop('priorities', p),
    });
  for (const a of f.assignees)
    chips.push({ key: `as-${a}`, label: a, onRemove: () => drop('assignees', a) });
  for (const l of f.labels)
    chips.push({ key: `lb-${l}`, label: `#${l}`, onRemove: () => drop('labels', l) });
  for (const d of f.due)
    chips.push({
      key: `due-${d}`,
      label: t(`filters.dueValue.${d as 'overdue' | 'today' | 'upcoming' | 'none'}`, {
        defaultValue: d,
      }),
      onRemove: () => drop('due', d),
    });
  for (const s of f.excludeStatuses)
    chips.push({
      key: `nx-${s}`,
      label: t('filters.not', { status: statusLabel(cols, s) }),
      onRemove: () => drop('excludeStatuses', s),
    });
  if (f.completion !== 'all')
    chips.push({
      key: 'comp',
      label: f.completion === 'complete' ? t('filters.complete') : t('filters.incomplete'),
      onRemove: () => onChange({ ...f, completion: 'all' }),
    });
  if (f.assignment === 'unassigned')
    chips.push({
      key: 'unassigned',
      label: t('filters.unassigned'),
      onRemove: () => onChange({ ...f, assignment: 'any' }),
    });
  if (f.dueWithinDays != null)
    chips.push({
      key: 'within',
      label:
        f.dueWithinDays === 7
          ? t('due.this-week')
          : t('filters.dueWithin', { days: f.dueWithinDays }),
      onRemove: () => onChange({ ...f, dueWithinDays: null }),
    });
  return chips;
}

/** Preset shortcuts plus removable chips summarizing the active filters. */
export function FilterBar({
  filters,
  presets,
  statuses,
  onChange,
  onApplyPreset,
  onUnavailablePreset,
}: FilterBarProps) {
  const { t } = useTranslation();
  const chips = buildChips(filters, statuses, onChange, t);
  const active = hasActiveFilters(filters);

  return (
    <div className="pdt-filterbar">
      <div className="pdt-filterbar__presets" role="group" aria-label={t('filters.presets')}>
        {presets.map((preset) => {
          const on = preset.available && matchesPreset(filters, preset);
          return (
            // An unavailable preset stays focusable (a disabled button would
            // hide its explanation from keyboard users) and leads to setup.
            <button
              key={preset.id}
              type="button"
              className={`pdt-chip pdt-chip--preset ${on ? 'is-active' : ''}`}
              aria-disabled={!preset.available || undefined}
              aria-pressed={on}
              title={
                preset.available || !preset.reason
                  ? undefined
                  : t(`presets.reason.${preset.reason}`)
              }
              onClick={() => {
                if (!preset.available) onUnavailablePreset?.(preset);
                else if (on) onChange({ ...EMPTY_FILTERS });
                else onApplyPreset(preset);
              }}
            >
              {t(`presets.${preset.id}`)}
            </button>
          );
        })}
      </div>

      {chips.length > 0 && (
        <div className="pdt-filterbar__chips" role="group" aria-label={t('filters.active')}>
          {chips.map((chip) => (
            <span key={chip.key} className="pdt-chip pdt-chip--filter">
              {chip.label}
              <button
                type="button"
                className="pdt-chip__x pdt-focusable"
                aria-label={t('filters.remove', { label: chip.label })}
                onClick={chip.onRemove}
              >
                <Icon name="cross" size={12} />
              </button>
            </span>
          ))}
          {active && (
            <button
              type="button"
              className="pdt-link pdt-filterbar__clear"
              onClick={() => onChange({ ...EMPTY_FILTERS })}
            >
              {t('filters.clearAll')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
