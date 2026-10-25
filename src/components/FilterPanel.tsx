import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  activeFilterCount,
  hasActiveFilters,
  type Completion,
  type DueFilter,
  type Facets,
  type FilterState,
} from '@/lib/filters';
import type { Priority, StatusDef } from '@/lib/types';
import { useDismiss } from './useDismiss';

interface FilterPanelProps {
  filters: FilterState;
  facets: Facets;
  statuses: StatusDef[];
  /** Lets the board's F shortcut open the panel by clicking the trigger. */
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
  onChange: (next: FilterState) => void;
  onClear: () => void;
}

const DUE_OPTIONS: DueFilter[] = ['overdue', 'today', 'upcoming', 'none'];

const COMPLETION_OPTIONS: Completion[] = ['all', 'incomplete', 'complete'];

/** Toggle a value in an array-valued filter dimension. */
function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export function FilterPanel({
  filters,
  facets,
  statuses,
  triggerRef,
  onChange,
  onClear,
}: FilterPanelProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const count = activeFilterCount(filters) - (filters.search.trim() ? 1 : 0);

  useDismiss(open, [wrapRef], () => setOpen(false), { escape: true });

  return (
    <div className="pdt-filter" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`pdt-btn ${count > 0 ? 'pdt-btn-selected' : ''}`}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((v) => !v)}
      >
        {count > 0 ? t('filterPanel.buttonCount', { count }) : t('filterPanel.button')}
      </button>

      {open && (
        <div className="pdt-filter__panel" role="dialog" aria-label={t('filterPanel.button')}>
          <Group label={t('filterPanel.status')}>
            {statuses.map((c) => (
              <Check
                key={c.key}
                label={c.label}
                checked={filters.statuses.includes(c.key)}
                onChange={() => onChange({ ...filters, statuses: toggle(filters.statuses, c.key) })}
              />
            ))}
          </Group>

          <Group label={t('filterPanel.section')}>
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
            <Group label={t('filterPanel.priority')}>
              {facets.priorities.map((p: Priority) => (
                <Check
                  key={p}
                  label={t(`priority.${p}`)}
                  checked={filters.priorities.includes(p)}
                  onChange={() =>
                    onChange({ ...filters, priorities: toggle(filters.priorities, p) })
                  }
                />
              ))}
            </Group>
          )}

          {facets.assignees.length > 0 && (
            <Group label={t('filterPanel.assignee')}>
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
            <Group label={t('filterPanel.label')}>
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

          <Group label={t('filterPanel.due')}>
            {DUE_OPTIONS.map((o) => (
              <Check
                key={o}
                label={t(`filterPanel.dueOption.${o}`)}
                checked={filters.due.includes(o)}
                onChange={() => onChange({ ...filters, due: toggle(filters.due, o) })}
              />
            ))}
          </Group>

          <Group label={t('filterPanel.completion')}>
            {COMPLETION_OPTIONS.map((o) => (
              <label key={o} className="pdt-filter__opt">
                <input
                  type="radio"
                  name="pdt-completion"
                  checked={filters.completion === o}
                  onChange={() => onChange({ ...filters, completion: o })}
                />
                <span>{t(`filterPanel.completionOption.${o}`)}</span>
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
              {t('filterPanel.clear')}
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
