// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SectionNameInput } from './SectionNameInput';

afterEach(cleanup);

function setup(name = 'Backend', otherNames = ['Frontend']) {
  const onRename = vi.fn();
  const onInvalid = vi.fn();
  render(
    <SectionNameInput
      name={name}
      otherNames={otherNames}
      onRename={onRename}
      onInvalid={onInvalid}
    />,
  );
  const input = screen.getByRole('textbox', { name: `Section name: ${name}` });
  return { input: input as HTMLInputElement, onRename, onInvalid };
}

describe('SectionNameInput', () => {
  it('keeps focus while typing and renames once, on Enter', async () => {
    const user = userEvent.setup();
    const { input, onRename } = setup();
    await user.click(input);
    await user.keyboard('{End} API');
    expect(document.activeElement).toBe(input);
    expect(onRename).not.toHaveBeenCalled();
    await user.keyboard('{Enter}');
    expect(onRename).toHaveBeenCalledTimes(1);
    expect(onRename).toHaveBeenCalledWith('Backend API', true);
  });

  it('commits on blur', async () => {
    const user = userEvent.setup();
    const { input, onRename } = setup();
    await user.click(input);
    await user.keyboard('{End}s');
    await user.tab();
    expect(onRename).toHaveBeenCalledWith('Backends', false);
  });

  it('refuses a name that would merge two sections, and keeps the old one', async () => {
    const user = userEvent.setup();
    const { input, onRename, onInvalid } = setup();
    await user.clear(input);
    await user.type(input, 'Frontend');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    await user.keyboard('{Enter}');
    expect(onRename).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalledWith(expect.stringContaining('already exists'));
    expect(input.value).toBe('Backend');
  });

  it('refuses an empty name', async () => {
    const user = userEvent.setup();
    const { input, onRename, onInvalid } = setup();
    await user.clear(input);
    await user.tab();
    expect(onRename).not.toHaveBeenCalled();
    expect(onInvalid).toHaveBeenCalled();
    expect(input.value).toBe('Backend');
  });

  it('reverts on Escape', async () => {
    const user = userEvent.setup();
    const { input, onRename } = setup();
    await user.click(input);
    await user.keyboard('{End}zzz{Escape}');
    expect(input.value).toBe('Backend');
    await user.tab();
    expect(onRename).not.toHaveBeenCalled();
  });
});
