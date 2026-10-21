/**
 * Message contract between the popup and the in-page content script.
 * Only the frame that actually hosts the editor registers a listener, so a
 * response identifies the meaningful frame.
 */

export type ContentMessage =
  | { type: 'get-status' }
  | { type: 'toggle-board' }
  | { type: 'set-board-visible'; visible: boolean }
  /** Popup quick-add: write a task into the active document. */
  | { type: 'add-task'; title: string; section?: string; due?: string };

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

/** The response the content script sends back for a given message. */
export type ResponseTo<M extends ContentMessage> = M extends { type: 'add-task' }
  ? AddTaskResponse
  : StatusResponse;
