import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { browser } from 'wxt/browser';
import { t } from '../i18n';
import { parseDocument } from '../lib/parser';
import { defaultStatus, isDoneStatus } from '../lib/statuses';
import type { EditorClient } from '../lib/editorClient';
import type { EditorStateMessage } from '../lib/bridgeProtocol';
import {
  addTask as addTaskToModel,
  createStarterModel,
  fromParseResult,
  serializeModel,
  countTasks,
  updateTask as updateTaskInModel,
  type BoardModel,
} from '../lib/model';
import { canonicalDoc, canonicalModel, hasRedundantStatus, reconcileIds } from '../lib/sync';
import { toggleInList } from '../lib/session';
import { withDefaults } from '../lib/defaults';
import { settingsItem, setSettings as persistSettings } from '../lib/settings';
import type { BoardView, SaveState, Settings } from '../lib/types';
import type { AddTaskResponse, ContentMessage, StatusResponse } from '../lib/messaging';
import { EditableBoard } from './EditableBoard';
import { Icon } from './Icon';
import { announceBoard } from '../lib/branding';
import { useSessionPrefs } from './useSessionPrefs';

interface OverlayAppProps {
  client: EditorClient;
  initialState: EditorStateMessage;
  host: HTMLElement;
  initialSettings: Settings;
}

/** Coalesces keystroke-level edits (e.g. typing a title) into one write. */
const WRITE_DEBOUNCE_MS = 300;
const UNDO_TIMEOUT_MS = 9000;

interface UndoEntry {
  model: BoardModel;
  label: string;
}

/**
 * Hosts the board and keeps it in sync with the Proton document.
 *
 * The document is the single source of truth and the board follows it live:
 * - A board edit is written through the editor bridge as one tagged Lexical
 *   update, merged with anything that changed in the document since the board
 *   last read it — so Proton's own Yjs sync and saving carry it, and nothing
 *   written elsewhere is overwritten.
 * - A change made anywhere else (another device, a collaborator, typing or
 *   undo in Proton) is folded into the open board immediately, unless a board
 *   edit is still pending — then the merge at write time takes care of it.
 * - While Proton has editing locked, edits stay pending and are written as
 *   soon as it unlocks.
 */
