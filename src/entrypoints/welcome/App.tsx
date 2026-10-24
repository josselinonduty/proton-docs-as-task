import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { DEFAULT_MARKERS } from '../../lib/defaults';
import { setLanguage } from '../../i18n';
import {
  LAYOUTS,
  LAYOUT_PRESETS,
  layoutForView,
  onboardingPatch,
  type Layout,
  type Preferences,
} from '../../lib/onboarding';
import { getSettings, setSettings } from '../../lib/settings';
import { flowSummary } from '../../lib/statuses';
import { STATUS_FLOWS, type StatusFlow } from '../../lib/types';
import { ChoiceGroup, Progress } from './Choices';
import { Done } from './Done';
import { PreferenceFields } from './PreferenceFields';
import { LayoutPreview } from './Previews';

const STEPS = ['layout', 'flow', 'prefs'] as const;
type Step = (typeof STEPS)[number] | 'done';

interface Choices {
  layout: Layout;
  flow: StatusFlow;
  marker: string;
  preferences: Preferences;
}

export function App() {
  const { t } = useTranslation();
  const [choices, setChoices] = useState<Choices | null>(null);
  const [step, setStep] = useState<Step>('layout');
  const [skipped, setSkipped] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const ready = choices !== null;

  // Start from what is stored, so running setup again shows the current choices.
  useEffect(() => {
    void getSettings().then((s) =>
      setChoices({
        layout: layoutForView(s.defaultView),
        flow: s.defaultStatuses,
        marker: s.markers[0] ?? DEFAULT_MARKERS[0]!,
        preferences: {
          language: s.language,
          theme: s.theme,
          density: s.density,
          dateFormat: s.dateFormat,
          userAssignee: s.userAssignee,
          confirmDelete: s.confirmDelete,
        },
      }),
    );
  }, []);

  // Each step moves focus to its heading, which announces the change.
  useEffect(() => {
    headingRef.current?.focus();
  }, [step, ready]);

  if (!choices) return <div className="wl-loading">{t('common.loading')}</div>;

  const update = (patch: Partial<Choices>) => setChoices({ ...choices, ...patch });

  // A layout suggests a density, which the next steps still let the user change.
  function pickLayout(layout: Layout) {
    update({
      layout,
      preferences: { ...choices!.preferences, density: LAYOUT_PRESETS[layout].density },
    });
  }

  // The language applies right away so the questions can be read in it.
  function pickPreferences(preferences: Preferences) {
    update({ preferences });
    if (preferences.language !== choices!.preferences.language) {
      void setLanguage(preferences.language);
    }
  }

  function skip() {
    // Nothing is saved, so drop a language that was only previewed.
    void getSettings().then((s) => setLanguage(s.language));
    setSkipped(true);
    setStep('done');
  }

  async function finish(picked: Choices) {
    setSaving(true);
    setFailed(false);
    try {
      await setSettings(onboardingPatch(picked.layout, picked.flow, picked.preferences));
      setSkipped(false);
      setStep('done');
    } catch {
      setFailed(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="wl">
      <header className="wl-head">
        <img className="wl-logo" src="/icon/128.png" alt="" width={40} height={40} />
        <div>
          <h1>{t('welcome.title')}</h1>
          <p className="wl-sub">{t('welcome.subtitle')}</p>
        </div>
      </header>

      <section className="wl-card pdt-card">
        {step !== 'done' && <Progress current={STEPS.indexOf(step) + 1} total={STEPS.length} />}

        {step === 'layout' && (
          <ChoiceGroup
            title={t('welcome.layout.title')}
            hint={t('welcome.layout.hint')}
            headingRef={headingRef}
            name="layout"
            value={choices.layout}
            options={LAYOUTS}
            onChange={pickLayout}
            optionName={(layout) => t(`layouts.${layout}.name`)}
            optionHint={(layout) => t(`layouts.${layout}.hint`)}
            optionVisual={(layout) => <LayoutPreview layout={layout} />}
          />
        )}

        {step === 'flow' && (
          <ChoiceGroup
            title={t('welcome.flow.title')}
            hint={t('welcome.flow.hint')}
            headingRef={headingRef}
            name="flow"
            value={choices.flow}
            options={STATUS_FLOWS}
            onChange={(flow) => update({ flow })}
            optionName={(flow) => t(`statusFlows.${flow}.name`)}
            optionHint={(flow) => t(`statusFlows.${flow}.hint`)}
            optionVisual={(flow) => <span className="wl-chain">{flowSummary(flow)}</span>}
          />
        )}

        {step === 'prefs' && (
          <PreferenceFields
            headingRef={headingRef}
            value={choices.preferences}
            onChange={pickPreferences}
          />
        )}

        {step === 'done' && (
          <Done
            layout={choices.layout}
            flow={choices.flow}
            preferences={choices.preferences}
            marker={choices.marker}
            skipped={skipped}
            headingRef={headingRef}
          />
        )}

        {failed && (
          <p className="wl-error" role="alert">
            {t('welcome.error')}
          </p>
        )}

        {step !== 'done' && (
          <footer className="wl-actions">
            <button type="button" className="pdt-link" onClick={skip}>
              {t('welcome.skip')}
            </button>
            <div className="wl-actions__nav">
              {step !== 'layout' && (
                <button
                  type="button"
                  className="pdt-btn"
                  onClick={() => setStep(STEPS[STEPS.indexOf(step) - 1]!)}
                >
                  {t('welcome.back')}
                </button>
              )}
              {step !== 'prefs' ? (
                <button
                  type="button"
                  className="pdt-btn pdt-btn-primary"
                  onClick={() => setStep(STEPS[STEPS.indexOf(step) + 1]!)}
                >
                  {t('welcome.next')}
                </button>
              ) : (
                <button
                  type="button"
                  className="pdt-btn pdt-btn-primary"
                  disabled={saving}
                  onClick={() => void finish(choices)}
                >
                  {failed ? t('welcome.retry') : t('welcome.finish')}
                </button>
              )}
            </div>
          </footer>
        )}
      </section>
    </main>
  );
}
