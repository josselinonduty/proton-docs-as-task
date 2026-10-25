// @vitest-environment jsdom
import { StrictMode, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { Dialog } from './Dialog';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Render inside a shadow root, the way the board overlay is mounted. */
function renderInShadow(ui: React.ReactElement) {
  const host = document.createElement('div');
  document.body.append(host);
  const shadow = host.attachShadow({ mode: 'open' });
  const container = document.createElement('div');
  shadow.append(container);
  const opener = document.createElement('button');
  opener.textContent = 'Open';
  shadow.append(opener);
  opener.focus();
  const result = render(ui, { container });
  const dialog = () => shadow.querySelector('dialog');
  return { shadow, opener, dialog, ...result };
}

/** A mousedown then a click, as a real click (or a drag) delivers them. */
function click(down: Element, up: Element = down) {
  fireEvent.mouseDown(down);
  fireEvent.click(up);
}

describe('Dialog in a shadow root', () => {
  it('opens as a native modal and focuses its first control', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    const { shadow, dialog } = renderInShadow(
      <Dialog title="Delete task" onClose={() => {}}>
        <button>Cancel</button>
        <button>Delete</button>
      </Dialog>,
    );
    expect(showModal).toHaveBeenCalledOnce();
    expect(dialog()!.open).toBe(true);
    expect(dialog()!.getAttribute('aria-label')).toBe('Delete task');
    expect(shadow.activeElement?.textContent).toBe('Cancel');
  });

  it('focuses initialFocus when given', () => {
    function WithHeading() {
      const ref = useRef<HTMLHeadingElement>(null);
      return (
        <Dialog title="Settings" onClose={() => {}} initialFocus={ref}>
          <button>First</button>
          <h3 ref={ref} tabIndex={-1}>
            Statuses
          </h3>
        </Dialog>
      );
    }
    const { shadow } = renderInShadow(<WithHeading />);
    expect(shadow.activeElement?.textContent).toBe('Statuses');
  });

  it('closes on Escape and restores focus to the opener', () => {
    const onClose = vi.fn();
    const { shadow, opener, dialog, unmount } = renderInShadow(
      <Dialog title="Delete task" onClose={onClose}>
        <button>Cancel</button>
      </Dialog>,
    );
    const escape = fireEvent.keyDown(shadow.activeElement!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    // Prevented, so the browser doesn't also close the dialog on its own.
    expect(escape).toBe(false);
    const element = dialog()!;
    act(() => unmount());
    expect(element.open).toBe(false);
    expect(shadow.activeElement).toBe(opener);
  });

  it('lets a nested control consume Escape first', () => {
    const onClose = vi.fn();
    const { shadow } = renderInShadow(
      <Dialog title="New task" onClose={onClose}>
        <input aria-label="Assignee" onKeyDown={(e) => e.key === 'Escape' && e.stopPropagation()} />
      </Dialog>,
    );
    fireEvent.keyDown(shadow.querySelector('input')!, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('prevents the native cancel, so only the key handler decides', () => {
    const onClose = vi.fn();
    const { dialog } = renderInShadow(
      <Dialog title="t" onClose={onClose}>
        <button>OK</button>
      </Dialog>,
    );
    const cancel = new Event('cancel', { cancelable: true });
    dialog()!.dispatchEvent(cancel);
    expect(cancel.defaultPrevented).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(dialog()!.open).toBe(true);
  });

  it('reports a close the browser made on its own', () => {
    const onClose = vi.fn();
    const { dialog } = renderInShadow(
      <Dialog title="t" onClose={onClose}>
        <button>OK</button>
      </Dialog>,
    );
    act(() => dialog()!.close());
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on a backdrop click, but not on a drag that starts inside', () => {
    const onClose = vi.fn();
    const { shadow, dialog } = renderInShadow(
      <Dialog title="t" onClose={onClose}>
        <p>Some text to select</p>
      </Dialog>,
    );
    const text = shadow.querySelector('p')!;
    click(text);
    click(text, dialog()!);
    expect(onClose).not.toHaveBeenCalled();
    click(dialog()!, text);
    expect(onClose).not.toHaveBeenCalled();
    click(dialog()!);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not steal focus back when the parent re-renders', () => {
    const { shadow, rerender } = renderInShadow(
      <Dialog title="t" onClose={() => {}}>
        <button>First</button>
        <button>Second</button>
      </Dialog>,
    );
    const second = shadow.querySelectorAll('dialog button')[1] as HTMLElement;
    second.focus();
    rerender(
      <Dialog title="t" onClose={() => {}}>
        <button>First</button>
        <button>Second</button>
      </Dialog>,
    );
    expect(shadow.activeElement).toBe(second);
  });

  it('without onClose, stays open and keeps Escape and backdrop clicks from the page', () => {
    const outerKey = vi.fn();
    const { shadow, dialog } = renderInShadow(
      <div onKeyDown={outerKey}>
        <Dialog title="Blocking">
          <button>Resolve</button>
        </Dialog>
      </div>,
    );
    fireEvent.keyDown(shadow.querySelector('button')!, { key: 'Escape' });
    click(dialog()!);
    expect(outerKey).not.toHaveBeenCalled();
    expect(dialog()!.open).toBe(true);
    // Closed by the browser anyway: it shows itself again.
    act(() => dialog()!.close());
    expect(dialog()!.open).toBe(true);
  });

  it('stays open under StrictMode', () => {
    const onClose = vi.fn();
    const { dialog } = renderInShadow(
      <StrictMode>
        <Dialog title="t" onClose={onClose}>
          <button>OK</button>
        </Dialog>
      </StrictMode>,
    );
    expect(dialog()!.open).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Stacked dialogs', () => {
  /** Board settings, and a confirmation it opens on top of itself. */
  function Stack({ onCloseOuter }: { onCloseOuter: () => void }) {
    const [confirming, setConfirming] = useState(false);
    return (
      <>
        <Dialog title="Board settings" onClose={onCloseOuter}>
          <button onClick={() => setConfirming(true)}>Delete status</button>
        </Dialog>
        {confirming && (
          <Dialog title="Delete status" onClose={() => setConfirming(false)}>
            <button>Cancel</button>
          </Dialog>
        )}
      </>
    );
  }

  it('shows the later dialog on top, and Escape closes only that one', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    const onCloseOuter = vi.fn();
    const { shadow } = renderInShadow(<Stack onCloseOuter={onCloseOuter} />);
    const screen = within(shadow as unknown as HTMLElement);
    const trigger = screen.getByRole('button', { name: 'Delete status' });
    fireEvent.click(trigger);

    const outer = screen.getByRole<HTMLDialogElement>('dialog', { name: 'Board settings' });
    const inner = screen.getByRole('dialog', { name: 'Delete status' });
    // The top layer follows showModal() order: the confirmation went last.
    expect(showModal.mock.contexts).toEqual([outer, inner]);
    expect(shadow.activeElement?.textContent).toBe('Cancel');

    fireEvent.keyDown(shadow.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Delete status' })).toBeNull();
    expect(onCloseOuter).not.toHaveBeenCalled();
    expect(outer.open).toBe(true);
    // Focus goes back to what opened the confirmation, inside the lower dialog.
    expect(shadow.activeElement).toBe(trigger);
  });
});
