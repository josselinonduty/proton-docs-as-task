import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { parseDocument } from '../lib/parser';
import { watchEditor } from '../lib/extractor';
import { writePreservingFocus } from '../lib/docwriter';
import {
  addTask as addTaskToModel,
  createStarterModel,
  fromParseResult,
  serializeModel,
  countTasks,
  updateTask as updateTaskInModel,
  type BoardModel,
} from '../lib/model';
import { canonicalDoc, canonicalModel } from '../lib/sync';
import { EMPTY_FILTERS, type FilterState } from '../lib/filters';
import { MANUAL_SORT, type SortState } from '../lib/sorting';
import { DEFAULT_SESSION, documentKey, toggleInList, type SessionPrefs } from '../lib/session';
import { readDocPrefs, writeDocPrefs } from '../lib/sessionStore';
import { settingsItem, setSettings as persistSettings, withDefaults } from '../lib/settings';
import type { BoardView, SaveState, Settings } from '../lib/types';
import type { AddTaskResponse, ContentMessage, StatusResponse } from '../lib/messaging';
import { EditableBoard } from './EditableBoard';
import { Icon } from './Icon';

interface OverlayAppProps {
  root: HTMLElement;
  host: HTMLElement;
  initialSettings: Settings;
}

const WRITE_DEBOUNCE_MS = 400;
const UNDO_TIMEOUT_MS = 9000;

interface UndoEntry {
  model: BoardModel;
  label: string;
}

