import { describe, expect, it } from 'vitest';
import {
  blockFromNode,
  blocksFromLines,
  isNoop,
  linesFromEditorState,
  planEdits,
  type SerializedNode,
} from './editorDoc';

const text = (t: string): SerializedNode => ({ type: 'text', text: t });
const paragraph = (...children: SerializedNode[]): SerializedNode => ({
  type: 'paragraph',
  children,
});
const heading = (tag: string, t: string): SerializedNode => ({
  type: 'heading',
  tag,
  children: [text(t)],
});
const item = (t: string, checked?: boolean, extra: SerializedNode[] = []): SerializedNode => ({
  type: 'listitem',
  checked,
  children: [text(t), ...extra],
});
const list = (listType: string, ...children: SerializedNode[]): SerializedNode => ({
  type: 'custom-list',
  listType,
  children,
});
const state = (...children: SerializedNode[]) => ({ root: { type: 'root', children } });

describe('linesFromEditorState', () => {
  it('reads headings, check lists and paragraphs as document lines', () => {
    const doc = state(
      paragraph(text('#!tasks Board')),
      paragraph(),
      heading('h2', 'Backend'),
      list('check', item('Design @who:sam', true), item('Build', false)),
      list('bullet', item('Plain')),
    );
    expect(linesFromEditorState(doc)).toEqual([
      '#!tasks Board',
      '',
      '## Backend',
      '- [x] Design @who:sam',
      '- [ ] Build',
      '- Plain',
    ]);
  });

  it('reads inline nodes (links, hashtags, comment marks) as their text', () => {
    const doc = state(
      paragraph(
        text('See '),
        { type: 'link', children: [text('docs')] },
        { type: 'mark', children: [{ type: 'hashtag', text: '#ui' }] },
      ),
    );
    expect(linesFromEditorState(doc)).toEqual(['See docs#ui']);
  });

  it('splits line breaks and flattens nested lists', () => {
    const nested = list('check', item('child', false));
    const doc = state(
      paragraph(text('a'), { type: 'linebreak' }, text('b')),
      list('check', item('parent', false), { type: 'listitem', children: [nested] }),
    );
    expect(linesFromEditorState(doc)).toEqual(['a', 'b', '- [ ] parent', '- [ ] child']);
  });

  it('keeps empty check items so they round-trip', () => {
    expect(linesFromEditorState(state(list('check', item('', false))))).toEqual(['- [ ]']);
  });
});

describe('blocksFromLines', () => {
  it('groups consecutive items into native lists', () => {
    const blocks = blocksFromLines(['#!tasks', '', '## A', '- [ ] one', '- [x] two', '- three']);
    expect(blocks.map((b) => [b.kind, b.tag ?? b.listType ?? null, b.lines])).toEqual([
      ['paragraph', null, ['#!tasks']],
      ['paragraph', null, ['']],
      ['heading', 'h2', ['## A']],
      ['list', 'check', ['- [ ] one', '- [x] two']],
      ['list', 'bullet', ['- three']],
    ]);
  });

  it('round-trips through the reader', () => {
    const lines = ['#!tasks Board', '', '## A', '- [ ] one', '- [x] two', '', '## B', '- [ ]'];
    const blocks = blocksFromLines(lines);
    expect(blocks.flatMap((b) => b.lines)).toEqual(lines);
  });
});

describe('planEdits', () => {
  const current = () =>
    state(
      paragraph(text('#!tasks')),
      heading('h2', 'A'),
      list('check', item('one', false), item('two', false)),
      heading('h2', 'B'),
      list('check', item('three', false)),
    ).root.children.map(blockFromNode);

  it('is a no-op when nothing changed', () => {
    const blocks = current();
    expect(isNoop(planEdits(blocks, blocks))).toBe(true);
  });

  it('edits a single list item in place', () => {
    const target = blocksFromLines([
      '#!tasks',
      '## A',
      '- [x] one',
      '- [ ] two',
      '## B',
      '- [ ] three',
    ]);
    expect(planEdits(current(), target)).toEqual([
      { op: 'keep', index: 0 },
      { op: 'keep', index: 1 },
      {
        op: 'patchList',
        index: 2,
        listType: 'check',
        items: [
          { op: 'set', index: 0, checked: true },
          { op: 'keep', index: 1 },
        ],
      },
      { op: 'keep', index: 3 },
      { op: 'keep', index: 4 },
    ]);
  });

  it('moves a task between sections as a remove plus an insert', () => {
    const target = blocksFromLines([
      '#!tasks',
      '## A',
      '- [ ] two',
      '## B',
      '- [ ] three',
      '- [ ] one',
    ]);
    const ops = planEdits(current(), target);
    expect(ops[2]).toEqual({
      op: 'patchList',
      index: 2,
      listType: 'check',
      items: [
        { op: 'remove', index: 0 },
        { op: 'keep', index: 1 },
      ],
    });
    expect(ops[4]).toEqual({
      op: 'patchList',
      index: 4,
      listType: 'check',
      items: [
        { op: 'keep', index: 0 },
        { op: 'insert', item: { text: 'one', checked: false, patchable: true } },
      ],
    });
  });

  it('renames a heading in place', () => {
    const target = blocksFromLines([
      '#!tasks',
      '## Alpha',
      '- [ ] one',
      '- [ ] two',
      '## B',
      '- [ ] three',
    ]);
    expect(planEdits(current(), target)[1]).toEqual({ op: 'setText', index: 1, text: 'Alpha' });
  });

  it('replaces legacy plain-paragraph task lines with native blocks', () => {
    const legacy = [
      paragraph(text('#!tasks')),
      paragraph(text('## A')),
      paragraph(text('- [ ] one')),
    ].map(blockFromNode);
    const ops = planEdits(legacy, blocksFromLines(['#!tasks', '## A', '- [ ] one']));
    expect(ops.map((op) => op.op)).toEqual(['keep', 'insert', 'insert', 'remove', 'remove']);
  });
});
