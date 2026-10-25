// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBar } from './FilterBar';
import { buildPresets, EMPTY_FILTERS, type FilterState } from '@/lib/filters';
import { DEFAULT_STATUSES } from '@/lib/statuses';

const STATUS = [...DEFAULT_STATUSES];

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
        statuses={STATUS}
        onChange={onChange}
        onApplyPreset={onApplyPreset}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Overdue' }));
    expect(onApplyPreset).toHaveBeenCalledWith(expect.objectContaining({ id: 'overdue' }));
  });

  it('routes "My open tasks" to setup instead of applying it without a configured name', async () => {
    const user = userEvent.setup();
    const onApplyPreset = vi.fn();
    const onUnavailablePreset = vi.fn();
    render(
      <FilterBar
        filters={{ ...EMPTY_FILTERS }}
        presets={buildPresets({})}
        statuses={STATUS}
        onChange={vi.fn()}
        onApplyPreset={onApplyPreset}
        onUnavailablePreset={onUnavailablePreset}
      />,
    );
    const mine = screen.getByRole('button', { name: 'My open tasks' });
    // Still reachable by keyboard, but marked unavailable.
    expect((mine as HTMLButtonElement).disabled).toBe(false);
    expect(mine.getAttribute('aria-disabled')).toBe('true');
    await user.click(mine);
    expect(onApplyPreset).not.toHaveBeenCalled();
    expect(onUnavailablePreset).toHaveBeenCalledWith(expect.objectContaining({ id: 'my-open' }));
  });

  it('renders a removable chip for each active filter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const filters: FilterState = { ...EMPTY_FILTERS, assignees: ['Sam'], priorities: ['high'] };
    render(
      <FilterBar
        filters={filters}
        presets={buildPresets({})}
        statuses={STATUS}
        onChange={onChange}
        onApplyPreset={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Remove filter Sam' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ assignees: [] }));
  });
});
