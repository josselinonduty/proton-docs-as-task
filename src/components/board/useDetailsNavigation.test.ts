// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { createTask, type BoardTask } from '../../lib/model';
import { useDetailsNavigation } from './useDetailsNavigation';

const task = (id: string): BoardTask => ({ ...createTask('Tasks', 'todo', id), id });
const TASKS = [task('a'), task('b'), task('c')];

function setup(tasks = TASKS) {
  return renderHook(({ list }) => useDetailsNavigation(list), { initialProps: { list: tasks } });
}

describe('useDetailsNavigation', () => {
  it('opens a task with a focus target and a fresh nonce each time', () => {
    const { result } = setup();
    act(() => result.current.open('a', 'title'));
    expect(result.current.details).toEqual({ id: 'a', focus: 'title', nonce: 1 });
    act(() => result.current.open('a'));
    expect(result.current.details).toEqual({ id: 'a', focus: 'panel', nonce: 2 });
    expect(result.current.canGoBack).toBe(false);
  });

  it('follows links and goes back along the trail', () => {
    const { result } = setup();
    act(() => result.current.open('a'));
    act(() => result.current.openLinked('b'));
    act(() => result.current.openLinked('c'));
    expect(result.current.details?.id).toBe('c');
    act(() => result.current.goBack());
    expect(result.current.details?.id).toBe('b');
    act(() => result.current.goBack());
    expect(result.current.details?.id).toBe('a');
    expect(result.current.canGoBack).toBe(false);
  });

  it('skips deleted tasks on the way back', () => {
    const { result, rerender } = setup();
    act(() => result.current.open('a'));
    act(() => result.current.openLinked('b'));
    act(() => result.current.openLinked('c'));
    rerender({ list: [TASKS[0]!, TASKS[2]!] });
    act(() => result.current.goBack());
    expect(result.current.details?.id).toBe('a');
  });

  it('opening a task afresh forgets the trail', () => {
    const { result } = setup();
    act(() => result.current.open('a'));
    act(() => result.current.openLinked('b'));
    act(() => result.current.open('c'));
    expect(result.current.canGoBack).toBe(false);
  });

  it('closes, returning the task it showed', () => {
    const { result } = setup();
    act(() => result.current.open('b'));
    let closed: string | null = null;
    act(() => {
      closed = result.current.close();
    });
    expect(closed).toBe('b');
    expect(result.current.details).toBeNull();
  });

  it('closes by itself when its task is deleted', () => {
    const { result, rerender } = setup();
    act(() => result.current.open('b'));
    rerender({ list: [TASKS[0]!] });
    expect(result.current.details).toBeNull();
  });
});
