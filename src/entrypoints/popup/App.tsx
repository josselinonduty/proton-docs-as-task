import { useEffect, useState } from 'react';
import { browser } from 'wxt/browser';
import { getSettings, setSettings } from '../../lib/settings';
import type { Settings } from '../../lib/types';
import type { ContentMessage, StatusResponse } from '../../lib/messaging';

type TabStatus =
  | { state: 'loading' }
  | { state: 'not-docs' }
  | { state: 'inactive' } // Docs open, but no editor / no task marker
  | { state: 'active'; status: StatusResponse };

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

export function App() {
  const [settings, setLocalSettings] = useState<Settings | null>(null);
  const [tab, setTab] = useState<TabStatus>({ state: 'loading' });
  const [tabId, setTabId] = useState<number | undefined>();

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
            <button className="pdt-btn pdt-btn-primary pp-btn" onClick={toggleBoard}>
              {tab.status.visible ? 'Hide board' : 'Show board'}
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
