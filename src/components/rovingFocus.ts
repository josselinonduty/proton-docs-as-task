import type { KeyboardEvent } from 'react';

/**
 * Arrow-key focus among a widget's items: the arrows of `orientation` move to
 * the previous or next item, wrapping around, and Home / End to the first or
 * last. Call it from the container's `onKeyDown`; `selector` picks the items
 * inside it. A handled key is consumed, so the board's own shortcuts never
 * see it. Returns the item focused, or `null` when the key isn't one of these.
 */
export function moveFocus(
  e: KeyboardEvent<HTMLElement>,
  selector: string,
  orientation: 'horizontal' | 'vertical',
): { item: HTMLElement; index: number } | null {
  const [prev, next] =
    orientation === 'horizontal' ? ['ArrowLeft', 'ArrowRight'] : ['ArrowUp', 'ArrowDown'];
  if (e.altKey || e.ctrlKey || e.metaKey || ![prev, next, 'Home', 'End'].includes(e.key)) {
    return null;
  }
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(selector));
  if (items.length === 0) return null;
  // Read focus from the container's own tree: the board lives in a shadow root.
  const root = e.currentTarget.getRootNode() as Document | ShadowRoot;
  const current = items.indexOf(root.activeElement as HTMLElement);
  const last = items.length - 1;
  const index =
    e.key === 'Home'
      ? 0
      : e.key === 'End'
        ? last
        : e.key === next
          ? current < 0 || current === last
            ? 0
            : current + 1
          : current <= 0
            ? last
            : current - 1;
  e.preventDefault();
  e.stopPropagation();
  const item = items[index]!;
  item.focus();
  return { item, index };
}
