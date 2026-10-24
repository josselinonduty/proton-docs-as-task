import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_SETTINGS, LANGUAGES } from '../../i18n/languages';
import { DATE_FORMATS } from '../../lib/dates';
import type { Preferences } from '../../lib/onboarding';
import { CARD_DENSITIES, THEMES } from '../../lib/types';

interface PreferenceFieldsProps {
  /** Receives focus when the step appears, so screen readers announce it. */
  headingRef: RefObject<HTMLHeadingElement | null>;
  value: Preferences;
  onChange: (value: Preferences) => void;
}

/** The small settings, as one labelled field each. */
export function PreferenceFields({ headingRef, value, onChange }: PreferenceFieldsProps) {
  const { t } = useTranslation();
  const set = <K extends keyof Preferences>(key: K, next: Preferences[K]) =>
    onChange({ ...value, [key]: next });

  return (
    <div>
      <h2 className="wl-title" ref={headingRef} tabIndex={-1}>
        {t('welcome.prefs.title')}
      </h2>
      <p className="wl-hint">{t('welcome.prefs.hint')}</p>
      <div className="wl-fields">
        <label className="wl-field">
          <span className="wl-field__label">{t('options.language')}</span>
          <select
            className="pdt-select"
            value={value.language}
            onChange={(e) => set('language', e.target.value as Preferences['language'])}
          >
            {LANGUAGE_SETTINGS.map((code) => (
              <option key={code} value={code}>
                {code === 'auto' ? t('options.languageAuto') : LANGUAGES[code]}
              </option>
            ))}
          </select>
        </label>
        <label className="wl-field">
          <span className="wl-field__label">{t('options.theme')}</span>
          <select
            className="pdt-select"
            value={value.theme}
            onChange={(e) => set('theme', e.target.value as Preferences['theme'])}
          >
            {THEMES.map((theme) => (
              <option key={theme} value={theme}>
                {t(`options.themes.${theme}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="wl-field">
          <span className="wl-field__label">{t('options.density')}</span>
          <select
            className="pdt-select"
            value={value.density}
            onChange={(e) => set('density', e.target.value as Preferences['density'])}
          >
            {CARD_DENSITIES.map((density) => (
              <option key={density} value={density}>
                {t(`options.densities.${density}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="wl-field">
          <span className="wl-field__label">{t('options.dateFormat')}</span>
          <select
            className="pdt-select"
            value={value.dateFormat}
            onChange={(e) => set('dateFormat', e.target.value as Preferences['dateFormat'])}
          >
            {DATE_FORMATS.map((format) => (
              <option key={format} value={format}>
                {t(`options.dateFormats.${format}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="wl-field wl-field--wide">
          <span className="wl-field__label">{t('options.name')}</span>
          <input
            type="text"
            className="pdt-input"
            value={value.userAssignee}
            placeholder={t('options.namePlaceholder')}
            onChange={(e) => set('userAssignee', e.target.value)}
          />
          <span className="wl-field__hint">{t('options.nameHint')}</span>
        </label>
        <label className="wl-check wl-field--wide">
          <input
            type="checkbox"
            className="pdt-native-check"
            checked={value.confirmDelete}
            onChange={(e) => set('confirmDelete', e.target.checked)}
          />
          <span>{t('options.confirmDelete')}</span>
        </label>
      </div>
    </div>
  );
}
