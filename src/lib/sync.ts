/**
 * Helpers for reconciling the in-memory board with the underlying document.
 *
 * The board is authoritative while open, but the Proton document can still
 * change underneath it (another tab, a collaborator, an undo in the editor).
 * These pure helpers let the overlay detect that divergence without a false
 * positive from cosmetic whitespace differences in the editor's DOM.
 */

import { fromParseResult, serializeModel, type BoardModel } from './model';
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
 * document changed in a way the board did not make. Used to raise the
 * "document changed" conflict state.
 */
export function documentsDiverged(
  editorText: string,
  model: BoardModel,
  markers: string[],
  marker: string,
): boolean {
  return canonicalDoc(editorText, markers) !== canonicalModel(model, marker);
}
