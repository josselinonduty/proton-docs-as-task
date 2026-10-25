/**
 * Extension message contract: popup → content script (a tab message) and
 * content script → background.
 *
 * A tab message reaches every frame of the tab (the content script runs with
 * `allFrames`), and the first frame to answer wins. Only the frame that hosts
 * the editor registers the popup handlers (`usePopupCommands`), and a frame
 * with no handler for a type stays silent, so the answer always comes from the
 * editor frame.
 */

import { defineExtensionMessaging } from '@webext-core/messaging';

export interface StatusResponse {
  ok: true;
  activated: boolean;
  visible: boolean;
  taskCount: number;
  doneCount: number;
  boardTitle?: string;
  /** Existing section names, for popup quick-add suggestions. */
  sections?: string[];
}

/** Popup quick-add: a task to write into the active document. */
export interface QuickAddTask {
  title: string;
  section?: string;
  due?: string;
}

export interface AddTaskResponse {
  ok: true;
  /** True only once the task is in the document. */
  added: boolean;
  /** The section the task landed in. */
  section?: string;
  /**
   * A machine-readable failure reason when `added` is false. `read-only`
   * means Proton has editing locked (loading, offline, or view-only access).
   */
  error?: 'empty' | 'not-a-board' | 'read-only' | 'write-failed';
}

export interface ProtocolMap {
  // Popup → editor frame.
  'get-status'(): StatusResponse;
  'toggle-board'(): StatusResponse;
  'set-board-visible'(visible: boolean): StatusResponse;
  'add-task'(task: QuickAddTask): AddTaskResponse;
  // Board → background: `openOptionsPage` isn't available in content scripts.
  // Resolves true once the options page is open.
  'open-options'(): boolean;
}

/** The messages the popup sends to the editor frame. */
export type PopupCommand = 'get-status' | 'toggle-board' | 'set-board-visible' | 'add-task';

export const { sendMessage, onMessage } = defineExtensionMessaging<ProtocolMap>();
