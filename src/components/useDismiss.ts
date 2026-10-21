import { useEffect, useEffectEvent, type RefObject } from 'react';

/**
 * While `open`, call `onDismiss` on a mousedown outside every element in
 * `refs`, and on Escape when `escape` is set. The click test uses
 * `composedPath` because the board renders in a shadow root, where a
 * document-level `e.target` is retargeted to the shadow host.
 */
export function useDismiss(
  open: boolean,
  refs: readonly RefObject<HTMLElement | null>[],
  onDismiss: () => void,
  { escape = false } = {},
) {
  const dismissOutside = useEffectEvent((path: EventTarget[]) => {
    if (!refs.some((ref) => ref.current && path.includes(ref.current))) onDismiss();
  });
  const dismiss = useEffectEvent(onDismiss);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => dismissOutside(e.composedPath());
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') dismiss();
    };
    document.addEventListener('mousedown', onMouseDown);
    if (escape) document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, escape]);
}
