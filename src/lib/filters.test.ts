import { describe, expect, it } from 'vitest';
import { parseDocument } from './parser';
import { DEFAULT_MARKERS } from './defaults';
import { fromParseResult } from './model';
import {
  activeFilterCount,
  applyFilters,
  collectFacets,
  dueBucket,
  EMPTY_FILTERS,
  hasActiveFilters,
  matchesFilters,
  type FilterState,
} from './filters';

const NOW = new Date(2026, 8, 3); // 2026-09-03 (local)

const DOC = [
  '#!tasks Board',
  '## Backend',
  '- [ ] Build the API @status:doing @priority:high @due:2026-09-02 @who:alex #api',
  '- [x] Write migrations @who:sam #db',
  '## Frontend',
  '- [ ] Polish styles @priority:low @due:2026-09-03 #ui',
  '- [ ] Ship it @due:2026-12-01',
].join('\n');

const model = fromParseResult(parseDocument(DOC, DEFAULT_MARKERS));

function filters(patch: Partial<FilterState>): FilterState {
  return { ...EMPTY_FILTERS, ...patch };
}

describe('dueBucket', () => {
  it('classifies overdue, today, soon and upcoming dates', () => {
    expect(dueBucket('2026-09-02', NOW)).toBe('overdue');
    expect(dueBucket('2026-09-03', NOW)).toBe('today');
    expect(dueBucket('2026-09-05', NOW)).toBe('soon');
    expect(dueBucket('2026-12-01', NOW)).toBe('upcoming');
    expect(dueBucket(undefined, NOW)).toBe('none');
    expect(dueBucket('next friday', NOW)).toBe('upcoming');
  });
});

describe('search', () => {
  it('is case-insensitive across title, description, assignee, labels and section', () => {
    expect(applyFilters(model.tasks, filters({ search: 'api' }), NOW).map((t) => t.title)).toEqual([
      'Build the API',
    ]);
    // assignee
    expect(applyFilters(model.tasks, filters({ search: 'SAM' }), NOW).map((t) => t.title)).toEqual([
      'Write migrations',
    ]);
    // section name
    expect(
      applyFilters(model.tasks, filters({ search: 'frontend' }), NOW).map((t) => t.title),
    ).toEqual(['Polish styles', 'Ship it']);
  });
});

describe('filters combine', () => {
  it('filters by status', () => {
    expect(
      applyFilters(model.tasks, filters({ statuses: ['done'] }), NOW).map((t) => t.title),
    ).toEqual(['Write migrations']);
  });

  it('filters by priority', () => {
    expect(
      applyFilters(model.tasks, filters({ priorities: ['high'] }), NOW).map((t) => t.title),
    ).toEqual(['Build the API']);
  });

  it('filters by label', () => {
    expect(applyFilters(model.tasks, filters({ labels: ['ui'] }), NOW).map((t) => t.title)).toEqual(
      ['Polish styles'],
    );
  });

  it('filters by due bucket (overdue / today / upcoming / none)', () => {
    expect(
      applyFilters(model.tasks, filters({ due: ['overdue'] }), NOW).map((t) => t.title),
    ).toEqual(['Build the API']);
    expect(applyFilters(model.tasks, filters({ due: ['today'] }), NOW).map((t) => t.title)).toEqual(
      ['Polish styles'],
    );
    expect(applyFilters(model.tasks, filters({ due: ['none'] }), NOW).map((t) => t.title)).toEqual([
      'Write migrations',
    ]);
  });

  it('filters by completion state', () => {
    expect(
      applyFilters(model.tasks, filters({ completion: 'incomplete' }), NOW).map((t) => t.title),
    ).toEqual(['Build the API', 'Polish styles', 'Ship it']);
  });

  it('combines multiple filters with AND', () => {
    const f = filters({ sections: ['Backend'], completion: 'incomplete' });
    expect(applyFilters(model.tasks, f, NOW).map((t) => t.title)).toEqual(['Build the API']);
  });

  it('reports whether any filter is active and how many', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    const f = filters({ search: 'x', statuses: ['todo', 'done'], due: ['overdue'] });
    expect(hasActiveFilters(f)).toBe(true);
    expect(activeFilterCount(f)).toBe(4);
  });

  it('matchesFilters is used per-task', () => {
    const done = model.tasks.find((t) => t.title === 'Write migrations')!;
    expect(matchesFilters(done, filters({ completion: 'complete' }), NOW)).toBe(true);
    expect(matchesFilters(done, filters({ completion: 'incomplete' }), NOW)).toBe(false);
  });
});

describe('collectFacets', () => {
  it('collects distinct sections, priorities, assignees and labels', () => {
    const facets = collectFacets(model);
    expect(facets.sections).toEqual(['Backend', 'Frontend']);
    expect(facets.priorities).toEqual(['high', 'low']);
    expect(facets.assignees).toEqual(['alex', 'sam']);
    expect(facets.labels).toEqual(['api', 'db', 'ui']);
  });
});
