/**
 * Message contract between the popup and the in-page content script.
 * Only the frame that actually hosts the editor registers a listener, so a
 * response identifies the meaningful frame.
 */

export type ContentMessage =
  | { type: 'get-status' }
  | { type: 'toggle-board' }
  | { type: 'set-board-visible'; visible: boolean };

export interface StatusResponse {
  ok: true;
  activated: boolean;
  visible: boolean;
  taskCount: number;
  doneCount: number;
  boardTitle?: string;
}
