// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { ApplyResult, EditorStateMessage } from '@/lib/bridgeProtocol';
import type { EditorClient } from '@/lib/editorClient';
import type { AddTaskResponse, QuickAddTask } from '@/lib/messaging';
import { DEFAULT_SETTINGS } from '@/lib/defaults';

/** The popup command listeners the overlay registered, by message type. */
const messageListeners = vi.hoisted(
  () => new Map<string, (message: { data: unknown }) => unknown>(),
);

vi.mock('@webext-core/messaging', () => ({
  defineExtensionMessaging: () => ({
    sendMessage: vi.fn(),
    onMessage: (type: string, fn: (message: { data: unknown }) => unknown) => {
      messageListeners.set(type, fn);
      return () => messageListeners.delete(type);
    },
  }),
}));
vi.mock('@/lib/settings', () => ({
  settingsItem: { watch: () => () => {} },
  setSettings: vi.fn(),
}));
vi.mock('@/lib/sessionStore', async () => {
  const session = await import('@/lib/session');
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
    const data: QuickAddTask = { title };
    response = Promise.resolve(
      messageListeners.get('add-task')!({ data }),
    ) as Promise<AddTaskResponse>;
  });
  return response;
}

afterEach(() => {
  vi.useRealTimers();
  cleanup();
  messageListeners.clear();
});

