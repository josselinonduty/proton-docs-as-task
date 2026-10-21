/**
 * Shared domain types for Proton Docs as Task.
 */

import type { LanguageSetting } from '../i18n';
import type { DateFormat } from './dates';

export type { DateFormat };

/** Key of one of the board's statuses, as written in `@status:key`. */
export type StatusKey = string;

/**
 * What a status means to the board: Not started, In progress or Done. A Done
 * status ticks the task's checkbox and counts as completed; a blocked task may
 * not leave a Not started status.
 */
export type StatusCategory = 'todo' | 'doing' | 'done';

/** A workflow status defined by the document (`@settings status …`). */
export interface StatusDef {
  /** Stable reference written on task lines; follows the label (slugified, unique) when renamed. */
  key: StatusKey;
  /** Display name; renaming also updates the key and task lines. */
  label: string;
  category: StatusCategory;
  /** Text colour: a swatch name (`blue`) or `#rrggbb`. */
  color?: string;
  /** Background colour: a swatch name or `#rrggbb`. */
  bg?: string;
}

export type Priority = 'low' | 'medium' | 'high';

/** A single parsed task. */
export interface Task {
  /** Stable-ish id derived from source line index. */
  id: string;
  /** Human-readable title (metadata tokens stripped out). */
  title: string;
  /**
   * Resolved status key. May name a status the document doesn't define when a
   * task line references one that was removed; the board then asks the user
   * to move those tasks.
   */
  status: StatusKey;
  /** True when the source checkbox was ticked (`- [x]`). */
  checked: boolean;
  priority?: Priority;
  /** ISO-ish due date string as written by the author. */
  due?: string;
  /** Assignee / owner name. */
  assignee?: string;
  /** Free-form single-line description, stored inline as `@desc(...)`. */
  description?: string;
  /** Free-form `#labels`. */
  labels: string[];
  /** Stable reference other tasks link to, written as `@id:key`. */
  key?: string;
  /** Keys of the tasks this one blocks (`@blocks:a,b`). */
  blocks: string[];
  /** Keys of loosely related tasks (`@rel:a,b`). */
  related: string[];
  /** Section heading this task lives under (default "Tasks"). */
  section: string;
  /**
   * Global ordering rank (0-based, in document line order). Used to keep a
   * stable order within each section when serializing back to the document.
   */
  order: number;
  /** Zero-based index of the source line within the whole document (marker line included). */
  sourceLine: number;
  /** Raw source line, useful for debugging / round-tripping. */
  raw: string;
}

/** Result of parsing a document. */
export interface ParseResult {
  /** Whether the activation marker was found on the first non-empty line. */
  activated: boolean;
  /** The marker that matched, when activated. */
  matchedMarker?: string;
  /** Optional board title taken from the marker line (e.g. `#!tasks My Board`). */
  boardTitle?: string;
  tasks: Task[];
  /** Distinct section names in first-seen order. */
  sections: string[];
  /** Section whose heading carries `@default`; the only one the List view shows. */
  defaultSection?: string;
  /** The document's statuses, in column order (built-in defaults when it defines none). */
  statuses: StatusDef[];
}

/**
 * The board layouts. Workflow groups by status, Sections by heading, and
 * Swimlane crosses the two (status columns × section rows). List is a single
 * flat checklist.
 */
export type BoardView = 'workflow' | 'sections' | 'swimlane' | 'list';

export type Theme = 'system' | 'light' | 'dark';
export type CardDensity = 'comfortable' | 'compact';

/** How completed tasks are presented (never removed from the document). */
export type CompletedDisplay = 'show' | 'collapse' | 'hide';

/**
 * Which optional fields a card shows. The title and completion control are
 * always visible and are intentionally absent here.
 */
export interface CardFieldVisibility {
  description: boolean;
  priority: boolean;
  due: boolean;
  assignee: boolean;
  labels: boolean;
  /** Show the section chip in Workflow view. */
  sectionInWorkflow: boolean;
  /** Show the status chip in Sections view. */
  statusInSections: boolean;
}

/**
 * Document synchronization state shown in the board header. `paused` means
 * Proton has editing locked (still loading, offline, or view-only access);
 * pending changes are written as soon as it unlocks.
 */
export type SaveState = 'saved' | 'saving' | 'paused' | 'error';

/** Persisted user settings. */
export interface Settings {
  /** Whether the extension is globally enabled. */
  enabled: boolean;
  /**
   * Activation markers. A document activates when its first non-empty line,
   * trimmed, starts with any of these (case-insensitive).
   */
  markers: string[];
  /** Default board view. */
  defaultView: BoardView;
  /** Whether the board should be opened automatically on activation. */
  autoShow: boolean;
  /** UI language; `auto` follows the browser. */
  language: LanguageSetting;
  /** Color theme for the board and extension surfaces. */
  theme: Theme;
  /** Card layout density. */
  density: CardDensity;
  /** Where a quick-added card lands in its column. */
  newCardsAtTop: boolean;
  /** Show a short description preview on collapsed cards. */
  showDescriptionPreview: boolean;
  /** Start the Done column collapsed in Workflow view. */
  collapseDoneByDefault: boolean;
  /** Ask for confirmation before deleting a card. */
  confirmDelete: boolean;
  /** Which optional fields cards display. */
  cardFields: CardFieldVisibility;
  /** How completed tasks are presented. */
  completedDisplay: CompletedDisplay;
  /** Display format for due dates. */
  dateFormat: DateFormat;
  /** The user's own assignee name, enabling the "My open tasks" filter. */
  userAssignee: string;
}
