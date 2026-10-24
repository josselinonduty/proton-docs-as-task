import { describe, expect, it } from 'vitest';
import {
  colorCss,
  contrastRatio,
  DEFAULT_STATUSES,
  defaultStatus,
  flowSummary,
  hasLowContrast,
  isLastOfRequiredCategory,
  normalizeColor,
  normalizeStatuses,
  parseStatusSetting,
  serializeStatusSetting,
  slugifyKey,
  STATUS_FLOW_TEMPLATES,
  statusesForFlow,
  uniqueStatusKey,
} from './statuses';
import { STATUS_FLOWS, type StatusDef } from './types';

describe('parseStatusSetting', () => {
  it('reads key, quoted label, category and colours', () => {
    expect(
      parseStatusSetting(
        '@settings status review "In review" @category:doing @color:purple @bg:#EFEAFF',
      ),
    ).toEqual({
      key: 'review',
      label: 'In review',
      category: 'doing',
      color: 'purple',
      bg: '#efeaff',
    });
  });

  it('unescapes quotes and backslashes in the label', () => {
    expect(
      parseStatusSetting('@settings status q "Say \\"hi\\" \\\\o/" @category:todo')?.label,
    ).toBe('Say "hi" \\o/');
  });

  it('falls back to the key as label and to Not started as category', () => {
    expect(parseStatusSetting('@settings status Backlog')).toEqual({
      key: 'backlog',
      label: 'backlog',
      category: 'todo',
    });
    expect(parseStatusSetting('@settings status x "X" @category:nope')?.category).toBe('todo');
  });

  it('ignores invalid colours, other settings and unusable keys', () => {
    expect(parseStatusSetting('@settings status x "X" @color:teal @bg:#12')).toEqual({
      key: 'x',
      label: 'X',
      category: 'todo',
    });
    expect(parseStatusSetting('@settings theme dark')).toBeUndefined();
    expect(parseStatusSetting('@settings status "No key"')).toBeUndefined();
    expect(parseStatusSetting('- [ ] @settings status x')).toBeUndefined();
  });

  it('round-trips through serializeStatusSetting', () => {
    const def: StatusDef = {
      key: 'qa',
      label: 'Q"A',
      category: 'done',
      color: '#ffffff',
      bg: 'green',
    };
    const line = serializeStatusSetting(def);
    expect(line).toBe('@settings status qa "Q\\"A" @category:done @color:#ffffff @bg:green');
    expect(parseStatusSetting(line)).toEqual(def);
  });
});

describe('normalizeStatuses', () => {
  it('falls back to the built-in statuses when none are defined', () => {
    expect(normalizeStatuses([])).toEqual(DEFAULT_STATUSES);
  });

  it('drops duplicate keys, first wins', () => {
    const statuses = normalizeStatuses([
      { key: 'a', label: 'A', category: 'todo' },
      { key: 'a', label: 'Again', category: 'doing' },
      { key: 'b', label: 'B', category: 'done' },
    ]);
    expect(statuses.map((s) => s.label)).toEqual(['A', 'B']);
  });

  it('adds a Not started and a Done status when a hand edit removed them', () => {
    const statuses = normalizeStatuses([{ key: 'todo', label: 'Doing', category: 'doing' }]);
    expect(statuses.map((s) => [s.key, s.category])).toEqual([
      ['todo-2', 'todo'],
      ['todo', 'doing'],
      ['done', 'done'],
    ]);
  });
});

describe('status helpers', () => {
  const statuses: StatusDef[] = [
    { key: 'backlog', label: 'Backlog', category: 'todo' },
    { key: 'ready', label: 'Ready', category: 'todo' },
    { key: 'shipped', label: 'Shipped', category: 'done' },
  ];

  it('picks the first status of the checkbox category', () => {
    expect(defaultStatus(statuses, false)).toBe('backlog');
    expect(defaultStatus(statuses, true)).toBe('shipped');
  });

  it('knows the last status of a required category', () => {
    expect(isLastOfRequiredCategory(statuses, 'backlog')).toBe(false);
    expect(isLastOfRequiredCategory(statuses, 'shipped')).toBe(true);
  });

  it('derives unique keys from labels', () => {
    expect(slugifyKey('  In Révision! ')).toBe('in-revision');
    expect(slugifyKey('🚀')).toBe('status');
    expect(uniqueStatusKey(statuses, 'Ready')).toBe('ready-2');
  });

  it('normalizes and renders colours', () => {
    expect(normalizeColor('#ABC')).toBe('#aabbcc');
    expect(normalizeColor('Blue')).toBe('blue');
    expect(normalizeColor('rebeccapurple')).toBeUndefined();
    expect(colorCss('blue', 'bg')).toBe('var(--pdt-swatch-blue-bg)');
    expect(colorCss('#123456', 'text')).toBe('#123456');
    expect(colorCss(undefined, 'text')).toBeUndefined();
  });

  it('warns only on a low-contrast custom pair', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21);
    expect(hasLowContrast({ color: '#777777', bg: '#888888' })).toBe(true);
    expect(hasLowContrast({ color: '#000000', bg: '#ffffff' })).toBe(false);
    expect(hasLowContrast({ color: 'blue', bg: '#0000ff' })).toBe(false);
    expect(hasLowContrast({ color: '#777777' })).toBe(false);
  });
});

describe('STATUS_FLOW_TEMPLATES', () => {
  it('gives every flow a Not started and a Done status', () => {
    for (const flow of STATUS_FLOWS) {
      const categories = STATUS_FLOW_TEMPLATES[flow].map((s) => s.category);
      expect(categories).toContain('todo');
      expect(categories).toContain('done');
      expect(normalizeStatuses(STATUS_FLOW_TEMPLATES[flow])).toEqual(STATUS_FLOW_TEMPLATES[flow]);
    }
  });

  it('summarizes a flow as a chain of labels', () => {
    expect(flowSummary('review')).toBe('To Do → In Progress → In review → Done');
  });

  it('hands out copies', () => {
    statusesForFlow('standard')[0]!.label = 'Changed';
    expect(DEFAULT_STATUSES[0]!.label).toBe('To Do');
  });
});
