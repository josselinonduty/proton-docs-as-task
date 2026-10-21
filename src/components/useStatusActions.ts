import { useTranslation } from 'react-i18next';
import {
  addStatus,
  canRemoveStatus,
  moveStatus,
  updateStatus,
  type BoardModel,
} from '../lib/model';
import type { StatusDef, StatusKey } from '../lib/types';

interface StatusActionsOptions {
  model: BoardModel;
  onChange: (next: BoardModel, undoLabel?: string) => void;
  announce: (message: string) => void;
}

/** Status edits shared by the workflow columns and Board settings, each one undoable. */
export function useStatusActions({ model, onChange, announce }: StatusActionsOptions) {
  const { t } = useTranslation();
  return {
    /** Append a new status; returns its key so the caller can focus it. */
    add(): StatusKey {
      const { model: next, key } = addStatus(model);
      onChange(next, t('settings.undo.added'));
      announce(t('settings.added'));
      return key;
    },
    rename(status: StatusDef, label: string) {
      onChange(updateStatus(model, status.key, { label }), t('settings.undo.renamed', { label }));
      announce(t('settings.renamed', { label }));
    },
    /** Returns false when the status is already at that end. */
    move(status: StatusDef, delta: number): boolean {
      const next = moveStatus(model, status.key, delta);
      if (next === model) return false;
      onChange(next, t('settings.undo.moved', { label: status.label }));
      return true;
    },
    canRemove: (status: StatusDef) => canRemoveStatus(model, status.key),
    /** Explains the delete button, including why it's disabled. */
    removeHint(status: StatusDef): string {
      return canRemoveStatus(model, status.key)
        ? t('settings.deleteStatus')
        : t('settings.needOne', { category: t(`statusCategory.${status.category}`) });
    },
  };
}
