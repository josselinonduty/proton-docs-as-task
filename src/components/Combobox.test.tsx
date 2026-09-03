// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Combobox } from './Combobox';
import type { Suggestion } from '../lib/suggestions';

const SUGGESTIONS: Suggestion[] = [
  { value: 'Sam', count: 2 },
  { value: 'Alex', count: 1 },
];

afterEach(cleanup);

function setup(initial = '') {
  const onChange = vi.fn();
  function Wrapper() {
    return (
      <Combobox
        value={initial}
        suggestions={SUGGESTIONS}
        onChange={onChange}
        ariaLabel="Assignee"
        showCounts
      />
    );
  }
  render(<Wrapper />);
  return { onChange, input: screen.getByRole('combobox') };
}

describe('Combobox', () => {
  it('filters suggestions as you type and selects with keyboard', async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();
    await user.click(input);
    await user.type(input, 'al');
    expect(screen.getByRole('option', { name: /Alex/ })).toBeTruthy();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('Alex');
  });

  it('reuses existing capitalization when a typed value matches', async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();
    await user.click(input);
    await user.type(input, 'sam');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('Sam');
  });

  it('accepts a brand-new value', async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();
    await user.click(input);
    await user.type(input, 'Jordan');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith('Jordan');
  });

  it('exposes a listbox with option counts', async () => {
    const user = userEvent.setup();
    const { input } = setup();
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeTruthy();
    // Both suggestions plus their counts render.
    expect(screen.getByText('Sam')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });
});
