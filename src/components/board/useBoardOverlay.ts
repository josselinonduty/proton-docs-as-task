import { useCallback, useState } from 'react';
import type { BoardTask } from '@/lib/model';
import type { StatusKey } from '@/lib/types';

/** Section or status preselected when quick add opens from a column footer. */
export interface QuickAddPreset {
  section?: string;
  status?: StatusKey;
}

/**
 * The board's modal layer: at most one of these is open at a time, and while
 * one is, the board's own shortcuts stand down.
 *
 * Two dialogs stack on top of it and so live outside it: the command palette
 * (Mod+K opens it from anywhere, even over another dialog) and the status
 * delete confirmation (Board settings asks it while staying open).
 */
export type BoardOverlay =
  | { kind: 'none' }
  | { kind: 'quickAdd'; preset: QuickAddPreset | null }
  | { kind: 'deleteCard'; task: BoardTask }
  | { kind: 'deleteBulk' }
  | { kind: 'deleteSection'; name: string; count: number }
  | { kind: 'boardSettings' }
  | { kind: 'help' };

export type BoardOverlayKind = BoardOverlay['kind'];

const NONE: BoardOverlay = { kind: 'none' };

export function useBoardOverlay() {
  const [overlay, setOverlay] = useState<BoardOverlay>(NONE);
  /** Opening one overlay replaces whichever was open. */
  const open = useCallback((next: BoardOverlay) => setOverlay(next), []);
  /** Close `kind` if it's the one open (or, without `kind`, whatever is). */
  const close = useCallback(
    (kind?: BoardOverlayKind) =>
      setOverlay((current) => (!kind || current.kind === kind ? NONE : current)),
    [],
  );
  return { overlay, open, close, isOpen: overlay.kind !== 'none' };
}
