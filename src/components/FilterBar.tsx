import {
  EMPTY_FILTERS,
  hasActiveFilters,
  matchesPreset,
  type FilterState,
  type Preset,
} from '../lib/filters';
import type { Priority, StatusKey } from '../lib/types';

interface FilterBarProps {
  filters: FilterState;
  presets: Preset[];
  statusColumns: { key: StatusKey; label: string }[];
  onChange: (filters: FilterState) => void;
  onApplyPreset: (preset: Preset) => void;
}

interface Chip {
  key: string;
  label: string;
  onRemove: () => void;
}

const DUE_LABELS: Record<string, string> = {
  overdue: 'Overdue',
  today: 'Due today',
  upcoming: 'Upcoming',
  none: 'No due date',
};

function statusLabel(cols: { key: StatusKey; label: string }[], key: StatusKey): string {
  return cols.find((c) => c.key === key)?.label ?? key;
}

/** Enumerate the active filters as removable chips. */
function buildChips(
  f: FilterState,
  cols: { key: StatusKey; label: string }[],
  onChange: (f: FilterState) => void,
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
      label: `${(p as Priority)[0]!.toUpperCase()}${(p as string).slice(1)} priority`,
      onRemove: () => drop('priorities', p),
    });
  for (const a of f.assignees)
    chips.push({ key: `as-${a}`, label: a, onRemove: () => drop('assignees', a) });
  for (const l of f.labels)
    chips.push({ key: `lb-${l}`, label: `#${l}`, onRemove: () => drop('labels', l) });
  for (const d of f.due)
    chips.push({ key: `due-${d}`, label: DUE_LABELS[d] ?? d, onRemove: () => drop('due', d) });
  for (const s of f.excludeStatuses)
    chips.push({
      key: `nx-${s}`,
      label: `Not ${statusLabel(cols, s)}`,
      onRemove: () => drop('excludeStatuses', s),
    });
  if (f.completion !== 'all')
    chips.push({
      key: 'comp',
      label: f.completion === 'complete' ? 'Complete' : 'Incomplete',
      onRemove: () => onChange({ ...f, completion: 'all' }),
    });
  if (f.assignment === 'unassigned')
    chips.push({
      key: 'unassigned',
      label: 'Unassigned',
      onRemove: () => onChange({ ...f, assignment: 'any' }),
    });
  if (f.dueWithinDays != null)
    chips.push({
      key: 'within',
      label: f.dueWithinDays === 7 ? 'Due this week' : `Due within ${f.dueWithinDays}d`,
      onRemove: () => onChange({ ...f, dueWithinDays: null }),
    });
  return chips;
}

/** Preset shortcuts plus removable chips summarizing the active filters. */
export function FilterBar({
  filters,
  presets,
  statusColumns,
  onChange,
  onApplyPreset,
}: FilterBarProps) {
  const chips = buildChips(filters, statusColumns, onChange);
  const active = hasActiveFilters(filters);

  return (
    <div className="pdt-filterbar">
      <div className="pdt-filterbar__presets" role="group" aria-label="Filter presets">
        {presets.map((preset) => {
          const on = preset.available && matchesPreset(filters, preset);
          return (
            <button
              key={preset.id}
              type="button"
              className={`pdt-chip pdt-chip--preset ${on ? 'is-active' : ''}`}
              disabled={!preset.available}
              aria-pressed={on}
              title={preset.available ? undefined : preset.reason}
              onClick={() => (on ? onChange({ ...EMPTY_FILTERS }) : onApplyPreset(preset))}
            >
              {preset.label}
            </button>
          );
        })}
      </div>

      {chips.length > 0 && (
        <div className="pdt-filterbar__chips" role="group" aria-label="Active filters">
          {chips.map((chip) => (
            <span key={chip.key} className="pdt-chip pdt-chip--filter">
              {chip.label}
              <button
                type="button"
                className="pdt-chip__x"
                aria-label={`Remove filter ${chip.label}`}
                onClick={chip.onRemove}
              >
                ✕
              </button>
            </span>
          ))}
          {active && (
            <button
              type="button"
              className="pdt-link pdt-filterbar__clear"
              onClick={() => onChange({ ...EMPTY_FILTERS })}
            >
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
