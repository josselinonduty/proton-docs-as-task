import { describe, expect, it } from 'vitest';
import {
  dueBadgeText,
  dueState,
  dueStateLabel,
  formatDate,
  isISODate,
  parseISODate,
  quickDate,
  toISODate,
} from './dates';

// A fixed local reference: Wednesday, 2026-09-03.
const WED = new Date(2026, 8, 3);

describe('toISODate / parseISODate', () => {
  it('round-trips a local date without UTC drift', () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toISODate(new Date(2026, 11, 31))).toBe('2026-12-31');
  });

  it('parses only well-formed calendar dates', () => {
    expect(parseISODate('2026-09-03')?.getDate()).toBe(3);
    expect(parseISODate('2026-9-3')).toBeNull(); // not zero-padded
    expect(parseISODate('2026-13-01')).toBeNull(); // bad month
    expect(parseISODate('2026-02-31')).toBeNull(); // rolls over
    expect(parseISODate('')).toBeNull();
    expect(parseISODate(undefined)).toBeNull();
    expect(parseISODate('next friday')).toBeNull();
  });

  it('isISODate reflects parseability', () => {
    expect(isISODate('2026-09-03')).toBe(true);
    expect(isISODate('tomorrow')).toBe(false);
  });
});

describe('quickDate', () => {
  it('today and tomorrow are exact', () => {
    expect(quickDate('today', WED)).toBe('2026-09-03');
    expect(quickDate('tomorrow', WED)).toBe('2026-09-04');
  });

  it('weekend resolves to the coming Saturday from a weekday', () => {
    // Wed 2026-09-03 → Sat 2026-09-05
    expect(quickDate('weekend', WED)).toBe('2026-09-05');
  });

  it('weekend stays on the current day across Sat/Sun', () => {
    const sat = new Date(2026, 8, 5); // Saturday
    const sun = new Date(2026, 8, 6); // Sunday
    expect(quickDate('weekend', sat)).toBe('2026-09-05');
    expect(quickDate('weekend', sun)).toBe('2026-09-06');
  });

  it('next-week is the following Monday', () => {
    // Wed 2026-09-03 → Mon 2026-09-07
    expect(quickDate('next-week', WED)).toBe('2026-09-07');
    // From a Monday, next week is +7.
    const mon = new Date(2026, 8, 7);
    expect(quickDate('next-week', mon)).toBe('2026-09-14');
    // From a Sunday, next Monday is tomorrow.
    const sun = new Date(2026, 8, 6);
    expect(quickDate('next-week', sun)).toBe('2026-09-07');
  });

  it('is deterministic regardless of time of day', () => {
    const morning = new Date(2026, 8, 3, 1, 0, 0);
    const evening = new Date(2026, 8, 3, 23, 59, 0);
    expect(quickDate('today', morning)).toBe(quickDate('today', evening));
    expect(quickDate('next-week', morning)).toBe(quickDate('next-week', evening));
  });
});

describe('dueState', () => {
  it('classifies relative buckets in local time', () => {
    expect(dueState('2026-09-02', WED)).toBe('overdue');
    expect(dueState('2026-09-03', WED)).toBe('today');
    expect(dueState('2026-09-04', WED)).toBe('tomorrow');
    expect(dueState('2026-09-05', WED)).toBe('this-week'); // Sat, same week
    expect(dueState('2026-09-06', WED)).toBe('this-week'); // Sun, end of week
    expect(dueState('2026-09-07', WED)).toBe('future'); // next Mon
    expect(dueState('2026-12-01', WED)).toBe('future');
    expect(dueState(undefined, WED)).toBe('none');
    expect(dueState('', WED)).toBe('none');
  });

  it('treats unparseable non-empty values as future', () => {
    expect(dueState('someday', WED)).toBe('future');
  });

  it('completed always wins so a done task is never overdue', () => {
    expect(dueState('2026-09-01', WED, true)).toBe('completed');
    expect(dueState(undefined, WED, true)).toBe('completed');
  });
});

describe('formatDate', () => {
  it('renders the configured display format', () => {
    expect(formatDate('2026-09-03', 'iso')).toBe('2026-09-03');
    expect(formatDate('2026-09-03', 'medium')).toBe('Sep 3, 2026');
    expect(formatDate('2026-09-03', 'us')).toBe('9/3/2026');
    expect(formatDate('2026-09-03', 'euro')).toBe('3/9/2026');
  });

  it('passes through free-form values unchanged', () => {
    expect(formatDate('next friday', 'medium')).toBe('next friday');
    expect(formatDate(undefined)).toBe('');
  });
});

describe('dueBadgeText / dueStateLabel', () => {
  it('uses relative words for near dates and formatted date otherwise', () => {
    expect(dueBadgeText('2026-09-03', dueState('2026-09-03', WED), 'iso')).toBe('Due today');
    expect(dueBadgeText('2026-12-01', dueState('2026-12-01', WED), 'medium')).toBe('Dec 1, 2026');
  });

  it('labels every state readably', () => {
    expect(dueStateLabel('overdue')).toBe('Overdue');
    expect(dueStateLabel('this-week')).toBe('Due this week');
    expect(dueStateLabel('completed')).toBe('Completed');
  });
});
