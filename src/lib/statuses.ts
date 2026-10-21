/**
 * Per-document workflow statuses.
 *
 * Each board defines its own statuses in the document itself, as one
 * `@settings status` paragraph per status right below the activation marker:
 *
 *   @settings status review "In review" @category:doing @color:purple @bg:#efeaff
 *
 * A status has a stable `key` (what task lines reference with `@status:key`),
 * an editable `label`, a `category` that gives it meaning (a ticked checkbox,
 * progress, blockers) and optional text / background colours. A document with
 * no definitions uses {@link DEFAULT_STATUSES}; they are written into it on the
 * board's first write, so the document stays the only source of truth.
 */

import type { StatusCategory, StatusDef, StatusKey } from './types';

export type { StatusCategory, StatusDef, StatusKey };

export const STATUS_CATEGORIES: { key: StatusCategory; label: string }[] = [
  { key: 'todo', label: 'Not started' },
  { key: 'doing', label: 'In progress' },
  { key: 'done', label: 'Done' },
];

export const DEFAULT_STATUSES: readonly StatusDef[] = [
  { key: 'todo', label: 'To Do', category: 'todo' },
  { key: 'doing', label: 'In Progress', category: 'doing' },
  { key: 'done', label: 'Done', category: 'done' },
];

/** Categories every board needs at least one status of. */
const REQUIRED_CATEGORIES: StatusCategory[] = ['todo', 'done'];

/**
 * Named swatches. Each maps to a `--pdt-swatch-<name>-text` / `-bg` token pair
 * that adapts to the light and dark themes with readable text on its tint.
 */
export const STATUS_SWATCHES = ['grey', 'purple', 'blue', 'green', 'orange', 'red'] as const;
export type StatusSwatch = (typeof STATUS_SWATCHES)[number];

const HEX_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
const KEY_RE = /^[a-z0-9][a-z0-9_-]*$/;

/** Whether `value` is a known swatch name. */
export function isSwatch(value: string | undefined): value is StatusSwatch {
  return (STATUS_SWATCHES as readonly string[]).includes(value ?? '');
}

/** Normalize a colour to a swatch name or lowercase `#rrggbb`; undefined if invalid. */
export function normalizeColor(value: string | undefined): string | undefined {
  const v = value?.trim().toLowerCase();
  if (!v) return undefined;
  if (isSwatch(v)) return v;
  if (!HEX_RE.test(v)) return undefined;
  return v.length === 4 ? `#${[...v.slice(1)].map((c) => c + c).join('')}` : v;
}

/** The CSS value for a stored colour, for the text (`text`) or background (`bg`) role. */
export function colorCss(value: string | undefined, role: 'text' | 'bg'): string | undefined {
  if (!value) return undefined;
  return isSwatch(value) ? `var(--pdt-swatch-${value}-${role})` : value;
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

/** WCAG contrast ratio between two `#rrggbb` colours. */
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/**
 * True when a status pairs two custom colours below WCAG AA for small text.
 * Swatches are contrast-checked in the design tokens, so only hex pairs warn.
 */
export function hasLowContrast(def: Pick<StatusDef, 'color' | 'bg'>): boolean {
  const { color, bg } = def;
  if (!color || !bg || isSwatch(color) || isSwatch(bg)) return false;
  return contrastRatio(color, bg) < 4.5;
}

/** Turn a label into a key candidate (`In review` → `in-review`). */
export function slugifyKey(label: string): string {
  const slug = label
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '');
  return slug || 'status';
}

