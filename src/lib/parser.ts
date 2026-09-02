import type { ParseResult, Priority, StatusKey, Task } from './types';

const DEFAULT_SECTION = 'Tasks';

/** Matches a markdown-style heading line: `#`..`######` + space + text. */
const HEADING_RE = /^(#{1,6})\s+(.*\S)\s*$/;

/**
 * Matches a task line. Accepts:
 *   - `[ ] text`  /  `- [ ] text`  /  `* [x] text`   (checkbox items)
 *   - `- text`    /  `* text`      /  `+ text`        (plain bullets)
 * Captures: 1 = checkbox char (space/x) when present, 2 = remaining text.
 */
const CHECKBOX_RE = /^\s*(?:[-*+]\s*)?\[([ xX])\]\s*(.*)$/;
const BULLET_RE = /^\s*[-*+]\s+(.*)$/;

const STATUS_SYNONYMS: Record<string, StatusKey> = {
  todo: 'todo',
  backlog: 'todo',
  open: 'todo',
  new: 'todo',
  doing: 'doing',
  wip: 'doing',
  progress: 'doing',
  inprogress: 'doing',
  'in-progress': 'doing',
  started: 'doing',
  done: 'done',
  complete: 'done',
  completed: 'done',
  closed: 'done',
  finished: 'done',
};

const PRIORITY_SYNONYMS: Record<string, Priority> = {
  high: 'high',
  h: 'high',
  '3': 'high',
  urgent: 'high',
  medium: 'medium',
  med: 'medium',
  m: 'medium',
  '2': 'medium',
  normal: 'medium',
  low: 'low',
  l: 'low',
  '1': 'low',
};

/** Removes the first regex match from `text` and returns its capture + remainder. */
function extractFirst(text: string, patterns: RegExp[]): { value?: string; text: string } {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m) {
      const value = (m[1] ?? '').trim();
      return { value, text: text.replace(m[0], ' ') };
    }
  }
  return { text };
}

interface Meta {
  status?: StatusKey;
  priority?: Priority;
  due?: string;
  assignee?: string;
  description?: string;
  labels: string[];
  title: string;
}

/**
 * `@desc(...)` value grammar. The board writes descriptions back into the doc
 * as a single hidden token; parentheses inside the text are backslash-escaped
 * so they round-trip cleanly.
 */
const DESC_RE = /@desc\(((?:\\.|[^)\\])*)\)/i;

/** Reverse the escaping applied by `encodeDescription`. */
export function decodeDescription(value: string): string {
  return value.replace(/\\(.)/g, '$1');
}

/** Escape a description so it can live inside `@desc(...)` on a single line. */
export function encodeDescription(value: string): string {
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/\n+/g, ' ')
    .replace(/[\\)]/g, (c) => `\\${c}`)
    .trim();
}

/** Pull all recognized inline metadata tokens out of a task's text. */
export function extractMeta(input: string): Meta {
  let text = input;
  const labels: string[] = [];

  // Description: @desc(...) with backslash-escaped parens. Pulled first so its
  // free-form contents can't be mistaken for labels or other metadata tokens.
  let description: string | undefined;
  const descMatch = DESC_RE.exec(text);
  if (descMatch) {
    description = decodeDescription(descMatch[1] ?? '').trim() || undefined;
    text = text.replace(descMatch[0], ' ');
  }

  // Labels: `#label` anywhere (word chars + dashes). Collect all.
  text = text.replace(/(^|\s)#([\p{L}\p{N}_-]+)/gu, (_all, pre, label) => {
    labels.push(label);
    return pre;
  });

  // Status: @status(...) / @status:... / @s:...
  const status = extractFirst(text, [/@(?:status|s)\(([^)]*)\)/i, /@(?:status|s):(\S+)/i]);
  text = status.text;

  // Priority: @priority(...) / @p:... plus bang shorthands (!, !!, !!!).
  const prio = extractFirst(text, [
    /@(?:priority|prio|p)\(([^)]*)\)/i,
    /@(?:priority|prio|p):(\S+)/i,
  ]);
  text = prio.text;
  let bangPriority: Priority | undefined;
  text = text.replace(/(^|\s)(!{1,3})(?=\s|$)/g, (_all, pre, bangs: string) => {
    bangPriority = bangs.length === 3 ? 'high' : bangs.length === 2 ? 'medium' : 'low';
    return pre;
  });

  // Due date: @due(...) / @due:...
  const due = extractFirst(text, [/@due\(([^)]*)\)/i, /@due:(\S+)/i]);
  text = due.text;

  // Assignee: @assignee(...) / @who:... / @@mention
  const assignee = extractFirst(text, [
    /@(?:assignee|owner|who|a)\(([^)]*)\)/i,
    /@(?:assignee|owner|who|a):(\S+)/i,
    /(?:^|\s)@@(\S+)/,
  ]);
  text = assignee.text;

  const priorityValue = prio.value ? PRIORITY_SYNONYMS[prio.value.toLowerCase()] : bangPriority;

  return {
    status: status.value
      ? STATUS_SYNONYMS[status.value.toLowerCase().replace(/\s+/g, '')]
      : undefined,
    priority: priorityValue,
    due: due.value || undefined,
    assignee: assignee.value || undefined,
    description,
    labels,
    title: text.replace(/\s+/g, ' ').trim(),
  };
}

