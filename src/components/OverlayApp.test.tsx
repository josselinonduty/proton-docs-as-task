// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ApplyResult, EditorStateMessage } from '../lib/bridgeProtocol';
import type { EditorClient } from '../lib/editorClient';
import type { AddTaskResponse, ContentMessage } from '../lib/messaging';
import { DEFAULT_SETTINGS } from '../lib/defaults';

const messageListeners = vi.hoisted(() => [] as Array<(message: ContentMessage) => unknown>);

vi.mock('wxt/browser', () => ({
  browser: {
    runtime: {
      sendMessage: vi.fn(),
      onMessage: {
        addListener: (fn: (message: ContentMessage) => unknown) => messageListeners.push(fn),
        removeListener: (fn: (message: ContentMessage) => unknown) =>
          messageListeners.splice(messageListeners.indexOf(fn), 1),
      },
    },
  },
}));
vi.mock('../lib/settings', async () => {
  const defaults = await import('../lib/defaults');
  return {
    settingsItem: { watch: () => () => {} },
    setSettings: vi.fn(),
    withDefaults: defaults.withDefaults,
  };
});
vi.mock('../lib/sessionStore', async () => {
  const session = await import('../lib/session');
  return {
    readDocPrefs: async () => session.DEFAULT_SESSION,
    writeDocPrefs: async () => {},
  };
});

const { OverlayApp } = await import('./OverlayApp');

/** A stand-in for the editor bridge: a document Proton could lock or change. */
class FakeEditor implements EditorClient {
  lines: string[];
  editable = true;
  state: EditorStateMessage;
  writes: Array<{ base: string[]; target: string[] }> = [];
  private listeners = new Set<(state: EditorStateMessage) => void>();
  readonly ready: Promise<EditorStateMessage>;

  constructor(lines: string[]) {
    this.lines = lines;
    this.state = this.snapshot('initial');
    this.ready = Promise.resolve(this.state);
  }

  private snapshot(origin: EditorStateMessage['origin']): EditorStateMessage {
    return { text: this.lines.join('\n'), editable: this.editable, origin };
  }

  private emit(origin: EditorStateMessage['origin']) {
    this.state = this.snapshot(origin);
    this.listeners.forEach((listener) => listener(this.state));
  }

  subscribe(listener: (state: EditorStateMessage) => void) {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  }

  apply(base: string[], target: string[]): ApplyResult {
    this.writes.push({ base, target });
    if (!this.editable) return { ok: false, reason: 'readonly' };
    this.lines = target;
    this.emit('self');
    return { ok: true, lines: target };
  }

  /** Someone else (another device, a collaborator) edited the document. */
  remoteEdit(lines: string[]) {
    act(() => {
      this.lines = lines;
      this.emit('remote');
    });
  }

  setEditable(editable: boolean) {
    act(() => {
      this.editable = editable;
      this.emit('local');
    });
  }

  stop() {}
}

const DOC = ['#!tasks Board', '', '## Tasks', '- [ ] Write the spec'];

function setup(lines = DOC) {
  const editor = new FakeEditor(lines);
  render(
    <OverlayApp
      client={editor}
      initialState={editor.state}
      host={document.createElement('div')}
      initialSettings={{ ...DEFAULT_SETTINGS, autoShow: true }}
    />,
  );
  return editor;
}

/** Send the popup's quick-add message to the overlay. */
function addTaskFromPopup(title: string): Promise<AddTaskResponse> {
  let response!: Promise<AddTaskResponse>;
  act(() => {
    response = messageListeners.at(-1)!({ type: 'add-task', title }) as Promise<AddTaskResponse>;
  });
  return response;
}

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  messageListeners.length = 0;
});

describe('OverlayApp document sync', () => {
  it('folds changes made elsewhere into the open board, without a conflict prompt', () => {
    const editor = setup();
    expect(screen.getByDisplayValue('Write the spec')).toBeTruthy();
    editor.remoteEdit([...DOC, '- [ ] Review on mobile']);
    expect(screen.getByDisplayValue('Review on mobile')).toBeTruthy();
    expect(screen.queryByText(/underlying document changed/i)).toBeNull();
    expect(editor.writes).toHaveLength(0);
  });

  it('writes board edits against the document it last read, so changes merge', async () => {
    const editor = setup();
    editor.remoteEdit([...DOC, '- [ ] From another device']);
    const response = await addTaskFromPopup('From the popup');
    expect(response.added).toBe(true);
    const write = editor.writes.at(-1)!;
    expect(write.base).toEqual([...DOC, '- [ ] From another device']);
    expect(write.target).toContain('- [ ] From another device');
    expect(write.target).toContain('- [ ] From the popup');
  });

  it('holds edits while Proton has editing locked and saves them once it unlocks', async () => {
    const editor = setup();
    editor.setEditable(false);
    const response = await addTaskFromPopup('Queued while offline');
    expect(response.added).toBe(false);
    expect(response.error).toBe('read-only');
    expect(screen.getByText('Waiting to save')).toBeTruthy();
    expect(screen.getByDisplayValue('Queued while offline')).toBeTruthy();

    editor.setEditable(true);
    expect(editor.lines).toContain('- [ ] Queued while offline');
    expect(screen.queryByText('Waiting to save')).toBeNull();
  });

  it('keeps a typed edit pending through a remote change, then merges against what it read', () => {
    vi.useFakeTimers();
    const editor = setup();
    fireEvent.change(screen.getByDisplayValue('Write the spec'), {
      target: { value: 'Write the full spec' },
    });
    // Arrives during the write debounce: must not wipe the typed title.
    editor.remoteEdit([...DOC, '- [ ] From another device']);
    expect(screen.getByDisplayValue('Write the full spec')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(400));
    const write = editor.writes.at(-1)!;
    // Based on the document the edit was made against; the bridge merges the
    // remote line back in.
    expect(write.base).toEqual(DOC);
    expect(write.target).toContain('- [ ] Write the full spec');
  });
});
