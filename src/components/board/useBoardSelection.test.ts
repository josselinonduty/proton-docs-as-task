// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBoardSelection } from './useBoardSelection';

const COLUMN = ['a', 'b', 'c', 'd'];

function setup() {
  return renderHook(() => useBoardSelection()).result;
}

const ids = (set: Set<string>) => [...set].sort();

describe('useBoardSelection', () => {
  it('toggles a card and enters selection mode', () => {
    const result = setup();
    act(() => result.current.toggle('b', 'todo', COLUMN, false));
    expect(result.current.selectionMode).toBe(true);
    expect(ids(result.current.selected)).toEqual(['b']);
    act(() => result.current.toggle('b', 'todo', COLUMN, false));
    expect(ids(result.current.selected)).toEqual([]);
    expect(result.current.selectionMode).toBe(true);
  });

  it('selects the range from the last toggled card with Shift', () => {
    const result = setup();
    act(() => result.current.toggle('a', 'todo', COLUMN, false));
    act(() => result.current.toggle('c', 'todo', COLUMN, true));
    expect(ids(result.current.selected)).toEqual(['a', 'b', 'c']);
  });

  it('only extends a range within the anchor’s column', () => {
    const result = setup();
    act(() => result.current.toggle('a', 'todo', COLUMN, false));
    act(() => result.current.toggle('x', 'done', ['x', 'y'], true));
    expect(ids(result.current.selected)).toEqual(['a', 'x']);
  });

  it('selects a given set, clears and exits', () => {
    const result = setup();
    act(() => result.current.select(new Set(['a', 'd'])));
    expect(result.current.selectionMode).toBe(true);
    expect(ids(result.current.selected)).toEqual(['a', 'd']);
    act(() => result.current.clear());
    expect(result.current.selected.size).toBe(0);
    expect(result.current.selectionMode).toBe(true);
    act(() => result.current.exit());
    expect(result.current.selectionMode).toBe(false);
  });

  it('forgets the Shift anchor on exit but keeps it when leaving after a delete', () => {
    const result = setup();
    act(() => result.current.toggle('a', 'todo', COLUMN, false));
    act(() => result.current.leave());
    act(() => result.current.toggle('c', 'todo', COLUMN, true));
    expect(ids(result.current.selected)).toEqual(['a', 'b', 'c']);

    act(() => result.current.exit());
    act(() => result.current.toggle('c', 'todo', COLUMN, true));
    expect(ids(result.current.selected)).toEqual(['c']);
  });
});
