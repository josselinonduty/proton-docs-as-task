import { describe, expect, it } from 'vitest';
import { parseDocument } from './parser';
import { DEFAULT_COLUMNS, DEFAULT_MARKERS } from './defaults';
import {
  addSection,
  addTask,
  applyBulkAction,
  columnsForView,
  countTasks,
  createStarterModel,
  duplicateTask,
  fromParseResult,
  moveSection,
  removeSection,
  removeSectionMovingTasks,
  renameSection,
  reorderColumn,
  serializeModel,
  setTaskSection,
  setTaskStatus,
  setTitle,
  updateTask,
  type BoardModel,
} from './model';

const MARKER = '#!tasks';

function build(doc: string): BoardModel {
  return fromParseResult(parseDocument(doc, DEFAULT_MARKERS));
}

function roundTrip(model: BoardModel): BoardModel {
  return build(serializeModel(model, MARKER));
}

const SAMPLE = [
  '#!tasks Product launch',
  '',
  '## Build',
  '- [ ] Implement API @status:doing @priority:high #backend',
  '',
  '## Launch',
  '- [x] Publish announcement #marketing',
].join('\n');

describe('serializeModel', () => {
  it('leads with the marker and board title', () => {
    const model = setTitle(createStarterModel(), 'Sprint 42');
    expect(serializeModel(model, MARKER).split('\n')[0]).toBe('#!tasks Sprint 42');
  });

  it('emits a heading per section and a checkbox line per task with metadata', () => {
    const model = build(SAMPLE);
    const text = serializeModel(model, MARKER);
    expect(text).toContain('## Build');
    expect(text).toContain('- [ ] Implement API @status:doing @priority:high #backend');
    expect(text).toContain('## Launch');
    expect(text).toContain('- [x] Publish announcement #marketing');
  });

  it('marks done tasks with [x] and omits a status token', () => {
    let model = build('#!tasks\n## Work\n- [ ] Shipped @status:doing');
    const id = model.tasks[0]!.id;
    model = setTaskStatus(model, id, 'done');
    const text = serializeModel(model, MARKER);
    expect(text).toContain('- [x] Shipped');
    expect(text).not.toContain('@status:done');
    expect(text).not.toContain('@status:doing');
  });

  it('writes @status:doing only for the doing status', () => {
    const model = build('#!tasks\n## Work\n- [ ] a\n- [ ] b @status:doing\n- [x] c');
    const text = serializeModel(model, MARKER);
    const doing = text.split('\n').filter((l) => l.includes('@status:doing'));
    expect(doing).toHaveLength(1);
  });
});

describe('independent status and section', () => {
  it('separates the two dimensions', () => {
    const model = build(SAMPLE);
    const api = model.tasks.find((t) => t.title === 'Implement API')!;
    expect(api.status).toBe('doing');
    expect(api.section).toBe('Build');
  });

  it('projects the same tasks into workflow and section columns', () => {
    const model = build(SAMPLE);
    const workflow = columnsForView(model, 'workflow', DEFAULT_COLUMNS);
    expect(workflow.map((c) => c.key)).toEqual(['todo', 'doing', 'done']);
    expect(workflow.find((c) => c.key === 'doing')!.tasks.map((t) => t.title)).toEqual([
      'Implement API',
    ]);
    expect(workflow.find((c) => c.key === 'done')!.tasks.map((t) => t.title)).toEqual([
      'Publish announcement',
    ]);

    const sections = columnsForView(model, 'sections', DEFAULT_COLUMNS);
    expect(sections.map((c) => c.key)).toEqual(['Build', 'Launch']);
  });
});

describe('workflow moves (status)', () => {
  it('changing status keeps the section', () => {
    let model = build(SAMPLE);
    const api = model.tasks.find((t) => t.title === 'Implement API')!;
    model = setTaskStatus(model, api.id, 'done');
    const moved = model.tasks.find((t) => t.id === api.id)!;
    expect(moved.status).toBe('done');
    expect(moved.section).toBe('Build');
  });

  it('moving to Done ticks the checkbox and drops @status:doing', () => {
    let model = build(SAMPLE);
    const api = model.tasks.find((t) => t.title === 'Implement API')!;
    model = setTaskStatus(model, api.id, 'done');
    const line = serializeModel(model, MARKER)
      .split('\n')
      .find((l) => l.includes('Implement API'))!;
    expect(line.startsWith('- [x]')).toBe(true);
    expect(line).not.toContain('@status');
  });
});

