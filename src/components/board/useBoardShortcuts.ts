import type { KeyboardEvent } from 'react';
import type { BoardTask } from '@/lib/model';
import type { CardPlace } from './boardLayout';
import { findShortcut, type ShortcutContext } from './shortcuts';

interface BoardShortcutsOptions extends Omit<ShortcutContext, 'cardId' | 'card' | 'cardPlaced'> {
  /** A dialog is open: only global shortcuts fire. */
  overlayOpen: boolean;
  /** The card that last took focus. */
  focusedCardId: string | null;
  tasks: BoardTask[];
  places: Map<string, CardPlace>;
}

/** The board's keydown handler, driven by the `BOARD_SHORTCUTS` key map. */
export function useBoardShortcuts({
  overlayOpen,
  focusedCardId,
  tasks,
  places,
  ...state
}: BoardShortcutsOptions) {
  return (e: KeyboardEvent) => {
    const target = e.target as HTMLElement;
    const typing =
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'SELECT' ||
      target.isContentEditable;
    const cardId = target.classList.contains('pdt-taskcard') ? focusedCardId : null;
    const ctx: ShortcutContext = {
      ...state,
      cardId,
      card: cardId ? tasks.find((task) => task.id === cardId) : undefined,
      cardPlaced: cardId ? places.has(cardId) : false,
    };
    const shortcut = findShortcut(
      { key: e.key, mod: e.metaKey || e.ctrlKey, typing, overlayOpen },
      ctx,
    );
    if (!shortcut) return;
    if (!shortcut.keepDefault) e.preventDefault();
    shortcut.run(ctx);
  };
}
