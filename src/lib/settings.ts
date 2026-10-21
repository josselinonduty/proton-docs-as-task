import { storage } from '#imports';
import { setLanguage } from '../i18n';
import { DEFAULT_SETTINGS, migrateLegacySettings, withDefaults } from './defaults';
import type { Settings } from './types';

/**
 * Single source of truth for persisted settings. Uses WXT's typed storage
 * (sync area) so preferences follow the user across devices.
 */
export const settingsItem = storage.defineItem<Settings>('sync:settings', {
  fallback: DEFAULT_SETTINGS,
  version: 2,
  migrations: { 2: migrateLegacySettings },
});

export async function getSettings(): Promise<Settings> {
  return withDefaults(await settingsItem.getValue());
}

export async function setSettings(patch: Partial<Settings>): Promise<Settings> {
  const next = withDefaults({ ...(await getSettings()), ...patch });
  await settingsItem.setValue(next);
  return next;
}

/** Applies the stored language and keeps following changes made elsewhere. */
export async function syncLanguage(): Promise<() => void> {
  await setLanguage((await getSettings()).language);
  return settingsItem.watch((value) => void setLanguage(withDefaults(value).language));
}