describe('section moves', () => {
  it('changing section keeps status and metadata, and relocates the line', () => {
    let model = build(SAMPLE);
    const api = model.tasks.find((t) => t.title === 'Implement API')!;
    model = setTaskSection(model, api.id, 'Launch');
    const moved = model.tasks.find((t) => t.id === api.id)!;
    expect(moved.section).toBe('Launch');
    expect(moved.status).toBe('doing');
    expect(moved.priority).toBe('high');

    const lines = serializeModel(model, MARKER).split('\n');
    const launchIdx = lines.indexOf('## Launch');
    const apiIdx = lines.findIndex((l) => l.includes('Implement API'));
    const buildIdx = lines.indexOf('## Build');
    expect(apiIdx).toBeGreaterThan(launchIdx);
    expect(apiIdx).toBeGreaterThan(buildIdx);
  });

  it('renaming a section renames its heading and updates its tasks', () => {
    let model = build(SAMPLE);
    model = renameSection(model, 'Launch', 'Release');
    expect(model.sections).toContain('Release');
    expect(model.sections).not.toContain('Launch');
    expect(model.tasks.find((t) => t.title === 'Publish announcement')!.section).toBe('Release');
    expect(serializeModel(model, MARKER)).toContain('## Release');
  });

  it('adding a section creates a new heading', () => {
    let model = build('#!tasks\n## A\n- [ ] x');
    model = addSection(model, 'B');
    expect(serializeModel(model, MARKER)).toContain('## B');
  });

  it('moves a section earlier / later', () => {
    let model = build('#!tasks\n## A\n- [ ] x\n## B\n- [ ] y');
    model = moveSection(model, 'B', -1);
    expect(model.sections).toEqual(['B', 'A']);
  });
});

describe('section deletion', () => {
  it('deletes a section and its tasks', () => {
    const model = removeSection(build(SAMPLE), 'Build');
    expect(model.sections).not.toContain('Build');
    expect(model.tasks.find((t) => t.title === 'Implement API')).toBeUndefined();
  });

  it('deletes a section but relocates its tasks to another section', () => {
    const model = removeSectionMovingTasks(build(SAMPLE), 'Build', 'Launch');
    expect(model.sections).not.toContain('Build');
    const api = model.tasks.find((t) => t.title === 'Implement API');
    expect(api).toBeDefined();
    expect(api!.section).toBe('Launch');
  });
});

describe('ordering', () => {
  it('reorders cards within a column and persists within a section', () => {
    let model = build('#!tasks\n## Work\n- [ ] a\n- [ ] b\n- [ ] c');
    const [a, b, c] = model.tasks;
    model = reorderColumn(model, [c!.id, a!.id, b!.id]);
    const titles = roundTrip(model).tasks.map((t) => t.title);
    expect(titles).toEqual(['c', 'a', 'b']);
  });

  it('card ordering survives a round-trip through the document', () => {
    const model = build('#!tasks\n## S\n- [ ] one\n- [ ] two\n- [ ] three');
    const titles = roundTrip(model).tasks.map((t) => t.title);
    expect(titles).toEqual(['one', 'two', 'three']);
  });
});

describe('task mutations', () => {
  it('adds a task inheriting section and defaulting to todo', () => {
    let model = build('#!tasks\n## S\n- [ ] existing');
    const { model: next, taskId } = addTask(model, 'S');
    model = next;
    const task = model.tasks.find((t) => t.id === taskId)!;
    expect(task.section).toBe('S');
    expect(task.status).toBe('todo');
  });

  it('duplicates a task right after the original', () => {
    let model = build('#!tasks\n## S\n- [ ] orig @priority:high');
    const orig = model.tasks[0]!;
    const { model: next, taskId } = duplicateTask(model, orig.id);
    model = next;
    expect(model.tasks).toHaveLength(2);
    const copy = model.tasks.find((t) => t.id === taskId)!;
    expect(copy.priority).toBe('high');
    expect(model.tasks[1]!.id).toBe(taskId);
  });

  it('counts totals and completed with status === done only', () => {
    let model = build('#!tasks\n## S\n- [ ] a\n- [ ] b @status:doing\n- [x] c');
    expect(countTasks(model)).toEqual({ total: 3, done: 1 });
    model = updateTask(model, model.tasks[0]!.id, { status: 'done' });
    expect(countTasks(model)).toEqual({ total: 3, done: 2 });
  });
});

