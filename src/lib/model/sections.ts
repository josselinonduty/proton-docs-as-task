/**
 * The board title and its sections. Like every model edit, each returns a new
 * model so React re-renders.
 */

import { reindex } from './internal';
import type { BoardModel } from './types';

export function setTitle(model: BoardModel, title: string): BoardModel {
  return { ...model, title: title.trim() || undefined };
}

/** Return a section name that does not yet exist, based on `base`. */
function uniqueSectionName(model: BoardModel, base: string): string {
  if (!model.sections.includes(base)) return base;
  let n = 2;
  while (model.sections.includes(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

export function addSection(model: BoardModel, name = 'New section'): BoardModel {
  const clean = uniqueSectionName(model, name.trim() || 'New section');
  return { ...model, sections: [...model.sections, clean] };
}

export function renameSection(model: BoardModel, from: string, to: string): BoardModel {
  const clean = to.trim();
  if (!clean || from === clean) {
    // Keep the (possibly whitespace-only) edit locally so the input reflects it,
    // but never collapse two sections into one silently.
    return {
      ...model,
      sections: model.sections.map((s) => (s === from ? to : s)),
      defaultSection: model.defaultSection === from ? to : model.defaultSection,
    };
  }
  return {
    ...model,
    defaultSection: model.defaultSection === from ? clean : model.defaultSection,
    sections: model.sections.map((s) => (s === from ? clean : s)),
    tasks: model.tasks.map((t) => (t.section === from ? { ...t, section: clean } : t)),
  };
}

/** Mark `name` as the List view's section, or clear the mark when it already is. */
export function toggleDefaultSection(model: BoardModel, name: string): BoardModel {
  return { ...model, defaultSection: model.defaultSection === name ? undefined : name };
}

/** Delete a section and every task under it. */
export function removeSection(model: BoardModel, name: string): BoardModel {
  return reindex({
    ...model,
    defaultSection: model.defaultSection === name ? undefined : model.defaultSection,
    sections: model.sections.filter((s) => s !== name),
    tasks: model.tasks.filter((t) => t.section !== name),
  });
}

/** Delete a section, relocating its tasks to `target` (kept at that section's end). */
export function removeSectionMovingTasks(
  model: BoardModel,
  name: string,
  target: string,
): BoardModel {
  if (!model.sections.includes(target) || target === name) {
    // No valid destination — fall back to deleting outright.
    return removeSection(model, name);
  }
  const moved = model.tasks
    .filter((t) => t.section === name)
    .map((t) => ({ ...t, section: target }));
  const kept = model.tasks.filter((t) => t.section !== name);
  // Place relocated tasks after the last existing task of the target section.
  let insertAt = kept.length;
  kept.forEach((t, i) => {
    if (t.section === target) insertAt = i + 1;
  });
  const tasks = [...kept.slice(0, insertAt), ...moved, ...kept.slice(insertAt)];
  return reindex({
    ...model,
    defaultSection: model.defaultSection === name ? undefined : model.defaultSection,
    sections: model.sections.filter((s) => s !== name),
    tasks,
  });
}

/** Move a section by `delta` positions (negative = earlier). */
export function moveSection(model: BoardModel, name: string, delta: number): BoardModel {
  const from = model.sections.indexOf(name);
  if (from < 0) return model;
  const to = Math.max(0, Math.min(model.sections.length - 1, from + delta));
  if (to === from) return model;
  const sections = [...model.sections];
  sections.splice(from, 1);
  sections.splice(to, 0, name);
  return { ...model, sections };
}

/** Reorder sections to exactly `orderedNames` (must be a permutation). */
export function reorderSections(model: BoardModel, orderedNames: string[]): BoardModel {
  const known = new Set(model.sections);
  const next = orderedNames.filter((n) => known.has(n));
  for (const s of model.sections) if (!next.includes(s)) next.push(s);
  return { ...model, sections: next };
}
