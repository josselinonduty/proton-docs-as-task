/**
 * Shared domain types for Proton Docs as Task.
 */

import type { DateFormat } from './dates';

export type { DateFormat };

/** Canonical task status keys used internally. */
export type StatusKey = 'todo' | 'doing' | 'done';

export type Priority = 'low' | 'medium' | 'high';

/** A single parsed task. */
export interface Task {
  /** Stable-ish id derived from source line index. */
  id: string;
  /** Human-readable title (metadata tokens stripped out). */
  title: string;
  /** Resolved status. */
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
}

/** A board column definition. */
export interface ColumnDef {
  key: StatusKey;
  label: string;
}

/**
 * The board layouts. Workflow groups by status, Sections by heading, and
 * Swimlane crosses the two (status columns × section rows).
 */
export type BoardView = 'workflow' | 'sections' | 'swimlane';

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

/** Document synchronization state shown in the board header. */
export type SaveState = 'saved' | 'saving' | 'error' | 'conflict';

/** Persisted user settings. */
export interface Settings {
  /** Whether the extension is globally enabled. */
  enabled: boolean;
  /**
   * Activation markers. A document activates when its first non-empty line,
   * trimmed, starts with any of these (case-insensitive).
   */
  markers: string[];
  /** Status column definitions (renameable labels), in display order. */
  columns: ColumnDef[];
  /** Default board view. */
  defaultView: BoardView;
  /** Whether the board should be opened automatically on activation. */
  autoShow: boolean;
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
