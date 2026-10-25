import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { OrphanStatus } from '@/lib/model';
import { defaultStatus } from '@/lib/statuses';
import type { StatusDef, StatusKey } from '@/lib/types';
import { Dialog } from './Dialog';

function StatusSelect({
  label,
  statuses,
  value,
  onChange,
}: {
  label: string;
  statuses: StatusDef[];
  value: StatusKey;
  onChange: (key: StatusKey) => void;
}) {
  return (
    <select
      className="pdt-select"
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {statuses.map((s) => (
        <option key={s.key} value={s.key}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

interface StatusDeleteDialogProps {
  status: StatusDef;
  count: number;
  /** The statuses its tasks may move to (every other one). */
  targets: StatusDef[];
  onCancel: () => void;
  onConfirm: (target: StatusKey) => void;
}

/** Confirm deleting a status that still has tasks, choosing where they go. */
export function StatusDeleteDialog({
  status,
  count,
  targets,
  onCancel,
  onConfirm,
}: StatusDeleteDialogProps) {
  const { t } = useTranslation();
  const [target, setTarget] = useState(
    () => (targets.find((s) => s.category === status.category) ?? targets[0])?.key ?? '',
  );
  return (
    <Dialog title={t('statusDialog.deleteTitle', { label: status.label })} onClose={onCancel}>
      <p className="pdt-modal__text">
        {t('statusDialog.deleteText', { label: status.label, count })}
      </p>
      <div className="pdt-modal__choice">
        <label className="pdt-field pdt-field--grow">
          <span className="pdt-field-label">{t('statusDialog.moveTo')}</span>
          <StatusSelect
            label={t('statusDialog.moveTo')}
            statuses={targets}
            value={target}
            onChange={setTarget}
          />
        </label>
      </div>
      <div className="pdt-modal__actions">
        <button className="pdt-btn" onClick={onCancel}>
          {t('common.cancel')}
        </button>
        <button className="pdt-btn pdt-btn-danger-solid" onClick={() => onConfirm(target)}>
          {t('statusDialog.moveAndDelete')}
        </button>
      </div>
    </Dialog>
  );
}

interface MissingStatusDialogProps {
  orphans: OrphanStatus[];
  statuses: StatusDef[];
  /** Move every orphaned task, per missing key, in one write. */
  onMove: (targets: Record<StatusKey, StatusKey>) => void;
  onOpenSettings: () => void;
}

/**
 * Shown while tasks reference statuses the board doesn't define (removed in
 * the document, or typed by hand). It can't be dismissed: the board stays
 * blocked until those tasks are moved, or the statuses are created again from
 * Board settings.
 */
export function MissingStatusDialog({
  orphans,
  statuses,
  onMove,
  onOpenSettings,
}: MissingStatusDialogProps) {
  const { t } = useTranslation();
  const fallback = defaultStatus(statuses, false);
  const [targets, setTargets] = useState<Record<StatusKey, StatusKey>>({});
  const targetOf = (key: StatusKey) => {
    const chosen = targets[key];
    return chosen && statuses.some((s) => s.key === chosen) ? chosen : fallback;
  };
  const total = orphans.reduce((n, o) => n + o.count, 0);

  return (
    <Dialog title={t('statusDialog.missingTitle')}>
      <p className="pdt-modal__text">
        {t('statusDialog.missingText', { count: total, statuses: orphans.length })}
      </p>
      <ul className="pdt-orphans">
        {orphans.map((o) => (
          <li key={o.key} className="pdt-orphans__row">
            <span className="pdt-orphans__key">
              <code>@status:{o.key}</code>
              <span className="pdt-text-weak">{t('count.tasks', { count: o.count })}</span>
            </span>
            <StatusSelect
              label={t('statusDialog.moveOrphans', { key: o.key })}
              statuses={statuses}
              value={targetOf(o.key)}
              onChange={(key) => setTargets((prev) => ({ ...prev, [o.key]: key }))}
            />
          </li>
        ))}
      </ul>
      <div className="pdt-modal__actions">
        <button className="pdt-btn" onClick={onOpenSettings}>
          {t('statusDialog.openSettings')}
        </button>
        <button
          className="pdt-btn pdt-btn-primary"
          onClick={() => onMove(Object.fromEntries(orphans.map((o) => [o.key, targetOf(o.key)])))}
        >
          {t('statusDialog.move')}
        </button>
      </div>
    </Dialog>
  );
}
