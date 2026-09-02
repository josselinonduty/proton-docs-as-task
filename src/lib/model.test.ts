import { describe, expect, it } from 'vitest';
import { parseDocument } from './parser';
import { DEFAULT_MARKERS } from './defaults';
import {
  addColumn,
  addTask,
  countTasks,
  createStarterModel,
  fromParseResult,
  moveTask,
  removeColumn,
  removeTask,
  renameColumn,
  serializeModel,
  setTitle,
  updateTask,
  type BoardModel,
} from './model';

const MARKER = '#!tasks';

/** Round-trip a model through serialization + parsing back into a model. */
function roundTrip(model: BoardModel): BoardModel {
  const text = serializeModel(model, MARKER);
  return fromParseResult(parseDocument(text, DEFAULT_MARKERS));
}

describe('serializeModel', () => {
  it('leads with the marker and board title', () => {
    const model = setTitle(createStarterModel(), 'Sprint 42');
    expect(serializeModel(model, MARKER).split('\n')[0]).toBe('#!tasks Sprint 42');
  });

  it('emits a heading per column and a checkbox line per task', () => {
    let model: BoardModel = { title: undefined, columns: [] };
    model = addColumn(model, 'Backend');
    const colId = model.columns[0]!.id;
    model = addTask(model, colId, 'Build the API');
    const taskId = model.columns[0]!.tasks[0]!.id;
    model = updateTask(model, taskId, {
      status: 'doing',
      priority: 'high',
      due: '2026-09-10',
      assignee: 'sam',
      description: 'Wire up the endpoints',
      labels: ['api'],
    });

    const text = serializeModel(model, MARKER);
    expect(text).toContain('## Backend');
    expect(text).toContain(
      '- [ ] Build the API @status:doing @priority:high @due:2026-09-10 @who:sam #api @desc(Wire up the endpoints)',
    );
  });

  it('marks done tasks with [x] and omits a status token', () => {
    let model: BoardModel = { title: undefined, columns: [] };
    model = addColumn(model, 'Done');
    const colId = model.columns[0]!.id;
    model = addTask(model, colId, 'Shipped');
    model = updateTask(model, model.columns[0]!.tasks[0]!.id, { status: 'done' });

    const text = serializeModel(model, MARKER);
    expect(text).toContain('- [x] Shipped');
    expect(text).not.toContain('@status:done');
  });
});

describe('round-trip through the document', () => {
  it('preserves columns, tasks and all metadata', () => {
    let model: BoardModel = setTitle({ title: undefined, columns: [] }, 'My board');
    model = addColumn(model, 'To Do');
    const colId = model.columns[0]!.id;
    model = addTask(model, colId, 'Write report');
    const taskId = model.columns[0]!.tasks[0]!.id;
    model = updateTask(model, taskId, {
      priority: 'medium',
      due: '2026-10-01',
      assignee: 'Sam Rivera',
      description: 'Cover Q3 (with parens) and #hashish edge cases',
      labels: ['docs'],
    });

    const back = roundTrip(model);
    expect(back.title).toBe('My board');
    expect(back.columns).toHaveLength(1);
    expect(back.columns[0]!.name).toBe('To Do');
    const t = back.columns[0]!.tasks[0]!;
    expect(t.title).toBe('Write report');
    expect(t.priority).toBe('medium');
    expect(t.due).toBe('2026-10-01');
    expect(t.assignee).toBe('Sam Rivera');
    expect(t.description).toBe('Cover Q3 (with parens) and #hashish edge cases');
    expect(t.labels).toEqual(['docs']);
  });

  it('round-trips the doing status', () => {
    let model: BoardModel = { title: undefined, columns: [] };
    model = addColumn(model, 'Work');
    const colId = model.columns[0]!.id;
    model = addTask(model, colId, 'In flight');
    model = updateTask(model, model.columns[0]!.tasks[0]!.id, { status: 'doing' });
    const back = roundTrip(model);
    expect(back.columns[0]!.tasks[0]!.status).toBe('doing');
  });
});

describe('model mutations', () => {
  it('adds, renames and removes columns immutably', () => {
    const base: BoardModel = { title: undefined, columns: [] };
    const withCol = addColumn(base, 'A');
    expect(base.columns).toHaveLength(0); // unchanged
    expect(withCol.columns).toHaveLength(1);

    const renamed = renameColumn(withCol, withCol.columns[0]!.id, 'B');
    expect(renamed.columns[0]!.name).toBe('B');

    const removed = removeColumn(renamed, renamed.columns[0]!.id);
    expect(removed.columns).toHaveLength(0);
  });

  it('moves a task between columns', () => {
    let model: BoardModel = { title: undefined, columns: [] };
    model = addColumn(model, 'One');
    model = addColumn(model, 'Two');
    const [c1, c2] = model.columns;
    model = addTask(model, c1!.id, 'roamer');
    const taskId = model.columns[0]!.tasks[0]!.id;

    model = moveTask(model, taskId, c2!.id);
    expect(model.columns[0]!.tasks).toHaveLength(0);
    expect(model.columns[1]!.tasks[0]!.title).toBe('roamer');
  });

  it('removes a task and counts totals', () => {
    let model: BoardModel = { title: undefined, columns: [] };
    model = addColumn(model, 'C');
    const colId = model.columns[0]!.id;
    model = addTask(model, colId, 'a');
    model = addTask(model, colId, 'b');
    model = updateTask(model, model.columns[0]!.tasks[0]!.id, { status: 'done' });
    expect(countTasks(model)).toEqual({ total: 2, done: 1 });

    model = removeTask(model, model.columns[0]!.tasks[1]!.id);
    expect(countTasks(model)).toEqual({ total: 1, done: 1 });
  });
});