describe('OverlayApp document sync', () => {
  it('folds changes made elsewhere into the open board, without a conflict prompt', () => {
    const editor = setup();
    expect(screen.getByText('Write the spec')).toBeTruthy();
    editor.remoteEdit([...DOC, '- [ ] Review on mobile']);
    expect(screen.getByText('Review on mobile')).toBeTruthy();
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
    expect(screen.getByText('Queued while offline')).toBeTruthy();

    editor.setEditable(true);
    expect(editor.lines).toContain('- [ ] Queued while offline');
    expect(screen.queryByText('Waiting to save')).toBeNull();
  });

  it('keeps a typed edit pending through a remote change, then merges against what it read', () => {
    vi.useFakeTimers();
    const editor = setup();
    // Titles are edited in the details panel the card opens.
    fireEvent.click(screen.getByText('Write the spec'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Task title' }), {
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

describe('OverlayApp board interactions', () => {
  it('opens a card in the details panel and returns focus to it on Escape', () => {
    setup();
    const card = screen.getByRole('listitem', { name: /Write the spec/ });
    fireEvent.click(card);
    const panel = screen.getByRole('complementary', { name: /Task details: Write the spec/ });
    expect(panel).toBeTruthy();
    fireEvent.keyDown(panel, { key: 'Escape' });
    expect(screen.queryByRole('complementary', { name: /Task details/ })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('listitem', { name: /Write the spec/ }));
  });

  it('keeps card shortcuts on the card: Space on a header button does not select a card', () => {
    setup();
    const card = screen.getByRole('listitem', { name: /Write the spec/ });
    act(() => card.focus());
    const filters = screen.getByRole('button', { name: /Filters/ });
    act(() => filters.focus());
    fireEvent.keyDown(filters, { key: ' ' });
    expect(screen.queryByRole('region', { name: 'Bulk actions' })).toBeNull();
    // …while on the card itself it still selects.
    act(() => card.focus());
    fireEvent.keyDown(card, { key: ' ' });
    expect(screen.getByRole('region', { name: 'Bulk actions' })).toBeTruthy();
  });

  it('shows the board title and progress in the header', () => {
    setup(['#!tasks Sprint 42', '', '## Tasks', '- [x] Done one', '- [ ] Open one']);
    expect(screen.getByRole('heading', { name: 'Sprint 42' })).toBeTruthy();
    expect(screen.getByText('1 of 2 done')).toBeTruthy();
  });
});

describe('OverlayApp per-document statuses', () => {
  const FLOW = [
    '#!tasks Flow',
    '@settings status todo "To Do" @category:todo',
    '@settings status review "In review" @category:doing @color:purple',
    '@settings status done "Done" @category:done',
    '',
    '## Tasks',
    '- [ ] Write the spec @status:review',
  ];

  it('shows the document statuses as workflow columns', () => {
    setup(FLOW);
    expect(screen.getByRole('textbox', { name: 'Status name: In review' })).toBeTruthy();
    expect(screen.queryByRole('textbox', { name: 'Status name: In Progress' })).toBeNull();
  });

  it('writes the built-in statuses into a document only with its first board write', async () => {
    const editor = setup();
    expect(editor.writes).toHaveLength(0);
    await addTaskFromPopup('First edit');
    expect(editor.lines.slice(0, 4)).toEqual([
      '#!tasks Board',
      '@settings status todo "To Do" @category:todo',
      '@settings status doing "In Progress" @category:doing',
      '@settings status done "Done" @category:done',
    ]);
  });

  it('renames a status from its column header and its key', () => {
    vi.useFakeTimers();
    const editor = setup(FLOW);
    const input = screen.getByRole('textbox', { name: 'Status name: In review' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'QA' } });
    fireEvent.blur(input);
    act(() => void vi.advanceTimersByTime(400));
    expect(editor.lines).toContain('@settings status qa "QA" @category:doing @color:purple');
    expect(editor.lines).toContain('- [ ] Write the spec @status:qa');
  });

  it('adds a status from board settings', () => {
    vi.useFakeTimers();
    const editor = setup(FLOW);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Board settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Board settings' });
    fireEvent.click(within(dialog).getByRole('button', { name: /Add status/ }));
    act(() => void vi.advanceTimersByTime(400));
    expect(editor.lines).toContain('@settings status new-status "New status" @category:doing');
  });

  it('asks where tasks go before deleting a status that has some', () => {
    vi.useFakeTimers();
    const editor = setup(FLOW);
    fireEvent.click(screen.getByRole('button', { name: 'Delete status In review' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete status “In review”' });
    fireEvent.change(within(dialog).getByRole('combobox', { name: 'Move tasks to' }), {
      target: { value: 'done' },
    });
    fireEvent.click(within(dialog).getByRole('button', { name: /Move tasks/ }));
    act(() => void vi.advanceTimersByTime(400));
    expect(editor.lines.some((l) => l.includes('status review'))).toBe(false);
    expect(editor.lines).toContain('- [x] Write the spec');
  });

  it('stacks the status delete confirmation over board settings', () => {
    const showModal = vi.spyOn(HTMLDialogElement.prototype, 'showModal');
    setup(FLOW);
    fireEvent.click(screen.getByRole('button', { name: 'More actions' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Board settings' }));
    const settings = screen.getByRole('dialog', { name: 'Board settings' });
    fireEvent.click(within(settings).getByRole('button', { name: 'Delete status In review' }));
    const confirm = screen.getByRole('dialog', { name: 'Delete status “In review”' });
    expect(showModal.mock.contexts).toEqual([settings, confirm]);
    fireEvent.keyDown(within(confirm).getByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: /Delete status/ })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Board settings' })).toBe(settings);
    showModal.mockRestore();
  });

  it('blocks the board until tasks with a missing status are moved', () => {
    vi.useFakeTimers();
    const editor = setup([...FLOW, '- [ ] Lost one @status:qa', '- [ ] Lost two @status:qa']);
    const dialog = screen.getByRole('dialog', { name: 'Some tasks have a missing status' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Some tasks have a missing status' })).toBeTruthy();
    expect(within(dialog).getByText('2 tasks')).toBeTruthy();

    fireEvent.change(
      within(dialog).getByRole('combobox', { name: 'Move tasks with status qa to' }),
      { target: { value: 'review' } },
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Move tasks' }));
    act(() => void vi.advanceTimersByTime(400));
    expect(screen.queryByRole('dialog', { name: /missing status/ })).toBeNull();
    expect(editor.lines).toContain('- [ ] Lost one @status:review');
    expect(editor.lines).toContain('- [ ] Lost two @status:review');
  });

  it('lets the user create the missing status from board settings instead', () => {
    setup([...FLOW, '- [ ] Lost @status:qa']);
    fireEvent.click(screen.getByRole('button', { name: 'Open board settings' }));
    expect(screen.getByRole('dialog', { name: 'Board settings' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: /missing status/ })).toBeNull();
  });
});
