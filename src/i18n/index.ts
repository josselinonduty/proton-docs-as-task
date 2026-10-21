import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import de from './locales/de.json';
import en from './locales/en.json';
import es from './locales/es.json';
import fr from './locales/fr.json';
import it from './locales/it.json';
import ja from './locales/ja.json';
import nl from './locales/nl.json';
import pt from './locales/pt.json';
import zh from './locales/zh.json';

export type Translation = typeof en;

/** Native names, so each stays recognisable whatever the current language. */
export const LANGUAGES = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  ja: '日本語',
  pt: 'Português',
  nl: 'Nederlands',
  zh: '中文',
} as const;

export type Language = keyof typeof LANGUAGES;
export type LanguageSetting = Language | 'auto';

const resources = { en, fr, de, es, it, ja, pt, nl, zh };

function isLanguage(code: string): code is Language {
  return code in LANGUAGES;
}

/** Turns the stored setting into a supported language, following the browser for `auto`. */
export function resolveLanguage(setting: LanguageSetting): Language {
  if (setting !== 'auto') return setting;
  const preferred = typeof navigator === 'undefined' ? [] : navigator.languages;
  for (const tag of preferred) {
    const base = tag.split('-')[0]!.toLowerCase();
    if (isLanguage(base)) return base;
  }
  return 'en';
}

export function setLanguage(setting: LanguageSetting): Promise<unknown> {
  return i18n.changeLanguage(resolveLanguage(setting));
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    Object.entries(resources).map(([code, translation]) => [code, { translation }]),
  ),
  lng: 'en',
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const t = i18n.t.bind(i18n);
export default i18n;
