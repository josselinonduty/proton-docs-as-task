import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ApplyFailure, ApplyResult, EditorOrigin, EditorStateMessage } from './bridgeProtocol';
import {
  UNDO_TIMEOUT_MS,
  WRITE_DEBOUNCE_MS,
  createBoardSession,
  type BoardNotice,
} from './boardSession';
import { DEFAULT_MARKERS } from './defaults';
import { mergeLines } from './lineMerge';
import { addTask, fromParseResult, serializeModel, updateTask, type BoardModel } from './model';
import { parseDocument } from './parser';

/** A stand-in for the editor bridge that merges writes like the real one. */
class FakeEditor {
  lines: string[];
  editable = true;
  /** When set, the next writes fail with this reason. */
  failWith: ApplyFailure | null = null;
  state: EditorStateMessage;
  writes: Array<{ base: string[]; target: string[] }> = [];
  listeners = new Set<(state: EditorStateMessage) => void>();

  constructor(lines: string[]) {
    this.lines = lines;
    this.state = this.snapshot('initial');
  }

  private snapshot(origin: EditorOrigin): EditorStateMessage {
    return { text: this.lines.join('\n'), editable: this.editable, origin };
  }

  emit(origin: EditorOrigin) {
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
    if (this.failWith) return { ok: false, reason: this.failWith };
    this.lines = mergeLines(base, target, this.lines);
    this.emit('self');
    return { ok: true, lines: this.lines };
  }

  remoteEdit(lines: string[]) {
    this.lines = lines;
    this.emit('remote');
  }

  setEditable(editable: boolean) {
    this.editable = editable;
    this.emit('local');
  }
}

const MARKERS = DEFAULT_MARKERS;
const DOC = ['#!tasks Board', '', '## Tasks', '- [ ] Write the spec'];

function setup(lines = DOC) {
  const editor = new FakeEditor(lines);
  const session = createBoardSession({
    client: editor,
    initialState: editor.state,
    markers: MARKERS,
  });
  const notices: BoardNotice[] = [];
  session.onNotice((notice) => notices.push(notice));
  session.start();
  return { editor, session, notices };
}

/** The open board with its first task retitled. */
function retitled(model: BoardModel, title: string) {
  return updateTask(model, model.tasks[0]!.id, { title });
}

