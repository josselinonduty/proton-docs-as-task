// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import type { DragEvent } from 'react';
import { useBoardDnd } from './useBoardDnd';

/** Just enough of a drag event for the handlers. */
function dragEvent(currentTarget = document.createElement('div')) {
  return {
    preventDefault: vi.fn(),
    currentTarget,
    clientY: 0,
    relatedTarget: null,
  } as unknown as DragEvent<HTMLElement>;
}

describe('useBoardDnd', () => {
  it('shows the dragged card as dragging only after dragstart returns', () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useBoardDnd());
    act(() => result.current.start('a'));
    expect(result.current.draggingId).toBeNull();
    act(() => void vi.runAllTimers());
    expect(result.current.draggingId).toBe('a');
    vi.useRealTimers();
  });

  it('drops on a column at the slot it was hovering, then resets', () => {
    const { result } = renderHook(() => useBoardDnd());
    const onDrop = vi.fn();
    act(() => result.current.start('a'));
    act(() => result.current.column('todo', onDrop).onDragOver(dragEvent()));
    expect(result.current.dropTarget).toEqual({ key: 'todo', beforeId: null });
    act(() => result.current.column('todo', onDrop).onDrop(dragEvent()));
    expect(onDrop).toHaveBeenCalledWith('a', null);
    expect(result.current.dropTarget).toBeNull();
    expect(result.current.draggingId).toBeNull();
  });

  it('drops on a swimlane cell', () => {
    const { result } = renderHook(() => useBoardDnd());
    const onDrop = vi.fn();
    act(() => result.current.start('b'));
    act(() => result.current.cell('Build::todo', onDrop).onDrop(dragEvent()));
    expect(onDrop).toHaveBeenCalledWith('b');
  });

  it('ignores drops when nothing is being dragged', () => {
    const { result } = renderHook(() => useBoardDnd());
    const onDrop = vi.fn();
    act(() => result.current.column('todo', onDrop).onDragOver(dragEvent()));
    expect(result.current.dropTarget).toBeNull();
    act(() => result.current.column('todo', onDrop).onDrop(dragEvent()));
    expect(onDrop).not.toHaveBeenCalled();
  });

  it('clears the target when the pointer leaves the column', () => {
    const { result } = renderHook(() => useBoardDnd());
    act(() => result.current.start('a'));
    act(() => result.current.column('todo', vi.fn()).onDragOver(dragEvent()));
    act(() => result.current.column('todo', vi.fn()).onDragLeave(dragEvent()));
    expect(result.current.dropTarget).toBeNull();
  });
});
