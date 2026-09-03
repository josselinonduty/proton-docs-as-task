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
  /** True when the open board is in an unresolved conflict state. */
  conflict?: boolean;
}

export interface AddTaskResponse {
  ok: true;
  /** True only once the content script has confirmed the document write. */
  added: boolean;
  /** The section the task landed in. */
  section?: string;
  /** Set when the write was refused because the board has a conflict. */
  blocked?: 'conflict';
  /** A machine-readable failure reason when `added` is false. */
  error?: 'empty' | 'not-a-board' | 'write-failed';
}