function withTask(model: BoardModel, title: string) {
  return addTask(model, model.sections[0]!, { status: 'todo', title }).model;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('boardSession writes', () => {
  it('coalesces edits made within the debounce into one write', () => {
    const { editor, session } = setup();
    session.open();
    const model = session.getSnapshot().model!;
    session.edit(retitled(model, 'Write'));
    session.edit(retitled(model, 'Write the full'));
    session.edit(retitled(model, 'Write the full spec'));
    expect(session.getSnapshot().saveState).toBe('saving');
    expect(editor.writes).toHaveLength(0);

    vi.advanceTimersByTime(WRITE_DEBOUNCE_MS - 1);
    expect(editor.writes).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(editor.writes).toHaveLength(1);
    expect(editor.lines).toContain('- [ ] Write the full spec');
    expect(session.getSnapshot().saveState).toBe('saved');
    expect(session.hasPending()).toBe(false);
  });

  it('writes immediately when asked, and reports success', () => {
    const { editor, session } = setup();
    session.open();
    const next = withTask(session.getSnapshot().model!, 'Now');
    expect(session.commit(next, true)).toBe(true);
    expect(editor.lines).toContain('- [ ] Now');
    expect(session.getSnapshot().model).toBe(next);
  });

  it('writes a pending edit on dispose, then stops following the document', () => {
    const { editor, session } = setup();
    session.open();
    session.edit(retitled(session.getSnapshot().model!, 'Written on unmount'));
    session.dispose();
    expect(editor.writes).toHaveLength(1);
    expect(editor.lines).toContain('- [ ] Written on unmount');

    const before = session.getSnapshot();
    editor.remoteEdit([...DOC, '- [ ] After dispose']);
    expect(session.getSnapshot()).toBe(before);
    // The debounce timer was settled by the flush; nothing else is written.
    vi.runAllTimers();
    expect(editor.writes).toHaveLength(1);
  });

  it('can start again after dispose (React StrictMode remounts)', () => {
    const { editor, session } = setup();
    session.dispose();
    session.start();
    editor.remoteEdit([...DOC, '- [ ] Seen']);
    expect(session.getSnapshot().docState.text).toContain('Seen');
  });

  it('writes straight to the document while the board is closed', () => {
    const { editor, session } = setup();
    const next = withTask(fromParseResult(session.readDocument()), 'Detached');
    const res = session.write(next);
    expect(res.ok).toBe(true);
    expect(editor.writes.at(-1)!.base).toEqual(DOC);
    expect(session.getSnapshot().model).toBeNull();
    expect(session.readDocument().tasks.map((t) => t.title)).toContain('Detached');
  });
});

describe('boardSession following the document', () => {
  it('folds a change made elsewhere into the open board', () => {
    const { editor, session, notices } = setup();
    session.open();
    const before = session.getSnapshot().model!;
    editor.remoteEdit([...DOC, '- [ ] From another device']);
    const after = session.getSnapshot().model!;
    expect(after.tasks.map((t) => t.title)).toEqual(['Write the spec', 'From another device']);
    // Task identity survives the re-parse.
    expect(after.tasks[0]!.id).toBe(before.tasks[0]!.id);
    expect(notices).toEqual(['updated']);
    expect(editor.writes).toHaveLength(0);
  });

  it('ignores a cosmetic change that means the same board', () => {
    const { editor, session, notices } = setup();
    session.open();
    const model = session.getSnapshot().model;
    editor.remoteEdit([...DOC, '']);
    expect(session.getSnapshot().model).toBe(model);
    expect(notices).toEqual([]);
  });

  it('ignores the echo of its own write', () => {
    const { editor, session, notices } = setup();
    session.open();
    const model = session.getSnapshot().model;
    // A self-origin state is accounted for by the write that caused it.
    editor.lines = [...DOC, '- [ ] Not followed'];
    editor.emit('self');
    expect(session.getSnapshot().model).toBe(model);
    expect(session.getSnapshot().docState.origin).toBe('self');
    expect(notices).toEqual([]);
  });

  it('keeps a pending edit through a remote change, then three-way merges it', () => {
    // A board already in canonical form, so the write only touches the edited task.
    const board = serializeModel(
      fromParseResult(parseDocument([...DOC, '- [ ] Second', '- [ ] Third'].join('\n'), MARKERS)),
      '#!tasks',
    ).split('\n');
    const { editor, session, notices } = setup(board);
    session.open();
    session.edit(retitled(session.getSnapshot().model!, 'Write the full spec'));
    // Arrives during the debounce: must not wipe the typed title.
    editor.remoteEdit([...board, '- [ ] From another device']);
    expect(session.getSnapshot().model!.tasks.map((t) => t.title)).toEqual([
      'Write the full spec',
      'Second',
      'Third',
    ]);

    vi.advanceTimersByTime(WRITE_DEBOUNCE_MS);
    // Based on the document the edit was made against…
    expect(editor.writes.at(-1)!.base).toEqual(board);
    // …so the merge keeps both, and the board shows the result.
    expect(editor.lines).toContain('- [ ] Write the full spec');
    expect(editor.lines).toContain('- [ ] From another device');
    expect(session.getSnapshot().model!.tasks.map((t) => t.title)).toEqual([
      'Write the full spec',
      'Second',
      'Third',
      'From another device',
    ]);
    expect(notices).toEqual(['updated']);
  });

  it('bases the next write on the latest document it followed', () => {
    const { editor, session } = setup();
    session.open();
    editor.remoteEdit([...DOC, '- [ ] From another device']);
    session.commit(withTask(session.getSnapshot().model!, 'Mine'), true);
    expect(editor.writes.at(-1)!.base).toEqual([...DOC, '- [ ] From another device']);
  });

  it('catches up on start with a state reported before it subscribed', () => {
    const editor = new FakeEditor(DOC);
    const session = createBoardSession({
      client: editor,
      initialState: editor.state,
      markers: MARKERS,
    });
    editor.remoteEdit([...DOC, '- [ ] Early']);
    session.start();
    expect(session.getSnapshot().docState.text).toContain('Early');
    session.open();
    expect(session.getSnapshot().model!.tasks).toHaveLength(2);
  });

  it('normalizes hand-written status tokens when the board opens', () => {
    const { editor, session } = setup(['#!tasks', '- [ ] bar @status:done']);
    session.open();
    expect(editor.writes).toHaveLength(1);
    expect(editor.lines).toContain('- [x] bar');
  });

  it('drops the board on close and on clear', () => {
    const { session } = setup();
    session.open();
    session.close();
    expect(session.getSnapshot().model).toBeNull();
    session.open();
    session.clear();
    expect(session.getSnapshot().model).toBeNull();
  });
});

describe('boardSession when writes fail', () => {
  it('holds edits while editing is locked and writes them once it unlocks', () => {
    const { editor, session } = setup();
    session.open();
    editor.setEditable(false);
    const next = withTask(session.getSnapshot().model!, 'Queued while offline');
    expect(session.commit(next, true)).toBe(false);
    expect(session.getSnapshot().saveState).toBe('paused');
    expect(session.hasPending()).toBe(true);
    expect(editor.lines).not.toContain('- [ ] Queued while offline');

    editor.setEditable(true);
    expect(editor.lines).toContain('- [ ] Queued while offline');
    expect(session.getSnapshot().saveState).toBe('saved');
    expect(session.hasPending()).toBe(false);
  });

  it('waits for the debounce rather than writing early on unlock', () => {
    const { editor, session } = setup();
    session.open();
    session.edit(withTask(session.getSnapshot().model!, 'Typed'));
    editor.setEditable(true);
    expect(editor.writes).toHaveLength(0);
    vi.advanceTimersByTime(WRITE_DEBOUNCE_MS);
    expect(editor.writes).toHaveLength(1);
  });

  it('reopens a locked board from its pending edit, not the document', () => {
    const { editor, session } = setup();
    session.open();
    editor.setEditable(false);
    const next = withTask(session.getSnapshot().model!, 'Pending');
    session.commit(next, true);
    session.close();
    expect(session.getSnapshot().model).toBeNull();
    session.open();
    expect(session.getSnapshot().model).toBe(next);
  });

  it('flags a failed write and retries it', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { editor, session } = setup();
    session.open();
    editor.failWith = 'failed';
    session.commit(withTask(session.getSnapshot().model!, 'Retry me'), true);
    expect(session.getSnapshot().saveState).toBe('error');
    expect(console.warn).toHaveBeenCalled();

    editor.failWith = null;
    session.retry();
    expect(editor.lines).toContain('- [ ] Retry me');
    expect(session.getSnapshot().saveState).toBe('saved');
  });

  it('reloads from the document, discarding the pending edit', () => {
    const { editor, session, notices } = setup();
    session.open();
    editor.setEditable(false);
    session.commit(withTask(session.getSnapshot().model!, 'Discarded'), true);
    session.reload();
    expect(session.hasPending()).toBe(false);
    expect(session.getSnapshot().saveState).toBe('saved');
    expect(session.getSnapshot().model!.tasks.map((t) => t.title)).toEqual(['Write the spec']);
    expect(notices).toEqual(['reloaded']);

    editor.setEditable(true);
    expect(editor.lines).toEqual(DOC);
  });
});

