/**
 * Line-level diffing and three-way merging.
 *
 * The board writes a whole target document, but the live document may have
 * moved on since the board last read it (another device, a collaborator,
 * typing in Proton). Merging the board's change (base → target) with the
 * document's change (base → current) keeps both instead of overwriting one
 * with the other.
 */

/** Index pairs `[i, j]` of a longest common subsequence of `a` and `b`. */
export function lcsPairs<T>(
  a: readonly T[],
  b: readonly T[],
  eq: (x: T, y: T) => boolean = Object.is,
): Array<[number, number]> {
  // Trim the common prefix and suffix — most edits touch a small window.
  let start = 0;
  while (start < a.length && start < b.length && eq(a[start]!, b[start]!)) start += 1;
  let endA = a.length;
  let endB = b.length;
  while (endA > start && endB > start && eq(a[endA - 1]!, b[endB - 1]!)) {
    endA -= 1;
    endB -= 1;
  }

  const pairs: Array<[number, number]> = [];
  for (let i = 0; i < start; i += 1) pairs.push([i, i]);

  const n = endA - start;
  const m = endB - start;
  if (n > 0 && m > 0) {
    // Classic DP over the middle window: table[i][j] = LCS of a[i..], b[j..].
    const width = m + 1;
    const table = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i -= 1) {
      for (let j = m - 1; j >= 0; j -= 1) {
        table[i * width + j] = eq(a[start + i]!, b[start + j]!)
          ? table[(i + 1) * width + j + 1]! + 1
          : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (eq(a[start + i]!, b[start + j]!)) {
        pairs.push([start + i, start + j]);
        i += 1;
        j += 1;
      } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) {
        i += 1;
      } else {
        j += 1;
      }
    }
  }

  for (let k = 0; k < a.length - endA; k += 1) pairs.push([endA + k, endB + k]);
  return pairs;
}

function sameLines(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((line, i) => line === b[i]);
}

function resolveChunk(base: string[], ours: string[], theirs: string[]): string[] {
  if (sameLines(ours, base)) return theirs;
  if (sameLines(theirs, base)) return ours;
  if (sameLines(ours, theirs)) return ours;
  // Both sides only inserted here (e.g. two tasks added to the same section):
  // keep both, theirs first.
  if (base.length === 0) return [...theirs, ...ours.filter((line) => !theirs.includes(line))];
  // A true overlap — the board's explicit edit wins.
  return ours;
}

/**
 * Three-way merge of line arrays. `ours` and `theirs` both derive from `base`;
 * regions changed on only one side take that side's lines, and regions changed
 * on both sides resolve in favor of `ours`.
 */
export function mergeLines(base: string[], ours: string[], theirs: string[]): string[] {
  if (sameLines(base, theirs)) return [...ours];
  if (sameLines(base, ours)) return [...theirs];

  const toOurs = new Map(lcsPairs(base, ours));
  const toTheirs = new Map(lcsPairs(base, theirs));

  const merged: string[] = [];
  let prevBase = -1;
  let prevOurs = -1;
  let prevTheirs = -1;
  const flush = (b: number, o: number, t: number) => {
    merged.push(
      ...resolveChunk(
        base.slice(prevBase + 1, b),
        ours.slice(prevOurs + 1, o),
        theirs.slice(prevTheirs + 1, t),
      ),
    );
  };

  for (let b = 0; b < base.length; b += 1) {
    const o = toOurs.get(b);
    const t = toTheirs.get(b);
    if (o === undefined || t === undefined) continue;
    // A line both sides kept anchors the merge.
    flush(b, o, t);
    merged.push(base[b]!);
    prevBase = b;
    prevOurs = o;
    prevTheirs = t;
  }
  flush(base.length, ours.length, theirs.length);
  return merged;
}
