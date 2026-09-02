import { useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { parseDocument } from '../lib/parser';
import { watchEditor } from '../lib/extractor';
import { settingsItem, withDefaults } from '../lib/settings';
import type { Settings } from '../lib/types';
import type { ContentMessage, StatusResponse } from '../lib/messaging';
import { Board } from './Board';

interface OverlayAppProps {
  root: HTMLElement;
  initialSettings: Settings;
}

export function OverlayApp({ root, initialSettings }: OverlayAppProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [text, setText] = useState('');
  const [visible, setVisible] = useState(false);
  const [grouping, setGrouping] = useState(initialSettings.grouping);
  const wasActivated = useRef(false);

  // Track document text via the editor observer.
  useEffect(() => {
    const watcher = watchEditor(root, setText);
    return () => watcher.stop();
  }, [root]);

  // Live-update when settings change (from popup or options page).
  useEffect(() => {
    const unwatch = settingsItem.watch((value) => setSettings(withDefaults(value)));
    return () => unwatch();
  }, []);

  const result = useMemo(
    () => parseDocument(text, settings.markers),
    [text, settings.markers],
  );

  // Auto-show the board the first time a document becomes a task board.
  useEffect(() => {
    if (result.activated && !wasActivated.current) {
      if (settings.autoShow) setVisible(true);
    }
    if (!result.activated) setVisible(false);
    wasActivated.current = result.activated;
  }, [result.activated, settings.autoShow]);

  // Respond to popup commands. Only this (editor) frame registers a listener.
  useEffect(() => {
    const status = (): StatusResponse => ({
      ok: true,
      activated: result.activated,
      visible,
      taskCount: result.tasks.length,
      doneCount: result.tasks.filter((t) => t.status === 'done').length,
      boardTitle: result.boardTitle,
    });

    const handler = (message: ContentMessage): Promise<StatusResponse> | undefined => {
      switch (message?.type) {
        case 'get-status':
          return Promise.resolve(status());
        case 'toggle-board':
          setVisible((v) => !v);
          return Promise.resolve({ ...status(), visible: !visible });
        case 'set-board-visible':
          setVisible(message.visible);
          return Promise.resolve({ ...status(), visible: message.visible });
        default:
          return undefined;
      }
    };

    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, [result, visible]);

  if (!settings.enabled || !result.activated) return null;

  if (!visible) {
    const pending = result.tasks.filter((t) => t.status !== 'done').length;
    return (
      <button
        className="pdt-fab"
        onClick={() => setVisible(true)}
        title="Open task board"
      >
        <span className="pdt-fab__icon" aria-hidden="true">
          ✓
        </span>
        <span className="pdt-fab__label">Tasks</span>
        {pending > 0 && <span className="pdt-fab__badge">{pending}</span>}
      </button>
    );
  }

  return (
    <Board
      result={result}
      settings={settings}
      grouping={grouping}
      onGroupingChange={setGrouping}
      onClose={() => setVisible(false)}
    />
  );
}
