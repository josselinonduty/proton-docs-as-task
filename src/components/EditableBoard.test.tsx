// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { EditableBoard } from './EditableBoard';
import { parseDocument } from '@/lib/parser';
import { fromParseResult, type BoardModel } from '@/lib/model';
import { EMPTY_FILTERS } from '@/lib/filters';
import { MANUAL_SORT } from '@/lib/sorting';
import { DEFAULT_SETTINGS } from '@/lib/defaults';
import type { BoardView } from '@/lib/types';

const DOC = [
  '#!tasks Sprint',
  '',
  '## Build @default',
  '- [ ] Spec',
  '- [ ] Code @status:doing',
  '- [x] Kickoff',
  '## Launch',
  '- [ ] Announce',
].join('\n');

afterEach(cleanup);

function setup(view: BoardView, patch: Partial<Parameters<typeof EditableBoard>[0]> = {}) {
  const model: BoardModel = fromParseResult(parseDocument(DOC, ['#!tasks']));
  const onChange = vi.fn();
  const onUndo = vi.fn();
  const onViewChange = vi.fn();
  render(
    <EditableBoard
      model={model}
      view={view}
      filters={{ ...EMPTY_FILTERS }}
      sort={MANUAL_SORT}
      settings={DEFAULT_SETTINGS}
      marker="#!tasks"
      saveState="saved"
      undoLabel={null}
      collapsedColumns={[]}
      collapsedRows={[]}
      lastQuickAddSection={null}
      announce={() => {}}
      onChange={onChange}
      onViewChange={onViewChange}
      onFiltersChange={() => {}}
      onSortChange={() => {}}
      onSettingsChange={() => {}}
      onToggleColumnCollapse={() => {}}
      onToggleRowCollapse={() => {}}
      onQuickAddSectionChange={() => {}}
      onUndo={onUndo}
      onRetry={() => {}}
      onReloadFromDoc={() => {}}
      onOpenSettings={() => {}}
      onClose={() => {}}
      {...patch}
    />,
  );
  const board = screen.getByRole('region', { name: /board/i });
  return { model, board, onChange, onUndo, onViewChange };
}

const columnNames = () =>
  screen
    .getAllByRole('list')
    .map((list) => list.getAttribute('aria-label'))
    .filter(Boolean);

describe('EditableBoard views', () => {
  it('Workflow shows a column per status', () => {
    setup('workflow');
    expect(columnNames()).toEqual(['To Do', 'In Progress', 'Done']);
    expect(screen.getByRole('textbox', { name: 'Status name: In Progress' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add status/ })).toBeTruthy();
  });

  it('Sections shows a column per section, with section controls', () => {
    setup('sections');
    expect(columnNames()).toEqual(['Build', 'Launch']);
    expect(screen.getByRole('button', { name: 'Delete section Build' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Add section/ })).toBeTruthy();
  });

  it('Swimlane shows a row per section and a cell per status', () => {
    setup('swimlane');
    const table = screen.getByRole('table');
    expect(
      within(table)
        .getAllByRole('rowheader')
        .map((h) => h.textContent),
    ).toEqual(['Build3', 'Launch1']);
    expect(within(table).getAllByRole('cell')).toHaveLength(6);
    expect(within(table).getByRole('listitem', { name: /Announce/ })).toBeTruthy();
  });

  it('List shows the default section’s tasks in one column', () => {
    setup('list');
    expect(document.querySelector('.pdt-columns--list')).toBeTruthy();
    expect(screen.getAllByRole('listitem')).toHaveLength(3);
    expect(screen.queryByRole('listitem', { name: /Announce/ })).toBeNull();
  });
});

