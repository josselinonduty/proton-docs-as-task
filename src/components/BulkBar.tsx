import { useState } from 'react';
import type { BulkAction } from '../lib/model';
import type { Suggestion } from '../lib/suggestions';
import type { DateFormat, Priority, StatusKey } from '../lib/types';
import { DueDateControl } from './DueDateControl';

interface BulkBarProps {
  count: number;
  sections: string[];
  statusColumns: { key: StatusKey; label: string }[];
  labelSuggestions: Suggestion[];
  now: Date;
  dateFormat: DateFormat;
  onAction: (action: BulkAction) => void;
  onRequestDelete: () => void;
  onSelectAll: () => void;
  onClear: () => void;
  onExit: () => void;
}

/**
 * Action toolbar shown while in bulk-selection mode. Each control applies to
 * every selected card as a single, undoable document write. Destructive delete
 * is routed through the parent for confirmation.
 */
export function BulkBar({
  count,
  sections,
  statusColumns,
  labelSuggestions,
  now,
  dateFormat,
  onAction,
  onRequestDelete,
  onSelectAll,
  onClear,
  onExit,
}: BulkBarProps) {
  const [labelDraft, setLabelDraft] = useState('');

  const commitLabel = (kind: 'addLabel' | 'removeLabel') => {
    const label = labelDraft.trim();
    if (!label) return;
    onAction({ kind, label });
    setLabelDraft('');
  };

  return (
    <div className="pdt-bulkbar" role="region" aria-label="Bulk actions">
      <span className="pdt-bulkbar__count" role="status">
        <strong>{count}</strong> selected
      </span>

      <div className="pdt-bulkbar__group">
        <button
          type="button"
          className="pdt-btn pdt-btn-sm"
          disabled={count === 0}
          onClick={() => onAction({ kind: 'complete' })}
        >
          Mark complete
        </button>

        <PickSelect
          label="Status"
          disabled={count === 0}
          options={statusColumns.map((c) => ({ value: c.key, label: c.label }))}
          onPick={(value) => onAction({ kind: 'status', status: value as StatusKey })}
        />

        <PickSelect
          label="Section"
          disabled={count === 0}
          options={sections.map((s) => ({ value: s, label: s }))}
          onPick={(value) => onAction({ kind: 'section', section: value })}
        />

        <PickSelect
          label="Priority"
          disabled={count === 0}
          options={[
            { value: 'high', label: 'High' },
            { value: 'medium', label: 'Medium' },
            { value: 'low', label: 'Low' },
            { value: '', label: 'None' },
          ]}
          onPick={(value) =>
            onAction({ kind: 'priority', priority: (value || undefined) as Priority | undefined })
          }
        />

        <div className="pdt-bulkbar__due">
          <DueDateControl
            value={undefined}
            onChange={(due) => onAction({ kind: 'due', due })}
            now={now}
            format={dateFormat}
            ariaLabel="Set due date for selection"
          />
        </div>

        <div className="pdt-bulkbar__label">
          <input
            className="pdt-input pdt-bulkbar__label-input"
            list="pdt-bulk-labels"
            value={labelDraft}
            placeholder="label"
            aria-label="Label for bulk add or remove"
            onChange={(e) => setLabelDraft(e.target.value.replace(/^#/, ''))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                commitLabel('addLabel');
              }
            }}
          />
          <datalist id="pdt-bulk-labels">
            {labelSuggestions.map((s) => (
              <option key={s.value} value={s.value} />
            ))}
          </datalist>
          <button
            type="button"
            className="pdt-btn pdt-btn-sm"
            disabled={count === 0 || !labelDraft.trim()}
            onClick={() => commitLabel('addLabel')}
          >
            + Label
          </button>
          <button
            type="button"
            className="pdt-btn pdt-btn-sm"
            disabled={count === 0 || !labelDraft.trim()}
            onClick={() => commitLabel('removeLabel')}
          >
            − Label
          </button>
        </div>

        <button
          type="button"
          className="pdt-btn pdt-btn-sm pdt-btn-danger"
          disabled={count === 0}
          onClick={onRequestDelete}
        >
          Delete
        </button>
      </div>

      <div className="pdt-bulkbar__right">
        <button type="button" className="pdt-btn pdt-btn-sm" onClick={onSelectAll}>
          Select all
        </button>
        <button
          type="button"
          className="pdt-btn pdt-btn-sm"
          disabled={count === 0}
          onClick={onClear}
        >
          Clear
        </button>
        <button type="button" className="pdt-btn pdt-btn-sm" onClick={onExit}>
          Done
        </button>
      </div>
    </div>
  );
}

/**
 * A select that behaves like an action menu: it never keeps a value — choosing
 * an option fires `onPick` and immediately resets to the label placeholder.
 */
function PickSelect({
  label,
  options,
  disabled,
  onPick,
}: {
  label: string;
  options: { value: string; label: string }[];
  disabled?: boolean;
  onPick: (value: string) => void;
}) {
  return (
    <select
      className="pdt-input pdt-bulkbar__select"
      value=""
      disabled={disabled}
      aria-label={`Set ${label} for selection`}
      onChange={(e) => {
        const v = e.target.value;
        e.currentTarget.value = '';
        if (v !== '') onPick(v === '__none__' ? '' : v);
      }}
    >
      <option value="" disabled>
        {label}…
      </option>
      {options.map((o) => (
        <option key={o.value || '__none__'} value={o.value || '__none__'}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
