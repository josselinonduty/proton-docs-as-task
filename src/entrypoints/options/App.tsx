import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { LANGUAGES } from '../../i18n';
import {
  DEFAULT_SETTINGS,
  getSettings,
  markersAreValid,
  setSettings,
  syncLanguage,
} from '../../lib/settings';
import type { CardFieldVisibility, Settings } from '../../lib/types';

const CARD_FIELDS: (keyof CardFieldVisibility)[] = [
  'description',
  'priority',
  'due',
  'assignee',
  'labels',
  'sectionInWorkflow',
  'statusInSections',
];

export function App() {
  const { t } = useTranslation();
  const [settings, setLocal] = useState<Settings | null>(null);
  const [markersText, setMarkersText] = useState('');
  const [markerError, setMarkerError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const unwatch = syncLanguage();
    void (async () => {
      const s = await getSettings();
      setLocal(s);
      setMarkersText(s.markers.join('\n'));
    })();
    return () => void unwatch.then((stop) => stop());
  }, []);

  async function persist(patch: Partial<Settings>) {
    const next = await setSettings(patch);
    setLocal(next);
    setMarkersText(next.markers.join('\n'));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function saveMarkers() {
    const markers = markersText
      .split('\n')
      .map((m) => m.trim())
      .filter(Boolean);
    if (!markersAreValid(markers)) {
      setMarkerError(t('options.markers.error'));
      return;
    }
    setMarkerError('');
    void persist({ markers });
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
        {saved && (
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
          onChange={(v) => persist({ enabled: v })}
        />
        <Toggle
          label={t('options.autoShow')}
          hint={t('options.autoShowHint')}
          checked={settings.autoShow}
          onChange={(v) => persist({ autoShow: v })}
        />

        <Row label={t('options.defaultView')} hint={t('options.defaultViewHint')}>
          <select
            className="pdt-select"
            value={settings.defaultView}
            onChange={(e) => persist({ defaultView: e.target.value as Settings['defaultView'] })}
          >
            <option value="workflow">{t('options.view.workflow')}</option>
            <option value="sections">{t('options.view.sections')}</option>
            <option value="swimlane">{t('options.view.swimlane')}</option>
            <option value="list">{t('options.view.list')}</option>
          </select>
        </Row>

        <Row label={t('options.language')} hint={t('options.languageHint')}>
          <select
            className="pdt-select"
            value={settings.language}
            onChange={(e) => persist({ language: e.target.value as Settings['language'] })}
          >
            <option value="auto">{t('options.languageAuto')}</option>
            {Object.entries(LANGUAGES).map(([code, name]) => (
              <option key={code} value={code}>
                {name}
              </option>
            ))}
          </select>
        </Row>

        <Row label={t('options.theme')} hint={t('options.themeHint')}>
          <select
            className="pdt-select"
            value={settings.theme}
            onChange={(e) => persist({ theme: e.target.value as Settings['theme'] })}
          >
            <option value="system">{t('options.themeSystem')}</option>
            <option value="light">{t('options.themeLight')}</option>
            <option value="dark">{t('options.themeDark')}</option>
          </select>
        </Row>

        <Row label={t('options.density')} hint={t('options.densityHint')}>
          <select
            className="pdt-select"
            value={settings.density}
            onChange={(e) => persist({ density: e.target.value as Settings['density'] })}
          >
            <option value="comfortable">{t('options.comfortable')}</option>
            <option value="compact">{t('options.compact')}</option>
          </select>
        </Row>
      </section>

      <section className="op-card pdt-card">
        <h2>{t('options.behavior')}</h2>
        <Row label={t('options.newCards')} hint={t('options.newCardsHint')}>
          <select
            className="pdt-select"
            value={settings.newCardsAtTop ? 'top' : 'bottom'}
            onChange={(e) => persist({ newCardsAtTop: e.target.value === 'top' })}
          >
            <option value="bottom">{t('options.bottom')}</option>
            <option value="top">{t('options.top')}</option>
          </select>
        </Row>
        <Toggle
          label={t('options.descPreview')}
          hint={t('options.descPreviewHint')}
          checked={settings.showDescriptionPreview}
          onChange={(v) => persist({ showDescriptionPreview: v })}
        />
        <Row label={t('options.completed')} hint={t('options.completedHint')}>
          <select
            className="pdt-select"
            value={settings.completedDisplay}
            onChange={(e) =>
              persist({ completedDisplay: e.target.value as Settings['completedDisplay'] })
            }
          >
            <option value="show">{t('options.completedShow')}</option>
            <option value="collapse">{t('options.completedCollapse')}</option>
            <option value="hide">{t('options.completedHide')}</option>
          </select>
        </Row>
        <Toggle
          label={t('options.confirmDelete')}
          hint={t('options.confirmDeleteHint')}
          checked={settings.confirmDelete}
          onChange={(v) => persist({ confirmDelete: v })}
        />
      </section>

      <section className="op-card pdt-card">
        <h2>{t('options.display')}</h2>
        <Row label={t('options.dateFormat')} hint={t('options.dateFormatHint')}>
          <select
            className="pdt-select"
            value={settings.dateFormat}
            onChange={(e) => persist({ dateFormat: e.target.value as Settings['dateFormat'] })}
          >
            <option value="iso">{t('options.dateIso')}</option>
            <option value="medium">{t('options.dateMedium')}</option>
            <option value="us">{t('options.dateUs')}</option>
            <option value="euro">{t('options.dateEuro')}</option>
          </select>
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
              void persist({ markers: DEFAULT_SETTINGS.markers });
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

function Row({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="op-row">
      <div>
        <div className="op-row__label">{label}</div>
        <div className="op-row__hint">{hint}</div>
      </div>
      {children}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Row label={label} hint={hint}>
      <input
        type="checkbox"
        className="pdt-native-check"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </Row>
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
