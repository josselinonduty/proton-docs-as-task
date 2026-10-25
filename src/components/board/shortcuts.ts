import type { ParseKeys } from 'i18next';
import type { BoardTask } from '@/lib/model';
import type { DetailsFocus } from '@/components/TaskDetailsPanel';

/** What the board can do from the keyboard. */
export interface ShortcutActions {
  openPalette: () => void;
  closeColorMenu: () => void;
  closeSort: () => void;
  closeDetails: () => void;
  exitSelection: () => void;
  undo: () => void;
  selectAll: () => void;
  addTask: () => void;
  focusSearch: () => void;
  openFilters: () => void;
  cycleView: () => void;
  toggleSort: () => void;
  focusCard: (delta: number) => void;
  openDetails: (id: string, focus?: DetailsFocus) => void;
  toggleDone: (task: BoardTask) => void;
  toggleSelect: (task: BoardTask) => void;
  requestBulkDelete: () => void;
  requestDelete: (task: BoardTask) => void;
  openHelp: () => void;
}

/** The board's state as a key is pressed. */
export interface ShortcutContext {
  /** The focused card, only when the key comes from the card itself. */
  cardId: string | null;
  /** Its task, if it still exists. */
  card: BoardTask | undefined;
  /** The card is on screen (its column isn't collapsed), so it can be selected. */
  cardPlaced: boolean;
  colorMenuOpen: boolean;
  sortOpen: boolean;
  detailsOpen: boolean;
  selectionMode: boolean;
  selectedCount: number;
  canUndo: boolean;
  actions: ShortcutActions;
}

export type ShortcutGroup = 'createFind' | 'view' | 'cards' | 'general';

/** Written in help as `Mod`, shown as the platform's own modifier label. */
export const MOD = 'Mod';

export interface Shortcut {
  /** `KeyboardEvent.key` values that trigger it. */
  keys: string[];
  /** `mod` needs Ctrl / Cmd, `none` (the default) refuses it, `any` ignores it. */
  mods?: 'mod' | 'none' | 'any';
  /** Fires even over an open dialog and while typing in a field. */
  global?: boolean;
  /** Fires while typing in a field (but not over a dialog). */
  whileTyping?: boolean;
  /** Leave the browser's default handling alone. */
  keepDefault?: boolean;
  /** Only fires when this holds; otherwise the next match is tried. */
  when?: (ctx: ShortcutContext) => boolean;
  run: (ctx: ShortcutContext) => void;
  /** Its row in the shortcut help: the keys as shown and the i18n key of the text. */
  help?: { group: ShortcutGroup; keys: string; text: ParseKeys };
}

/**
 * Every board shortcut. Card shortcuts act only on a card that has focus,
 * never on a button that happens to follow one. Help rows appear in this
 * order, grouped.
 */
