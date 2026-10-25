import { describe, expect, it } from 'vitest';
import { parseDocument } from '@/lib/parser';
import { EMPTY_FILTERS } from '@/lib/filters';
import { MANUAL_SORT } from '@/lib/sorting';
import { fromParseResult } from '@/lib/model';
import { layoutBoard, type LayoutInput } from './boardLayout';

const DOC = [
  '#!tasks Board',
  '',
  '## Build',
  '- [ ] Spec',
  '- [ ] Code @status:doing',
  '- [x] Kickoff',
  '## Launch',
  '- [ ] Announce',
].join('\n');

function input(patch: Partial<LayoutInput> = {}): LayoutInput {
  return {
    model: fromParseResult(parseDocument(DOC, ['#!tasks'])),
    view: 'workflow',
    filters: { ...EMPTY_FILTERS },
    sort: MANUAL_SORT,
    hideCompleted: false,
    now: new Date(2026, 8, 3),
    collapsedColumns: [],
    collapsedRows: [],
    ...patch,
  };
}

const titles = (base: LayoutInput, ids: string[]) =>
  ids.map((id) => base.model.tasks.find((task) => task.id === id)?.title);

describe('layoutBoard', () => {
  it('orders cards column by column for keyboard navigation', () => {
    const base = input();
    const layout = layoutBoard(base);
    expect(layout.columns.map((c) => c.col.key)).toEqual(['todo', 'doing', 'done']);
    expect(titles(base, layout.navOrder)).toEqual(['Spec', 'Announce', 'Code', 'Kickoff']);
  });

  it('records each card’s column and its place in it', () => {
    const base = input();
    const layout = layoutBoard(base);
    const announce = base.model.tasks.find((task) => task.title === 'Announce')!;
    const place = layout.places.get(announce.id)!;
    expect(place.colKey).toBe('todo');
    expect(place.ids.indexOf(announce.id)).toBe(1);
    expect(place.ids).toHaveLength(2);
  });

  it('leaves collapsed columns out of the keyboard order but keeps their counts', () => {
    const layout = layoutBoard(input({ collapsedColumns: ['todo'] }));
    const todo = layout.columns.find((c) => c.col.key === 'todo')!;
    expect(todo.collapsed).toBe(true);
    expect(todo.visible).toHaveLength(2);
    expect(layout.navOrder).toHaveLength(2);
  });

  it('hides completed tasks when asked', () => {
    const base = input({ hideCompleted: true });
    const layout = layoutBoard(base);
    expect(titles(base, layout.navOrder)).not.toContain('Kickoff');
    expect(layout.columns.find((c) => c.col.key === 'done')!.col.tasks).toHaveLength(1);
  });

  it('lays out one swimlane row per section, with a cell per status', () => {
    const base = input({ view: 'swimlane', collapsedRows: ['Launch'] });
    const layout = layoutBoard(base);
    expect(layout.columns).toEqual([]);
    expect(layout.rows.map((r) => [r.section, r.count, r.cells.length])).toEqual([
      ['Build', 3, 3],
      ['Launch', 1, 0],
    ]);
    expect(layout.rows[0]!.cells[0]!.cell.col.key).toBe('Build::todo');
    expect(titles(base, layout.navOrder)).toEqual(['Spec', 'Code', 'Kickoff']);
  });
});
