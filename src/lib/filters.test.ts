import { describe, expect, it } from 'vitest';
import { parseDocument } from './parser';
import { DEFAULT_MARKERS } from './defaults';
import { fromParseResult } from './model';
import {
  activeFilterCount,
  applyFilters,
  buildPresets,
  collectFacets,
  dueBucket,
  EMPTY_FILTERS,
  facetCounts,
  getPreset,
  hasActiveFilters,
  matchesFilters,
  matchesPreset,
  normalizeFilters,
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

describe('exclude & assignment filters', () => {
  it('excludes tasks by status ("not Done")', () => {
    expect(
      applyFilters(model.tasks, filters({ excludeStatuses: ['done'] }), NOW).map((t) => t.title),
    ).toEqual(['Build the API', 'Polish styles', 'Ship it']);
  });

  it('keeps only unassigned tasks', () => {
    expect(
      applyFilters(model.tasks, filters({ assignment: 'unassigned' }), NOW).map((t) => t.title),
    ).toEqual(['Polish styles', 'Ship it']);
  });

  it('filters by dueWithinDays (this week)', () => {
    // NOW is 2026-09-03; within 7 days catches 2026-09-03 (today). 09-02 is overdue (excluded),
    // 12-01 is far off.
    expect(
      applyFilters(model.tasks, filters({ dueWithinDays: 7 }), NOW).map((t) => t.title),
    ).toEqual(['Polish styles']);
  });

  it('counts the new dimensions as active', () => {
    expect(hasActiveFilters(filters({ assignment: 'unassigned' }))).toBe(true);
    expect(activeFilterCount(filters({ excludeStatuses: ['done'], dueWithinDays: 7 }))).toBe(2);
  });
});

describe('normalizeFilters', () => {
  it('fills missing new fields from a legacy stored object', () => {
    const legacy = { search: 'x', statuses: ['todo'] } as Partial<FilterState>;
    const f = normalizeFilters(legacy);
    expect(f.excludeStatuses).toEqual([]);
    expect(f.assignment).toBe('any');
    expect(f.dueWithinDays).toBeNull();
    expect(f.search).toBe('x');
  });
});

describe('facetCounts', () => {
  it('counts usage per value including unassigned', () => {
    const c = facetCounts(model);
    expect(c.assignees).toEqual({ alex: 1, sam: 1 });
    expect(c.labels).toEqual({ api: 1, db: 1, ui: 1 });
    expect(c.unassigned).toBe(2);
    expect(c.statuses.done).toBe(1);
  });
});

describe('presets', () => {
  it('marks "My open tasks" unavailable without a configured name', () => {
    const none = getPreset('my-open', {})!;
    expect(none.available).toBe(false);
    const mine = getPreset('my-open', { userAssignee: 'alex' })!;
    expect(mine.available).toBe(true);
    expect(applyFilters(model.tasks, mine.filters, NOW).map((t) => t.title)).toEqual([
      'Build the API',
    ]);
  });

  it('overdue preset finds only incomplete overdue tasks', () => {
    const p = getPreset('overdue', {})!;
    expect(applyFilters(model.tasks, p.filters, NOW).map((t) => t.title)).toEqual([
      'Build the API',
    ]);
  });

  it('unassigned and high-priority presets work', () => {
    const unassigned = getPreset('unassigned', {})!;
    expect(applyFilters(model.tasks, unassigned.filters, NOW).map((t) => t.title)).toEqual([
      'Polish styles',
      'Ship it',
    ]);
    const high = getPreset('high-priority', {})!;
    expect(applyFilters(model.tasks, high.filters, NOW).map((t) => t.title)).toEqual([
      'Build the API',
    ]);
  });

  it('matchesPreset detects an active preset', () => {
    const p = getPreset('unassigned', {})!;
    expect(matchesPreset(p.filters, p)).toBe(true);
    expect(matchesPreset(EMPTY_FILTERS, p)).toBe(false);
  });

  it('builds the full preset list', () => {
    expect(buildPresets({ userAssignee: 'x' }).map((p) => p.id)).toEqual([
      'my-open',
      'overdue',
      'due-this-week',
      'high-priority',
      'unassigned',
      'recently-completed',
    ]);
  });
});
