import { useEffect, useId, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { Icon } from '../../components/Icon';
import { AppearanceSelect, SettingSelect } from '../../components/SettingSelect';
import { DEFAULT_MARKERS } from '../../lib/defaults';
import { getSettings, setSettings } from '../../lib/settings';
import { flowSummary } from '../../lib/statuses';
import {
  BOARD_VIEWS,
  COMPLETED_DISPLAYS,
  STATUS_FLOWS,
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

const REPO_URL = 'https://github.com/josselinonduty/proton-docs-as-task';
const SYNTAX_URL = `${REPO_URL}#task-syntax`;

const parseMarkers = (text: string) =>
  text
    .split('\n')
    .map((m) => m.trim())
    .filter(Boolean);

const sameList = (a: readonly string[], b: readonly string[]) =>
  a.length === b.length && a.every((item, i) => item === b[i]);

export function App() {
  const { t } = useTranslation();
  const [settings, setLocal] = useState<Settings | null>(null);
  const [markersText, setMarkersText] = useState('');
  const [markerError, setMarkerError] = useState('');
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const markerHelpId = useId();
  const markerErrorId = useId();

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
      if (patch.markers) setMarkersText(next.markers.join('\n'));
      setSavedAt(Date.now());
    });
  }

  function saveMarkers() {
    const markers = parseMarkers(markersText);
    if (markers.length === 0) {
      setMarkerError(t('options.markers.error'));
      return;
    }
    setMarkerError('');
    persist({ markers });
  }

  function resetMarkers() {
    setConfirmingReset(false);
    setMarkerError('');
    persist({ markers: DEFAULT_MARKERS });
  }

  if (!settings) return <div className="op-loading">{t('common.loading')}</div>;

  const markersDirty = !sameList(parseMarkers(markersText), settings.markers);
  const markersAreDefault = sameList(settings.markers, DEFAULT_MARKERS) && !markersDirty;

  return (
    <div className="op">
      <header className="op-head">
        <img className="op-logo" src="/icon/128.png" alt="" width={40} height={40} />
        <div>
          <h1>Proton Docs as Task</h1>
          <p className="op-sub">{t('options.subtitle')}</p>
        </div>
        <div className="op-head__aside">
          <span className="op-saved" role="status">
            {savedAt > 0 && (
              <span className="pdt-badge pdt-badge-solid pdt-badge-solid-success">
                <Icon name="checkmark" size={12} />
                {t('options.saved')}
              </span>
            )}
          </span>
          <a
            className="pdt-btn"
            href={browser.runtime.getURL('/welcome.html')}
            target="_blank"
            rel="noreferrer"
          >
            {t('options.rerun')}
          </a>
        </div>
      </header>

      <Group title={t('options.groups.board')}>
        <Toggle
          label={t('options.enabled')}
          checked={settings.enabled}
          onChange={(enabled) => persist({ enabled })}
        />
        <Toggle
          label={t('options.autoShow')}
          checked={settings.autoShow}
          onChange={(autoShow) => persist({ autoShow })}
        />
        <Row label={t('options.openIn')} hint={t('options.openInHint')}>
          {(field) => (
            <SettingSelect
              {...field}
              value={settings.defaultView}
              options={BOARD_VIEWS}
              optionLabel={(view) => t(`options.views.${view}`)}
              onChange={(defaultView) => persist({ defaultView })}
            />
          )}
        </Row>
        <Row label={t('options.statusFlow')} hint={t('options.statusFlowHint')}>
          {(field) => (
            <SettingSelect
              {...field}
              value={settings.defaultStatuses}
              options={STATUS_FLOWS}
              optionLabel={(flow) => `${t(`statusFlows.${flow}.name`)} (${flowSummary(flow)})`}
              onChange={(defaultStatuses) => persist({ defaultStatuses })}
            />
          )}
        </Row>
      </Group>

      <Group title={t('options.groups.appearance')}>
        <Row label={t('options.language')}>
          {(field) => (
            <AppearanceSelect
              {...field}
              setting="language"
              value={settings.language}
              onChange={(language) => persist({ language })}
            />
          )}
        </Row>
        <Row label={t('options.theme')}>
          {(field) => (
            <AppearanceSelect
              {...field}
              setting="theme"
              value={settings.theme}
              onChange={(theme) => persist({ theme })}
            />
          )}
        </Row>
        <Row label={t('options.density')}>
          {(field) => (
            <AppearanceSelect
              {...field}
              setting="density"
              value={settings.density}
              onChange={(density) => persist({ density })}
            />
          )}
        </Row>
        <Row label={t('options.dateFormat')}>
          {(field) => (
            <AppearanceSelect
              {...field}
              setting="dateFormat"
              value={settings.dateFormat}
              onChange={(dateFormat) => persist({ dateFormat })}
            />
          )}
        </Row>
      </Group>

      <Group title={t('options.groups.cards')}>
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
        <Toggle
          label={t('options.descPreview')}
          checked={settings.showDescriptionPreview}
          disabled={!settings.cardFields.description}
          onChange={(showDescriptionPreview) => persist({ showDescriptionPreview })}
        />
        <Row label={t('options.completed')} hint={t('options.completedHint')}>
          {(field) => (
            <SettingSelect
              {...field}
              value={settings.completedDisplay}
              options={COMPLETED_DISPLAYS}
              optionLabel={(display) => t(`options.completedDisplays.${display}`)}
              onChange={(completedDisplay) => persist({ completedDisplay })}
            />
          )}
        </Row>
        <Row label={t('options.newCards')} hint={t('options.newCardsHint')}>
          {(field) => (
            <SettingSelect
              {...field}
              value={settings.newCardsAtTop ? 'top' : 'bottom'}
              options={NEW_CARD_POSITIONS}
              optionLabel={(position) => t(`options.newCardPositions.${position}`)}
              onChange={(position) => persist({ newCardsAtTop: position === 'top' })}
            />
          )}
        </Row>
      </Group>

      <Group title={t('options.groups.behavior')}>
        <Row label={t('options.name')} hint={t('options.nameHint')}>
          {(field) => (
            <input
              {...field}
              type="text"
              className="pdt-input"
              value={settings.userAssignee}
              placeholder={t('options.namePlaceholder')}
              onChange={(e) => setLocal({ ...settings, userAssignee: e.target.value })}
              onBlur={(e) => persist({ userAssignee: e.target.value })}
            />
          )}
        </Row>
        <Toggle
          label={t('options.confirmDelete')}
          hint={t('options.confirmDeleteHint')}
          checked={settings.confirmDelete}
          onChange={(confirmDelete) => persist({ confirmDelete })}
        />
        <Toggle
          label={t('options.closePopupAfterAdd')}
          hint={t('options.closePopupAfterAddHint')}
          checked={settings.closePopupAfterAdd}
          onChange={(closePopupAfterAdd) => persist({ closePopupAfterAdd })}
        />
      </Group>

      <details className="op-card op-more pdt-card">
        <summary>
          <h2>{t('options.markers.title')}</h2>
        </summary>
        <p className="op-hint" id={markerHelpId}>
          <Trans
            i18nKey="options.markers.help"
            components={{ strong: <strong />, code: <code /> }}
          />
        </p>
        <textarea
          className="pdt-textarea pdt-textarea-code"
          rows={4}
          value={markersText}
          aria-label={t('options.markers.title')}
          aria-describedby={markerError ? `${markerHelpId} ${markerErrorId}` : markerHelpId}
          aria-invalid={markerError ? true : undefined}
          onChange={(e) => {
            setMarkersText(e.target.value);
            setConfirmingReset(false);
          }}
          spellCheck={false}
        />
        {markerError && (
          <p className="op-error" id={markerErrorId} role="alert">
            {markerError}
          </p>
        )}
        {confirmingReset ? (
          <div className="op-actions" role="group" aria-label={t('options.markers.reset')}>
            <span className="op-actions__note">{t('options.markers.resetConfirm')}</span>
            <button className="pdt-btn pdt-btn-primary" onClick={resetMarkers}>
              {t('options.markers.reset')}
            </button>
            <button className="pdt-btn" onClick={() => setConfirmingReset(false)}>
              {t('common.cancel')}
            </button>
          </div>
        ) : (
          <div className="op-actions">
            <button
              className="pdt-btn pdt-btn-primary"
              disabled={!markersDirty}
              onClick={saveMarkers}
            >
              {t('options.markers.save')}
            </button>
            <button
              className="pdt-btn"
              disabled={markersAreDefault}
              onClick={() => setConfirmingReset(true)}
            >
              {t('options.markers.reset')}
            </button>
            {markersDirty && (
              <span className="op-actions__note">{t('options.markers.unsaved')}</span>
            )}
          </div>
        )}
      </details>

      <details className="op-card op-more pdt-card">
        <summary>
          <h2>{t('options.syntax.title')}</h2>
        </summary>
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
        <p className="op-more__link">
          <a className="pdt-link" href={SYNTAX_URL} target="_blank" rel="noreferrer">
            {t('options.syntax.more')}
          </a>
        </p>
      </details>

      <footer className="op-foot">
        <a href={REPO_URL} target="_blank" rel="noreferrer">
          github.com/josselinonduty/proton-docs-as-task
        </a>
      </footer>
    </div>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const headingId = useId();
  return (
    <section className="op-card pdt-card" aria-labelledby={headingId}>
      <h2 id={headingId}>{title}</h2>
      {children}
    </section>
  );
}

