/**
 * Shared domain types for Proton Docs as Task.
 */

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
  /** Free-form `#labels`. */
  labels: string[];
  /** Section heading this task lives under (default "Tasks"). */
  section: string;
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

/** Persisted user settings. */
export interface Settings {
  /** Whether the extension is globally enabled. */
  enabled: boolean;
  /**
   * Activation markers. A document activates when its first non-empty line,
   * trimmed, starts with any of these (case-insensitive).
   */
  markers: string[];
  /** Column definitions, in display order. */
  columns: ColumnDef[];
  /** Default grouping mode for the board. */
  grouping: 'status' | 'section';
  /** Whether the board should be shown automatically on activation. */
  autoShow: boolean;
}
