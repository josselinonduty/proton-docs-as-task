// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MANUAL_SORT, type SortState } from '@/lib/sorting';
import { SortMenu } from '@/components/SortMenu';
import { BoardMenu } from './BoardMenu';

afterEach(cleanup);

function setup() {
  const onBoardSettings = vi.fn();
  const outerKey = vi.fn();
  render(
    <div onKeyDown={outerKey}>
      <BoardMenu
        selectionMode={false}
        onToggleSelection={() => {}}
        onBoardSettings={onBoardSettings}
        onCopyBoard={async () => {}}
        onReload={() => {}}
        onPalette={() => {}}
        onHelp={() => {}}
        onExtensionSettings={() => {}}
      />
    </div>,
  );
  const trigger = screen.getByRole('button', { name: 'More actions' });
  const items = () => screen.getAllByRole('menuitem');
  return { trigger, items, onBoardSettings, outerKey };
}

describe('BoardMenu', () => {
  it('focuses the first item on open and labels the menu with its button', () => {
    const { trigger, items } = setup();
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu', { name: 'More actions' })).toBeTruthy();
    expect(document.activeElement).toBe(items()[0]);
    expect(items().every((item) => item.tabIndex === -1)).toBe(true);
  });

  it('moves between items with the arrows, wrapping, and Home / End', () => {
    const { trigger, items, outerKey } = setup();
    fireEvent.click(trigger);
    const menu = screen.getByRole('menu');
    const all = items();
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(all[1]);
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(all[all.length - 1]);
    fireEvent.keyDown(menu, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(all[0]);
    fireEvent.keyDown(menu, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(all[all.length - 1]);
    fireEvent.keyDown(menu, { key: 'Home' });
    expect(document.activeElement).toBe(all[0]);
    // The board's shortcuts behind the menu never see these keys, or letters.
    fireEvent.keyDown(menu, { key: 'j' });
    expect(outerKey).not.toHaveBeenCalled();
  });

  it('opens on the last item with ArrowUp on the button', () => {
    const { trigger, items } = setup();
    fireEvent.keyDown(trigger, { key: 'ArrowUp' });
    const all = items();
    expect(document.activeElement).toBe(all[all.length - 1]);
  });

  it('closes on Escape and returns focus to the button', () => {
    const { trigger, outerKey } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
    expect(outerKey).not.toHaveBeenCalled();
  });

  it('closes on Tab, from the button', () => {
    const { trigger } = setup();
    fireEvent.click(trigger);
    fireEvent.keyDown(document.activeElement!, { key: 'Tab' });
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('returns focus to the button before an item runs its action', () => {
    const { trigger, onBoardSettings } = setup();
    onBoardSettings.mockImplementation(() => expect(document.activeElement).toBe(trigger));
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Board settings' }));
    expect(onBoardSettings).toHaveBeenCalledOnce();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});

describe('SortMenu', () => {
  function Sort({ initial = MANUAL_SORT }: { initial?: SortState }) {
    const [open, setOpen] = useState(false);
    const [sort, setSort] = useState(initial);
    return (
      <SortMenu
        sort={sort}
        open={open}
        onOpenChange={setOpen}
        onChange={setSort}
        onApplyToDocument={() => {}}
      />
    );
  }

  it('is a menu of radio items, skipping a disabled one', () => {
    render(<Sort />);
    fireEvent.click(screen.getByRole('button', { name: 'Sort' }));
    const menu = screen.getByRole('menu', { name: 'Sort tasks' });
    const radios = within(menu).getAllByRole('menuitemradio');
    expect(radios[0]!.getAttribute('aria-checked')).toBe('true');
    expect(document.activeElement).toBe(radios[0]);
    // "Apply to document" is disabled without a sort: End stops on the last key.
    fireEvent.keyDown(menu, { key: 'End' });
    expect(document.activeElement).toBe(radios[radios.length - 1]);
  });

  it('keeps the menu open while choosing a key and its direction', () => {
    render(<Sort />);
    fireEvent.click(screen.getByRole('button', { name: 'Sort' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Due date' }));
    const menu = screen.getByRole('menu');
    expect(
      screen.getByRole('menuitemradio', { name: 'Due date' }).getAttribute('aria-checked'),
    ).toBe('true');
    const direction = within(menu).getByRole('group');
    fireEvent.click(within(direction).getByRole('menuitemradio', { name: /Descending/ }));
    expect(
      within(direction)
        .getByRole('menuitemradio', { name: /Descending/ })
        .getAttribute('aria-checked'),
    ).toBe('true');
    expect(within(menu).getByRole('menuitem', { name: /Apply/ })).toBeTruthy();
  });
});