describe('boardSession undo', () => {
  it('reverts a labelled edit', () => {
    const { session, notices } = setup();
    session.open();
    const original = session.getSnapshot().model!;
    session.edit(withTask(original, 'Oops'), 'Task added');
    expect(session.getSnapshot().undo).toEqual({ model: original, label: 'Task added' });
    session.undo();
    expect(session.getSnapshot().model).toBe(original);
    expect(session.getSnapshot().undo).toBeNull();
    expect(notices).toEqual(['undone']);
  });

  it('offers no undo for an unlabelled edit', () => {
    const { session } = setup();
    session.open();
    session.edit(withTask(session.getSnapshot().model!, 'Quiet'));
    expect(session.getSnapshot().undo).toBeNull();
  });

  it('withdraws the undo after a while, a newer one restarting the clock', () => {
    const { session } = setup();
    session.open();
    session.edit(withTask(session.getSnapshot().model!, 'One'), 'One');
    vi.advanceTimersByTime(UNDO_TIMEOUT_MS - 1000);
    session.edit(withTask(session.getSnapshot().model!, 'Two'), 'Two');
    vi.advanceTimersByTime(UNDO_TIMEOUT_MS - 1000);
    expect(session.getSnapshot().undo?.label).toBe('Two');
    vi.advanceTimersByTime(1000);
    expect(session.getSnapshot().undo).toBeNull();
  });

  it('withdraws the undo once the document changed elsewhere', () => {
    const { editor, session } = setup();
    session.open();
    session.edit(withTask(session.getSnapshot().model!, 'Mine'), 'Mine');
    vi.advanceTimersByTime(WRITE_DEBOUNCE_MS);
    editor.remoteEdit([...editor.lines, '- [ ] Theirs']);
    expect(session.getSnapshot().undo).toBeNull();
  });
});

describe('boardSession snapshots', () => {
  it('returns the same snapshot until something changes', () => {
    const { session } = setup();
    const listener = vi.fn();
    session.subscribe(listener);
    const first = session.getSnapshot();
    expect(session.getSnapshot()).toBe(first);

    // No-ops: nothing to write, nothing to retry, nothing to clear.
    session.flush();
    session.retry();
    session.clear();
    expect(session.getSnapshot()).toBe(first);
    expect(listener).not.toHaveBeenCalled();

    session.open();
    expect(session.getSnapshot()).not.toBe(first);
    expect(listener).toHaveBeenCalled();
    const opened = session.getSnapshot();
    session.open();
    expect(session.getSnapshot()).toBe(opened);
  });

  it('stops notifying an unsubscribed listener', () => {
    const { editor, session } = setup();
    const listener = vi.fn();
    const unsubscribe = session.subscribe(listener);
    unsubscribe();
    editor.remoteEdit([...DOC, '- [ ] Unheard']);
    expect(listener).not.toHaveBeenCalled();
  });

  it('writes with the marker the document uses', () => {
    const { editor, session } = setup(['#!todo Board', '## Tasks', '- [ ] One']);
    session.setMarkers(['#!tasks', '#!todo']);
    session.open();
    session.commit(withTask(session.getSnapshot().model!, 'Two'), true);
    expect(editor.lines[0]).toBe('#!todo Board');
  });
});
