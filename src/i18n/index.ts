import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { resolveLanguage, type Language, type LanguageSetting } from './languages';
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

const translations = { en, fr, de, es, it, ja, pt, nl, zh } satisfies Record<Language, object>;

export function setLanguage(setting: LanguageSetting) {
  return i18n.changeLanguage(resolveLanguage(setting));
}

void i18n.use(initReactI18next).init({
  resources: Object.fromEntries(
    Object.entries(translations).map(([code, translation]) => [code, { translation }]),
  ),
  lng: 'en',
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
});

/** For non-component code; components use `useTranslation` so they re-render on language changes. */
export const t = i18n.t.bind(i18n);
export default i18n;
