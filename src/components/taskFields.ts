import type { Priority } from '../lib/types';
import type { IconName } from './Icon';

/** Priority choices for selects, "none" first. */
export const PRIORITY_OPTIONS: { value: '' | Priority; label: string }[] = [
  { value: '', label: 'No priority' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

/** Priority is told apart by its label and chip color; the flag marks the field. */
export const PRIORITY_ICON: IconName = 'flag';

export function priorityLabel(priority: Priority): string {
  return priority[0]!.toUpperCase() + priority.slice(1);
}