/** Props a row hands to its control, tying it to the row's label and hint. */
interface FieldProps {
  id: string;
  'aria-describedby'?: string;
}

interface RowProps {
  label: string;
  hint?: string;
  children: (field: FieldProps) => React.ReactNode;
}

/** A label and its control side by side, with an optional hint under the label. */
function Row({ label, hint, children }: RowProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="op-row">
      <label className="op-row__label" htmlFor={id}>
        {label}
      </label>
      <div className="op-row__control">
        {children({ id, 'aria-describedby': hint ? hintId : undefined })}
      </div>
      {hint && (
        <p className="op-row__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

interface ToggleProps {
  label: string;
  hint?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}

/** An on/off setting, drawn as the same switch the popup uses. */
function Toggle({ label, hint, checked, disabled, onChange }: ToggleProps) {
  const hintId = useId();
  return (
    <div className="op-row op-row--switch">
      <label className="pdt-switch-row" aria-disabled={disabled || undefined}>
        <span>{label}</span>
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          aria-describedby={hint ? hintId : undefined}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="pdt-switch" aria-hidden="true" />
      </label>
      {hint && (
        <p className="op-row__hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

const SYNTAX_EXAMPLE = `#!tasks Sprint 42

## Backend
- [x] Design the schema @who:sam
- [ ] Build the API @status:doing @priority:high @due:2026-09-10 #api

## Frontend
- [ ] Wire up the board @@jo !!
- [ ] Polish styles #ui`;
