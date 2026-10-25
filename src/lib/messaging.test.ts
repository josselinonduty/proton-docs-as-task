/**
 * A tab message reaches every frame of the tab, and the first frame to answer
 * wins. These tests run the real `@webext-core/messaging` against a fake
 * `chrome` with two frames, to pin the behaviour the popup relies on: a frame
 * that registered no handler (the Docs shell) stays silent, so the answer comes
 * from the editor frame.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { defineExtensionMessaging } from '@webext-core/messaging';
import type { ProtocolMap, StatusResponse } from './messaging';

type RootListener = (
  message: unknown,
  sender: object,
  sendResponse: (r: unknown) => void,
) => unknown;

/** Frames of one tab, each with its own `runtime.onMessage` listeners. */
function fakeTab(frameCount: number) {
  const frames: RootListener[][] = Array.from({ length: frameCount }, () => []);
  let current = 0;

  // Deliver like Chrome: every frame's listeners get the message, the first
  // `sendResponse` settles it, and with nobody answering the callback gets
  // `undefined` (and `lastError` is set).
  const deliver = (message: unknown, respond: (response: unknown) => void) => {
    let settled = false;
    let pending = 0;
    const answer = (response: unknown) => {
      if (settled) return;
      settled = true;
      respond(response);
    };
    for (const listeners of frames) {
      for (const listener of listeners) {
        if (listener(message, {}, answer) === true) pending++;
      }
    }
    if (pending === 0) answer(undefined);
  };

  vi.stubGlobal('chrome', {
    runtime: {
      onMessage: {
        addListener: (fn: RootListener) => frames[current]!.push(fn),
        removeListener: (fn: RootListener) => {
          frames[current]!.splice(frames[current]!.indexOf(fn), 1);
        },
      },
    },
    tabs: {
      sendMessage: (
        _tabId: number,
        message: unknown,
        _options: unknown,
        cb: (r: unknown) => void,
      ) => deliver(message, cb),
    },
  });

  /** A messenger as the content script in frame `index` would define it. */
  const inFrame = (index: number) => {
    current = index;
    const messenger = defineExtensionMessaging<ProtocolMap>();
    return {
      ...messenger,
      onMessage: ((type, fn) => {
        current = index;
        return messenger.onMessage(type, fn);
      }) as typeof messenger.onMessage,
    };
  };

  return { inFrame };
}

const STATUS: StatusResponse = {
  ok: true,
  activated: true,
  visible: false,
  taskCount: 2,
  doneCount: 1,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('tab messages across frames', () => {
  it('gets the editor frame’s answer, not the shell’s', async () => {
    const tab = fakeTab(2);
    // The shell frame (0) loads the content script but never registers handlers.
    tab.inFrame(0);
    const editor = tab.inFrame(1);
    editor.onMessage('get-status', () => STATUS);

    const popup = tab.inFrame(0);
    await expect(popup.sendMessage('get-status', undefined, 7)).resolves.toEqual(STATUS);
  });

  it('stays silent in a frame without a handler for the type', async () => {
    const tab = fakeTab(2);
    tab.inFrame(0).onMessage('open-options', () => true);
    tab.inFrame(1).onMessage('get-status', () => STATUS);

    const popup = tab.inFrame(0);
    await expect(popup.sendMessage('get-status', undefined, 7)).resolves.toEqual(STATUS);
  });

  it('rejects when no frame answers, which the popup reads as "no board here"', async () => {
    const tab = fakeTab(1);
    const popup = tab.inFrame(0);
    await expect(popup.sendMessage('get-status', undefined, 7)).rejects.toThrow();
  });
});
