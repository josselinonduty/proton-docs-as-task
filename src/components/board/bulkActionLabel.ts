import type { TFunction } from 'i18next';
import type { BulkAction } from '../../lib/model';

/** Human label for a bulk action, for the undo toast + announcement. */
export function bulkActionLabel(t: TFunction, action: BulkAction, count: number): string {
  const n = t('count.tasks', { count });
  switch (action.kind) {
    case 'complete':
      return t('bulkLabel.complete', { n });
    case 'status':
      return t('bulkLabel.status', { n });
    case 'section':
      return t('bulkLabel.section', { n, section: action.section });
    case 'priority':
      return t('bulkLabel.priority', { n });
    case 'assignee':
      return t('bulkLabel.assignee', { n });
    case 'due':
      return t('bulkLabel.due', { n });
    case 'addLabel':
      return t('bulkLabel.addLabel', { n, label: action.label });
    case 'removeLabel':
      return t('bulkLabel.removeLabel', { n, label: action.label });
    case 'delete':
      return t('bulkLabel.delete', { n });
  }
}
