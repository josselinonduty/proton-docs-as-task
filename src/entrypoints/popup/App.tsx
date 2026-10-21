import { useEffect, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { getSettings, setSettings, syncLanguage } from '../../lib/settings';
import type { Settings } from '../../lib/types';
import type { AddTaskResponse, ContentMessage, StatusResponse } from '../../lib/messaging';

type TabStatus =
  | { state: 'loading' }
  | { state: 'not-docs' }
  | { state: 'inactive' } // Docs open, but no editor / no task marker
  | { state: 'active'; status: StatusResponse };

type SaveFeedback = { kind: 'idle' | 'saving' | 'saved' | 'error' | 'warning'; message?: string };

async function queryActiveTab(): Promise<{ id?: number; url?: string }> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return { id: tab?.id, url: tab?.url };
}

async function sendToTab(tabId: number, message: ContentMessage): Promise<StatusResponse | null> {
  try {
    const res = (await browser.tabs.sendMessage(tabId, message)) as StatusResponse;
    return res?.ok ? res : null;
  } catch {
    return null; // no content script / editor frame in this tab
  }
}

async function sendAddTask(
  tabId: number,
  message: ContentMessage,
): Promise<AddTaskResponse | null> {
  try {
    const res = (await browser.tabs.sendMessage(tabId, message)) as AddTaskResponse;
    return res?.ok ? res : null;
  } catch {
    return null;
  }
}

