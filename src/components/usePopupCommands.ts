import { useEffect, useEffectEvent } from 'react';
import type { GetDataType, GetReturnType } from '@webext-core/messaging';
import { onMessage, type PopupCommand, type ProtocolMap } from '@/lib/messaging';

export type PopupHandlers = {
  [K in PopupCommand]: (data: GetDataType<ProtocolMap[K]>) => GetReturnType<ProtocolMap[K]>;
};

/**
 * Answer popup commands with `handlers`, which see the latest render's state.
 * The listeners are registered once. Only the editor frame calls this, and
 * frames without a listener stay silent, so the popup gets this frame's
 * answer (see `lib/messaging.ts`).
 */
export function usePopupCommands(handlers: PopupHandlers) {
  const latest = useEffectEvent(() => handlers);

  useEffect(() => {
    const removers = [
      onMessage('get-status', ({ data }) => latest()['get-status'](data)),
      onMessage('toggle-board', ({ data }) => latest()['toggle-board'](data)),
      onMessage('set-board-visible', ({ data }) => latest()['set-board-visible'](data)),
      onMessage('add-task', ({ data }) => latest()['add-task'](data)),
    ];
    return () => removers.forEach((remove) => remove());
  }, []);
}