export const BOARD_SHORTCUTS: Shortcut[] = [
  {
    keys: ['n', 'N'],
    run: (c) => c.actions.addTask(),
    help: { group: 'createFind', keys: 'N', text: 'shortcuts.createFind.newTask' },
  },
  {
    keys: ['/'],
    run: (c) => c.actions.focusSearch(),
    help: { group: 'createFind', keys: '/', text: 'shortcuts.createFind.search' },
  },
  {
    keys: ['f', 'F'],
    run: (c) => c.actions.openFilters(),
    help: { group: 'createFind', keys: 'F', text: 'shortcuts.createFind.filters' },
  },
  {
    keys: ['k', 'K'],
    mods: 'mod',
    global: true,
    run: (c) => c.actions.openPalette(),
    help: { group: 'createFind', keys: `${MOD} K`, text: 'shortcuts.createFind.palette' },
  },
  {
    keys: ['v', 'V'],
    run: (c) => c.actions.cycleView(),
    help: { group: 'view', keys: 'V', text: 'shortcuts.view.changeView' },
  },
  {
    keys: ['s', 'S'],
    run: (c) => c.actions.toggleSort(),
    help: { group: 'view', keys: 'S', text: 'shortcuts.view.sort' },
  },
  {
    keys: ['?'],
    run: (c) => c.actions.openHelp(),
    help: { group: 'view', keys: '?', text: 'shortcuts.view.help' },
  },
  {
    keys: ['j', 'J'],
    run: (c) => c.actions.focusCard(1),
    help: { group: 'cards', keys: 'J / K', text: 'shortcuts.cards.focus' },
  },
  { keys: ['k', 'K'], run: (c) => c.actions.focusCard(-1) },
  {
    keys: ['Enter'],
    when: (c) => c.cardId !== null,
    run: (c) => c.actions.openDetails(c.cardId!),
    help: { group: 'cards', keys: 'Enter', text: 'shortcuts.cards.open' },
  },
  {
    keys: ['e', 'E'],
    when: (c) => c.cardId !== null,
    run: (c) => c.actions.openDetails(c.cardId!, 'title'),
    help: { group: 'cards', keys: 'E', text: 'shortcuts.cards.edit' },
  },
  {
    keys: [' '],
    when: (c) => c.card !== undefined && c.cardPlaced,
    run: (c) => c.actions.toggleSelect(c.card!),
    help: { group: 'cards', keys: 'Space', text: 'shortcuts.cards.select' },
  },
  {
    keys: ['x', 'X'],
    when: (c) => c.card !== undefined,
    run: (c) => c.actions.toggleDone(c.card!),
    help: { group: 'cards', keys: 'X', text: 'shortcuts.cards.toggle' },
  },
  {
    keys: ['m', 'M'],
    when: (c) => c.cardId !== null,
    run: (c) => c.actions.openDetails(c.cardId!, 'section'),
    help: { group: 'cards', keys: 'M', text: 'shortcuts.cards.move' },
  },
  {
    // With a selection, delete it (after confirming); otherwise the focused card.
    keys: ['Delete', 'Backspace'],
    when: (c) => c.selectionMode && c.selectedCount > 0,
    run: (c) => c.actions.requestBulkDelete(),
    help: { group: 'cards', keys: 'Delete / Backspace', text: 'shortcuts.cards.delete' },
  },
  {
    keys: ['Delete', 'Backspace'],
    when: (c) => c.card !== undefined,
    run: (c) => c.actions.requestDelete(c.card!),
  },
  {
    keys: ['z', 'Z'],
    mods: 'mod',
    when: (c) => c.canUndo,
    run: (c) => c.actions.undo(),
    help: { group: 'general', keys: `${MOD} Z`, text: 'shortcuts.general.undo' },
  },
  // Escape closes the innermost open thing, one per press.
  {
    keys: ['Escape'],
    mods: 'any',
    whileTyping: true,
    keepDefault: true,
    when: (c) => c.colorMenuOpen,
    run: (c) => c.actions.closeColorMenu(),
    help: { group: 'general', keys: 'Esc', text: 'shortcuts.general.close' },
  },
  {
    keys: ['Escape'],
    mods: 'any',
    whileTyping: true,
    keepDefault: true,
    when: (c) => c.sortOpen,
    run: (c) => c.actions.closeSort(),
  },
  {
    keys: ['Escape'],
    mods: 'any',
    whileTyping: true,
    keepDefault: true,
    when: (c) => c.detailsOpen,
    run: (c) => c.actions.closeDetails(),
  },
  {
    keys: ['Escape'],
    mods: 'any',
    whileTyping: true,
    keepDefault: true,
    when: (c) => c.selectionMode,
    run: (c) => c.actions.exitSelection(),
  },
  { keys: ['a', 'A'], mods: 'mod', run: (c) => c.actions.selectAll() },
];

/** The key press, as far as matching a shortcut goes. */
export interface KeyPress {
  key: string;
  mod: boolean;
  typing: boolean;
  overlayOpen: boolean;
}

/** The first shortcut in `shortcuts` that `press` triggers in `ctx`, if any. */
export function findShortcut(
  press: KeyPress,
  ctx: ShortcutContext,
  shortcuts: readonly Shortcut[] = BOARD_SHORTCUTS,
): Shortcut | undefined {
  return shortcuts.find((shortcut) => {
    if (!shortcut.keys.includes(press.key)) return false;
    const mods = shortcut.mods ?? 'none';
    if (mods !== 'any' && (mods === 'mod') !== press.mod) return false;
    // Dialogs handle their own keys; fields keep theirs.
    if (press.overlayOpen && !shortcut.global) return false;
    if (press.typing && !shortcut.global && !shortcut.whileTyping) return false;
    return shortcut.when?.(ctx) ?? true;
  });
}

export interface ShortcutHelpGroup {
  group: ShortcutGroup;
  items: { keys: string; text: ParseKeys }[];
}

/** The help dialog's rows, from the shortcuts that document themselves. */
export function shortcutHelp(
  modLabel: string,
  shortcuts: readonly Shortcut[] = BOARD_SHORTCUTS,
): ShortcutHelpGroup[] {
  const groups: ShortcutHelpGroup[] = [];
  for (const { help } of shortcuts) {
    if (!help) continue;
    let entry = groups.find((g) => g.group === help.group);
    if (!entry) groups.push((entry = { group: help.group, items: [] }));
    entry.items.push({ keys: help.keys.replace(MOD, modLabel), text: help.text });
  }
  return groups;
}
