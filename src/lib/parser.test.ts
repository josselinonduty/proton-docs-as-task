import { describe, expect, it } from 'vitest';
import { extractMeta, matchMarker, parseDocument } from './parser';
import { DEFAULT_MARKERS } from './defaults';

describe('matchMarker', () => {
  it('matches an exact marker', () => {
    expect(matchMarker('#!tasks', DEFAULT_MARKERS).matched).toBe(true);
  });

  it('is case-insensitive and captures a board title', () => {
    const r = matchMarker('#!TASKS  Sprint 42 ', DEFAULT_MARKERS);
    expect(r.matched).toBe(true);
    expect(r.title).toBe('Sprint 42');
  });

  it('does not match a marker that is only a prefix of a word', () => {
    expect(matchMarker('#!tasksy', DEFAULT_MARKERS).matched).toBe(false);
  });

  it('rejects unrelated first lines', () => {
    expect(matchMarker('# My grocery list', DEFAULT_MARKERS).matched).toBe(false);
  });
});

describe('extractMeta', () => {
  it('extracts a clean title with no metadata', () => {
    const m = extractMeta('Buy milk');
    expect(m.title).toBe('Buy milk');
    expect(m.labels).toEqual([]);
    expect(m.status).toBeUndefined();
  });

  it('extracts status, priority, due, assignee and labels', () => {
    const m = extractMeta(
      'Ship release @status:doing @priority:high @due:2026-09-10 @who:alex #release #ops',
    );
    expect(m.title).toBe('Ship release');
    expect(m.status).toBe('doing');
    expect(m.priority).toBe('high');
    expect(m.due).toBe('2026-09-10');
    expect(m.assignee).toBe('alex');
    expect(m.labels).toEqual(['release', 'ops']);
  });

  it('supports parenthesized values with spaces', () => {
    const m = extractMeta('Call vendor @due(next friday) @who(Sam Rivera)');
    expect(m.due).toBe('next friday');
    expect(m.assignee).toBe('Sam Rivera');
    expect(m.title).toBe('Call vendor');
  });

  it('maps synonyms and short forms', () => {
    const m = extractMeta('Task @s:wip @p:m');
    expect(m.status).toBe('doing');
    expect(m.priority).toBe('medium');
  });

  it('supports bang priority shorthand', () => {
    expect(extractMeta('Urgent thing !!!').priority).toBe('high');
    expect(extractMeta('Later !').priority).toBe('low');
    expect(extractMeta('Later !').title).toBe('Later');
  });

  it('supports @@mention assignees', () => {
    const m = extractMeta('Review PR @@jo');
    expect(m.assignee).toBe('jo');
    expect(m.title).toBe('Review PR');
  });

  it('keeps unicode labels', () => {
    expect(extractMeta('Étude #révision').labels).toEqual(['révision']);
  });
});

describe('parseDocument', () => {
  it('does not activate without a marker', () => {
    const r = parseDocument('# Notes\n- [ ] a task', DEFAULT_MARKERS);
    expect(r.activated).toBe(false);
    expect(r.tasks).toEqual([]);
  });

  it('activates when the first non-empty line is a marker', () => {
    const doc = ['', '  ', '#!tasks', '- [ ] first', '- [x] second'].join('\n');
    const r = parseDocument(doc, DEFAULT_MARKERS);
    expect(r.activated).toBe(true);
    expect(r.tasks).toHaveLength(2);
    expect(r.tasks[0]!.title).toBe('first');
    expect(r.tasks[0]!.status).toBe('todo');
    expect(r.tasks[1]!.status).toBe('done');
    expect(r.tasks[1]!.checked).toBe(true);
  });

  it('groups tasks under headings as sections', () => {
    const doc = [
      '#!tasks Board',
      '## Backend',
      '- [ ] api',
      '## Frontend',
      '- [ ] ui',
      '- [ ] ux',
    ].join('\n');
    const r = parseDocument(doc, DEFAULT_MARKERS);
    expect(r.boardTitle).toBe('Board');
    expect(r.sections).toEqual(['Backend', 'Frontend']);
    expect(r.tasks.filter((t) => t.section === 'Frontend')).toHaveLength(2);
  });

  it('uses the default section when no heading precedes a task', () => {
    const r = parseDocument('#!tasks\n- [ ] loose', DEFAULT_MARKERS);
    expect(r.tasks[0]!.section).toBe('Tasks');
    expect(r.sections).toEqual(['Tasks']);
  });

  it('treats plain bullets as unchecked tasks', () => {
    const r = parseDocument('#!tasks\n- just a bullet', DEFAULT_MARKERS);
    expect(r.tasks).toHaveLength(1);
    expect(r.tasks[0]!.status).toBe('todo');
    expect(r.tasks[0]!.checked).toBe(false);
  });

  it('lets explicit @status override the checkbox state', () => {
    const r = parseDocument('#!tasks\n- [x] revisit @status:doing', DEFAULT_MARKERS);
    expect(r.tasks[0]!.status).toBe('doing');
  });

  it('ignores non-task, non-heading prose lines', () => {
    const doc = ['#!tasks', 'Some intro paragraph.', '- [ ] real task'].join('\n');
    const r = parseDocument(doc, DEFAULT_MARKERS);
    expect(r.tasks).toHaveLength(1);
    expect(r.tasks[0]!.title).toBe('real task');
  });

  it('assigns stable ids from source line numbers', () => {
    const r = parseDocument('#!tasks\n- [ ] a\n- [ ] b', DEFAULT_MARKERS);
    expect(r.tasks[0]!.id).toBe('task-1');
    expect(r.tasks[1]!.id).toBe('task-2');
  });
});
