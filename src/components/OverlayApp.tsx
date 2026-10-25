import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { t } from '../i18n';
import { parseDocument } from '../lib/parser';
import { defaultStatus, isDoneStatus } from '../lib/statuses';
import type { EditorClient } from '../lib/editorClient';
import type { EditorStateMessage } from '../lib/bridgeProtocol';
import type { BoardNotice } from '../lib/boardSession';
import {
  addTask as addTaskToModel,
  createStarterModel,
  fromParseResult,
  countTasks,
  updateTask as updateTaskInModel,
} from '../lib/model';
import { toggleInList } from '../lib/session';
import { withDefaults } from '../lib/defaults';
import { settingsItem, setSettings as persistSettings } from '../lib/settings';
import type { BoardView, Settings } from '../lib/types';
import type { AddTaskResponse, ContentMessage, StatusResponse } from '../lib/messaging';
import { EditableBoard } from './EditableBoard';
import { Icon } from './Icon';
import { announceBoard } from '../lib/branding';
import { useBoardSession } from './useBoardSession';
import { usePopupCommands } from './usePopupCommands';
import { useSessionPrefs } from './useSessionPrefs';

interface OverlayAppProps {
  client: EditorClient;
  initialState: EditorStateMessage;
  host: HTMLElement;
  initialSettings: Settings;
}

const NOTICES: Record<BoardNotice, () => string> = {
  updated: () => t('overlay.updated'),
  undone: () => t('overlay.undone'),
  reloaded: () => t('overlay.reloaded'),
};

/**
 * Hosts the board on top of the Proton document: shows it, the button to
 * reopen it, or the offer to turn an empty document into one, and answers the
 * popup. Keeping the board and the document in sync is the board session's
 * job (see `boardSession.ts`).
 */
