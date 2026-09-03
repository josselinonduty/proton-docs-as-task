// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette, type Command } from './CommandPalette';

afterEach(cleanup);

function makeCommands(runAdd = vi.fn(), runRetry = vi.fn()): Command[] {
  return [
    { id: 'add', title: 'Add task', run: runAdd },
    { id: 'search', title: 'Search tasks', run: vi.fn() },
    {
      id: 'retry',
      title: 'Retry failed save',
      disabled: true,
      disabledReason: 'The document is saved',
      run: runRetry,
    },
  ];
}

describe('CommandPalette', () => {
  it('filters commands by query', async () => {
    const user = userEvent.setup();
    render(<CommandPalette commands={makeCommands()} onClose={vi.fn()} />);
    await user.type(screen.getByRole('combobox'), 'search');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toContain('Search tasks');
    expect(options.every((o) => !o.textContent?.includes('Add task'))).toBe(true);
  });

  it('runs the active command on Enter and closes', async () => {
    const user = userEvent.setup();
    const runAdd = vi.fn();
    const onClose = vi.fn();
    render(<CommandPalette commands={makeCommands(runAdd)} onClose={onClose} />);
    await user.keyboard('{Enter}'); // first item active by default
    expect(runAdd).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('does not run a disabled command and explains why', async () => {
    const user = userEvent.setup();
    const runRetry = vi.fn();
    render(<CommandPalette commands={makeCommands(vi.fn(), runRetry)} onClose={vi.fn()} />);
    expect(screen.getByText('The document is saved')).toBeTruthy();
    await user.click(screen.getByText('Retry failed save'));
    expect(runRetry).not.toHaveBeenCalled();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<CommandPalette commands={makeCommands()} onClose={onClose} />);
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
