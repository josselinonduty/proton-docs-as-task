import { describe, expect, it } from 'vitest';
import { parseDocument } from './parser';
import { DEFAULT_MARKERS } from './defaults';
import { fromParseResult, setTaskStatus, serializeModel } from './model';
import { canonicalDoc, documentsDiverged } from './sync';

const MARKERS = DEFAULT_MARKERS;
const MARKER = '#!tasks';

const DOC = ['#!tasks Board', '## S', '- [ ] a', '- [x] b'].join('\n');

describe('canonicalDoc', () => {
  it('collapses cosmetic whitespace / blank lines to one canonical form', () => {
    const messy = ['#!tasks Board', '', '', '## S', '- [ ]   a', '', '- [x] b', ''].join('\n');
    expect(canonicalDoc(messy, MARKERS)).toBe(canonicalDoc(DOC, MARKERS));
  });
});

describe('documentsDiverged', () => {
  it('is false when the editor text matches the board model', () => {
    const model = fromParseResult(parseDocument(DOC, MARKERS));
    const editorText = serializeModel(model, MARKER);
    expect(documentsDiverged(editorText, model, MARKERS, MARKER)).toBe(false);
  });

  it('ignores cosmetic differences the editor introduces', () => {
    const model = fromParseResult(parseDocument(DOC, MARKERS));
    const editorText = ['#!tasks Board', '## S', '- [ ] a', '- [x] b'].join('\n');
    expect(documentsDiverged(editorText, model, MARKERS, MARKER)).toBe(false);
  });

  it('is true when the document changed underneath the board', () => {
    let model = fromParseResult(parseDocument(DOC, MARKERS));
    model = setTaskStatus(model, model.tasks[0]!.id, 'done');
    // Editor still holds the old document.
    expect(documentsDiverged(DOC, model, MARKERS, MARKER)).toBe(true);
  });
});