export function OverlayApp({ client, initialState, host, initialSettings }: OverlayAppProps) {
  // Re-render on language changes; strings come from the shared `t`, which callbacks can use without deps.
  const { i18n } = useTranslation();
  const [settings, setSettings] = useState(initialSettings);
  const [visible, setVisible] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const announce = useCallback((message: string) => setAnnouncement(message), []);

  const [{ docState, model, saveState, undo }, session] = useBoardSession({
    client,
    initialState,
    markers: settings.markers,
    onNotice: (notice) => announce(NOTICES[notice]()),
  });
  const text = docState.text;
  const wasActivated = useRef(false);

  // Every Done-category column of the document, when completed tasks start collapsed.
  const prefs = useSessionPrefs(initialSettings.defaultView, () => {
    if (settings.completedDisplay !== 'collapse') return [];
    const { statuses } = session.readDocument();
    return statuses.filter((s) => s.category === 'done').map((s) => s.key);
  });
  const { setView, setCollapsedColumns, setCollapsedRows } = prefs;

  // Live-update when settings change (from popup or options page).
  useEffect(() => {
    const unwatch = settingsItem.watch((value) => setSettings(withDefaults(value)));
    return () => unwatch();
  }, []);

  // Apply the chosen theme and language to the shadow host.
  useEffect(() => {
    if (settings.theme === 'system') host.removeAttribute('data-theme');
    else host.setAttribute('data-theme', settings.theme);
  }, [host, settings.theme]);
  useEffect(() => {
    host.lang = i18n.language;
  }, [host, i18n.language]);

  const result = useMemo(() => parseDocument(text, settings.markers), [text, settings.markers]);
  const marker = result.matchedMarker ?? settings.markers[0] ?? '#!tasks';

  const handleViewChange = useCallback(
    (next: BoardView) => {
      setView(next);
      void persistSettings({ defaultView: next });
    },
    [setView],
  );

  const handleSettingsChange = useCallback((patch: Partial<Settings>) => {
    void persistSettings(patch);
  }, []);

  const toggleColumnCollapse = useCallback(
    (key: string) => setCollapsedColumns((l) => toggleInList(l, key)),
    [setCollapsedColumns],
  );
  const toggleRowCollapse = useCallback(
    (key: string) => setCollapsedRows((l) => toggleInList(l, key)),
    [setCollapsedRows],
  );
  // Content scripts can't call `openOptionsPage` directly, so hand it off to
  // the background script.
  const openSettingsPage = useCallback(
    () => void browser.runtime.sendMessage({ type: 'open-options' }),
    [],
  );

  const openBoard = useCallback(() => {
    session.open();
    setVisible(true);
  }, [session]);

  const closeBoard = useCallback(() => {
    session.close();
    setVisible(false);
  }, [session]);

  const convertToTaskDoc = useCallback(() => {
    setVisible(true);
    session.convert(createStarterModel(settings.defaultStatuses));
  }, [session, settings.defaultStatuses]);

  // The document stopped being a task board (marker removed elsewhere).
  useEffect(() => {
    if (visible && !result.activated && !session.hasPending() && text.trim() !== '') {
      setVisible(false);
      session.clear();
    }
  }, [visible, result.activated, text, session]);

  // Auto-show the board the first time a document becomes a task board.
  useEffect(() => {
    if (result.activated && !wasActivated.current && settings.autoShow) openBoard();
    if (!result.activated && !session.getSnapshot().model) setVisible(false);
    wasActivated.current = result.activated;
  }, [result.activated, settings.autoShow, openBoard, session]);

  // Brand the Docs shell (favicon, header icon) while this is a task board.
  useEffect(() => {
    announceBoard(result.activated);
    return () => announceBoard(false);
  }, [result.activated]);

  // Popup quick-add: write a task into the active document, whether or not the
  // board is open. Reports success only once the task is in the document.
  const addTaskFromPopup = (title: string, section?: string, due?: string): AddTaskResponse => {
    const clean = title.trim();
    if (!clean) return { ok: true, added: false, error: 'empty' };

    // Settle any pending board edit first so the task lands on top of it.
    session.flush();
    const parsed = session.readDocument();
    const current = session.getSnapshot().model;
    const boardOpen = visible && current != null;
    if (!parsed.activated && !boardOpen) {
      return { ok: true, added: false, error: 'not-a-board' };
    }

    const base = boardOpen ? current : fromParseResult(parsed);
    const targetSection =
      section && base.sections.includes(section) ? section : (base.sections[0] ?? 'Tasks');
    const { model: withTask, taskId } = addTaskToModel(base, targetSection, {
      status: defaultStatus(base.statuses, false),
      title: clean,
      atTop: settings.newCardsAtTop,
    });
    const next = due?.trim() ? updateTaskInModel(withTask, taskId, { due: due.trim() }) : withTask;

    if (boardOpen) {
      if (session.commit(next, true)) return { ok: true, added: true, section: targetSection };
      // The board keeps the task pending and writes it once Proton allows.
      const error = client.state?.editable === false ? 'read-only' : 'write-failed';
      return { ok: true, added: false, error };
    }

    const res = session.write(next);
    if (!res.ok) {
      const error = res.reason === 'readonly' ? 'read-only' : 'write-failed';
      return { ok: true, added: false, error };
    }
    return { ok: true, added: true, section: targetSection };
  };

  // Respond to popup commands. Only this (editor) frame registers a listener.
  usePopupCommands((message: ContentMessage) => {
    const counts = model ? countTasks(model) : { total: result.tasks.length, done: 0 };
    const doneCount = model
      ? counts.done
      : result.tasks.filter((task) => isDoneStatus(result.statuses, task.status)).length;
    const status = (): StatusResponse => ({
      ok: true,
      activated: result.activated,
      visible,
      taskCount: counts.total,
      doneCount,
      boardTitle: model?.title ?? result.boardTitle,
      sections: model ? model.sections : result.sections,
    });

    switch (message?.type) {
      case 'get-status':
        return status();
      case 'toggle-board':
        if (visible) closeBoard();
        else openBoard();
        return { ...status(), visible: !visible };
      case 'set-board-visible':
        if (message.visible) openBoard();
        else closeBoard();
        return { ...status(), visible: message.visible };
      case 'add-task':
        return addTaskFromPopup(message.title, message.section, message.due);
      default:
        return undefined;
    }
  });

  if (!settings.enabled) return null;

  // Editable board takes over the screen while open.
  if (visible && model) {
    return (
      <>
        <LiveRegion message={announcement} />
        <EditableBoard
          model={model}
          view={prefs.view}
          filters={prefs.filters}
          sort={prefs.sort}
          settings={settings}
          marker={marker}
          saveState={saveState}
          undoLabel={undo?.label ?? null}
          collapsedColumns={prefs.collapsedColumns}
          collapsedRows={prefs.collapsedRows}
          lastQuickAddSection={prefs.lastQuickAddSection}
          announce={announce}
          onChange={session.edit}
          onViewChange={handleViewChange}
          onFiltersChange={prefs.setFilters}
          onSortChange={prefs.setSort}
          onSettingsChange={handleSettingsChange}
          onToggleColumnCollapse={toggleColumnCollapse}
          onToggleRowCollapse={toggleRowCollapse}
          onQuickAddSectionChange={prefs.setLastQuickAddSection}
          onUndo={session.undo}
          onRetry={session.retry}
          onReloadFromDoc={session.reload}
          onOpenSettings={openSettingsPage}
          onClose={closeBoard}
        />
      </>
    );
  }

  // Activated document, board closed → floating button to reopen it.
  if (result.activated) {
    const pendingCount = result.tasks.filter(
      (task) => !isDoneStatus(result.statuses, task.status),
    ).length;
    return (
      <button
        className="pdt-btn pdt-fab"
        onClick={openBoard}
        title={t('overlay.openTitle')}
        aria-label={t('overlay.openAria', { count: pendingCount })}
      >
        <Icon name="kanban" size={16} />
        <span>{t('overlay.open')}</span>
        {pendingCount > 0 && (
          <span className="pdt-badge pdt-badge-primary" aria-hidden="true">
            {pendingCount}
          </span>
        )}
      </button>
    );
  }

  // Empty document Proton lets us edit → offer to convert it into a task board.
  if (text.trim() === '' && docState.editable) {
    return (
      <div className="pdt-convert" role="region" aria-label={t('overlay.convert')}>
        <span className="pdt-convert__icon" aria-hidden="true">
          <Icon name="kanban" size={24} />
        </span>
        <p className="pdt-convert__title">{t('overlay.convertTitle')}</p>
        <p className="pdt-convert__hint">{t('overlay.convertHint')}</p>
        <button type="button" className="pdt-btn pdt-btn-primary" onClick={convertToTaskDoc}>
          <Icon name="plus" size={16} />
          <span>{t('overlay.create')}</span>
        </button>
      </div>
    );
  }

  return null;
}

/** Off-screen polite live region for screen-reader announcements. */
function LiveRegion({ message }: { message: string }) {
  return (
    <div className="pdt-sr-only" role="status" aria-live="polite" aria-atomic="true">
      {message}
    </div>
  );
}
