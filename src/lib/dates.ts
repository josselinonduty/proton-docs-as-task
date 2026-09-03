/**
 * Deterministic, timezone-local due-date helpers.
 *
 * Dates are always stored as `YYYY-MM-DD` (see {@link toISODate}). Every
 * calculation here is done in the user's *local* calendar so "today",
 * "tomorrow" and the quick shortcuts land on the day the user actually sees —
 * never shifted by a UTC round-trip. Natural-language parsing is deliberately
 * out of scope: the quick options below map to exact calendar dates.
 */

export type QuickDateOption = 'today' | 'tomorrow' | 'weekend' | 'next-week';

/**
 * Presentation state of a task's due date. `completed` always wins so a done
 * task is never shown as overdue. `none` means no (parseable) due date.
 */
export type DueState =
  'none' | 'overdue' | 'today' | 'tomorrow' | 'this-week' | 'future' | 'completed';

/** Supported display formats for a stored ISO date. */
export type DateFormat = 'iso' | 'medium' | 'us' | 'euro';

/** Strict `YYYY-MM-DD` shape. */
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Local midnight for a Date (drops the time-of-day component). */
export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Serialize a Date to a local `YYYY-MM-DD` string. */
export function toISODate(d: Date): string {
  const y = d.getFullYear().toString().padStart(4, '0');
  const m = (d.getMonth() + 1).toString().padStart(2, '0');
  const day = d.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Parse a strict `YYYY-MM-DD` string into a local Date, or null if malformed. */
export function parseISODate(value: string | undefined): Date | null {
  const v = value?.trim();
  if (!v) return null;
  const m = ISO_RE.exec(v);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  // Reject impossible dates that JS would roll over (e.g. 2026-02-31).
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

/** True when `value` is exactly a well-formed `YYYY-MM-DD`. */
export function isISODate(value: string | undefined): boolean {
  return parseISODate(value) !== null;
}

/** Whole-day difference `a - b` (positive when `a` is later). */
function dayDiff(a: Date, b: Date): number {
  return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / 86_400_000);
}

function addDays(d: Date, n: number): Date {
  const next = startOfDay(d);
  next.setDate(next.getDate() + n);
  return next;
}

/**
 * The concrete calendar date a quick option resolves to, relative to `now`.
 *
 * - `today` / `tomorrow` are self-explanatory.
 * - `weekend` is the coming Saturday; on a Saturday or Sunday it is the current
 *   day, so "this weekend" always means the weekend you are in or approaching.
 * - `next-week` is the Monday that begins the following week.
 */
export function quickDate(option: QuickDateOption, now: Date = new Date()): string {
  const today = startOfDay(now);
  const dow = today.getDay(); // 0 = Sunday … 6 = Saturday
  switch (option) {
    case 'today':
      return toISODate(today);
    case 'tomorrow':
      return toISODate(addDays(today, 1));
    case 'weekend': {
      if (dow === 0 || dow === 6) return toISODate(today); // already the weekend
      return toISODate(addDays(today, 6 - dow)); // upcoming Saturday
    }
    case 'next-week': {
      const daysUntilNextMonday = (8 - dow) % 7 || 7;
      return toISODate(addDays(today, daysUntilNextMonday));
    }
  }
}

/**
 * Classify a task's due date for display. Completed tasks are reported as
 * `completed` regardless of the date so they never read as overdue. A
 * non-empty but unparseable value is treated as an (untimed) `future` date.
 */
export function dueState(
  due: string | undefined,
  now: Date = new Date(),
  completed = false,
): DueState {
  if (completed) return 'completed';
  const value = due?.trim();
  if (!value) return 'none';
  const date = parseISODate(value);
  if (!date) return 'future';
  const diff = dayDiff(date, now);
  if (diff < 0) return 'overdue';
  if (diff === 0) return 'today';
  if (diff === 1) return 'tomorrow';
  // "This week" = up to and including the coming Sunday (Monday-start week).
  const daysUntilSunday = (7 - now.getDay()) % 7;
  if (diff <= daysUntilSunday) return 'this-week';
  return 'future';
}

/** Human-readable, screen-reader-friendly label for a due state. */
export function dueStateLabel(state: DueState): string {
  switch (state) {
    case 'overdue':
      return 'Overdue';
    case 'today':
      return 'Due today';
    case 'tomorrow':
      return 'Due tomorrow';
    case 'this-week':
      return 'Due this week';
    case 'future':
      return 'Due';
    case 'completed':
      return 'Completed';
    case 'none':
      return 'No due date';
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Render a stored date for display in the configured format. Unparseable values
 * are returned unchanged so hand-typed free-form dates still show through.
 */
export function formatDate(value: string | undefined, format: DateFormat = 'iso'): string {
  const v = value?.trim() ?? '';
  const date = parseISODate(v);
  if (!date) return v;
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  switch (format) {
    case 'iso':
      return toISODate(date);
    case 'medium':
      return `${MONTHS[date.getMonth()]} ${d}, ${y}`;
    case 'us':
      return `${m}/${d}/${y}`;
    case 'euro':
      return `${d}/${m}/${y}`;
  }
}

/**
 * A short label suitable for a card badge: the relative word for near dates,
 * otherwise the formatted date. `completed` and `none` show the formatted date
 * (or nothing) rather than a state word.
 */
export function dueBadgeText(
  value: string | undefined,
  state: DueState,
  format: DateFormat = 'iso',
): string {
  switch (state) {
    case 'overdue':
    case 'today':
    case 'tomorrow':
    case 'this-week':
      return dueStateLabel(state);
    default:
      return formatDate(value, format);
  }
}
