import { describe, expect, it } from 'vitest';
import { DEFAULT_CARD_FIELDS, DEFAULT_SETTINGS, withDefaults } from './defaults';

describe('withDefaults — v0.6 fields', () => {
  it('fills new fields with defaults for an old stored object', () => {
    const s = withDefaults({ enabled: true });
    expect(s.cardFields).toEqual(DEFAULT_CARD_FIELDS);
    expect(s.completedDisplay).toBe('show');
    expect(s.dateFormat).toBe('iso');
    expect(s.userAssignee).toBe('');
  });

  it('migrates collapseDoneByDefault → completedDisplay', () => {
    const s = withDefaults({ collapseDoneByDefault: true });
    expect(s.completedDisplay).toBe('collapse');
  });

  it('keeps completedDisplay and back-fills the legacy flag', () => {
    const s = withDefaults({ completedDisplay: 'hide' });
    expect(s.completedDisplay).toBe('hide');
    expect(s.collapseDoneByDefault).toBe(false);
  });

  it('merges partial cardFields over defaults', () => {
    const s = withDefaults({ cardFields: { priority: false } as never });
    expect(s.cardFields.priority).toBe(false);
    expect(s.cardFields.due).toBe(true);
  });

  it('rejects an invalid dateFormat and trims userAssignee', () => {
    const s = withDefaults({ dateFormat: 'klingon' as never, userAssignee: '  Sam  ' });
    expect(s.dateFormat).toBe('iso');
    expect(s.userAssignee).toBe('Sam');
  });

  it('DEFAULT_SETTINGS is already normalized', () => {
    expect(withDefaults(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });
});
