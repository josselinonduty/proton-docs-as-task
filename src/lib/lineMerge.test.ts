import { describe, expect, it } from 'vitest';
import { lcsPairs, mergeLines } from './lineMerge';

describe('lcsPairs', () => {
  it('pairs the longest common subsequence', () => {
    expect(lcsPairs(['a', 'b', 'c', 'd'], ['a', 'c', 'x', 'd'])).toEqual([
      [0, 0],
      [2, 1],
      [3, 3],
    ]);
  });

  it('handles empty inputs', () => {
    expect(lcsPairs([], ['a'])).toEqual([]);
    expect(lcsPairs(['a'], [])).toEqual([]);
  });
});

describe('mergeLines', () => {
  const base = ['#!tasks', '## A', '- [ ] one', '- [ ] two', '## B', '- [ ] three'];

  it('takes our change when the document did not move', () => {
    const ours = ['#!tasks', '## A', '- [x] one', '- [ ] two', '## B', '- [ ] three'];
    expect(mergeLines(base, ours, base)).toEqual(ours);
  });

  it('takes their change when the board did not move', () => {
    const theirs = [...base, '- [ ] four'];
    expect(mergeLines(base, base, theirs)).toEqual(theirs);
  });

  it('keeps both sides when they touched different lines', () => {
    const ours = ['#!tasks', '## A', '- [x] one', '- [ ] two', '## B', '- [ ] three'];
    const theirs = ['#!tasks', '## A', '- [ ] one', '- [ ] two', '## B', '- [x] three'];
    expect(mergeLines(base, ours, theirs)).toEqual([
      '#!tasks',
      '## A',
      '- [x] one',
      '- [ ] two',
      '## B',
      '- [x] three',
    ]);
  });

  it('keeps both tasks when each side appended to the same section', () => {
    const ours = [...base, '- [ ] mine'];
    const theirs = [...base, '- [ ] theirs'];
    expect(mergeLines(base, ours, theirs)).toEqual([...base, '- [ ] theirs', '- [ ] mine']);
  });

  it('lets the board win when both sides edited the same line', () => {
    const ours = ['#!tasks', '## A', '- [ ] one (board)', '- [ ] two', '## B', '- [ ] three'];
    const theirs = ['#!tasks', '## A', '- [ ] one (doc)', '- [ ] two', '## B', '- [ ] three'];
    expect(mergeLines(base, ours, theirs)).toEqual(ours);
  });

  it('keeps a deletion on one side and an edit elsewhere on the other', () => {
    const ours = ['#!tasks', '## A', '- [ ] one', '## B', '- [ ] three'];
    const theirs = ['#!tasks', '## A', '- [ ] one', '- [ ] two', '## B', '- [ ] three!'];
    expect(mergeLines(base, ours, theirs)).toEqual([
      '#!tasks',
      '## A',
      '- [ ] one',
      '## B',
      '- [ ] three!',
    ]);
  });
});
