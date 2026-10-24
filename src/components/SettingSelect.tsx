import type { SelectHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGE_SETTINGS, LANGUAGES } from '../i18n/languages';
import { DATE_FORMATS } from '../lib/dates';
import { CARD_DENSITIES, THEMES, type Settings } from '../lib/types';

interface SettingSelectProps<T extends string> extends Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  'value' | 'onChange'
> {
  value: T;
  options: readonly T[];
  optionLabel: (option: T) => string;
  onChange: (value: T) => void;
}

/** A styled select over a fixed list of setting values. */
export function SettingSelect<T extends string>({
  value,
  options,
  optionLabel,
  onChange,
  ...rest
}: SettingSelectProps<T>) {
  return (
    <select
      className="pdt-select"
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      {...rest}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {optionLabel(option)}
        </option>
      ))}
    </select>
  );
}

type AppearanceSetting = 'language' | 'theme' | 'density' | 'dateFormat';

interface AppearanceSelectProps<K extends AppearanceSetting> extends Omit<
  SettingSelectProps<Settings[K]>,
  'options' | 'optionLabel'
> {
  setting: K;
}

/** A select for one appearance setting, shared by the options page and first-run setup. */
export function AppearanceSelect<K extends AppearanceSetting>({
  setting,
  ...rest
}: AppearanceSelectProps<K>) {
  const { t } = useTranslation();
  const choices: {
    [S in AppearanceSetting]: Pick<SettingSelectProps<Settings[S]>, 'options' | 'optionLabel'>;
  } = {
    language: {
      options: LANGUAGE_SETTINGS,
      optionLabel: (code) => (code === 'auto' ? t('options.languageAuto') : LANGUAGES[code]),
    },
    theme: { options: THEMES, optionLabel: (theme) => t(`options.themes.${theme}`) },
    density: {
      options: CARD_DENSITIES,
      optionLabel: (density) => t(`options.densities.${density}`),
    },
    dateFormat: {
      options: DATE_FORMATS,
      optionLabel: (format) => t(`options.dateFormats.${format}`),
    },
  };
  return <SettingSelect {...choices[setting]} {...rest} />;
}