export function App() {
  const { t } = useTranslation();
  const [settings, setLocalSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<TabStatus>({ state: 'loading' });
  const [tabId, setTabId] = useState<number | undefined>();
  const [qaTitle, setQaTitle] = useState('');
  const [qaSection, setQaSection] = useState('');
  const [qaDue, setQaDue] = useState('');
  const [feedback, setFeedback] = useState<SaveFeedback>({ kind: 'idle' });

  useEffect(() => {
    const unwatch = syncLanguage();
    void (async () => {
      setLocalSettings(await getSettings());
      const active = await queryActiveTab();
      setTabId(active.id);
      if (!active.url || !/^https:\/\/docs(-editor)?\.proton\.me\//.test(active.url)) {
        setTab({ state: 'not-docs' });
        return;
      }
      if (active.id == null) {
        setTab({ state: 'inactive' });
        return;
      }
      const status = await sendToTab(active.id, { type: 'get-status' });
      setTab(status && status.activated ? { state: 'active', status } : { state: 'inactive' });
    })();
    return () => void unwatch.then((stop) => stop());
  }, []);

  async function toggleEnabled() {
    if (!settings) return;
    const next = await setSettings({ enabled: !settings.enabled });
    setLocalSettings(next);
  }

  async function toggleBoard() {
    if (tabId == null) return;
    const status = await sendToTab(tabId, { type: 'toggle-board' });
    if (status) setTab({ state: 'active', status });
  }

  async function submitQuickAdd(e: React.FormEvent) {
    e.preventDefault();
    if (tabId == null || tab.state !== 'active') return;
    const title = qaTitle.trim();
    if (!title) return;
    setFeedback({ kind: 'saving' });
    const res = await sendAddTask(tabId, {
      type: 'add-task',
      title,
      section: qaSection || undefined,
      due: qaDue || undefined,
    });
    if (res?.added) {
      setFeedback({ kind: 'saved', message: t('popup.added', { section: res.section }) });
      setQaTitle('');
      setQaDue('');
      // Refresh counts.
      const status = await sendToTab(tabId, { type: 'get-status' });
      if (status && status.activated) setTab({ state: 'active', status });
    } else if (res?.error === 'read-only') {
      setFeedback({
        kind: 'warning',
        message: t('popup.readOnly'),
      });
    } else {
      setFeedback({ kind: 'error', message: t('popup.saveFailed') });
    }
  }

  if (!settings) {
    return <div className="pp-loading">{t('common.loading')}</div>;
  }

  return (
    <div className="pp">
      <header className="pp-head">
        <img className="pp-logo" src="/icon/96.png" alt="" width={32} height={32} />
        <div>
          <h1 className="pp-title">Proton Docs as Task</h1>
          <p className="pp-sub">{t('popup.subtitle')}</p>
        </div>
      </header>

      <label className="pdt-switch-row pp-toggle">
        <span>{t('popup.enabled')}</span>
        <input type="checkbox" checked={settings.enabled} onChange={toggleEnabled} />
        <span className="pdt-switch" aria-hidden="true" />
      </label>

      <div className="pp-status">
        {tab.state === 'loading' && <p className="pdt-text-weak">{t('popup.checking')}</p>}
        {tab.state === 'not-docs' && (
          <p className="pdt-text-weak">
            <Trans i18nKey="popup.notDocs" components={{ strong: <strong /> }} />
          </p>
        )}
        {tab.state === 'inactive' && (
          <p className="pdt-text-weak">
            <Trans
              i18nKey="popup.inactive"
              values={{ marker: settings.markers[0] }}
              components={{ strong: <strong />, code: <code /> }}
            />
          </p>
        )}
        {tab.state === 'active' && (
          <div>
            <p className="pp-active">
              <Trans
                i18nKey="popup.active"
                values={{
                  title: tab.status.boardTitle || t('board.defaultTitle'),
                  done: tab.status.doneCount,
                  total: tab.status.taskCount,
                }}
                components={{ strong: <strong /> }}
              />
            </p>

            <form className="pp-quickadd" onSubmit={submitQuickAdd}>
              <label className="pdt-field">
                <span className="pdt-field-label">{t('popup.newTask')}</span>
                <input
                  className="pdt-input"
                  value={qaTitle}
                  placeholder={t('popup.titlePlaceholder')}
                  aria-label={t('details.titlePlaceholder')}
                  onChange={(e) => {
                    setQaTitle(e.target.value);
                    if (feedback.kind !== 'idle') setFeedback({ kind: 'idle' });
                  }}
                  autoFocus
                />
              </label>
              <div className="pp-quickadd__row">
                <label className="pdt-field pp-quickadd__grow">
                  <span className="pdt-field-label">{t('quickAdd.section')}</span>
                  <select
                    className="pdt-input"
                    value={qaSection}
                    aria-label={t('quickAdd.section')}
                    onChange={(e) => setQaSection(e.target.value)}
                  >
                    <option value="">{t('popup.firstSection')}</option>
                    {(tab.status.sections ?? []).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pdt-field">
                  <span className="pdt-field-label">{t('popup.due')}</span>
                  <input
                    type="date"
                    className="pdt-input"
                    value={qaDue}
                    aria-label={t('details.due')}
                    onChange={(e) => setQaDue(e.target.value)}
                  />
                </label>
              </div>
              <button
                type="submit"
                className="pdt-btn pdt-btn-primary pp-btn"
                disabled={!qaTitle.trim() || feedback.kind === 'saving'}
              >
                {feedback.kind === 'saving' ? t('popup.adding') : t('quickAdd.add')}
              </button>
              {feedback.kind !== 'idle' && feedback.kind !== 'saving' && (
                <p
                  className={`pp-feedback pp-feedback--${feedback.kind}`}
                  role="status"
                  aria-live="polite"
                >
                  {feedback.kind === 'saved' ? '✓ ' : '⚠ '}
                  {feedback.message}
                </p>
              )}
            </form>

            <button className="pdt-btn pp-btn pp-btn--ghost" onClick={toggleBoard}>
              {tab.status.visible ? t('popup.hide') : t('overlay.open')}
            </button>
          </div>
        )}
      </div>

      <footer className="pp-foot">
        <button className="pdt-link" onClick={() => browser.runtime.openOptionsPage()}>
          {t('popup.settings')}
        </button>
      </footer>
    </div>
  );
}
