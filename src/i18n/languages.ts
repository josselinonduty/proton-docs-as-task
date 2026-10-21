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

export const LANGUAGE_SETTINGS = ['auto', ...Object.keys(LANGUAGES)] as LanguageSetting[];

export function isLanguage(code: unknown): code is Language {
  return typeof code === 'string' && Object.hasOwn(LANGUAGES, code);
}

/** Turns the stored setting into a supported language, following the browser for `auto`. */
export function resolveLanguage(setting: LanguageSetting): Language {
  if (setting !== 'auto') return setting;
  for (const tag of navigator.languages) {
    const base = tag.split('-')[0]!.toLowerCase();
    if (isLanguage(base)) return base;
  }
  return 'en';
}
