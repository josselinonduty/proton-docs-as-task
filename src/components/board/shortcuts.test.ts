import { describe, expect, it, vi } from 'vitest';
import { createTask } from '@/lib/model';
import {
  findShortcut,
  shortcutHelp,
  type KeyPress,
  type ShortcutActions,
  type ShortcutContext,
} from './shortcuts';

const CARD = { ...createTask('Tasks', 'todo', 'Spec'), id: 'card-1' };

function context(patch: Partial<Omit<ShortcutContext, 'actions'>> = {}): ShortcutContext {
  const actions = Object.fromEntries(
    [
      'openPalette',
      'closeColorMenu',
      'closeSort',
      'closeDetails',
      'exitSelection',
      'undo',
      'selectAll',
      'addTask',
      'focusSearch',
      'openFilters',
      'cycleView',
      'toggleSort',
      'focusCard',
      'openDetails',
      'toggleDone',
      'toggleSelect',
      'requestBulkDelete',
      'requestDelete',
      'openHelp',
    ].map((name) => [name, vi.fn()]),
  ) as unknown as ShortcutActions;
  return {
    cardId: null,
    card: undefined,
    cardPlaced: false,
    colorMenuOpen: false,
    sortOpen: false,
    detailsOpen: false,
    selectionMode: false,
    selectedCount: 0,
    canUndo: false,
    actions,
    ...patch,
  };
}

const ON_CARD = { cardId: CARD.id, card: CARD, cardPlaced: true };

/** Press `key` and return the context, so the test can check which action ran. */
function press(key: string, ctx = context(), opts: Partial<KeyPress> = {}) {
  const shortcut = findShortcut(
    { key, mod: false, typing: false, overlayOpen: false, ...opts },
    ctx,
  );
  shortcut?.run(ctx);
  return { ctx, shortcut };
}

