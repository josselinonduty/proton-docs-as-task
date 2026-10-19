/**
 * Helpers for reconciling the in-memory board with the underlying document.
 *
 * The board follows the Proton document live: changes made elsewhere (another
 * tab or device, a collaborator, an undo in the editor) are folded into the
 * open board. These pure helpers compare the two without a false positive
 * from cosmetic differences, and keep task identities stable across a
 * re-parse so open cards and selections survive.
 */

import {
  fromParseResult,
  serializeModel,
  serializeTaskLine,
  type BoardModel,
  type BoardTask,
} from './model';
import { parseDocument } from './parser';

/**
 * Reduce arbitrary document text to the canonical serialized form the board
 * would produce for it. Parsing then re-serializing collapses incidental
 * whitespace, blank lines and metadata ordering so two documents that mean the
 * same board compare equal.
 */
export function canonicalDoc(text: string, markers: string[]): string {
  const result = parseDocument(text, markers);
  if (!result.activated) return text.trim();
  const marker = result.matchedMarker ?? markers[0] ?? '#!tasks';
  return serializeModel(fromParseResult(result), marker);
}

/** Canonical serialized form of the current board model. */
export function canonicalModel(model: BoardModel, marker: string): string {
  return canonicalDoc(serializeModel(model, marker), [marker]);
}

/**
 * True when `editorText` represents a different board than `model` — i.e. the
 * document changed in a way the board did not make.
 */
export function documentsDiverged(
  editorText: string,
  model: BoardModel,
  markers: string[],
  marker: string,
): boolean {
  return canonicalDoc(editorText, markers) !== canonicalModel(model, marker);
}

/** Ways to recognize the same task across a re-parse, strictest first. */
const IDENTITY_KEYS: Array<(task: BoardTask) => string | null> = [
  (t) => `${t.section}\n${serializeTaskLine(t)}`,
  (t) => serializeTaskLine(t),
  (t) => (t.title.trim() ? `${t.section}\n${t.title}` : null),
  (t) => (t.title.trim() ? t.title : null),
];

/**
 * Carry task ids from `prev` over to the matching tasks of a freshly parsed
 * `next`, so a document change made elsewhere doesn't remount every card.
 */
export function reconcileIds(prev: BoardModel, next: BoardModel): BoardModel {
  const ids: Array<string | undefined> = next.tasks.map(() => undefined);
  const used = new Set<string>();

  for (const keyOf of IDENTITY_KEYS) {
    const available = new Map<string, string[]>();
    for (const task of prev.tasks) {
      const key = keyOf(task);
      if (key === null || used.has(task.id)) continue;
      available.set(key, [...(available.get(key) ?? []), task.id]);
    }
    next.tasks.forEach((task, i) => {
      if (ids[i]) return;
      const key = keyOf(task);
      const id = key === null ? undefined : available.get(key)?.shift();
      if (id) {
        ids[i] = id;
        used.add(id);
      }
    });
  }

  return {
    ...next,
    tasks: next.tasks.map((task, i) => (ids[i] ? { ...task, id: ids[i]! } : task)),
  };
}
