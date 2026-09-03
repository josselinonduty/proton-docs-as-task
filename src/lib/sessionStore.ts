/**
 * Ephemeral, per-document persistence for {@link SessionPrefs}.
 *
 * Backed by the browser's `session` storage area so preferences vanish when the
 * browser session ends — they are UI state, never document content. All
 * documents share one record keyed by {@link documentKey}. When no stable key
 * exists the caller should skip this store entirely and keep prefs in React
 * state for the tab's lifetime.
 */

import { storage } from '#imports';
import { normalizeSessionPrefs, type SessionPrefs } from './session';

const prefsItem = storage.defineItem<Record<string, Partial<SessionPrefs>>>('session:doc-prefs', {
  fallback: {},
});

/** Read (and normalize) the stored preferences for a document key. */
export async function readDocPrefs(key: string): Promise<SessionPrefs> {
  try {
    const all = await prefsItem.getValue();
    return normalizeSessionPrefs(all[key]);
  } catch {
    return normalizeSessionPrefs();
  }
}

/** Persist the preferences for a document key, merged into the shared record. */
export async function writeDocPrefs(key: string, prefs: SessionPrefs): Promise<void> {
  try {
    const all = await prefsItem.getValue();
    await prefsItem.setValue({ ...all, [key]: prefs });
  } catch {
    // Session storage may be unavailable (e.g. private mode); prefs then stay
    // in memory only, which is an acceptable degradation.
  }
}