describe('board shortcuts', () => {
  it.each([
    ['n', 'addTask'],
    ['N', 'addTask'],
    ['/', 'focusSearch'],
    ['f', 'openFilters'],
    ['v', 'cycleView'],
    ['s', 'toggleSort'],
    ['?', 'openHelp'],
  ] as const)('%s runs %s', (key, action) => {
    const { ctx } = press(key);
    expect(ctx.actions[action]).toHaveBeenCalledOnce();
  });

  it('J and K move card focus down and up', () => {
    expect(press('j').ctx.actions.focusCard).toHaveBeenCalledWith(1);
    expect(press('K').ctx.actions.focusCard).toHaveBeenCalledWith(-1);
  });

  it('Mod+K opens the palette even while typing or over a dialog', () => {
    const { ctx } = press('k', context(), { mod: true, typing: true, overlayOpen: true });
    expect(ctx.actions.openPalette).toHaveBeenCalledOnce();
    expect(ctx.actions.focusCard).not.toHaveBeenCalled();
  });

  it('Mod+Z undoes only when there is something to undo', () => {
    expect(press('z', context(), { mod: true }).shortcut).toBeUndefined();
    const { ctx } = press('Z', context({ canUndo: true }), { mod: true });
    expect(ctx.actions.undo).toHaveBeenCalledOnce();
  });

  it('Mod+A selects all shown cards', () => {
    expect(press('a', context(), { mod: true }).ctx.actions.selectAll).toHaveBeenCalledOnce();
  });

  it('leaves other modified keys to the browser', () => {
    expect(press('n', context(), { mod: true }).shortcut).toBeUndefined();
    expect(press('c', context(), { mod: true }).shortcut).toBeUndefined();
  });

  it('card keys act on the focused card only', () => {
    for (const key of ['Enter', 'e', 'm', 'x', ' ', 'Delete']) {
      expect(press(key).shortcut).toBeUndefined();
    }
    const ctx = context(ON_CARD);
    press('Enter', ctx);
    press('e', ctx);
    press('M', ctx);
    expect(ctx.actions.openDetails).toHaveBeenNthCalledWith(1, CARD.id);
    expect(ctx.actions.openDetails).toHaveBeenNthCalledWith(2, CARD.id, 'title');
    expect(ctx.actions.openDetails).toHaveBeenNthCalledWith(3, CARD.id, 'section');
    expect(press('X', ctx).ctx.actions.toggleDone).toHaveBeenCalledWith(CARD);
    expect(press(' ', ctx).ctx.actions.toggleSelect).toHaveBeenCalledWith(CARD);
    expect(press('Backspace', ctx).ctx.actions.requestDelete).toHaveBeenCalledWith(CARD);
  });

  it('Space only selects a card that is on screen', () => {
    expect(press(' ', context({ ...ON_CARD, cardPlaced: false })).shortcut).toBeUndefined();
  });

  it('Delete asks to delete the selection when there is one', () => {
    const { ctx } = press('Delete', context({ ...ON_CARD, selectionMode: true, selectedCount: 2 }));
    expect(ctx.actions.requestBulkDelete).toHaveBeenCalledOnce();
    expect(ctx.actions.requestDelete).not.toHaveBeenCalled();
  });

  it('Escape closes the innermost thing, one per press, even while typing', () => {
    const all = { colorMenuOpen: true, sortOpen: true, detailsOpen: true, selectionMode: true };
    const order = [
      ['colorMenuOpen', 'closeColorMenu'],
      ['sortOpen', 'closeSort'],
      ['detailsOpen', 'closeDetails'],
      ['selectionMode', 'exitSelection'],
    ] as const;
    let state: Partial<ShortcutContext> = { ...all };
    for (const [flag, action] of order) {
      const { ctx, shortcut } = press('Escape', context(state), { typing: true });
      expect(ctx.actions[action]).toHaveBeenCalledOnce();
      expect(shortcut?.keepDefault).toBe(true);
      state = { ...state, [flag]: false };
    }
    expect(press('Escape', context(state)).shortcut).toBeUndefined();
  });

  it('stands down while typing or while a dialog is open', () => {
    expect(press('n', context(), { typing: true }).shortcut).toBeUndefined();
    expect(press('n', context(), { overlayOpen: true }).shortcut).toBeUndefined();
    expect(press('Escape', context({ detailsOpen: true }), { overlayOpen: true }).shortcut).toBe(
      undefined,
    );
  });

  it('documents its shortcuts in the help, grouped', () => {
    expect(shortcutHelp('Ctrl')).toEqual([
      {
        group: 'createFind',
        items: [
          { keys: 'N', text: 'shortcuts.createFind.newTask' },
          { keys: '/', text: 'shortcuts.createFind.search' },
          { keys: 'F', text: 'shortcuts.createFind.filters' },
          { keys: 'Ctrl K', text: 'shortcuts.createFind.palette' },
        ],
      },
      {
        group: 'view',
        items: [
          { keys: 'V', text: 'shortcuts.view.changeView' },
          { keys: 'S', text: 'shortcuts.view.sort' },
          { keys: '?', text: 'shortcuts.view.help' },
        ],
      },
      {
        group: 'cards',
        items: [
          { keys: 'J / K', text: 'shortcuts.cards.focus' },
          { keys: 'Enter', text: 'shortcuts.cards.open' },
          { keys: 'E', text: 'shortcuts.cards.edit' },
          { keys: 'Space', text: 'shortcuts.cards.select' },
          { keys: 'X', text: 'shortcuts.cards.toggle' },
          { keys: 'M', text: 'shortcuts.cards.move' },
          { keys: 'Delete / Backspace', text: 'shortcuts.cards.delete' },
        ],
      },
      {
        group: 'general',
        items: [
          { keys: 'Ctrl Z', text: 'shortcuts.general.undo' },
          { keys: 'Esc', text: 'shortcuts.general.close' },
        ],
      },
    ]);
  });
});
