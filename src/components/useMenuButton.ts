import { useId, useLayoutEffect, useRef, type KeyboardEvent } from 'react';
import { moveFocus } from './rovingFocus';
import { useDismiss } from './useDismiss';

/** The menu's items: every enabled `menuitem`, `menuitemradio` or `menuitemcheckbox`. */
const ITEMS = '[role^="menuitem"]:not([disabled])';

/**
 * The WAI-ARIA menu button pattern, for a button that opens a `role="menu"`
 * panel. Opening focuses the first item (the last one with ArrowUp on the
 * button); ArrowUp / ArrowDown, Home and End move between items; Escape closes
 * the menu and returns focus to the button, and Tab closes it and moves on
 * from the button. A click outside closes it too. Give the button
 * `triggerRef` and `triggerProps`, the panel `menuRef` and `menuProps`, and
 * the element holding both `wrapRef`. When an item runs, call `close()`
 * before its action, so a dialog the action opens gives focus back to the
 * button when it closes.
 */
export function useMenuButton(open: boolean, setOpen: (open: boolean) => void) {
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const focusOnOpen = useRef<'first' | 'last'>('first');

  useDismiss(open, [wrapRef], () => setOpen(false), { escape: true });

  // Focus an item as the menu opens, however it was opened (click, keys, a shortcut).
  useLayoutEffect(() => {
    if (!open) return;
    const items = menuRef.current?.querySelectorAll<HTMLElement>(ITEMS);
    const item = focusOnOpen.current === 'last' ? items?.[items.length - 1] : items?.[0];
    item?.focus();
    focusOnOpen.current = 'first';
  }, [open]);

  /** Close the menu; with `returnFocus` (the default), focus goes back to the button. */
  const close = (returnFocus = true) => {
    if (returnFocus) triggerRef.current?.focus();
    setOpen(false);
  };

  const triggerProps = {
    id: `${id}-button`,
    'aria-haspopup': 'menu' as const,
    'aria-expanded': open,
    'aria-controls': open ? `${id}-menu` : undefined,
    onClick: () => setOpen(!open),
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      e.preventDefault();
      e.stopPropagation();
      focusOnOpen.current = e.key === 'ArrowUp' ? 'last' : 'first';
      setOpen(true);
    },
  };

  const menuProps = {
    id: `${id}-menu`,
    role: 'menu' as const,
    'aria-labelledby': `${id}-button`,
    onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => {
      if (moveFocus(e, ITEMS, 'vertical')) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === 'Tab') {
        // From the button, the browser's Tab then moves past the menu.
        close();
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // A letter belongs to the menu, not to the board's shortcuts behind it.
        e.stopPropagation();
      }
    },
  };

  return { wrapRef, triggerRef, menuRef, triggerProps, menuProps, close };
}
