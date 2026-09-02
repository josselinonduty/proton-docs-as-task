import { describe, expect, it } from 'vitest';
import { groupBySection, groupByStatus, summarize } from './board';
import { parseDocument } from './parser';
import { DEFAULT_COLUMNS, DEFAULT_MARKERS } from './defaults';

const doc = [
  '#!tasks',
  '## Backend',
  '- [ ] api @status:doing',
  '- [x] migrations',
  '## Frontend',
  '- [ ] ui',
].join('\n');

const result = parseDocument(doc, DEFAULT_MARKERS);

describe('groupByStatus', () => {
  it('places each task in its status column and keeps empty columns', () => {
    const groups = groupByStatus(result.tasks, DEFAULT_COLUMNS);
    expect(groups.map((g) => g.key)).toEqual(['todo', 'doing', 'done']);
    expect(groups[0]!.tasks.map((t) => t.title)).toEqual(['ui']);
    expect(groups[1]!.tasks.map((t) => t.title)).toEqual(['api']);
    expect(groups[2]!.tasks.map((t) => t.title)).toEqual(['migrations']);
  });
});

describe('groupBySection', () => {
  it('groups by document section in first-seen order', () => {
    const groups = groupBySection(result.tasks, result.sections);
    expect(groups.map((g) => g.key)).toEqual(['Backend', 'Frontend']);
    expect(groups[0]!.tasks).toHaveLength(2);
    expect(groups[1]!.tasks).toHaveLength(1);
  });
});

describe('summarize', () => {
  it('computes totals and completion progress', () => {
    const s = summarize(result);
    expect(s.total).toBe(3);
    expect(s.done).toBe(1);
    expect(s.progress).toBeCloseTo(1 / 3);
  });

  it('reports zero progress for an empty board', () => {
    expect(summarize({ activated: true, tasks: [], sections: [] }).progress).toBe(0);
  });
});
