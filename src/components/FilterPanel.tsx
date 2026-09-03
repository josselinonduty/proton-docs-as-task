import { useEffect, useRef, useState } from 'react';
import {
  activeFilterCount,
  hasActiveFilters,
  type Completion,
  type DueFilter,
  type Facets,
  type FilterState,
} from '../lib/filters';
import type { Priority, StatusKey } from '../lib/types';

interface FilterPanelProps {
  filters: FilterState;
  facets: Facets;
  statusColumns: { key: StatusKey; label: string }[];
  /** Lets the board's F shortcut open the panel by clicking the trigger. */
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  onChange: (next: FilterState) => void;
  onClear: () => void;
}

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'none', label: 'No due date' },
];

const COMPLETION_OPTIONS: { value: Completion; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'incomplete', label: 'Incomplete' },
  { value: 'complete', label: 'Complete' },
];

/** Toggle a value in an array-valued filter dimension. */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterPanel({
  filters,
  facets,
  statusColumns,
  triggerRef,
  onChange,
  onClear,
}: FilterPanelProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const count = activeFilterCount(filters) - (filters.search.trim() ? 1 : 0);

  useEffect(() => {
    if (!open) return;
    const onDocKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onDocKey);
    document.addEventListener('mousedown', onDocClick);
    return () => {
      document.removeEventListener('keydown', onDocKey);
      document.removeEventListener('mousedown', onDocClick);
    };
  }, [open]);

  return (
    <div className="pdt-filter" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`pdt-btn ${count > 0 ? 'pdt-btn-primary' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        Filters{count > 0 ? ` (${count})` : ''}
      </button>

      {open && (
        <div className="pdt-filter__panel" role="dialog" aria-label="Filters">
          <Group label="Status">
            {statusColumns.map((c) => (
              <Check
                key={c.key}
                label={c.label}
                checked={filters.statuses.includes(c.key)}
                onChange={() => onChange({ ...filters, statuses: toggle(filters.statuses, c.key) })}
              />
            ))}
          </Group>

          <Group label="Section">
            {facets.sections.map((s) => (
              <Check
                key={s}
                label={s}
                checked={filters.sections.includes(s)}
                onChange={() => onChange({ ...filters, sections: toggle(filters.sections, s) })}
              />
            ))}
          </Group>

          {facets.priorities.length > 0 && (
            <Group label="Priority">
              {facets.priorities.map((p: Priority) => (
                <Check
                  key={p}
                  label={p[0]!.toUpperCase() + p.slice(1)}
                  checked={filters.priorities.includes(p)}
                  onChange={() =>
                    onChange({ ...filters, priorities: toggle(filters.priorities, p) })
                  }
                />
              ))}
            </Group>
          )}

          {facets.assignees.length > 0 && (
            <Group label="Assignee">
              {facets.assignees.map((a) => (
                <Check
                  key={a}
                  label={a}
                  checked={filters.assignees.includes(a)}
                  onChange={() => onChange({ ...filters, assignees: toggle(filters.assignees, a) })}
                />
              ))}
            </Group>
          )}

          {facets.labels.length > 0 && (
            <Group label="Label">
              {facets.labels.map((l) => (
                <Check
                  key={l}
                  label={`#${l}`}
                  checked={filters.labels.includes(l)}
                  onChange={() => onChange({ ...filters, labels: toggle(filters.labels, l) })}
                />
              ))}
            </Group>
          )}

          <Group label="Due date">
            {DUE_OPTIONS.map((o) => (
              <Check
                key={o.value}
                label={o.label}
                checked={filters.due.includes(o.value)}
                onChange={() => onChange({ ...filters, due: toggle(filters.due, o.value) })}
              />
            ))}
          </Group>

          <Group label="Completion">
            {COMPLETION_OPTIONS.map((o) => (
              <label key={o.value} className="pdt-filter__opt">
                <input
                  type="radio"
                  name="pdt-completion"
                  checked={filters.completion === o.value}
                  onChange={() => onChange({ ...filters, completion: o.value })}
                />
                <span>{o.label}</span>
              </label>
            ))}
          </Group>

          <div className="pdt-filter__foot">
            <button
              type="button"
              className="pdt-btn pdt-btn-sm"
              disabled={!hasActiveFilters(filters)}
              onClick={onClear}
            >
              Clear all filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <fieldset className="pdt-filter__group">
      <legend className="pdt-field-label">{label}</legend>
      <div className="pdt-filter__opts">{children}</div>
    </fieldset>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="pdt-filter__opt">
      <input type="checkbox" checked={checked} onChange={onChange} />
      <span>{label}</span>
    </label>
  );
}
