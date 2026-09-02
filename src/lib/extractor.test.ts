// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractText, findEditorRoot } from './extractor';

/** Build a detached container from an HTML string and return it. */
function html(markup: string): HTMLElement {
  const root = document.createElement('div');
  root.innerHTML = markup;
  return root;
}

describe('extractText', () => {
  it('serializes headings h1..h6 as markdown headings', () => {
    const root = html('<h1>One</h1><h3>Three</h3><h6>Six</h6>');
    expect(extractText(root)).toBe('# One\n### Three\n###### Six');
  });

  it('serializes plain list items as bullets', () => {
    const root = html('<ul><li>alpha</li><li>beta</li></ul>');
    expect(extractText(root)).toBe('- alpha\n- beta');
  });

  it('serializes ARIA check-list items with their checked state', () => {
    const root = html(
      '<ul>' +
        '<li role="checkbox" aria-checked="true">done thing</li>' +
        '<li role="checkbox" aria-checked="false">open thing</li>' +
        '</ul>',
    );
    expect(extractText(root)).toBe('- [x] done thing\n- [ ] open thing');
  });

  it('reads checked state from class names, not tripping on "unchecked"', () => {
    // Regression: "unchecked" contains the substring "checked", so a naive
    // /checked/ test would wrongly mark it done. It must resolve to unchecked.
    const root = html(
      '<ul>' +
        '<li class="list-checkbox checked">by class on</li>' +
        '<li class="list-checkbox unchecked">by class off</li>' +
        '</ul>',
    );
    expect(extractText(root)).toBe('- [x] by class on\n- [ ] by class off');
  });

  it('flattens nested lists (subtasks) into sibling bullets', () => {
    const root = html('<ul><li>parent<ul><li>child</li></ul></li></ul>');
    expect(extractText(root)).toBe('- parent\n- child');
  });

  it('excludes nested list text from a list item’s own text', () => {
    const root = html('<ul><li>keep me<ul><li>not here</li></ul></li></ul>');
    const lines = extractText(root).split('\n');
    expect(lines[0]).toBe('- keep me');
  });

  it('emits paragraph prose as a plain line', () => {
    const root = html('<p>an intro paragraph</p>');
    expect(extractText(root)).toBe('an intro paragraph');
  });

  it('recurses into block wrappers instead of duplicating their text', () => {
    const root = html('<div><h2>Wrapped</h2><p>body</p></div>');
    expect(extractText(root)).toBe('## Wrapped\nbody');
  });

  it('collapses whitespace within a block', () => {
    const root = html('<p>  spaced   out\n  text </p>');
    expect(extractText(root)).toBe('spaced out text');
  });
});

describe('findEditorRoot', () => {
  afterEach(() => vi.restoreAllMocks());

  it('finds a contenteditable Lexical root when it has a visible area', () => {
    // jsdom reports a zero-size layout by default; give elements a real area so
    // the "largest visible editable region" heuristic can select one.
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 600,
    } as DOMRect);

    document.body.innerHTML =
      '<div data-lexical-editor="true" contenteditable="true"><p>doc</p></div>';
    const root = findEditorRoot(document);
    expect(root).not.toBeNull();
    expect(root?.getAttribute('data-lexical-editor')).toBe('true');
  });

  it('returns null when no editable region exists', () => {
    document.body.innerHTML = '<div><p>just a static page</p></div>';
    expect(findEditorRoot(document)).toBeNull();
  });
});
