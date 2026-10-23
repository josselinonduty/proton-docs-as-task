import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { LANGUAGE_SETTINGS, LANGUAGES } from '../../i18n/languages';
import { DATE_FORMATS } from '../../lib/dates';
import { DEFAULT_MARKERS } from '../../lib/defaults';
import { getSettings, setSettings } from '../../lib/settings';
import {
  BOARD_VIEWS,
  CARD_DENSITIES,
  COMPLETED_DISPLAYS,
  THEMES,
  type CardFieldVisibility,
  type Settings,
} from '../../lib/types';

const CARD_FIELDS: (keyof CardFieldVisibility)[] = [
  'description',
  'priority',
  'due',
  'assignee',
  'labels',
  'sectionInWorkflow',
  'statusInSections',
];

const NEW_CARD_POSITIONS = ['bottom', 'top'] as const;

const SAVED_BADGE_MS = 1500;

export function App() {
  const { t } = useTranslation();
  const [settings, setLocal] = useState<Settings | null>(null);
  const [markersText, setMarkersText] = useState('');
  const [markerError, setMarkerError] = useState('');
  const [savedAt, setSavedAt] = useState(0);

  useEffect(() => {
    void getSettings().then((s) => {
      setLocal(s);
      setMarkersText(s.markers.join('\n'));
    });
  }, []);

  useEffect(() => {
    if (!savedAt) return;
    const timer = setTimeout(() => setSavedAt(0), SAVED_BADGE_MS);
    return () => clearTimeout(timer);
  }, [savedAt]);

  function persist(patch: Partial<Settings>) {
    void setSettings(patch).then((next) => {
      setLocal(next);
      setMarkersText(next.markers.join('\n'));
      setSavedAt(Date.now());
    });
  }

  function saveMarkers() {
    const markers = markersText
      .split('\n')
      .map((m) => m.trim())
      .filter(Boolean);
    if (markers.length === 0) {
      setMarkerError(t('options.markers.error'));
      return;
    }
    setMarkerError('');
    persist({ markers });
  }

  if (!settings) return <div className="op-loading">{t('common.loading')}</div>;

  return (
    <div className="op">
      <header className="op-head">
        <img className="op-logo" src="/icon/128.png" alt="" width={40} height={40} />
        <div>
          <h1>Proton Docs as Task</h1>
          <p className="op-sub">{t('options.subtitle')}</p>
        </div>
        {savedAt > 0 && (
          <span className="pdt-badge pdt-badge-solid pdt-badge-solid-success op-saved">
            {t('options.saved')}
          </span>
        )}
      </header>

      <section className="op-card pdt-card">
        <h2>{t('options.general')}</h2>
        <Toggle
          label={t('options.enabled')}
          hint={t('options.enabledHint')}
          checked={settings.enabled}
          onChange={(enabled) => persist({ enabled })}
        />
        <Toggle
          label={t('options.autoShow')}
          hint={t('options.autoShowHint')}
          checked={settings.autoShow}
          onChange={(autoShow) => persist({ autoShow })}
        />
        <Row label={t('options.defaultView')} hint={t('options.defaultViewHint')}>
          <Select
            value={settings.defaultView}
            options={BOARD_VIEWS}
            optionLabel={(view) => t(`options.views.${view}`)}
            onChange={(defaultView) => persist({ defaultView })}
          />
        </Row>
        <Row label={t('options.language')} hint={t('options.languageHint')}>
          <Select
            value={settings.language}
            options={LANGUAGE_SETTINGS}
            optionLabel={(code) => (code === 'auto' ? t('options.languageAuto') : LANGUAGES[code])}
            onChange={(language) => persist({ language })}
          />
        </Row>
        <Row label={t('options.theme')} hint={t('options.themeHint')}>
          <Select
            value={settings.theme}
            options={THEMES}
            optionLabel={(theme) => t(`options.themes.${theme}`)}
            onChange={(theme) => persist({ theme })}
          />
        </Row>
        <Row label={t('options.density')} hint={t('options.densityHint')}>
          <Select
            value={settings.density}
            options={CARD_DENSITIES}
            optionLabel={(density) => t(`options.densities.${density}`)}
            onChange={(density) => persist({ density })}
          />
        </Row>
      </section>

      <section className="op-card pdt-card">
        <h2>{t('options.behavior')}</h2>
        <Row label={t('options.newCards')} hint={t('options.newCardsHint')}>
          <Select
            value={settings.newCardsAtTop ? 'top' : 'bottom'}
            options={NEW_CARD_POSITIONS}
            optionLabel={(position) => t(`options.newCardPositions.${position}`)}
            onChange={(position) => persist({ newCardsAtTop: position === 'top' })}
          />
        </Row>
        <Toggle
          label={t('options.descPreview')}
          hint={t('options.descPreviewHint')}
          checked={settings.showDescriptionPreview}
          onChange={(showDescriptionPreview) => persist({ showDescriptionPreview })}
        />
        <Row label={t('options.completed')} hint={t('options.completedHint')}>
          <Select
            value={settings.completedDisplay}
            options={COMPLETED_DISPLAYS}
            optionLabel={(display) => t(`options.completedDisplays.${display}`)}
            onChange={(completedDisplay) => persist({ completedDisplay })}
          />
        </Row>
        <Toggle
          label={t('options.confirmDelete')}
          hint={t('options.confirmDeleteHint')}
          checked={settings.confirmDelete}
          onChange={(confirmDelete) => persist({ confirmDelete })}
        />
      </section>

      <section className="op-card pdt-card">
        <h2>{t('options.display')}</h2>
        <Row label={t('options.dateFormat')} hint={t('options.dateFormatHint')}>
          <Select
            value={settings.dateFormat}
            options={DATE_FORMATS}
            optionLabel={(format) => t(`options.dateFormats.${format}`)}
            onChange={(dateFormat) => persist({ dateFormat })}
          />
        </Row>

        <Row label={t('options.name')} hint={t('options.nameHint')}>
          <input
            type="text"
            className="pdt-input"
            value={settings.userAssignee}
            placeholder={t('options.namePlaceholder')}
            onChange={(e) => setLocal({ ...settings, userAssignee: e.target.value })}
            onBlur={(e) => persist({ userAssignee: e.target.value })}
          />
        </Row>

        <fieldset className="op-fieldset">
          <legend className="op-row__label">{t('options.fields')}</legend>
          <p className="op-row__hint">{t('options.fieldsHint')}</p>
          <div className="op-checks">
            {CARD_FIELDS.map((key) => (
              <label key={key} className="op-check">
                <input
                  type="checkbox"
                  className="pdt-native-check"
                  checked={settings.cardFields[key]}
                  onChange={(e) =>
                    persist({ cardFields: { ...settings.cardFields, [key]: e.target.checked } })
                  }
                />
                <span>{t(`options.field.${key}`)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="op-card pdt-card">
        <h2>{t('options.markers.title')}</h2>
        <p className="op-hint">
          <Trans
            i18nKey="options.markers.help"
            components={{ strong: <strong />, code: <code /> }}
          />
        </p>
        <textarea
          className="pdt-textarea pdt-textarea-code"
          rows={4}
          value={markersText}
          onChange={(e) => setMarkersText(e.target.value)}
          spellCheck={false}
        />
        {markerError && (
          <p className="op-error" role="alert">
            {markerError}
          </p>
        )}
        <div className="op-actions">
          <button className="pdt-btn pdt-btn-primary" onClick={saveMarkers}>
            {t('options.markers.save')}
          </button>
          <button
            className="pdt-btn"
            onClick={() => {
              setMarkerError('');
              persist({ markers: DEFAULT_MARKERS });
            }}
          >
            {t('options.markers.reset')}
          </button>
        </div>
      </section>

      <section className="op-card pdt-card">
        <h2>{t('options.syntax.title')}</h2>
        <p className="op-hint">
          <Trans i18nKey="options.syntax.intro" components={{ code: <code /> }} />
        </p>
        <pre className="op-syntax">{SYNTAX_EXAMPLE}</pre>
        <ul className="op-legend">
          <li>
            <Trans i18nKey="options.syntax.task" components={{ code: <code /> }} />
          </li>
          <li>
            <Trans i18nKey="options.syntax.section" components={{ code: <code /> }} />
          </li>
          <li>
            <Trans i18nKey="options.syntax.status" components={{ code: <code />, em: <em /> }} />
          </li>
          <li>
            <Trans i18nKey="options.syntax.statusRef" components={{ code: <code /> }} />
          </li>
          <li>
            <Trans i18nKey="options.syntax.priority" components={{ code: <code /> }} />
          </li>
          <li>
            <Trans i18nKey="options.syntax.due" components={{ code: <code /> }} />
          </li>
          <li>
            <Trans i18nKey="options.syntax.who" components={{ code: <code /> }} />
          </li>
          <li>
            <Trans i18nKey="options.syntax.label" components={{ code: <code /> }} />
          </li>
          <li>
            <Trans i18nKey="options.syntax.parent" components={{ code: <code /> }} />
          </li>
        </ul>
      </section>

      <footer className="op-foot">
        <a
          href="https://github.com/josselinonduty/proton-docs-as-task"
          target="_blank"
          rel="noreferrer"
        >
          github.com/josselinonduty/proton-docs-as-task
        </a>
      </footer>
    </div>
  );
}

interface RowProps {
  label: string;
  hint: string;
  children: React.ReactNode;
}

function Row({ label, hint, children }: RowProps) {
  return (
    <label className="op-row">
      <span>
        <span className="op-row__label">{label}</span>
        <span className="op-row__hint">{hint}</span>
      </span>
      {children}
    </label>
  );
}

interface ToggleProps extends Omit<RowProps, 'children'> {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function Toggle({ checked, onChange, ...row }: ToggleProps) {
  return (
    <Row {...row}>
      <input
        type="checkbox"
        className="pdt-native-check"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </Row>
  );
}

interface SelectProps<T extends string> {
  value: T;
  options: readonly T[];
  optionLabel: (option: T) => string;
  onChange: (value: T) => void;
}

function Select<T extends string>({ value, options, optionLabel, onChange }: SelectProps<T>) {
  return (
    <select className="pdt-select" value={value} onChange={(e) => onChange(e.target.value as T)}>
      {options.map((option) => (
        <option key={option} value={option}>
          {optionLabel(option)}
        </option>
      ))}
    </select>
  );
}

const SYNTAX_EXAMPLE = `#!tasks Sprint 42
@settings status todo "To Do" @category:todo
@settings status doing "In Progress" @category:doing @color:blue @bg:blue
@settings status done "Done" @category:done @color:green

## Backend
- [x] Design the schema @who:sam
- [ ] Build the API @status:doing @priority:high @due:2026-09-10 #api

## Frontend
- [ ] Wire up the board @@jo !!
- [ ] Polish styles #ui`;