/** A key derived from `label` that no status in `statuses` uses yet. */
export function uniqueStatusKey(statuses: readonly StatusDef[], label: string): string {
  const base = slugifyKey(label);
  const taken = new Set(statuses.map((s) => s.key));
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function findStatus(statuses: readonly StatusDef[], key: StatusKey): StatusDef | undefined {
  return statuses.find((s) => s.key === key);
}

/** True when `key` is a status of the Done category. */
export function isDoneStatus(statuses: readonly StatusDef[], key: StatusKey): boolean {
  return findStatus(statuses, key)?.category === 'done';
}

/**
 * The status a task gets from its checkbox alone: the first Done status when
 * ticked, else the first Not started one. Task lines omit `@status` for it.
 */
export function defaultStatus(statuses: readonly StatusDef[], done: boolean): StatusKey {
  const category: StatusCategory = done ? 'done' : 'todo';
  return (statuses.find((s) => s.category === category) ?? statuses[0])?.key ?? category;
}

/** Whether `key` is the last status of a category the board can't do without. */
export function isLastOfRequiredCategory(statuses: readonly StatusDef[], key: StatusKey): boolean {
  const status = findStatus(statuses, key);
  if (!status || !REQUIRED_CATEGORIES.includes(status.category)) return false;
  return statuses.filter((s) => s.category === status.category).length === 1;
}

/**
 * Make a parsed status list usable: drop duplicate keys (first wins) and make
 * sure a Not started and a Done status exist, adding the built-in ones when a
 * hand edit removed them. An empty list falls back to {@link DEFAULT_STATUSES}.
 */
export function normalizeStatuses(input: readonly StatusDef[]): StatusDef[] {
  const seen = new Set<string>();
  const statuses = input.filter((s) => !seen.has(s.key) && seen.add(s.key));
  if (statuses.length === 0) return DEFAULT_STATUSES.map((s) => ({ ...s }));
  for (const category of REQUIRED_CATEGORIES) {
    if (statuses.some((s) => s.category === category)) continue;
    const fallback = DEFAULT_STATUSES.find((s) => s.category === category)!;
    const added = { ...fallback, key: uniqueStatusKey(statuses, fallback.key) };
    if (category === 'todo') statuses.unshift(added);
    else statuses.push(added);
  }
  return statuses;
}

// ---------------------------------------------------------------------------
// `@settings status` lines.
// ---------------------------------------------------------------------------

/** Matches a settings paragraph; captures the kind and the rest of the line. */
export const SETTINGS_LINE_RE = /^@settings\s+(\S+)\s*(.*)$/i;

const STATUS_BODY_RE = /^(\S+?)(?:\s+"((?:\\.|[^"\\])*)")?(?=\s|$)(.*)$/;

function attr(rest: string, name: string): string | undefined {
  return new RegExp(`(?:^|\\s)@${name}:(\\S+)`, 'i').exec(rest)?.[1];
}

const escapeLabel = (label: string) => label.replace(/[\\"]/g, (c) => `\\${c}`);
const unescapeLabel = (label: string) => label.replace(/\\(.)/g, '$1');

/**
 * Parse one `@settings status <key> "<label>" @category:… @color:… @bg:…`
 * line. Returns undefined for any other line or an unusable key. A missing
 * label falls back to the key, an unknown category to Not started, and an
 * invalid colour is ignored.
 */
export function parseStatusSetting(line: string): StatusDef | undefined {
  const settings = SETTINGS_LINE_RE.exec(line.trim());
  if (!settings || settings[1]!.toLowerCase() !== 'status') return undefined;
  const body = STATUS_BODY_RE.exec(settings[2] ?? '');
  const key = body?.[1]?.toLowerCase();
  if (!body || !key || !KEY_RE.test(key)) return undefined;
  const rest = body[3] ?? '';
  const category = attr(rest, 'category')?.toLowerCase();
  const def: StatusDef = {
    key,
    label: unescapeLabel(body[2] ?? '').trim() || key,
    category: STATUS_CATEGORIES.some((c) => c.key === category)
      ? (category as StatusCategory)
      : 'todo',
  };
  const color = normalizeColor(attr(rest, 'color'));
  const bg = normalizeColor(attr(rest, 'bg'));
  if (color) def.color = color;
  if (bg) def.bg = bg;
  return def;
}

/** Serialize a status as its `@settings status` line. */
export function serializeStatusSetting(def: StatusDef): string {
  const label = def.label.replace(/\s+/g, ' ').trim() || def.key;
  const parts = [`@settings status ${def.key} "${escapeLabel(label)}" @category:${def.category}`];
  if (def.color) parts.push(`@color:${def.color}`);
  if (def.bg) parts.push(`@bg:${def.bg}`);
  return parts.join(' ');
}