/** Returns true when `line` (first non-empty one) activates a task board. */
export function matchMarker(
  line: string,
  markers: string[],
): { matched: boolean; marker?: string; title?: string } {
  const trimmed = line.trim();
  const lower = trimmed.toLowerCase();
  for (const marker of markers) {
    const m = marker.trim().toLowerCase();
    if (!m) continue;
    if (lower === m || lower.startsWith(m + ' ')) {
      return {
        matched: true,
        marker,
        title: trimmed.slice(marker.trim().length).trim() || undefined,
      };
    }
  }
  return { matched: false };
}

/**
 * Parse a document's plain text into a task board model.
 *
 * A document activates only when its first non-empty line starts with one of
 * the configured markers. Everything after the marker line is parsed for
 * headings (sections) and checkbox/bullet lines (tasks).
 */
export function parseDocument(text: string, markers: string[]): ParseResult {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');

  // Find the first non-empty line — the potential marker line.
  let markerIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if ((lines[i] ?? '').trim() !== '') {
      markerIndex = i;
      break;
    }
  }

  if (markerIndex === -1) {
    return { activated: false, tasks: [], sections: [] };
  }

  const marker = matchMarker(lines[markerIndex] ?? '', markers);
  if (!marker.matched) {
    return { activated: false, tasks: [], sections: [] };
  }

  const tasks: Task[] = [];
  const sections: string[] = [];
  let currentSection = DEFAULT_SECTION;

  for (let i = markerIndex + 1; i < lines.length; i++) {
    const rawLine = lines[i] ?? '';
    const line = rawLine.trim();
    if (line === '') continue;

    const heading = HEADING_RE.exec(line);
    if (heading) {
      currentSection = (heading[2] ?? '').trim();
      if (!sections.includes(currentSection)) sections.push(currentSection);
      continue;
    }

    let checked = false;
    let body: string | null = null;

    const checkbox = CHECKBOX_RE.exec(rawLine);
    if (checkbox) {
      checked = (checkbox[1] ?? '').toLowerCase() === 'x';
      body = checkbox[2] ?? '';
    } else {
      const bullet = BULLET_RE.exec(rawLine);
      if (bullet) body = bullet[1] ?? '';
    }

    if (body === null) continue;

    const meta = extractMeta(body);
    if (meta.title === '' && meta.labels.length === 0 && !meta.description) continue;

    const status: StatusKey = meta.status ?? (checked ? 'done' : 'todo');
    // Keep `checked` consistent with a resolved done status.
    const resolvedChecked = checked || status === 'done';

    if (!sections.includes(currentSection)) sections.push(currentSection);

    tasks.push({
      id: `task-${i}`,
      title: meta.title,
      status,
      checked: resolvedChecked,
      priority: meta.priority,
      due: meta.due,
      assignee: meta.assignee,
      description: meta.description,
      labels: meta.labels,
      section: currentSection,
      sourceLine: i,
      raw: rawLine,
    });
  }

  return {
    activated: true,
    matchedMarker: marker.marker,
    boardTitle: marker.title,
    tasks,
    sections: sections.length > 0 ? sections : [DEFAULT_SECTION],
  };
}
