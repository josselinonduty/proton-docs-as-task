import { useLayoutEffect, useRef, type ComponentProps, type RefObject } from 'react';

/** The `<dialog>`'s other attributes; the modal owns its state and dismiss events. */
type DialogAttributes = Omit<
  ComponentProps<'dialog'>,
  'open' | 'ref' | 'onClose' | 'onCancel' | 'onKeyDown' | 'onMouseDown' | 'onClick'
>;

interface ModalProps extends DialogAttributes {
  /**
   * Called on Escape or a backdrop click. Without it the modal can't be
   * dismissed: it stays until one of its own actions resolves what it asks for.
   */
  onClose?: () => void;
  /** Element to focus first; defaults to the first focusable control. */
  initialFocus?: RefObject<HTMLElement | null>;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The focused element as seen from `node`'s tree (document or shadow root). */
function activeElementOf(node: Node): HTMLElement | null {
  const root = node.getRootNode() as Document | ShadowRoot;
  return root.activeElement as HTMLElement | null;
}

/**
 * A native modal `<dialog>`, open for as long as it is rendered. `showModal()`
 * puts it in the top layer and makes the rest of the page inert, so focus
 * stays inside without a trap, and a modal opened later stacks on top of an
 * open one. The element covers the viewport and the visible panel is its
 * child: a click on the dialog element itself is a click on the backdrop.
 *
 * Escape is handled on the dialog (not the document), so a nested popover such
 * as an open autocomplete or date picker can consume it first. The native
 * `cancel` that follows an Escape nobody prevented is always prevented: the
 * key handler has already decided. If the browser closes the dialog anyway,
 * `close` reports it through `onClose`, or reopens a modal that can't be
 * dismissed.
 *
 * The board lives in a shadow root, where `document.activeElement` is just the
 * shadow host, so focus is read from the dialog's own root node, and restored
 * to the element that had it when the modal unmounts.
 */
export function Modal({ onClose, initialFocus, children, ...rest }: ModalProps) {
  const ref = useRef<HTMLDialogElement>(null);
  // Set while unmounting, so the `close` that `close()` queues is ignored.
  const closing = useRef(false);
  // A backdrop click must also start on the backdrop: a drag that selects
  // text in the panel and ends outside it doesn't close the modal.
  const downOnBackdrop = useRef(false);

  // A layout effect, so the modal is shown and focused before it paints, in
  // mount order: the last modal shown is the top one. Mount-only: parents pass
  // inline `onClose` callbacks, and re-running this on every render would
  // steal focus back to the first control.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    closing.current = false;
    const previouslyFocused = activeElementOf(dialog);
    // Under StrictMode the effect runs twice; showModal() on an open modal throws.
    if (!dialog.open) dialog.showModal();
    const first = initialFocus?.current ?? dialog.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? dialog).focus();
    return () => {
      closing.current = true;
      if (dialog.open) dialog.close();
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onNativeClose = () => {
    const dialog = ref.current;
    // Ours (unmounting), or a stale one from a StrictMode remount.
    if (!dialog || closing.current || dialog.open) return;
    if (onClose) onClose();
    else dialog.showModal();
  };

  return (
    <dialog
      {...rest}
      ref={ref}
      tabIndex={-1}
      onCancel={(e) => e.preventDefault()}
      onClose={onNativeClose}
      onKeyDown={(e) => {
        if (e.key !== 'Escape') return;
        // Also keeps the browser from closing the dialog on its own.
        e.preventDefault();
        e.stopPropagation();
        onClose?.();
      }}
      onMouseDown={(e) => {
        downOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (downOnBackdrop.current && e.target === e.currentTarget) onClose?.();
        downOnBackdrop.current = false;
      }}
    >
      {children}
    </dialog>
  );
}
