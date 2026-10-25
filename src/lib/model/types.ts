/** The editable board model's shapes. See `./index.ts` for how they fit together. */

import type { Priority, StatusDef, StatusKey } from '@/lib/types';

export interface BoardTask {
  id: string;
  title: string;
  /** Workflow stage — independent of `section`. */
  status: StatusKey;
  /** Document heading the task lives under — independent of `status`. */
  section: string;
  priority?: Priority;
  /** Free-form due date string, as the author would type it. */
  due?: string;
  assignee?: string;
  description?: string;
  labels: string[];
  /** Reference other tasks link to; assigned on first link, written as `@id`. */
  key?: string;
  /** Keys of the tasks this one blocks. */
  blocks?: string[];
  /** Keys of loosely related tasks. */
  related?: string[];
  /** Key of the parent task when this is a sub-task. */
  parent?: string;
  /** Ordering rank; kept in sync with the array index by `reindex`. */
  order: number;
}

export interface BoardModel {
  title?: string;
  /** Section headings in display / document order. */
  sections: string[];
  /** Section marked `@default`; the List view shows only its tasks. */
  defaultSection?: string;
  /** Workflow statuses in column order; always has a Not started and a Done one. */
  statuses: StatusDef[];
  /** Flat task collection; array order is canonical. */
  tasks: BoardTask[];
}

/** A projected column (status or section) with its tasks in display order. */
export interface BoardColumn {
  /** Status key (workflow) or section name (sections). */
  key: string;
  label: string;
  /** Present only in Workflow view. */
  status?: StatusKey;
  /** Present only in Sections view. */
  section?: string;
  tasks: BoardTask[];
}
