// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DueDateControl } from './DueDateControl';

const NOW = new Date(2026, 8, 3); // Wed 2026-09-03

afterEach(cleanup);

function setup(value?: string) {
  const onChange = vi.fn();
  render(
    <DueDateControl
      value={value}
      onChange={onChange}
      now={NOW}
      format="iso"
      ariaLabel="Due date"
    />,
  );
  return { onChange };
}

describe('DueDateControl', () => {
  it('shows a relative state on the trigger', () => {
    setup('2026-09-03');
    expect(screen.getByRole('button', { name: /Due today/ })).toBeTruthy();
  });

  it('picks a deterministic date from a quick option', async () => {
    const user = userEvent.setup();
    const { onChange } = setup();
    await user.click(screen.getByRole('button', { name: /Due date/ }));
    await user.click(screen.getByRole('button', { name: 'This weekend' }));
    expect(onChange).toHaveBeenCalledWith('2026-09-05'); // coming Saturday
  });

  it('clears the date', async () => {
    const user = userEvent.setup();
    const { onChange } = setup('2026-09-10');
    await user.click(screen.getByRole('button', { name: /Due date/ }));
    await user.click(screen.getByRole('button', { name: 'Clear date' }));
    expect(onChange).toHaveBeenCalledWith(undefined);
  });
});
