import { describe, expect, it } from 'vitest';
import { parseDocument } from './parser';
import { DEFAULT_MARKERS } from './defaults';
import { fromParseResult, setTaskStatus, serializeModel } from './model';
import { canonicalDoc, documentsDiverged, hasRedundantStatus, reconcileIds } from './sync';

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

describe('reconcileIds', () => {
  const parse = (text: string) => fromParseResult(parseDocument(text, MARKERS));

  it('keeps the ids of tasks that survive a re-parse', () => {
    const prev = parse(DOC);
    const next = reconcileIds(
      prev,
      parse(['#!tasks Board', '## S', '- [x] b', '- [ ] a'].join('\n')),
    );
    expect(next.tasks.find((t) => t.title === 'a')!.id).toBe(prev.tasks[0]!.id);
    expect(next.tasks.find((t) => t.title === 'b')!.id).toBe(prev.tasks[1]!.id);
  });

  it('follows a task whose status changed elsewhere, and gives new tasks new ids', () => {
    const prev = parse(DOC);
    const next = reconcileIds(
      prev,
      parse(['#!tasks Board', '## S', '- [x] a', '- [x] b', '- [ ] c'].join('\n')),
    );
    expect(next.tasks[0]!.id).toBe(prev.tasks[0]!.id);
    expect(next.tasks[1]!.id).toBe(prev.tasks[1]!.id);
    expect(prev.tasks.map((t) => t.id)).not.toContain(next.tasks[2]!.id);
  });
});

describe('hasRedundantStatus', () => {
  const parse = (...lines: string[]) => parseDocument(['#!tasks', ...lines].join('\n'), MARKERS);

  it('flags status tokens the board would drop', () => {
    expect(hasRedundantStatus(parse('- [ ] bar @status:done'))).toBe(true);
    expect(hasRedundantStatus(parse('- [x] bar @status:doing'))).toBe(true);
  });

  it('ignores canonical lines', () => {
    expect(hasRedundantStatus(parse('- [ ] bar @status:doing', '- [x] baz'))).toBe(false);
  });
});
