import { storage } from '#imports';
import type { Settings } from './types';
import { DEFAULT_SETTINGS, withDefaults } from './defaults';

export {
  DEFAULT_CARD_FIELDS,
  DEFAULT_COLUMNS,
  DEFAULT_MARKERS,
  DEFAULT_SETTINGS,
  markersAreValid,
  withDefaults,
} from './defaults';

/**
 * Single source of truth for persisted settings. Uses WXT's typed storage
 * (sync area) so preferences follow the user across devices.
 */
export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 1,
});

export async function getSettings(): Promise<Settings> {
  return withDefaults(await settingsItem.getValue());
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = withDefaults({ ...(await getSettings()), ...patch });
  await settingsItem.setValue(next);
  return next;
}