describe('EditableBoard keyboard and dialogs', () => {
  it('moves card focus with J / K in column order', () => {
    const { board } = setup('workflow');
    fireEvent.keyDown(board, { key: 'j' });
    expect(document.activeElement).toBe(screen.getByRole('listitem', { name: /Spec/ }));
    fireEvent.keyDown(document.activeElement!, { key: 'j' });
    expect(document.activeElement).toBe(screen.getByRole('listitem', { name: /Announce/ }));
    fireEvent.keyDown(document.activeElement!, { key: 'k' });
    expect(document.activeElement).toBe(screen.getByRole('listitem', { name: /Spec/ }));
  });

  it('opens quick add with N and closes it with Escape', () => {
    const { board } = setup('workflow');
    fireEvent.keyDown(board, { key: 'n' });
    const dialog = screen.getByRole('dialog', { name: 'New task' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'New task' })).toBeNull();
  });

  it('ignores board shortcuts while a dialog is open, except the palette', () => {
    const { board } = setup('workflow');
    fireEvent.keyDown(board, { key: '?' });
    const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    fireEvent.keyDown(help, { key: 'n' });
    expect(screen.queryByRole('dialog', { name: 'New task' })).toBeNull();
    fireEvent.keyDown(help, { key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeTruthy();
  });

  it('stacks the palette over an open dialog, and Escape closes only the palette', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    const { board } = setup('workflow');
    fireEvent.keyDown(board, { key: '?' });
    const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    fireEvent.keyDown(help, { key: 'k', ctrlKey: true });
    const palette = screen.getByRole('dialog', { name: 'Command palette' });
    expect(showModal.mock.contexts).toEqual([help, palette]);
    fireEvent.keyDown(screen.getByRole('combobox', { name: 'Search commands' }), {
      key: 'Escape',
    });
    expect(screen.queryByRole('dialog', { name: 'Command palette' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBe(help);
    showModal.mockRestore();
  });

  it('lists the documented shortcuts in the help dialog', () => {
    const { board } = setup('workflow');
    fireEvent.keyDown(board, { key: '?' });
    const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(help).getByText('Open focused card details')).toBeTruthy();
    expect(within(help).getAllByRole('heading', { level: 3 })).toHaveLength(4);
  });

  it('selects every shown card with Mod+A and leaves with Escape', () => {
    const { board } = setup('workflow');
    fireEvent.keyDown(board, { key: 'a', ctrlKey: true });
    const bar = screen.getByRole('region', { name: 'Bulk actions' });
    expect(within(bar).getByText('4')).toBeTruthy();
    fireEvent.keyDown(board, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).toBeNull();
  });

  it('confirms before deleting the focused card', () => {
    const { board, onChange } = setup('workflow');
    fireEvent.keyDown(board, { key: 'j' });
    fireEvent.keyDown(document.activeElement!, { key: 'Delete' });
    const dialog = screen.getByRole('dialog', { name: 'Delete task' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(onChange).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog', { name: 'Delete task' })).toBeNull();
  });

  it('undoes with Mod+Z only while there is something to undo', () => {
    const first = setup('workflow');
    fireEvent.keyDown(first.board, { key: 'z', ctrlKey: true });
    expect(first.onUndo).not.toHaveBeenCalled();
    cleanup();
    const second = setup('workflow', { undoLabel: 'Task added' });
    fireEvent.keyDown(second.board, { key: 'z', ctrlKey: true });
    expect(second.onUndo).toHaveBeenCalledOnce();
  });

  it('cycles the view with V', () => {
    const { board, onViewChange } = setup('workflow');
    fireEvent.keyDown(board, { key: 'v' });
    expect(onViewChange).toHaveBeenCalledWith('sections');
  });

  it('keeps board shortcuts from firing while the menu has focus', () => {
    setup('workflow');
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.keyDown(document.activeElement!, { key: 'n' });
    expect(screen.queryByRole('dialog', { name: 'New task' })).toBeNull();
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(screen.getByRole('menu')).toBeTruthy();
  });

  it('gives focus back to the menu button when a dialog it opened closes', () => {
    setup('workflow');
    const trigger = screen.getByRole('button', { name: 'More actions' });
    fireEvent.click(trigger);
    fireEvent.click(screen.getByRole('menuitem', { name: /Keyboard shortcuts/ }));
    const help = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    fireEvent.keyDown(help, { key: 'Escape' });
    expect(document.activeElement).toBe(trigger);
  });

  it('opens board settings from the menu and closes the menu', () => {
    setup('workflow');
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Board settings' }));
    expect(screen.getByRole('dialog', { name: 'Board settings' })).toBeTruthy();
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
