import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SESSION,
  documentKey,
  mergeSessionPrefs,
  normalizeSessionPrefs,
  toggleInList,
} from './session';

describe('normalizeSessionPrefs', () => {
  it('returns defaults for empty input', () => {
    expect(normalizeSessionPrefs()).toEqual(DEFAULT_SESSION);
    expect(normalizeSessionPrefs(null)).toEqual(DEFAULT_SESSION);
  });

  it('keeps valid values and rejects invalid ones', () => {
    const p = normalizeSessionPrefs({
      view: 'swimlane',
      sort: { key: 'due', dir: 'desc' },
      collapsedColumns: ['done', 42 as unknown as string],
      lastQuickAddSection: 'Build',
    });
    expect(p.view).toBe('swimlane');
    expect(p.sort).toEqual({ key: 'due', dir: 'desc' });
    expect(p.collapsedColumns).toEqual(['done']); // non-strings dropped
    expect(p.lastQuickAddSection).toBe('Build');
  });

  it('falls back on a bad view/sort', () => {
    const p = normalizeSessionPrefs({
      view: 'nonsense' as never,
      sort: { key: 'bogus' as never, dir: 'sideways' as never },
    });
    expect(p.view).toBeNull();
    expect(p.sort).toEqual({ key: 'manual', dir: 'asc' });
  });

  it('normalizes stored filters to the current shape', () => {
    const p = normalizeSessionPrefs({ filters: { search: 'hi' } as never });
    expect(p.filters.search).toBe('hi');
    expect(p.filters.assignment).toBe('any');
  });
});

describe('mergeSessionPrefs / toggleInList', () => {
  it('merges a patch immutably', () => {
    const next = mergeSessionPrefs(DEFAULT_SESSION, { view: 'sections' });
    expect(next.view).toBe('sections');
    expect(DEFAULT_SESSION.view).toBeNull();
  });

  it('toggles membership', () => {
    expect(toggleInList([], 'a')).toEqual(['a']);
    expect(toggleInList(['a', 'b'], 'a')).toEqual(['b']);
  });
});

describe('documentKey', () => {
  it('uses explicit link/volume ids', () => {
    expect(documentKey('https://docs.proton.me/u/0/doc?mode=open&volumeId=v1&linkId=l1')).toBe(
      'link:v1:l1',
    );
  });

  it('falls back to a document id param', () => {
    expect(documentKey('https://docs-editor.proton.me/doc?documentId=abc')).toBe('id:abc');
  });

  it('returns null without a stable identifier or off-domain', () => {
    expect(documentKey('https://docs.proton.me/u/0/doc?mode=open')).toBeNull();
    expect(documentKey('https://example.com/doc?linkId=x')).toBeNull();
    expect(documentKey('not a url')).toBeNull();
    expect(documentKey(undefined)).toBeNull();
  });
});
