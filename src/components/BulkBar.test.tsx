// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BulkBar } from './BulkBar';

const STATUS = [
  { key: 'todo' as const, label: 'To Do' },
  { key: 'doing' as const, label: 'In Progress' },
  { key: 'done' as const, label: 'Done' },
];

afterEach(cleanup);

function setup(count = 3) {
  const onAction = vi.fn();
  const onRequestDelete = vi.fn();
  const onExit = vi.fn();
  render(
    <BulkBar
      count={count}
      sections={['Build', 'Launch']}
      statusColumns={STATUS}
      labelSuggestions={[]}
      now={new Date(2026, 8, 3)}
      dateFormat="iso"
      onAction={onAction}
      onRequestDelete={onRequestDelete}
      onSelectAll={vi.fn()}
      onClear={vi.fn()}
      onExit={onExit}
    />,
  );
  return { onAction, onRequestDelete, onExit };
}

describe('BulkBar', () => {
  it('shows the selection count', () => {
    setup(3);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('marks the selection complete', async () => {
    const user = userEvent.setup();
    const { onAction } = setup();
    await user.click(screen.getByRole('button', { name: 'Mark complete' }));
    expect(onAction).toHaveBeenCalledWith({ kind: 'complete' });
  });

  it('changes status via the action select', async () => {
    const user = userEvent.setup();
    const { onAction } = setup();
    await user.selectOptions(screen.getByLabelText('Set Status for selection'), 'doing');
    expect(onAction).toHaveBeenCalledWith({ kind: 'status', status: 'doing' });
  });

  it('adds a label to the selection', async () => {
    const user = userEvent.setup();
    const { onAction } = setup();
    await user.type(screen.getByLabelText(/Label for bulk/), 'urgent');
    await user.click(screen.getByRole('button', { name: '+ Label' }));
    expect(onAction).toHaveBeenCalledWith({ kind: 'addLabel', label: 'urgent' });
  });

  it('routes delete through confirmation', async () => {
    const user = userEvent.setup();
    const { onRequestDelete } = setup();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onRequestDelete).toHaveBeenCalled();
  });
});
