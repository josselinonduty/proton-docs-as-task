// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_MARKERS, DEFAULT_SETTINGS } from '../../lib/defaults';
import type { Settings } from '../../lib/types';

const setSettings = vi.hoisted(() => vi.fn());

vi.mock('wxt/browser', () => ({
  browser: { runtime: { getURL: (path: string) => path } },
}));
vi.mock('../../lib/settings', () => ({
  getSettings: async () => DEFAULT_SETTINGS,
  setSettings,
}));

const { App } = await import('./App');

beforeEach(() => {
  setSettings.mockImplementation(async (patch: Partial<Settings>) => ({
    ...DEFAULT_SETTINGS,
    ...patch,
  }));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const markers = () =>
  screen.getByRole<HTMLTextAreaElement>('textbox', { name: 'Activation markers' });
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name });

describe('options page', () => {
  it('saves a setting as soon as it changes', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('checkbox', { name: 'Confirm card deletion' }));
    expect(setSettings).toHaveBeenCalledWith({ confirmDelete: !DEFAULT_SETTINGS.confirmDelete });
    expect(await screen.findByRole('status')).toHaveProperty('textContent', 'Saved');
  });

  it('ties each hint to its control', async () => {
    render(<App />);
    const openIn = await screen.findByRole('combobox', { name: 'Open boards in' });
    const hint = document.getElementById(openIn.getAttribute('aria-describedby')!);
    expect(hint?.textContent).toBe('Follows the view you last used on a board.');
  });

  it('only saves markers on demand, and flags unsaved edits', async () => {
    render(<App />);
    await screen.findByText('Activation markers');
    expect(button('Save markers').disabled).toBe(true);

    fireEvent.change(markers(), { target: { value: '#!todo\n\n  #!plan  ' } });
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    expect(setSettings).not.toHaveBeenCalled();

    fireEvent.click(button('Save markers'));
    expect(setSettings).toHaveBeenCalledWith({ markers: ['#!todo', '#!plan'] });
  });

  it('refuses an empty marker list', async () => {
    render(<App />);
    await screen.findByText('Activation markers');
    fireEvent.change(markers(), { target: { value: '   \n' } });
    fireEvent.click(button('Save markers'));
    expect(screen.getByRole('alert').textContent).toMatch(/at least one activation marker/);
    expect(markers().getAttribute('aria-invalid')).toBe('true');
    expect(setSettings).not.toHaveBeenCalled();
  });

  it('asks before resetting markers to the defaults', async () => {
    render(<App />);
    await screen.findByText('Activation markers');
    fireEvent.change(markers(), { target: { value: '#!todo' } });
    fireEvent.click(button('Reset to defaults'));
    expect(setSettings).not.toHaveBeenCalled();
    expect(screen.getByText('Replace your markers with the defaults?')).toBeTruthy();

    fireEvent.click(button('Reset to defaults'));
    expect(setSettings).toHaveBeenCalledWith({ markers: DEFAULT_MARKERS });
  });
});
