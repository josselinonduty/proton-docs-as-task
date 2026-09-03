// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickAddForm } from './QuickAddForm';

const STATUS = [
  { key: 'todo' as const, label: 'To Do' },
  { key: 'doing' as const, label: 'In Progress' },
  { key: 'done' as const, label: 'Done' },
];

afterEach(cleanup);

function setup() {
  const onSubmit = vi.fn();
  const onClose = vi.fn();
  render(
    <QuickAddForm
      sections={['Build', 'Launch']}
      statusColumns={STATUS}
      assigneeSuggestions={[]}
      labelSuggestions={[]}
      defaultSection="Launch"
      now={new Date(2026, 8, 3)}
      dateFormat="iso"
      onSubmit={onSubmit}
      onClose={onClose}
    />,
  );
  return { onSubmit, onClose };
}

describe('QuickAddForm', () => {
  it('requires a title (submitting empty does nothing)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('creates a task with the defaults (To Do, remembered section)', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.type(screen.getByLabelText(/Task title/), 'Ship it');
    await user.click(screen.getByRole('button', { name: 'Add task' }));
    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Ship it', status: 'todo', section: 'Launch', labels: [] }),
    );
  });

  it('submits on Enter in the title field', async () => {
    const user = userEvent.setup();
    const { onSubmit } = setup();
    await user.type(screen.getByLabelText(/Task title/), 'Quick{Enter}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = setup();
    await user.type(screen.getByLabelText(/Task title/), '{Escape}');
    expect(onClose).toHaveBeenCalled();
  });
});
