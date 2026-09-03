// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';
import { buildPresets, EMPTY_FILTERS, type FilterState } from '../lib/filters';

const STATUS = [
  { key: 'todo' as const, label: 'To Do' },
  { key: 'doing' as const, label: 'In Progress' },
  { key: 'done' as const, label: 'Done' },
];

afterEach(cleanup);

describe('FilterBar', () => {
  it('applies a preset', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onApplyPreset = vi.fn();
    render(
      <FilterBar
        filters={{ ...EMPTY_FILTERS }}
        presets={buildPresets({})}
        statusColumns={STATUS}
        onChange={onChange}
        onApplyPreset={onApplyPreset}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Overdue' }));
    expect(onApplyPreset).toHaveBeenCalledWith(expect.objectContaining({ id: 'overdue' }));
  });

  it('disables "My open tasks" without a configured name', () => {
    render(
      <FilterBar
        filters={{ ...EMPTY_FILTERS }}
        presets={buildPresets({})}
        statusColumns={STATUS}
        onChange={vi.fn()}
        onApplyPreset={vi.fn()}
      />,
    );
    expect(
      (screen.getByRole('button', { name: 'My open tasks' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('renders a removable chip for each active filter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const filters: FilterState = { ...EMPTY_FILTERS, assignees: ['Sam'], priorities: ['high'] };
    render(
      <FilterBar
        filters={filters}
        presets={buildPresets({})}
        statusColumns={STATUS}
        onChange={onChange}
        onApplyPreset={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Remove filter Sam' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ assignees: [] }));
  });
});
