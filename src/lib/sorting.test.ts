import { describe, expect, it } from 'vitest';
import { parseDocument } from './parser';
import { DEFAULT_MARKERS } from './defaults';
import { columnsForView, fromParseResult, serializeModel, type BoardTask } from './model';
import { DEFAULT_COLUMNS } from './defaults';
import {
  applySortToModel,
  isActiveSort,
  MANUAL_SORT,
  sortColumns,
  sortTasks,
  type SortState,
} from './sorting';

const DOC = [
  '#!tasks Board',
  '## Work',
  '- [ ] Charlie @priority:low @due:2026-09-10 @who:Sam',
  '- [ ] alpha @priority:high @due:2026-09-02 @who:alex',
  '- [ ] Bravo @priority:medium @who:Sam',
  '- [ ] Delta @due:2026-09-05',
].join('\n');

const model = fromParseResult(parseDocument(DOC, DEFAULT_MARKERS));
const tasks = model.tasks;

function titlesAfter(sort: SortState): string[] {
  return sortTasks(tasks, sort).map((t) => t.title);
}

describe('sortTasks', () => {
  it('manual order returns the input untouched', () => {
    expect(titlesAfter(MANUAL_SORT)).toEqual(['Charlie', 'alpha', 'Bravo', 'Delta']);
    expect(isActiveSort(MANUAL_SORT)).toBe(false);
  });

  it('sorts by title case-insensitively', () => {
    expect(titlesAfter({ key: 'title', dir: 'asc' })).toEqual([
      'alpha',
      'Bravo',
      'Charlie',
      'Delta',
    ]);
    expect(titlesAfter({ key: 'title', dir: 'desc' })).toEqual([
      'Delta',
      'Charlie',
      'Bravo',
      'alpha',
    ]);
  });

  it('sorts by due date with undated tasks last in both directions', () => {
    expect(titlesAfter({ key: 'due', dir: 'asc' })).toEqual(['alpha', 'Delta', 'Charlie', 'Bravo']);
    expect(titlesAfter({ key: 'due', dir: 'desc' })).toEqual([
      'Charlie',
      'Delta',
      'alpha',
      'Bravo',
    ]);
  });

  it('sorts by priority (desc = high first) with none last', () => {
    expect(titlesAfter({ key: 'priority', dir: 'desc' })).toEqual([
      'alpha',
      'Bravo',
      'Charlie',
      'Delta',
    ]);
    // ascending: none (lowest) then low..high
    expect(titlesAfter({ key: 'priority', dir: 'asc' })).toEqual([
      'Delta',
      'Charlie',
      'Bravo',
      'alpha',
    ]);
  });

  it('sorts by assignee with unassigned last, stable within a name', () => {
    // alex, then the two Sams in manual order (Charlie before Bravo), then unassigned Delta.
    expect(titlesAfter({ key: 'assignee', dir: 'asc' })).toEqual([
      'alpha',
      'Charlie',
      'Bravo',
      'Delta',
    ]);
  });

  it('is stable: equal keys keep manual order and do not jitter when reversed', () => {
    // Everything has no shared title, so use priority where Delta/none is unique;
    // build a synthetic tie.
    const tied: BoardTask[] = [
      { id: 'task-a-1', title: 'one', status: 'todo', section: 'S', labels: [], order: 0 },
      { id: 'task-b-2', title: 'two', status: 'todo', section: 'S', labels: [], order: 1 },
    ];
    expect(sortTasks(tied, { key: 'priority', dir: 'asc' }).map((t) => t.title)).toEqual([
      'one',
      'two',
    ]);
    expect(sortTasks(tied, { key: 'priority', dir: 'desc' }).map((t) => t.title)).toEqual([
      'one',
      'two',
    ]);
  });

  it('sorts by created using the id counter (desc = newest first)', () => {
    const older: BoardTask = {
      id: 'task-x-5',
      title: 'older',
      status: 'todo',
      section: 'S',
      labels: [],
      order: 0,
    };
    const newer: BoardTask = {
      id: 'task-x-9',
      title: 'newer',
      status: 'todo',
      section: 'S',
      labels: [],
      order: 1,
    };
    expect(sortTasks([older, newer], { key: 'created', dir: 'desc' }).map((t) => t.title)).toEqual([
      'newer',
      'older',
    ]);
  });
});

describe('sortColumns', () => {
  it('sorts within each column and leaves manual columns as-is', () => {
    const columns = columnsForView(model, 'workflow', DEFAULT_COLUMNS);
    const sorted = sortColumns(columns, { key: 'title', dir: 'asc' });
    const todo = sorted.find((c) => c.key === 'todo')!;
    expect(todo.tasks.map((t) => t.title)).toEqual(['alpha', 'Bravo', 'Charlie', 'Delta']);
    // Manual returns the same reference set unchanged.
    expect(sortColumns(columns, MANUAL_SORT)).toBe(columns);
  });
});

describe('applySortToModel', () => {
  it('bakes the sorted order into the document serialization', () => {
    const columns = columnsForView(model, 'sections', DEFAULT_COLUMNS);
    const next = applySortToModel(model, columns, { key: 'title', dir: 'asc' });
    const text = serializeModel(next, '#!tasks');
    const order = text
      .split('\n')
      .filter((l) => l.startsWith('- ['))
      .map((l) =>
        l
          .replace(/^- \[.\]\s*/, '')
          .split(' @')[0]!
          .split(' #')[0]!
          .trim(),
      );
    expect(order).toEqual(['alpha', 'Bravo', 'Charlie', 'Delta']);
  });

  it('is a no-op for a manual sort', () => {
    const columns = columnsForView(model, 'sections', DEFAULT_COLUMNS);
    expect(applySortToModel(model, columns, MANUAL_SORT)).toBe(model);
  });
});