describe('round-trip fidelity', () => {
  it('preserves title, sections, statuses and all metadata', () => {
    let model: BoardModel = build('#!tasks My board\n## To Do\n- [ ] Write report');
    const id = model.tasks[0]!.id;
    model = updateTask(model, id, {
      priority: 'medium',
      due: '2026-10-01',
      assignee: 'Sam Rivera',
      description: 'Cover Q3 (with parens) and #hashish edge cases',
      labels: ['docs'],
    });

    const back = roundTrip(model);
    expect(back.title).toBe('My board');
    expect(back.sections).toEqual(['To Do']);
    const t = back.tasks[0]!;
    expect(t.title).toBe('Write report');
    expect(t.priority).toBe('medium');
    expect(t.due).toBe('2026-10-01');
    expect(t.assignee).toBe('Sam Rivera');
    expect(t.description).toBe('Cover Q3 (with parens) and #hashish edge cases');
    expect(t.labels).toEqual(['docs']);
  });

  it('does not activate-change v0.4 documents on open (no manual migration)', () => {
    const v04 = ['#!tasks Legacy', '## Backend', '- [x] done thing', '- [ ] open @@jo !!'].join(
      '\n',
    );
    const model = build(v04);
    expect(model.tasks).toHaveLength(2);
    expect(model.tasks[1]!.assignee).toBe('jo');
    expect(model.tasks[1]!.priority).toBe('medium');
  });
});

describe('bulk actions', () => {
  const doc = [
    '#!tasks',
    '## A',
    '- [ ] one @priority:low #x',
    '- [ ] two @who:Sam',
    '## B',
    '- [x] three',
  ].join('\n');

  function ids(model: BoardModel, ...titles: string[]): string[] {
    return titles.map((t) => model.tasks.find((x) => x.title === t)!.id);
  }

  it('sets status/complete across a selection in one new model', () => {
    const m = build(doc);
    const next = applyBulkAction(m, ids(m, 'one', 'two'), { kind: 'complete' });
    expect(next).not.toBe(m);
    expect(
      next.tasks
        .filter((t) => t.status === 'done')
        .map((t) => t.title)
        .sort(),
    ).toEqual(['one', 'three', 'two']);
  });

  it('moves a selection to a section, registering the section', () => {
    const m = build(doc);
    const next = applyBulkAction(m, ids(m, 'one'), { kind: 'section', section: 'C' });
    expect(next.sections).toContain('C');
    expect(next.tasks.find((t) => t.title === 'one')!.section).toBe('C');
  });

  it('sets priority, assignee and due, clearing with undefined', () => {
    const m = build(doc);
    const withPrio = applyBulkAction(m, ids(m, 'two'), { kind: 'priority', priority: 'high' });
    expect(withPrio.tasks.find((t) => t.title === 'two')!.priority).toBe('high');
    const cleared = applyBulkAction(withPrio, ids(m, 'one'), { kind: 'priority' });
    expect(cleared.tasks.find((t) => t.title === 'one')!.priority).toBeUndefined();
    const due = applyBulkAction(m, ids(m, 'one', 'two'), { kind: 'due', due: '2026-09-09' });
    expect(due.tasks.filter((t) => t.due === '2026-09-09')).toHaveLength(2);
  });

  it('adds and removes labels without duplicates', () => {
    const m = build(doc);
    const added = applyBulkAction(m, ids(m, 'one', 'two'), { kind: 'addLabel', label: '#x' });
    // 'one' already has x (case-insensitive) → still one copy; 'two' gains it.
    expect(added.tasks.find((t) => t.title === 'one')!.labels).toEqual(['x']);
    expect(added.tasks.find((t) => t.title === 'two')!.labels).toEqual(['x']);
    const removed = applyBulkAction(added, ids(m, 'one', 'two'), {
      kind: 'removeLabel',
      label: 'X',
    });
    expect(removed.tasks.every((t) => t.labels.length === 0)).toBe(true);
  });

  it('deletes a selection and reindexes', () => {
    const m = build(doc);
    const next = applyBulkAction(m, ids(m, 'one', 'three'), { kind: 'delete' });
    expect(next.tasks.map((t) => t.title)).toEqual(['two']);
    expect(next.tasks[0]!.order).toBe(0);
  });
});
