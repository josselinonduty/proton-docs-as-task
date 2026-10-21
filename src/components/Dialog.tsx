import { useEffect, useRef } from 'react';

interface DialogProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  /** Panel width: `md` (default) for confirmations, `lg` for forms. */
  size?: 'md' | 'lg';
  /** Element to focus first; defaults to the first focusable control. */
  initialFocus?: React.RefObject<HTMLElement | null>;
  /**
   * When false, Escape and backdrop clicks don't close the dialog: it stays
   * until one of its own actions resolves what it asks for.
   */
  dismissible?: boolean;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** The focused element as seen from `node`'s tree (document or shadow root). */
function activeElementOf(node: Node): Element | null {
  const root = node.getRootNode() as Document | ShadowRoot;
  return root.activeElement ?? null;
}

/**
 * A modal dialog that traps focus, closes on Escape or backdrop click (unless
 * `dismissible` is false), and restores focus to the element that opened it.
 *
 * The board lives in a shadow root, where `document.activeElement` is just the
 * shadow host — so focus is always read from the dialog's own root node.
 * Keys are handled on the panel (not the document) so a nested popover, such
 * as an open autocomplete or date picker, can consume Escape first.
 */
export function Dialog({
  title,
  children,
  onClose,
  size = 'md',
  initialFocus,
  dismissible = true,
}: DialogProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Mount-only: parents pass inline `onClose` callbacks, and re-running this
  // on every render would steal focus back to the first control.
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const previouslyFocused = activeElementOf(panel) as HTMLElement | null;
    const first = initialFocus?.current ?? panel.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? panel).focus();
    return () => {
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      if (dismissible) onCloseRef.current();
      return;
    }
    const panel = panelRef.current;
    if (e.key !== 'Tab' || !panel) return;
    const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.getClientRects().length > 0,
    );
    if (items.length === 0) return;
    const firstEl = items[0]!;
    const lastEl = items[items.length - 1]!;
    const active = activeElementOf(panel);
    if (e.shiftKey && (active === firstEl || active === panel)) {
      e.preventDefault();
      lastEl.focus();
    } else if (!e.shiftKey && active === lastEl) {
      e.preventDefault();
      firstEl.focus();
    }
  };

  return (
    <div
      className="pdt-modal"
      onMouseDown={(e) => dismissible && e.target === e.currentTarget && onCloseRef.current()}
    >
      <div
        className={`pdt-modal__panel pdt-modal__panel--${size}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
        onKeyDown={onKeyDown}
      >
        <h2 className="pdt-modal__title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
