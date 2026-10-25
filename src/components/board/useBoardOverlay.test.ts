// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useBoardOverlay } from './useBoardOverlay';

describe('useBoardOverlay', () => {
  it('starts closed', () => {
    const { result } = renderHook(() => useBoardOverlay());
    expect(result.current.overlay).toEqual({ kind: 'none' });
    expect(result.current.isOpen).toBe(false);
  });

  it('opens one overlay at a time, the latest replacing the previous', () => {
    const { result } = renderHook(() => useBoardOverlay());
    act(() => result.current.open({ kind: 'quickAdd', preset: { section: 'Build' } }));
    expect(result.current.overlay).toEqual({ kind: 'quickAdd', preset: { section: 'Build' } });
    expect(result.current.isOpen).toBe(true);
    act(() => result.current.open({ kind: 'help' }));
    expect(result.current.overlay).toEqual({ kind: 'help' });
  });

  it('closes only the named overlay', () => {
    const { result } = renderHook(() => useBoardOverlay());
    act(() => result.current.open({ kind: 'boardSettings' }));
    act(() => result.current.close('deleteCard'));
    expect(result.current.overlay.kind).toBe('boardSettings');
    act(() => result.current.close('boardSettings'));
    expect(result.current.overlay.kind).toBe('none');
  });

  it('closes whatever is open without a kind', () => {
    const { result } = renderHook(() => useBoardOverlay());
    act(() => result.current.open({ kind: 'deleteSection', name: 'Build', count: 2 }));
    act(() => result.current.close());
    expect(result.current.isOpen).toBe(false);
  });
});
