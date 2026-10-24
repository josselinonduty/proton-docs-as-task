import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { AppearanceSelect } from '../../components/SettingSelect';
import type { Preferences } from '../../lib/onboarding';

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
          <AppearanceSelect
            setting="language"
            value={value.language}
            onChange={(next) => set('language', next)}
          />
        </label>
        <label className="wl-field">
          <span className="wl-field__label">{t('options.theme')}</span>
          <AppearanceSelect
            setting="theme"
            value={value.theme}
            onChange={(next) => set('theme', next)}
          />
        </label>
        <label className="wl-field">
          <span className="wl-field__label">{t('options.density')}</span>
          <AppearanceSelect
            setting="density"
            value={value.density}
            onChange={(next) => set('density', next)}
          />
        </label>
        <label className="wl-field">
          <span className="wl-field__label">{t('options.dateFormat')}</span>
          <AppearanceSelect
            setting="dateFormat"
            value={value.dateFormat}
            onChange={(next) => set('dateFormat', next)}
          />
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
