import { describe, expect, it } from 'vitest';
import { parseDocument } from './parser';
import { DEFAULT_MARKERS } from './defaults';
import {
  addSection,
  addSubtask,
  canSetParent,
  descendantsOf,
  openSubtasks,
  parentOf,
  removeTask,
  setParent,
  subtasksOf,
  addStatus,
  addTask,
  applyBulkAction,
  canChangeStatusCategory,
  canLink,
  canRemoveStatus,
  canSetStatus,
  linksOf,
  linkTasks,
  openBlockers,
  unlinkTasks,
  columnsForView,
  countTasks,
  createStarterModel,
  duplicateTask,
  fromParseResult,
  moveSection,
  moveStatus,
  moveTasksToStatus,
  orphanStatuses,
  removeSection,
  removeSectionMovingTasks,
  removeStatus,
  renameSection,
  reorderColumn,
  serializeModel,
  setTaskSection,
  setTaskStatus,
  setTitle,
  toggleDefaultSection,
  updateStatus,
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
    const workflow = columnsForView(model, 'workflow');
    expect(workflow.map((c) => c.key)).toEqual(['todo', 'doing', 'done']);
    expect(workflow.find((c) => c.key === 'doing')!.tasks.map((t) => t.title)).toEqual([
      'Implement API',
    ]);
    expect(workflow.find((c) => c.key === 'done')!.tasks.map((t) => t.title)).toEqual([
      'Publish announcement',
    ]);

    const sections = columnsForView(model, 'sections');
    expect(sections.map((c) => c.key)).toEqual(['Build', 'Launch']);
  });

  it('projects every task into a single flat list column', () => {
    const model = build(SAMPLE);
    const [list, ...rest] = columnsForView(model, 'list');
    expect(rest).toEqual([]);
    expect(list!.tasks).toHaveLength(model.tasks.length);
  });

  it('limits the list to the @default section and round-trips the marker', () => {
    let model = toggleDefaultSection(build(SAMPLE), 'Launch');
    const [list] = columnsForView(model, 'list');
    expect(list!.tasks.every((t) => t.section === 'Launch')).toBe(true);
    model = renameSection(model, 'Launch', 'Ship');
    expect(model.defaultSection).toBe('Ship');
    expect(serializeModel(model, '#!tasks')).toContain('## Ship @default');
    expect(removeSection(model, 'Ship').defaultSection).toBeUndefined();
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

describe('task relationships', () => {
  const doc = '#!tasks\n- [ ] a\n- [ ] b\n- [ ] c';
  const idOf = (model: BoardModel, title: string) => model.tasks.find((t) => t.title === title)!.id;
  const task = (model: BoardModel, title: string) => model.tasks.find((t) => t.title === title)!;

  it('links tasks and derives the inverse side', () => {
    const m = build(doc);
    const linked = linkTasks(m, idOf(m, 'a'), idOf(m, 'b'), 'blocks');
    expect(linksOf(linked, task(linked, 'b')).blockedBy.map((t) => t.title)).toEqual(['a']);
    expect(linksOf(linked, task(linked, 'a')).blocks.map((t) => t.title)).toEqual(['b']);
  });

  it('round-trips links through the document', () => {
    const m = build(doc);
    const linked = linkTasks(m, idOf(m, 'a'), idOf(m, 'b'), 'blockedBy');
    const back = build(serializeModel(linked, MARKER));
    expect(linksOf(back, task(back, 'a')).blockedBy.map((t) => t.title)).toEqual(['b']);
  });

  it('drops links to tasks that no longer exist when serializing', () => {
    const m = build(doc);
    const linked = linkTasks(m, idOf(m, 'a'), idOf(m, 'b'), 'blocks');
    const text = serializeModel(
      applyBulkAction(linked, [idOf(linked, 'b')], { kind: 'delete' }),
      MARKER,
    );
    expect(text).not.toMatch(/@id|@blocks/);
  });

  it('refuses self links, duplicates and blocking cycles', () => {
    const m = build(doc);
    const [a, b] = [idOf(m, 'a'), idOf(m, 'b')];
    const linked = linkTasks(m, a, b, 'blocks');
    expect(canLink(linked, a, a, 'related')).toBe(false);
    expect(canLink(linked, a, b, 'related')).toBe(false);
    expect(canLink(linked, b, a, 'blocks')).toBe(false);
    expect(canLink(linked, idOf(linked, 'c'), a, 'related')).toBe(true);
  });

  it('unlinks both sides', () => {
    const m = build(doc);
    const linked = linkTasks(m, idOf(m, 'a'), idOf(m, 'b'), 'related');
    const cleared = unlinkTasks(linked, idOf(linked, 'b'), idOf(linked, 'a'));
    expect(linksOf(cleared, task(cleared, 'a')).related).toEqual([]);
  });

  it('keeps a blocked task from advancing until its blockers are done', () => {
    const m = build(doc);
    const [a, b] = [idOf(m, 'a'), idOf(m, 'b')];
    const linked = linkTasks(m, a, b, 'blocks');
    expect(openBlockers(linked, task(linked, 'b'))).toHaveLength(1);
    expect(setTaskStatus(linked, b, 'doing')).toBe(linked);
    expect(
      applyBulkAction(linked, [b], { kind: 'complete' }).tasks.find((t) => t.id === b)!.status,
    ).toBe('todo');
    const unblocked = setTaskStatus(linked, a, 'done');
    expect(setTaskStatus(unblocked, b, 'doing').tasks.find((t) => t.id === b)!.status).toBe(
      'doing',
    );
  });
});

describe('sub-tasks', () => {
  const doc = '#!tasks\n## A\n- [ ] parent\n- [ ] other\n## B\n- [ ] elsewhere';
  const task = (model: BoardModel, title: string) => model.tasks.find((t) => t.title === title)!;
  const titles = (tasks: { title: string }[]) => tasks.map((t) => t.title);

  it('creates a sub-task in the parent section, right after the parent', () => {
    const m = build(doc);
    const { model, taskId } = addSubtask(m, task(m, 'parent').id, '  child  ');
    const child = model.tasks.find((t) => t.id === taskId)!;
    expect([child.title, child.section, child.status]).toEqual(['child', 'A', 'todo']);
    expect(parentOf(model, child)?.title).toBe('parent');
    expect(titles(model.tasks)).toEqual(['parent', 'child', 'other', 'elsewhere']);
    const next = addSubtask(model, task(model, 'parent').id, 'second').model;
    expect(titles(next.tasks)).toEqual(['parent', 'child', 'second', 'other', 'elsewhere']);
    expect(titles(subtasksOf(next, task(next, 'parent')))).toEqual(['child', 'second']);
  });

  it('round-trips through the document as @parent', () => {
    const m = build(doc);
    const linked = setParent(m, task(m, 'elsewhere').id, task(m, 'parent').id);
    const text = serializeModel(linked, MARKER);
    expect(text).toMatch(/- \[ \] parent @id:\w{4}\n/);
    expect(text).toMatch(/- \[ \] elsewhere @parent:\w{4}$/);
    const back = build(text);
    expect(parentOf(back, task(back, 'elsewhere'))?.title).toBe('parent');
    expect(task(back, 'elsewhere').section).toBe('B');
  });

  it('nests to any depth and refuses cycles', () => {
    const m = build(doc);
    const [p, o, e] = ['parent', 'other', 'elsewhere'].map((title) => task(m, title).id) as [
      string,
      string,
      string,
    ];
    const nested = setParent(setParent(m, o, p), e, o);
    expect(titles(descendantsOf(nested, task(nested, 'parent')))).toEqual(['other', 'elsewhere']);
    expect(canSetParent(nested, p, e)).toBe(false);
    expect(canSetParent(nested, p, p)).toBe(false);
    expect(canSetParent(nested, o, p)).toBe(false);
    expect(canSetParent(nested, e, p)).toBe(true);
    expect(setParent(nested, p, e)).toBe(nested);
  });

  it('ignores self references and cycles typed in the document', () => {
    const m = build(
      '#!tasks\n- [ ] a @id:ka @parent:kb\n- [ ] b @id:kb @parent:ka\n- [ ] c @id:kc @parent:kc\n- [ ] d @parent:ka',
    );
    expect(parentOf(m, task(m, 'a'))).toBeUndefined();
    expect(parentOf(m, task(m, 'c'))).toBeUndefined();
    // A task hanging off a cycle still has its parent.
    expect(parentOf(m, task(m, 'd'))?.title).toBe('a');
    expect(titles(descendantsOf(m, task(m, 'a')))).toEqual(['d']);
    expect(canSetStatus(m, task(m, 'b'), 'done')).toBe(true);
    const text = serializeModel(m, MARKER);
    expect(text).not.toMatch(/@parent:kb|@parent:kc/);
    expect(text).toMatch(/- \[ \] d @parent:ka$/);
  });

  it('keeps a parent from reaching Done while a sub-task at any depth is open', () => {
    const m = build(doc);
    const [p, o, e] = ['parent', 'other', 'elsewhere'].map((title) => task(m, title).id) as [
      string,
      string,
      string,
    ];
    const nested = setParent(setParent(m, o, p), e, o);
    expect(titles(openSubtasks(nested, task(nested, 'parent')))).toEqual(['other', 'elsewhere']);
    expect(canSetStatus(nested, task(nested, 'parent'), 'done')).toBe(false);
    expect(canSetStatus(nested, task(nested, 'parent'), 'doing')).toBe(true);
    expect(setTaskStatus(nested, p, 'done')).toBe(nested);
    expect(applyBulkAction(nested, [p], { kind: 'complete' }).tasks[0]!.status).toBe('todo');
    // Completing the child alone is not enough: the grandchild is still open.
    const childDone = setTaskStatus(nested, o, 'done');
    expect(childDone).toBe(nested);
    const allDone = setTaskStatus(setTaskStatus(nested, e, 'done'), o, 'done');
    expect(setTaskStatus(allDone, p, 'done').tasks[0]!.status).toBe('done');
  });

  it('detaches a sub-task without touching the parent', () => {
    const m = build(doc);
    const linked = setParent(m, task(m, 'other').id, task(m, 'parent').id);
    const detached = setParent(linked, task(linked, 'other').id, undefined);
    expect(parentOf(detached, task(detached, 'other'))).toBeUndefined();
    expect(serializeModel(detached, MARKER)).not.toMatch(/@parent|@id/);
  });

  it('keeps sub-tasks, detached, when their parent is deleted', () => {
    const m = build(doc);
    const linked = setParent(m, task(m, 'other').id, task(m, 'parent').id);
    for (const next of [
      removeTask(linked, task(linked, 'parent').id),
      applyBulkAction(linked, [task(linked, 'parent').id], { kind: 'delete' }),
    ]) {
      expect(titles(next.tasks)).toEqual(['other', 'elsewhere']);
      expect(task(next, 'other').parent).toBeUndefined();
    }
  });

  it('duplicates a sub-task as a sibling', () => {
    const m = build(doc);
    const linked = setParent(m, task(m, 'other').id, task(m, 'parent').id);
    const { model } = duplicateTask(linked, task(linked, 'other').id);
    expect(titles(subtasksOf(model, task(model, 'parent')))).toEqual(['other', 'other']);
  });
});

const STATUS_DOC = [
  '#!tasks Flow',
  '@settings status backlog "Backlog" @category:todo',
  '@settings status review "In review" @category:doing @color:purple @bg:#efeaff',
  '@settings status shipped "Shipped" @category:done',
  '',
  '## S',
  '- [ ] Idea',
  '- [ ] Patch @status:review',
  '- [x] Release',
].join('\n');

describe('status serialization', () => {
  it('writes the statuses right below the marker, in order', () => {
    const lines = serializeModel(build(STATUS_DOC), MARKER).split('\n');
    expect(lines.slice(0, 4)).toEqual([
      '#!tasks Flow',
      '@settings status backlog "Backlog" @category:todo',
      '@settings status review "In review" @category:doing @color:purple @bg:#efeaff',
      '@settings status shipped "Shipped" @category:done',
    ]);
  });

  it('writes a status token only when the checkbox does not imply it', () => {
    const text = serializeModel(build(STATUS_DOC), MARKER);
    expect(text).toContain('- [ ] Idea\n- [ ] Patch @status:review\n- [x] Release');
  });

  it('ticks the checkbox for every Done status', () => {
    let model = build(STATUS_DOC);
    ({ model } = addStatus(model, { label: 'Archived', category: 'done' }));
    model = setTaskStatus(model, model.tasks[0]!.id, 'archived');
    expect(serializeModel(model, MARKER)).toContain('- [x] Idea @status:archived');
  });

  it('keeps a reference to an undefined status', () => {
    const model = build('#!tasks\n- [ ] Lost @status:qa');
    expect(serializeModel(model, MARKER)).toContain('- [ ] Lost @status:qa');
    expect(orphanStatuses(model)).toEqual([{ key: 'qa', count: 1 }]);
  });

  it('round-trips statuses and their colours', () => {
    const model = build(STATUS_DOC);
    expect(roundTrip(model).statuses).toEqual(model.statuses);
  });
});

describe('status management', () => {
  it('adds a status keyed after a unique label', () => {
    const base = build(STATUS_DOC);
    const { model, key } = addStatus(base, { label: 'In review' });
    expect(key).toBe('in-review-2');
    expect(model.statuses.at(-1)).toEqual({
      key: 'in-review-2',
      label: 'In review 2',
      category: 'doing',
    });
  });

  it('renames without touching task lines and refuses duplicates', () => {
    const base = build(STATUS_DOC);
    const renamed = updateStatus(base, 'review', { label: 'QA' });
    expect(renamed.statuses[1]!.label).toBe('QA');
    expect(renamed.statuses[1]!.key).toBe('qa');
    expect(serializeModel(renamed, MARKER)).toContain('Patch @status:qa');
    expect(updateStatus(base, 'review', { label: 'backlog' })).toBe(base);
    expect(updateStatus(base, 'review', { label: '  ' })).toBe(base);
  });

  it('keeps renamed status keys unique and file-safe', () => {
    const base = build(STATUS_DOC);
    const keys = (m: typeof base) => m.statuses.map((s) => s.key);
    const a = updateStatus(base, 'review', { label: 'Ready / Ünit #1' });
    expect(a.statuses[1]!.key).toBe('ready-unit-1');
    const taken = base.statuses[0]!.key;
    const b = updateStatus(base, 'review', { label: `${taken}!` });
    expect(b.statuses[1]!.key).toBe(`${taken}-2`);
    expect(new Set(keys(b)).size).toBe(keys(b).length);
  });

  it('clears a colour', () => {
    const model = updateStatus(build(STATUS_DOC), 'review', { color: undefined });
    expect(model.statuses[1]).not.toHaveProperty('color');
    expect(model.statuses[1]!.bg).toBe('#efeaff');
  });

  it('never leaves the board without a Not started or Done status', () => {
    const base = build(STATUS_DOC);
    expect(canChangeStatusCategory(base, 'shipped', 'doing')).toBe(false);
    expect(updateStatus(base, 'shipped', { category: 'doing' })).toBe(base);
    expect(canRemoveStatus(base, 'backlog')).toBe(false);
    expect(canRemoveStatus(base, 'review')).toBe(true);
    expect(removeStatus(base, 'shipped', 'backlog')).toBe(base);
  });

  it('reorders statuses', () => {
    const model = moveStatus(build(STATUS_DOC), 'shipped', -2);
    expect(model.statuses.map((s) => s.key)).toEqual(['shipped', 'backlog', 'review']);
    expect(columnsForView(model, 'workflow').map((c) => c.key)).toEqual([
      'shipped',
      'backlog',
      'review',
    ]);
  });

  it('deletes a status, moving its tasks first', () => {
    const base = build(STATUS_DOC);
    expect(removeStatus(base, 'review')).toBe(base);
    const model = removeStatus(base, 'review', 'backlog');
    expect(model.statuses.map((s) => s.key)).toEqual(['backlog', 'shipped']);
    expect(model.tasks.map((t) => t.status)).toEqual(['backlog', 'backlog', 'shipped']);
  });

  it('deletes an empty status without a target', () => {
    const { model: base } = addStatus(build(STATUS_DOC), { label: 'Spare' });
    expect(removeStatus(base, 'spare').statuses.map((s) => s.key)).not.toContain('spare');
  });

  it('moves the tasks of a missing status to a defined one', () => {
    const base = build('#!tasks\n- [ ] a @status:qa\n- [ ] b @status:qa\n- [ ] c');
    const model = moveTasksToStatus(base, 'qa', 'doing');
    expect(model.tasks.map((t) => t.status)).toEqual(['doing', 'doing', 'todo']);
    expect(orphanStatuses(model)).toEqual([]);
    expect(moveTasksToStatus(base, 'qa', 'nope')).toBe(base);
  });

  it('lets a blocked task only move between Not started statuses', () => {
    let model = build(
      [
        '#!tasks',
        '@settings status backlog "Backlog" @category:todo',
        '@settings status ready "Ready" @category:todo',
        '@settings status done "Done" @category:done',
        '- [ ] Blocker @id:a @blocks:b',
        '- [ ] Blocked @id:b',
      ].join('\n'),
    );
    const blocked = model.tasks[1]!;
    expect(canSetStatus(model, blocked, 'ready')).toBe(true);
    expect(canSetStatus(model, blocked, 'done')).toBe(false);
    model = setTaskStatus(model, model.tasks[0]!.id, 'done');
    expect(canSetStatus(model, model.tasks[1]!, 'done')).toBe(true);
  });

  it('completes tasks into the first Done status and counts every Done status', () => {
    let model = build(STATUS_DOC);
    model = applyBulkAction(model, [model.tasks[0]!.id], { kind: 'complete' });
    expect(model.tasks[0]!.status).toBe('shipped');
    expect(countTasks(model)).toEqual({ total: 3, done: 2 });
  });
});
