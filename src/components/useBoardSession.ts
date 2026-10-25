import { useEffect, useEffectEvent, useState, useSyncExternalStore } from 'react';
import type { EditorStateMessage } from '../lib/bridgeProtocol';
import type { EditorClient } from '../lib/editorClient';
import {
  createBoardSession,
  type BoardNotice,
  type BoardSession,
  type BoardSessionSnapshot,
} from '../lib/boardSession';

interface BoardSessionProps {
  /** Fixed for the component's lifetime, like `initialState`. */
  client: EditorClient;
  initialState: EditorStateMessage;
  markers: string[];
  onNotice: (notice: BoardNotice) => void;
}

/**
 * Keep a {@link BoardSession} for the component's lifetime: follow the
 * document while mounted, write any pending edit when the tab is hidden or
 * the component unmounts, and re-render on every snapshot.
 */
export function useBoardSession({
  client,
  initialState,
  markers,
  onNotice,
}: BoardSessionProps): [BoardSessionSnapshot, BoardSession] {
  const [session] = useState(() => createBoardSession({ client, initialState, markers }));
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const notify = useEffectEvent(onNotice);

  useEffect(() => {
    const offNotice = session.onNotice((notice) => notify(notice));
    session.start();
    return () => {
      session.dispose();
      offNotice();
    };
  }, [session]);

  useEffect(() => session.setMarkers(markers), [session, markers]);

  // Don't lose a debounced edit when the tab is backgrounded or closed —
  // mobile browsers may never run the timer again.
  useEffect(() => {
    const flush = () => void session.flush();
    const onHide = () => {
      if (document.visibilityState === 'hidden') flush();
    };
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!session.flush()) event.preventDefault();
    };
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flush);
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flush);
      window.removeEventListener('beforeunload', onBeforeUnload);
    };
  }, [session]);

  return [snapshot, session];
}
