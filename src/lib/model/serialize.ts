/** Serialization back to the plain document text the parser understands. */

import { encodeDescription } from '@/lib/parser';
import { defaultStatus, isDoneStatus, serializeStatusSetting } from '@/lib/statuses';
import type { StatusDef } from '@/lib/types';
import { pruneLinks } from './links';
import type { BoardModel, BoardTask } from './types';

/** Render a metadata value as `@key(value)` (spaces) or `@key:value` (simple). */
function tokenFor(key: string, value: string): string {
  return /\s/.test(value) ? `@${key}(${value})` : `@${key}:${value}`;
}

/** Serialize a single task to its Markdown checklist line (for "Copy as Markdown"). */
export function serializeTaskLine(task: BoardTask, statuses: readonly StatusDef[]): string {
  const done = isDoneStatus(statuses, task.status);
  const checkbox = done ? 'x' : ' ';
  const parts: string[] = [];
  const title = task.title.trim();
  if (title) parts.push(title);

  // The checkbox implies the first Not started / Done status; others need a token.
  if (task.status !== defaultStatus(statuses, done)) parts.push(tokenFor('status', task.status));
  if (task.priority) parts.push(`@priority:${task.priority}`);
  if (task.due?.trim()) parts.push(tokenFor('due', task.due.trim()));
  if (task.assignee?.trim()) parts.push(tokenFor('who', task.assignee.trim()));
  for (const label of task.labels) {
    const clean = label.trim().replace(/^#/, '');
    if (clean) parts.push(`#${clean}`);
  }
  if (task.key) parts.push(`@id:${task.key}`);
  if (task.blocks?.length) parts.push(`@blocks:${task.blocks.join(',')}`);
  if (task.related?.length) parts.push(`@rel:${task.related.join(',')}`);
  if (task.parent) parts.push(`@parent:${task.parent}`);
  const description = task.description ? encodeDescription(task.description) : '';
  if (description) parts.push(`@desc(${description})`);

  return `- [${checkbox}] ${parts.join(' ')}`.trimEnd();
}

/**
 * Serialize a board model into the plain document text the parser understands.
 * `marker` is the activation marker to lead with (e.g. `#!tasks`).
 */
export function serializeModel(source: BoardModel, marker: string): string {
  const model = pruneLinks(source);
  const lines: string[] = [];
  const title = model.title?.trim();
  lines.push(title ? `${marker} ${title}` : marker);
  for (const status of model.statuses) lines.push(serializeStatusSetting(status));

  // Every section, plus any orphan section referenced only by a task.
  const sections = [...model.sections];
  for (const task of model.tasks) {
    if (!sections.includes(task.section)) sections.push(task.section);
  }

  for (const section of sections) {
    lines.push('');
    lines.push(
      `## ${section.trim() || 'Untitled'}${section === model.defaultSection ? ' @default' : ''}`,
    );
    const inSection = model.tasks
      .filter((t) => t.section === section)
      .sort((a, b) => a.order - b.order);
    for (const task of inSection) lines.push(serializeTaskLine(task, model.statuses));
  }

  return lines.join('\n');
}
