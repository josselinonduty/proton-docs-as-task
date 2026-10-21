import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CARD_FIELDS,
  DEFAULT_MARKERS,
  DEFAULT_SETTINGS,
  migrateLegacySettings,
  withDefaults,
} from './defaults';

describe('withDefaults', () => {
  it('fills missing fields with defaults', () => {
    const s = withDefaults({ enabled: false });
    expect(s).toEqual({ ...DEFAULT_SETTINGS, enabled: false });
  });

  it('merges partial cardFields over defaults', () => {
    const s = withDefaults({ cardFields: { priority: false } as never });
    expect(s.cardFields).toEqual({ ...DEFAULT_CARD_FIELDS, priority: false });
  });

  it('replaces invalid enum values', () => {
    const s = withDefaults({
      defaultView: 'gantt',
      theme: 'neon',
      density: 'cozy',
      completedDisplay: 'archive',
      dateFormat: 'klingon',
      language: 'xx',
    } as never);
    expect(s.defaultView).toBe('workflow');
    expect(s.theme).toBe('system');
    expect(s.density).toBe('comfortable');
    expect(s.completedDisplay).toBe('show');
    expect(s.dateFormat).toBe('iso');
    expect(s.language).toBe('auto');
  });

  it('keeps a supported language', () => {
    expect(withDefaults({ language: 'ja' }).language).toBe('ja');
  });

  it('trims markers and userAssignee, never leaving markers empty', () => {
    expect(withDefaults({ markers: [' #!todo ', ''] }).markers).toEqual(['#!todo']);
    expect(withDefaults({ markers: ['  '] }).markers).toEqual(DEFAULT_MARKERS);
    expect(withDefaults({ userAssignee: '  Sam  ' }).userAssignee).toBe('Sam');
  });

  it('drops unknown keys', () => {
    expect(withDefaults({ legacy: true } as never)).not.toHaveProperty('legacy');
  });

  it('DEFAULT_SETTINGS is already normalized', () => {
    expect(withDefaults(DEFAULT_SETTINGS)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('migrateLegacySettings', () => {
  it('maps the v0.4 grouping onto defaultView', () => {
    expect(migrateLegacySettings({ grouping: 'section' }).defaultView).toBe('sections');
    expect(migrateLegacySettings({ grouping: 'status' }).defaultView).toBe('workflow');
    expect(migrateLegacySettings({ grouping: 'section', defaultView: 'list' }).defaultView).toBe(
      'list',
    );
  });

  it('maps collapseDoneByDefault onto completedDisplay', () => {
    expect(migrateLegacySettings({ collapseDoneByDefault: true }).completedDisplay).toBe(
      'collapse',
    );
    expect(
      migrateLegacySettings({ collapseDoneByDefault: true, completedDisplay: 'hide' })
        .completedDisplay,
    ).toBe('hide');
  });

  it('drops the legacy fields, including the global status labels', () => {
    const s = migrateLegacySettings({
      grouping: 'status',
      collapseDoneByDefault: false,
      columns: [{ key: 'todo', label: 'Later' }],
    });
    expect(s).toEqual(DEFAULT_SETTINGS);
  });
});
