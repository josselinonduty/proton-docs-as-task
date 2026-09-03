import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { getSettings, setSettings } from '../../lib/settings';
import type { Settings } from '../../lib/types';
import type { AddTaskResponse, ContentMessage, StatusResponse } from '../../lib/messaging';

type TabStatus =
  | { state: 'loading' }
  | { state: 'not-docs' }
  | { state: 'inactive' } // Docs open, but no editor / no task marker
  | { state: 'active'; status: StatusResponse };

type SaveFeedback = { kind: 'idle' | 'saving' | 'saved' | 'error' | 'conflict'; message?: string };

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
  const [settings, setLocalSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<TabStatus>({ state: 'loading' });
  const [tabId, setTabId] = useState<number | undefined>();
  const [qaTitle, setQaTitle] = useState('');
  const [qaSection, setQaSection] = useState('');
  const [qaDue, setQaDue] = useState('');
  const [feedback, setFeedback] = useState<SaveFeedback>({ kind: 'idle' });

  useEffect(() => {
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
    if (tab.status.conflict) {
      setFeedback({
        kind: 'conflict',
        message: 'The document changed — open the board to resolve it first.',
      });
      return;
    }
    setFeedback({ kind: 'saving' });
    const res = await sendAddTask(tabId, {
      type: 'add-task',
      title,
      section: qaSection || undefined,
      due: qaDue || undefined,
    });
    if (res?.added) {
      setFeedback({ kind: 'saved', message: `Added to ${res.section}.` });
      setQaTitle('');
      setQaDue('');
      // Refresh counts.
      const status = await sendToTab(tabId, { type: 'get-status' });
      if (status && status.activated) setTab({ state: 'active', status });
    } else if (res?.blocked === 'conflict') {
      setFeedback({
        kind: 'conflict',
        message: 'The document changed — open the board to resolve it first.',
      });
    } else {
      setFeedback({ kind: 'error', message: 'Could not save the task. Try opening the board.' });
    }
  }

  if (!settings) {
    return <div className="pp-loading">Loading…</div>;
  }

  return (
    <div className="pp">
      <header className="pp-head">
        <span className="pp-logo" aria-hidden="true">
          ✓
        </span>
        <div>
          <h1 className="pp-title">Proton Docs as Task</h1>
          <p className="pp-sub">Checklist docs, rendered as a board</p>
        </div>
      </header>

      <label className="pdt-switch-row pp-toggle">
        <span>Enabled</span>
        <input type="checkbox" checked={settings.enabled} onChange={toggleEnabled} />
        <span className="pdt-switch" aria-hidden="true" />
      </label>

      <div className="pp-status">
        {tab.state === 'loading' && <p className="pdt-text-weak">Checking this tab…</p>}
        {tab.state === 'not-docs' && (
          <p className="pdt-text-weak">
            Open a document on <strong>docs.proton.me</strong> to use the board.
          </p>
        )}
        {tab.state === 'inactive' && (
          <p className="pdt-text-weak">
            This document isn't a task board yet. Make its first line{' '}
            <code>{settings.markers[0]}</code> to activate it.
          </p>
        )}
        {tab.state === 'active' && (
          <div>
            <p className="pp-active">
              <strong>{tab.status.boardTitle || 'Task board'}</strong> is active —{' '}
              {tab.status.doneCount}/{tab.status.taskCount} done.
            </p>

            <form className="pp-quickadd" onSubmit={submitQuickAdd}>
              <label className="pdt-field">
                <span className="pdt-field-label">New task</span>
                <input
                  className="pdt-input"
                  value={qaTitle}
                  placeholder="Task title…"
                  aria-label="Task title"
                  onChange={(e) => {
                    setQaTitle(e.target.value);
                    if (feedback.kind !== 'idle') setFeedback({ kind: 'idle' });
                  }}
                  autoFocus
                />
              </label>
              <div className="pp-quickadd__row">
                <label className="pdt-field pp-quickadd__grow">
                  <span className="pdt-field-label">Section</span>
                  <select
                    className="pdt-input"
                    value={qaSection}
                    aria-label="Section"
                    onChange={(e) => setQaSection(e.target.value)}
                  >
                    <option value="">First section</option>
                    {(tab.status.sections ?? []).map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="pdt-field">
                  <span className="pdt-field-label">Due</span>
                  <input
                    type="date"
                    className="pdt-input"
                    value={qaDue}
                    aria-label="Due date"
                    onChange={(e) => setQaDue(e.target.value)}
                  />
                </label>
              </div>
              <button
                type="submit"
                className="pdt-btn pdt-btn-primary pp-btn"
                disabled={!qaTitle.trim() || feedback.kind === 'saving'}
              >
                {feedback.kind === 'saving' ? 'Adding…' : 'Add task'}
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
              {tab.status.visible ? 'Hide board' : 'Open board'}
            </button>
          </div>
        )}
      </div>

      <footer className="pp-foot">
        <button className="pdt-link" onClick={() => browser.runtime.openOptionsPage()}>
          Settings &amp; syntax guide
        </button>
      </footer>
    </div>
  );
}
