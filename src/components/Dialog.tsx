import { Modal } from './Modal';

interface DialogProps {
  title: string;
  children: React.ReactNode;
  /**
   * Called on Escape or a backdrop click. Without it the dialog can't be
   * dismissed: it stays until one of its own actions resolves what it asks for.
   */
  onClose?: () => void;
  /** Panel width: `md` (default) for confirmations, `lg` for forms. */
  size?: 'md' | 'lg';
  /** Element to focus first; defaults to the first focusable control. */
  initialFocus?: React.RefObject<HTMLElement | null>;
}

/**
 * A titled modal dialog: a native `<dialog>` (see `Modal`) that closes on
 * Escape or a backdrop click when it has `onClose`, and restores focus to the
 * element that opened it.
 */
export function Dialog({ title, children, onClose, size = 'md', initialFocus }: DialogProps) {
  return (
    <Modal className="pdt-modal" aria-label={title} onClose={onClose} initialFocus={initialFocus}>
      <div className={`pdt-modal__panel pdt-modal__panel--${size}`}>
        <h2 className="pdt-modal__title">{title}</h2>
        {children}
      </div>
    </Modal>
  );
}
