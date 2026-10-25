import { useEffect, useEffectEvent } from 'react';
import { browser } from 'wxt/browser';
import type { AddTaskResponse, ContentMessage, StatusResponse } from '../lib/messaging';

/**
 * Answer popup commands with `handle`, which sees the latest render's state.
 * The listener is registered once; only the editor frame calls this, so a
 * response identifies the meaningful frame. `handle` returns undefined for a
 * message that isn't ours, leaving it to other listeners.
 */
export function usePopupCommands(
  handle: (message: ContentMessage) => StatusResponse | AddTaskResponse | undefined,
) {
  const onMessage = useEffectEvent(handle);

  useEffect(() => {
    const listener = (
      message: ContentMessage,
    ): Promise<StatusResponse | AddTaskResponse> | undefined => {
      const response = onMessage(message);
      return response && Promise.resolve(response);
    };
    browser.runtime.onMessage.addListener(listener);
    return () => browser.runtime.onMessage.removeListener(listener);
  }, []);
}
