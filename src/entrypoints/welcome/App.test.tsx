// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

const tabs = vi.hoisted(() => ({
  query: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));
const setSettings = vi.hoisted(() => vi.fn());

vi.mock('wxt/browser', () => ({
  browser: {
    tabs,
    windows: { update: vi.fn() },
    runtime: { openOptionsPage: vi.fn() },
  },
}));
vi.mock('@/lib/settings', () => ({
  getSettings: async () => DEFAULT_SETTINGS,
  setSettings,
}));

const { App } = await import('./App');

beforeEach(() => {
  tabs.query.mockResolvedValue([]);
  setSettings.mockResolvedValue(DEFAULT_SETTINGS);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const radio = (name: RegExp) => screen.getByRole<HTMLInputElement>('radio', { name });
const pick = (name: string) =>
  fireEvent.click(screen.getByRole('radio', { name: new RegExp(name) }));

describe('welcome page', () => {
  it('preselects the defaults and shows progress', async () => {
    render(<App />);
    await screen.findByRole('radiogroup');
    expect(radio(/Kanban board/).checked).toBe(true);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuetext')).toBe('Step 1 of 3');
  });

  it('saves the layout and status flow once, at the end', async () => {
    render(<App />);
    await screen.findByRole('radiogroup');
    pick('Swimlanes');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(setSettings).not.toHaveBeenCalled();

    pick('With review');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.change(screen.getByLabelText('Theme'), { target: { value: 'dark' } });
    fireEvent.change(screen.getByLabelText('Card density'), { target: { value: 'comfortable' } });
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));

    expect(await screen.findByRole('heading', { name: "You're all set" })).toBeTruthy();
    expect(setSettings).toHaveBeenCalledTimes(1);
    expect(setSettings).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultView: 'swimlane',
        defaultStatuses: 'review',
        theme: 'dark',
        density: 'comfortable',
      }),
    );
  });

  it('writes nothing when skipped', async () => {
    render(<App />);
    await screen.findByRole('radiogroup');
    fireEvent.click(screen.getByRole('button', { name: 'Skip, use defaults' }));
    expect(await screen.findByText(/Default settings are kept/)).toBeTruthy();
    expect(setSettings).not.toHaveBeenCalled();
  });

  it('lets the user go back without losing a choice', async () => {
    render(<App />);
    await screen.findByRole('radiogroup');
    pick('Simple list');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(radio(/Simple list/).checked).toBe(true);
  });

  it('suggests the layout density but keeps a later choice', async () => {
    render(<App />);
    await screen.findByRole('radiogroup');
    pick('Simple list');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByLabelText<HTMLSelectElement>('Card density').value).toBe('compact');
  });

  it('reports a failed save and lets the user retry', async () => {
    setSettings.mockRejectedValueOnce(new Error('quota'));
    render(<App />);
    await screen.findByRole('radiogroup');
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect((await screen.findByRole('alert')).textContent).toContain("couldn't be saved");

    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('heading', { name: "You're all set" })).toBeTruthy();
  });

  it('focuses an open Proton Docs tab instead of opening another', async () => {
    tabs.query.mockResolvedValue([{ id: 7, windowId: 2 }]);
    render(<App />);
    await screen.findByRole('radiogroup');
    fireEvent.click(screen.getByRole('button', { name: 'Skip, use defaults' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Go to Proton Docs' }));
    await vi.waitFor(() => expect(tabs.update).toHaveBeenCalledWith(7, { active: true }));
    expect(tabs.create).not.toHaveBeenCalled();
  });
});
