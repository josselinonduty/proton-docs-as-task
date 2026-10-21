// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Dialog } from './Dialog';

afterEach(cleanup);

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
  return { shadow, opener, ...result };
}

// jsdom has no layout; treat every element as rendered for the focus trap.
Element.prototype.getClientRects = function () {
  return [{}] as unknown as DOMRectList;
};

describe('Dialog in a shadow root', () => {
  it('traps Tab focus inside the panel', () => {
    const { shadow } = renderInShadow(
      <Dialog title="Delete task" onClose={() => {}}>
        <button>Cancel</button>
        <button>Delete</button>
      </Dialog>,
    );
    const [cancel, del] = Array.from(shadow.querySelectorAll<HTMLElement>('.pdt-modal button'));
    expect(shadow.activeElement).toBe(cancel);

    del!.focus();
    fireEvent.keyDown(del!, { key: 'Tab' });
    expect(shadow.activeElement).toBe(cancel);

    fireEvent.keyDown(cancel!, { key: 'Tab', shiftKey: true });
    expect(shadow.activeElement).toBe(del);
  });

  it('closes on Escape and restores focus to the opener', () => {
    const onClose = vi.fn();
    const { shadow, opener, unmount } = renderInShadow(
      <Dialog title="Delete task" onClose={onClose}>
        <button>Cancel</button>
      </Dialog>,
    );
    fireEvent.keyDown(shadow.activeElement!, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => unmount());
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

  it('does not steal focus back when the parent re-renders', () => {
    const { shadow, rerender } = renderInShadow(
      <Dialog title="t" onClose={() => {}}>
        <button>First</button>
        <button>Second</button>
      </Dialog>,
    );
    const second = shadow.querySelectorAll('.pdt-modal button')[1] as HTMLElement;
    second.focus();
    rerender(
      <Dialog title="t" onClose={() => {}}>
        <button>First</button>
        <button>Second</button>
      </Dialog>,
    );
    expect(shadow.activeElement).toBe(second);
  });

  it('without onClose, keeps Escape and backdrop clicks from reaching the page', () => {
    const outerKey = vi.fn();
    const { shadow } = renderInShadow(
      <div onKeyDown={outerKey}>
        <Dialog title="Blocking">
          <button>Resolve</button>
        </Dialog>
      </div>,
    );
    fireEvent.keyDown(shadow.querySelector('button')!, { key: 'Escape' });
    fireEvent.mouseDown(shadow.querySelector('.pdt-modal')!);
    expect(outerKey).not.toHaveBeenCalled();
    expect(shadow.querySelector('[role="dialog"]')).not.toBeNull();
  });
});