export function OverlayApp({ client, initialState, host, initialSettings }: OverlayAppProps) {
  // Re-render on language changes; strings come from the shared `t`, which callbacks can use without deps.
  const { i18n } = useTranslation();
  const [settings, setSettings] = useState(initialSettings);
  const [docState, setDocState] = useState(initialState);
  const [visible, setVisible] = useState(false);
  const [model, setModel] = useState<BoardModel | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [undo, setUndo] = useState<UndoEntry | null>(null);
  const undoRef = useRef<UndoEntry | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const text = docState.text;
  const wasActivated = useRef(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const modelRef = useRef<BoardModel | null>(null);
  /** The latest document lines, updated synchronously by the bridge. */
  const docLines = useRef<string[]>(initialState.text.split('\n'));
  /** The document lines the board's model reflects — the merge base for writes. */
  const baseLines = useRef<string[]>(docLines.current);
  /** A board model not yet written to the document. */
  const pending = useRef<BoardModel | null>(null);

  modelRef.current = model;
  undoRef.current = undo;

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

  // Every Done-category column of the document, when completed tasks start collapsed.
  const prefs = useSessionPrefs(initialSettings.defaultView, () => {
    if (settings.completedDisplay !== 'collapse') return [];
    const { statuses } = parseDocument(docLines.current.join('\n'), settings.markers);
    return statuses.filter((s) => s.category === 'done').map((s) => s.key);
  });
  const { setView, setCollapsedColumns, setCollapsedRows } = prefs;

  const result = useMemo(() => parseDocument(text, settings.markers), [text, settings.markers]);

  const marker = result.matchedMarker ?? settings.markers[0] ?? '#!tasks';
  const markerRef = useRef(marker);
  markerRef.current = marker;
  const markersRef = useRef(settings.markers);
  markersRef.current = settings.markers;

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  const showModel = useCallback((next: BoardModel | null) => {
    modelRef.current = next;
    setModel(next);
  }, []);

  /**
   * Bring the open board in line with `lines` (the current document) — a
   * no-op when they already mean the same board. Returns true if it changed.
   */
  const followDocument = useCallback(
    (lines: string[]) => {
      baseLines.current = lines;
      const current = modelRef.current;
      if (!current) return false;
      const docText = lines.join('\n');
      if (
        canonicalDoc(docText, markersRef.current) === canonicalModel(current, markerRef.current)
      ) {
        return false;
      }
      const parsed = parseDocument(docText, markersRef.current);
      showModel(reconcileIds(current, fromParseResult(parsed)));
      // An undo snapshot would now also revert the change made elsewhere.
      setUndo(null);
      return true;
    },
    [showModel],
  );

  /** Write the pending board model to the document now. */
  const flush = useCallback(() => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = undefined;
    const next = pending.current;
    if (!next) return true;

    const target = serializeModel(next, markerRef.current).split('\n');
    const res = client.apply(baseLines.current, target);
    if (!res.ok) {
      // Keep the edit pending: it is retried when Proton unlocks editing, or
      // from the Retry action.
      setSaveState(res.reason === 'readonly' ? 'paused' : 'error');
      if (res.reason !== 'readonly') console.warn('[proton-docs-as-task] write failed', res);
      return false;
    }
    pending.current = null;
    docLines.current = res.lines;
    setSaveState('saved');
    // The merge may have folded in changes made elsewhere; show them.
    if (modelRef.current === next) {
      if (followDocument(res.lines)) announce(t('overlay.updated'));
    } else {
      baseLines.current = res.lines;
    }
    return true;
  }, [client, followDocument, announce]);

  /** Record a board edit and write it (debounced unless `immediate`). */
  const commit = useCallback(
    (next: BoardModel, immediate = false) => {
      pending.current = next;
      if (writeTimer.current) clearTimeout(writeTimer.current);
      if (immediate) return flush();
      setSaveState('saving');
      writeTimer.current = setTimeout(flush, WRITE_DEBOUNCE_MS);
      return true;
    },
    [flush],
  );

  // Follow the document as the bridge reports changes.
  const seenState = useRef(initialState);
  useEffect(() => {
    const onState = (state: EditorStateMessage) => {
      seenState.current = state;
      const lines = state.text.split('\n');
      docLines.current = lines;
      setDocState(state);
      // Our own write — `flush` already accounted for it.
      if (state.origin === 'self') return;
      if (pending.current) {
        // Editing just unlocked: write what queued up meanwhile.
        if (state.editable && !writeTimer.current) flush();
        return;
      }
      if (followDocument(lines)) announce(t('overlay.updated'));
    };
    const unsubscribe = client.subscribe(onState);
    // Catch up on anything reported before we subscribed (e.g. Proton still
    // loading the document while the overlay mounted).
    if (client.state && client.state !== seenState.current) onState(client.state);
    return unsubscribe;
  }, [client, flush, followDocument, announce]);

  // Don't lose a debounced edit when the tab is backgrounded or closed —
  // mobile browsers may never run the timer again.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!flush()) event.preventDefault();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [flush]);

  const handleModelChange = useCallback(
    (next: BoardModel, undoLabel?: string) => {
      if (undoLabel && modelRef.current) setUndo({ model: modelRef.current, label: undoLabel });
      showModel(next);
      commit(next);
    },
    [commit, showModel],
  );

  const handleUndo = useCallback(() => {
    const entry = undoRef.current;
    if (!entry) return;
    showModel(entry.model);
    commit(entry.model);
    setUndo(null);
    announce(t('overlay.undone'));
  }, [commit, showModel, announce]);

  // Auto-dismiss the undo toast.
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [undo]);

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
    if (!modelRef.current) {
      // An edit still waiting for Proton to unlock is newer than the document.
      const parsed = parseDocument(docLines.current.join('\n'), markersRef.current);
      const next = pending.current ?? fromParseResult(parsed);
      if (!pending.current) baseLines.current = docLines.current;
      showModel(next);
      // Normalize hand-written status tokens into the checkbox right away.
      if (!pending.current && hasRedundantStatus(parsed)) commit(next, true);
    }
    setVisible(true);
  }, [showModel, commit]);

  const closeBoard = useCallback(() => {
    flush();
    setVisible(false);
    showModel(null);
    setUndo(null);
  }, [flush, showModel]);

  const convertToTaskDoc = useCallback(() => {
    const starter = createStarterModel(settings.defaultStatuses);
    baseLines.current = docLines.current;
    showModel(starter);
    setVisible(true);
    commit(starter, true);
  }, [commit, showModel, settings.defaultStatuses]);

  const reloadFromDoc = useCallback(() => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = undefined;
    pending.current = null;
    baseLines.current = docLines.current;
    showModel(fromParseResult(parseDocument(docLines.current.join('\n'), markersRef.current)));
    setUndo(null);
    setSaveState('saved');
    announce(t('overlay.reloaded'));
  }, [showModel, announce]);

  const retryWrite = useCallback(() => {
    if (pending.current) flush();
    else setSaveState('saved');
  }, [flush]);

  // The document stopped being a task board (marker removed elsewhere).
  useEffect(() => {
    if (visible && !result.activated && !pending.current && text.trim() !== '') {
      setVisible(false);
      showModel(null);
    }
  }, [visible, result.activated, text, showModel]);

  // Auto-show the board the first time a document becomes a task board.
  useEffect(() => {
    if (result.activated && !wasActivated.current && settings.autoShow) {
      openBoard();
    }
    if (!result.activated && !modelRef.current) setVisible(false);
    wasActivated.current = result.activated;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.activated, settings.autoShow]);

  // Brand the Docs shell (favicon, header icon) while this is a task board.
  useEffect(() => {
    announceBoard(result.activated);
    return () => announceBoard(false);
  }, [result.activated]);

  // Write any pending edit on unmount.
  useEffect(() => {
    return () => {
      flush();
    };
  }, [flush]);

  // Popup quick-add: write a task into the active document, whether or not the
  // board is open. Reports success only once the task is in the document.
  const addTaskFromPopup = useCallback(
    (title: string, section?: string, due?: string): AddTaskResponse => {
      const clean = title.trim();
      if (!clean) return { ok: true, added: false, error: 'empty' };

      // Settle any pending board edit first so the task lands on top of it.
      flush();
      const parsed = parseDocument(docLines.current.join('\n'), markersRef.current);
      const boardOpen = visible && modelRef.current != null;
      if (!parsed.activated && !boardOpen) {
        return { ok: true, added: false, error: 'not-a-board' };
      }

      const base = boardOpen ? modelRef.current! : fromParseResult(parsed);
      const targetSection =
        section && base.sections.includes(section) ? section : (base.sections[0] ?? 'Tasks');
      const { model: withTask, taskId } = addTaskToModel(base, targetSection, {
        status: defaultStatus(base.statuses, false),
        title: clean,
        atTop: settings.newCardsAtTop,
      });
      const next = due?.trim()
        ? updateTaskInModel(withTask, taskId, { due: due.trim() })
        : withTask;

      if (boardOpen) {
        showModel(next);
        if (commit(next, true)) return { ok: true, added: true, section: targetSection };
        // The board keeps the task pending and writes it once Proton allows.
        const error = client.state?.editable === false ? 'read-only' : 'write-failed';
        return { ok: true, added: false, error };
      }

      const res = client.apply(
        docLines.current,
        serializeModel(next, markerRef.current).split('\n'),
      );
      if (!res.ok) {
        const error = res.reason === 'readonly' ? 'read-only' : 'write-failed';
        return { ok: true, added: false, error };
      }
      docLines.current = res.lines;
      return { ok: true, added: true, section: targetSection };
    },
    [visible, settings.newCardsAtTop, flush, commit, showModel, client],
  );

  // Respond to popup commands. Only this (editor) frame registers a listener.
  useEffect(() => {
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

    const handler = (
      message: ContentMessage,
    ): Promise<StatusResponse | AddTaskResponse> | undefined => {
      switch (message?.type) {
        case 'get-status':
          return Promise.resolve(status());
        case 'toggle-board':
          if (visible) closeBoard();
          else openBoard();
          return Promise.resolve({ ...status(), visible: !visible });
        case 'set-board-visible':
          if (message.visible) openBoard();
          else closeBoard();
          return Promise.resolve({ ...status(), visible: message.visible });
        case 'add-task':
          return Promise.resolve(addTaskFromPopup(message.title, message.section, message.due));
        default:
          return undefined;
      }
    };

    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, [result, visible, model, openBoard, closeBoard, addTaskFromPopup]);

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
          onChange={handleModelChange}
          onViewChange={handleViewChange}
          onFiltersChange={prefs.setFilters}
          onSortChange={prefs.setSort}
          onSettingsChange={handleSettingsChange}
          onToggleColumnCollapse={toggleColumnCollapse}
          onToggleRowCollapse={toggleRowCollapse}
          onQuickAddSectionChange={prefs.setLastQuickAddSection}
          onUndo={handleUndo}
          onRetry={retryWrite}
          onReloadFromDoc={reloadFromDoc}
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
