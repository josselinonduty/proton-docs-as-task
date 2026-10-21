import { t } from '../i18n';
import type { Priority } from '../lib/types';
import type { IconName } from './Icon';

/** Priority choices for selects, "none" first. */
export const PRIORITY_OPTIONS: ('' | Priority)[] = ['', 'high', 'medium', 'low'];

export function priorityOptionLabel(priority: '' | Priority): string {
  return priority ? priorityLabel(priority) : t('priority.noneLong');
}

/** Priority is told apart by its label and chip color; the flag marks the field. */
export const PRIORITY_ICON: IconName = 'flag';

export function priorityLabel(priority: Priority): string {
  return t(`priority.${priority}`);
}