export function OverlayApp({ root, host, initialSettings }: OverlayAppProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [text, setText] = useState('');
  const [visible, setVisible] = useState(false);
  const [model, setModel] = useState<BoardModel | null>(null);
  const [view, setView] = useState<BoardView>(initialSettings.defaultView);
  const [filters, setFilters] = useState<FilterState>({ ...EMPTY_FILTERS });
  const [sort, setSort] = useState<SortState>(MANUAL_SORT);
  const [collapsedColumns, setCollapsedColumns] = useState<string[]>([]);
  const [collapsedRows, setCollapsedRows] = useState<string[]>([]);
  const [lastQuickAddSection, setLastQuickAddSection] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [undo, setUndo] = useState<UndoEntry | null>(null);
  const undoRef = useRef<UndoEntry | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const wasActivated = useRef(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const modelRef = useRef<BoardModel | null>(null);
  const expectedCanonical = useRef<string | null>(null);
  // The canonical the editor held just before the latest write. Its (delayed)
  // MutationObserver echo would otherwise briefly look like an external change.
  const prevExpected = useRef<string | null>(null);
  const suppressConflict = useRef<string | null>(null);
  const pendingWrite = useRef<BoardModel | null>(null);

  modelRef.current = model;
  undoRef.current = undo;

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

  // Apply the chosen theme to the shadow host.
  useEffect(() => {
    if (settings.theme === 'system') host.removeAttribute('data-theme');
    else host.setAttribute('data-theme', settings.theme);
  }, [host, settings.theme]);

  // Per-document session preferences (view, sort, filters, collapsed sets).
  const docKey = useMemo(
    () => (typeof window !== 'undefined' ? documentKey(window.location.href) : null),
    [],
  );
  const sessionReady = useRef(false);

  const seedCollapsed = useCallback(
    () =>
      settings.completedDisplay === 'collapse' || settings.collapseDoneByDefault ? ['done'] : [],
    [settings.completedDisplay, settings.collapseDoneByDefault],
  );

  // Load stored preferences once (per document key, else start from defaults).
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const prefs = docKey ? await readDocPrefs(docKey) : DEFAULT_SESSION;
      if (cancelled) return;
      if (prefs.view) setView(prefs.view);
      setSort(prefs.sort);
      setFilters(prefs.filters);
      setCollapsedColumns(prefs.collapsedColumns.length ? prefs.collapsedColumns : seedCollapsed());
      setCollapsedRows(prefs.collapsedRows);
      setLastQuickAddSection(prefs.lastQuickAddSection);
      sessionReady.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docKey]);

  // Persist preferences whenever they change (session storage only).
  useEffect(() => {
    if (!sessionReady.current || !docKey) return;
    const prefs: SessionPrefs = {
      view,
      sort,
      filters,
      collapsedColumns,
      collapsedRows,
      lastQuickAddSection,
    };
    void writeDocPrefs(docKey, prefs);
  }, [docKey, view, sort, filters, collapsedColumns, collapsedRows, lastQuickAddSection]);

  const result = useMemo(() => parseDocument(text, settings.markers), [text, settings.markers]);

  const marker = result.matchedMarker ?? settings.markers[0] ?? '#!tasks';
  const markerRef = useRef(marker);
  markerRef.current = marker;

  const announce = useCallback((message: string) => setAnnouncement(message), []);

  // Perform an actual write, honoring the "don't rewrite if unchanged" rule.
  const doWrite = useCallback(
    (next: BoardModel) => {
      const m = markerRef.current;
      const canonical = canonicalModel(next, m);
      if (canonical === expectedCanonical.current) {
        pendingWrite.current = null;
        setSaveState('saved');
        return;
      }
      const ok = writePreservingFocus(root, serializeModel(next, m));
      if (ok) {
        prevExpected.current = expectedCanonical.current;
        expectedCanonical.current = canonical;
        suppressConflict.current = null;
        pendingWrite.current = null;
        setSaveState('saved');
      } else {
        pendingWrite.current = next;
        setSaveState('error');
      }
    },
    [root],
  );

  const scheduleWrite = useCallback(
    (next: BoardModel) => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
      setSaveState('saving');
      writeTimer.current = setTimeout(() => doWrite(next), WRITE_DEBOUNCE_MS);
    },
    [doWrite],
  );

  const flushWrite = useCallback(
    (next: BoardModel) => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
      doWrite(next);
    },
    [doWrite],
  );

  const handleModelChange = useCallback(
    (next: BoardModel, undoLabel?: string) => {
      if (undoLabel && modelRef.current) setUndo({ model: modelRef.current, label: undoLabel });
      setModel(next);
      modelRef.current = next;
      scheduleWrite(next);
    },
    [scheduleWrite],
  );

  const handleUndo = useCallback(() => {
    const entry = undoRef.current;
    if (!entry) return;
    setModel(entry.model);
    modelRef.current = entry.model;
    scheduleWrite(entry.model);
    setUndo(null);
    announce('Change undone');
  }, [scheduleWrite, announce]);

  // Auto-dismiss the undo toast.
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), UNDO_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [undo]);

  const handleViewChange = useCallback((next: BoardView) => {
    setView(next);
    void persistSettings({ defaultView: next });
  }, []);

  const handleSettingsChange = useCallback((patch: Partial<Settings>) => {
    void persistSettings(patch);
  }, []);

  const toggleColumnCollapse = useCallback(
    (key: string) => setCollapsedColumns((l) => toggleInList(l, key)),
    [],
  );
  const toggleRowCollapse = useCallback(
    (key: string) => setCollapsedRows((l) => toggleInList(l, key)),
    [],
  );
  // Content scripts can't call `openOptionsPage` directly, so hand it off to
  // the background script.
  const openSettingsPage = useCallback(
    () => void browser.runtime.sendMessage({ type: 'open-options' }),
    [],
  );

  const openBoard = useCallback(() => {
    const next = fromParseResult(parseDocument(text, settings.markers));
    setModel((current) => current ?? next);
    modelRef.current = modelRef.current ?? next;
    expectedCanonical.current = canonicalDoc(text, settings.markers);
    suppressConflict.current = null;
    setSaveState('saved');
    setVisible(true);
  }, [text, settings.markers]);

  const closeBoard = useCallback(() => {
    if (modelRef.current) flushWrite(modelRef.current);
    setVisible(false);
    setModel(null);
    modelRef.current = null;
    setUndo(null);
  }, [flushWrite]);

  const convertToTaskDoc = useCallback(() => {
    const starter = createStarterModel();
    setModel(starter);
    modelRef.current = starter;
    expectedCanonical.current = null; // force the first write
    setVisible(true);
    flushWrite(starter);
  }, [flushWrite]);

  // --- Conflict handling ---------------------------------------------------
  const reloadFromDoc = useCallback(() => {
    const next = fromParseResult(parseDocument(text, settings.markers));
    setModel(next);
    modelRef.current = next;
    expectedCanonical.current = canonicalDoc(text, settings.markers);
    suppressConflict.current = null;
    setSaveState('saved');
    announce('Board reloaded from the document');
  }, [text, settings.markers, announce]);

  const overwriteDoc = useCallback(() => {
    if (modelRef.current) {
      expectedCanonical.current = null; // force overwrite
      flushWrite(modelRef.current);
    }
    announce('Document overwritten with the board version');
  }, [flushWrite, announce]);

  const dismissConflict = useCallback(() => {
    suppressConflict.current = canonicalDoc(text, settings.markers);
    setSaveState('saved');
  }, [text, settings.markers]);

  const retryWrite = useCallback(() => {
    const next = pendingWrite.current ?? modelRef.current;
    if (next) {
      setSaveState('saving');
      doWrite(next);
    }
  }, [doWrite]);

  // Detect external document changes while the board is open.
  useEffect(() => {
    if (!visible || !model) return;
    if (saveState === 'saving' || saveState === 'error') return;
    if (expectedCanonical.current == null) return;
    const canonical = canonicalDoc(text, settings.markers);
    if (canonical === expectedCanonical.current) {
      if (saveState === 'conflict') setSaveState('saved');
      return;
    }
    // The editor's MutationObserver echo lags our write by a beat; while it
    // still reports the pre-write content, that is not an external change.
    if (canonical === prevExpected.current) return;
    if (canonical === suppressConflict.current) return;
    setSaveState('conflict');
  }, [text, visible, model, saveState, settings.markers]);

  // Auto-show the board the first time a document becomes a task board.
  useEffect(() => {
    if (result.activated && !wasActivated.current && settings.autoShow) {
      openBoard();
    }
    if (!result.activated && !modelRef.current) setVisible(false);
    wasActivated.current = result.activated;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.activated, settings.autoShow]);

  // Flush any pending write on unmount.
  useEffect(() => {
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, []);

  // Popup quick-add: write a task into the active document, whether or not the
  // board is open. Returns success only once the write is actually dispatched.
  const addTaskFromPopup = useCallback(
    (title: string, section?: string, due?: string): AddTaskResponse => {
      const clean = title.trim();
      if (!clean) return { ok: true, added: false, error: 'empty' };

      const parsed = parseDocument(text, settings.markers);
      const boardOpen = visible && modelRef.current != null;
      if (!parsed.activated && !boardOpen) {
        return { ok: true, added: false, error: 'not-a-board' };
      }
      // A conflict on the open board must be resolved on the board itself.
      if (boardOpen && saveState === 'conflict') {
        return { ok: true, added: false, blocked: 'conflict' };
      }

      const base = boardOpen ? modelRef.current! : fromParseResult(parsed);
      const targetSection =
        section && base.sections.includes(section) ? section : (base.sections[0] ?? 'Tasks');
      const { model: withTask, taskId } = addTaskToModel(base, targetSection, {
        status: 'todo',
        title: clean,
        atTop: settings.newCardsAtTop,
      });
      const next = due?.trim()
        ? updateTaskInModel(withTask, taskId, { due: due.trim() })
        : withTask;

      const m = markerRef.current;
      const ok = writePreservingFocus(root, serializeModel(next, m));
      if (!ok) return { ok: true, added: false, error: 'write-failed' };

      prevExpected.current = expectedCanonical.current;
      expectedCanonical.current = canonicalModel(next, m);
      suppressConflict.current = null;
      setSaveState('saved');
      if (boardOpen) {
        setModel(next);
        modelRef.current = next;
      }
      return { ok: true, added: true, section: targetSection };
    },
    [text, settings.markers, settings.newCardsAtTop, visible, saveState, root],
  );

  // Respond to popup commands. Only this (editor) frame registers a listener.
  useEffect(() => {
    const counts = model ? countTasks(model) : { total: result.tasks.length, done: 0 };
    const doneCount = model ? counts.done : result.tasks.filter((t) => t.status === 'done').length;
    const status = (): StatusResponse => ({
      ok: true,
      activated: result.activated,
      visible,
      taskCount: counts.total,
      doneCount,
      boardTitle: model?.title ?? result.boardTitle,
      sections: model ? model.sections : result.sections,
      conflict: visible && saveState === 'conflict',
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
  }, [result, visible, model, saveState, openBoard, closeBoard, addTaskFromPopup]);

  if (!settings.enabled) return null;

  // Editable board takes over the screen while open.
  if (visible && model) {
    return (
      <>
        <LiveRegion message={announcement} />
        <EditableBoard
          model={model}
          view={view}
          filters={filters}
          sort={sort}
          settings={settings}
          marker={marker}
          saveState={saveState}
          undoLabel={undo?.label ?? null}
          collapsedColumns={collapsedColumns}
          collapsedRows={collapsedRows}
          lastQuickAddSection={lastQuickAddSection}
          announce={announce}
          onChange={handleModelChange}
          onViewChange={handleViewChange}
          onFiltersChange={setFilters}
          onSortChange={setSort}
          onSettingsChange={handleSettingsChange}
          onToggleColumnCollapse={toggleColumnCollapse}
          onToggleRowCollapse={toggleRowCollapse}
          onQuickAddSectionChange={setLastQuickAddSection}
          onUndo={handleUndo}
          onRetry={retryWrite}
          onReloadFromDoc={reloadFromDoc}
          onOverwriteDoc={overwriteDoc}
          onDismissConflict={dismissConflict}
          onOpenSettings={openSettingsPage}
          onClose={closeBoard}
        />
      </>
    );
  }

  // Activated document, board closed → floating button to reopen it.
  if (result.activated) {
    const pending = result.tasks.filter((t) => t.status !== 'done').length;
    return (
      <button
        className="pdt-btn pdt-btn-primary pdt-btn-pill pdt-fab"
        onClick={openBoard}
        title="Open task board"
      >
        <Icon name="checkmark-circle" size={18} />
        <span>Tasks</span>
        {pending > 0 && <span className="pdt-fab__badge">{pending}</span>}
      </button>
    );
  }

  // Empty document → offer to convert it into a task board.
  if (text.trim() === '') {
    return (
      <div className="pdt-convert" role="region" aria-label="Convert to task board">
        <button
          type="button"
          className="pdt-btn pdt-btn-primary pdt-btn-pill pdt-convert__btn"
          onClick={convertToTaskDoc}
        >
          <span className="pdt-convert__icon" aria-hidden="true">
            <Icon name="checkmark" size={14} />
          </span>
          Convert to task board
        </button>
        <p className="pdt-convert__hint">
          Turn this empty document into an interactive task board.
        </p>
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
