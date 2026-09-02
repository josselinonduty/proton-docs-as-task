import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { browser } from 'wxt/browser';
import { parseDocument } from '../lib/parser';
import { watchEditor } from '../lib/extractor';
import { writePreservingFocus } from '../lib/docwriter';
import {
  createStarterModel,
  fromParseResult,
  serializeModel,
  countTasks,
  type BoardModel,
} from '../lib/model';
import { settingsItem, withDefaults } from '../lib/settings';
import type { Settings } from '../lib/types';
import type { ContentMessage, StatusResponse } from '../lib/messaging';
import { EditableBoard } from './EditableBoard';

interface OverlayAppProps {
  root: HTMLElement;
  initialSettings: Settings;
}

const WRITE_DEBOUNCE_MS = 400;

export function OverlayApp({ root, initialSettings }: OverlayAppProps) {
  const [settings, setSettings] = useState(initialSettings);
  const [text, setText] = useState('');
  const [visible, setVisible] = useState(false);
  const [model, setModel] = useState<BoardModel | null>(null);
  const wasActivated = useRef(false);
  const writeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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

  const result = useMemo(() => parseDocument(text, settings.markers), [text, settings.markers]);

  // Marker to lead the document with when serializing the board back out.
  const marker = result.matchedMarker ?? settings.markers[0] ?? '#!tasks';
  const markerRef = useRef(marker);
  markerRef.current = marker;

  // The board is authoritative while open: push the (debounced) serialized
  // model into the editor. External doc edits are ignored until the board is
  // reopened, at which point it rebuilds from the freshly parsed document.
  const writeDoc = useCallback(
    (next: BoardModel) => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
      writeTimer.current = setTimeout(() => {
        writePreservingFocus(root, serializeModel(next, markerRef.current));
      }, WRITE_DEBOUNCE_MS);
    },
    [root],
  );

  const flushWrite = useCallback(
    (next: BoardModel) => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
      writePreservingFocus(root, serializeModel(next, markerRef.current));
    },
    [root],
  );

  const handleModelChange = useCallback(
    (next: BoardModel) => {
      setModel(next);
      writeDoc(next);
    },
    [writeDoc],
  );

  const openBoard = useCallback(() => {
    setModel((current) => current ?? fromParseResult(parseDocument(text, settings.markers)));
    setVisible(true);
  }, [text, settings.markers]);

  const closeBoard = useCallback(() => {
    setVisible(false);
    setModel((current) => {
      if (current) flushWrite(current);
      return null; // rebuild from the doc on next open
    });
  }, [flushWrite]);

  const convertToTaskDoc = useCallback(() => {
    const starter = createStarterModel();
    setModel(starter);
    setVisible(true);
    flushWrite(starter);
  }, [flushWrite]);

  // Auto-show the board the first time a document becomes a task board.
  useEffect(() => {
    if (result.activated && !wasActivated.current && settings.autoShow) {
      setModel((current) => current ?? fromParseResult(result));
      setVisible(true);
    }
    if (!result.activated && !model) setVisible(false);
    wasActivated.current = result.activated;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result.activated, settings.autoShow]);

  // Flush any pending write on unmount.
  useEffect(() => {
    return () => {
      if (writeTimer.current) clearTimeout(writeTimer.current);
    };
  }, []);

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
    });

    const handler = (message: ContentMessage): Promise<StatusResponse> | undefined => {
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
        default:
          return undefined;
      }
    };

    browser.runtime.onMessage.addListener(handler);
    return () => browser.runtime.onMessage.removeListener(handler);
  }, [result, visible, model, openBoard, closeBoard]);

  if (!settings.enabled) return null;

  // Editable board takes over the screen while open.
  if (visible && model) {
    return <EditableBoard model={model} onChange={handleModelChange} onClose={closeBoard} />;
  }

  // Activated document, board closed → floating button to reopen it.
  if (result.activated) {
    const pending = result.tasks.filter((t) => t.status !== 'done').length;
    return (
      <button className="pdt-fab" onClick={openBoard} title="Open task board">
        <span className="pdt-fab__icon" aria-hidden="true">
          ✓
        </span>
        <span className="pdt-fab__label">Tasks</span>
        {pending > 0 && <span className="pdt-fab__badge">{pending}</span>}
      </button>
    );
  }

  // Empty document → offer to convert it into a task board.
  if (text.trim() === '') {
    return (
      <div className="pdt-convert" role="region" aria-label="Convert to task board">
        <button type="button" className="pdt-convert__btn" onClick={convertToTaskDoc}>
          <span className="pdt-convert__icon" aria-hidden="true">
            ✓
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
