// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { LabelInput } from './LabelInput';
import type { Suggestion } from '../lib/suggestions';

const SUGGESTIONS: Suggestion[] = [
  { value: 'api', count: 3 },
  { value: 'Backend', count: 1 },
];

afterEach(cleanup);

function setup(initial: string[] = []) {
  const onChange = vi.fn();
  function Wrapper() {
    const [labels, setLabels] = useState(initial);
    return (
      <LabelInput
        labels={labels}
        suggestions={SUGGESTIONS}
        onChange={(next) => {
          setLabels(next);
          onChange(next);
        }}
      />
    );
  }
  render(<Wrapper />);
  return { onChange, input: screen.getByRole('combobox') };
}

describe('LabelInput', () => {
  it('adds a label on Enter and clears the input', async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();
    await user.type(input, 'design');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['design']);
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('adds on comma too', async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();
    await user.type(input, 'ui,');
    expect(onChange).toHaveBeenLastCalledWith(['ui']);
  });

  it('prevents case-insensitive duplicates', async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup(['api']);
    await user.type(input, 'API');
    await user.keyboard('{Enter}');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('removes the last label on Backspace when empty', async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup(['api', 'ui']);
    input.focus();
    await user.keyboard('{Backspace}');
    expect(onChange).toHaveBeenLastCalledWith(['api']);
  });

  it('reuses existing capitalization from suggestions', async () => {
    const user = userEvent.setup();
    const { onChange, input } = setup();
    await user.type(input, 'backend');
    await user.keyboard('{Enter}');
    expect(onChange).toHaveBeenLastCalledWith(['Backend']);
  });

  it('removes a chip via its button', async () => {
    const user = userEvent.setup();
    const { onChange } = setup(['api']);
    await user.click(screen.getByRole('button', { name: /Remove label api/ }));
    expect(onChange).toHaveBeenLastCalledWith([]);
  });
});
