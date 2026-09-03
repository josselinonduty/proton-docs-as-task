import { describe, expect, it } from 'vitest';
import { parseDocument } from './parser';
import { DEFAULT_MARKERS } from './defaults';
import { fromParseResult } from './model';
import {
  addLabel,
  buildAssigneeIndex,
  buildLabelIndex,
  canonicalize,
  matchSuggestions,
  normalizeLabel,
  removeLabel,
} from './suggestions';

const DOC = [
  '#!tasks',
  '## Work',
  '- [ ] A @who:Sam #api #Backend',
  '- [ ] B @who:sam #api',
  '- [ ] C @who:Alex #ui',
  '- [ ] D #API',
].join('\n');

const model = fromParseResult(parseDocument(DOC, DEFAULT_MARKERS));

describe('buildAssigneeIndex', () => {
  it('folds case-insensitively, keeps first capitalization, counts usage', () => {
    const idx = buildAssigneeIndex(model);
    // Sam (2 uses, first-seen "Sam") ranks above Alex (1).
    expect(idx).toEqual([
      { value: 'Sam', count: 2 },
      { value: 'Alex', count: 1 },
    ]);
  });
});

describe('buildLabelIndex', () => {
  it('collapses #API/#api, strips #, and counts usage', () => {
    const idx = buildLabelIndex(model);
    expect(idx).toEqual([
      { value: 'api', count: 3 },
      { value: 'Backend', count: 1 },
      { value: 'ui', count: 1 },
    ]);
  });
});

describe('matchSuggestions', () => {
  const idx = buildLabelIndex(model);
  it('returns everything for an empty query', () => {
    expect(matchSuggestions(idx, '').map((s) => s.value)).toEqual(['api', 'Backend', 'ui']);
  });
  it('is case-insensitive and prefers prefix matches', () => {
    // 'a' matches 'api' (prefix, first) and 'Backend' (interior).
    expect(matchSuggestions(idx, 'a').map((s) => s.value)).toEqual(['api', 'Backend']);
    // "b" matches Backend (prefix) — interior matches would come after.
    expect(matchSuggestions(idx, 'B').map((s) => s.value)).toEqual(['Backend']);
  });
  it('excludes already-selected values and honors the limit', () => {
    expect(matchSuggestions(idx, '', { exclude: ['api'] }).map((s) => s.value)).toEqual([
      'Backend',
      'ui',
    ]);
    expect(matchSuggestions(idx, '', { limit: 1 })).toHaveLength(1);
  });
});

describe('label helpers', () => {
  it('normalizeLabel strips leading # and trims', () => {
    expect(normalizeLabel('  #Foo ')).toBe('Foo');
    expect(normalizeLabel('##bar')).toBe('bar');
    expect(normalizeLabel('   ')).toBe('');
  });

  it('addLabel prevents case-insensitive duplicates on the task', () => {
    const labels = ['api'];
    expect(addLabel(labels, 'API')).toBe(labels); // unchanged reference
    expect(addLabel(labels, '  #Api ')).toBe(labels);
  });

  it('addLabel reuses existing capitalization from the index', () => {
    const idx = buildLabelIndex(model);
    expect(addLabel([], '#backend', idx)).toEqual(['Backend']);
    expect(addLabel([], 'newlabel', idx)).toEqual(['newlabel']);
  });

  it('removeLabel removes case-insensitively', () => {
    expect(removeLabel(['api', 'ui'], 'API')).toEqual(['ui']);
  });
});

describe('canonicalize', () => {
  it('returns the stored capitalization when known, else the trimmed input', () => {
    const idx = buildAssigneeIndex(model);
    expect(canonicalize(idx, 'sam')).toBe('Sam');
    expect(canonicalize(idx, ' NewPerson ')).toBe('NewPerson');
  });
});
