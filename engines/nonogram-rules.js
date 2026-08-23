/* ============================================================================
   NONOGRAM — rules core
   ----------------------------------------------------------------------------
   DOM-free so the authoring tool (and this repo's test suite) can prove a
   bitmap's derived clue set has exactly one solution before it ships.

   A bitmap is an array of N strings/arrays of 0/1, `grid[row][col]`. Clues
   are always DERIVED from the bitmap — never hand-authored — so the picture
   is the single source of truth and can't drift out of sync with its clues.
   ========================================================================== */

// A single line's run-lengths, e.g. [0,1,1,0,0,1] -> [2,1]. All-empty -> [].
export function lineClue(line) {
  const runs = [];
  let cur = 0;
  for (const v of line) {
    if (v) cur++;
    else { if (cur) runs.push(cur); cur = 0; }
  }
  if (cur) runs.push(cur);
  return runs;
}

export function deriveClues(bitmap) {
  const n = bitmap.length;
  const rows = bitmap.map((r) => lineClue(r));
  const cols = [];
  for (let c = 0; c < n; c++) {
    cols.push(lineClue(bitmap.map((r) => r[c])));
  }
  return { rows, cols };
}

/* All boolean fillings of a line of `len` cells that satisfy `clue`. Used
   both by the line-solver (propagation) and, for short lines, exhaustively. */
export function possibleLines(len, clue) {
  if (clue.length === 0) return [new Array(len).fill(false)];
  const results = [];
  const k = clue.length;
  const minLen = clue.reduce((a, b) => a + b, 0) + (k - 1);
  if (minLen > len) return results;

  function place(idx, pos, acc) {
    if (idx === k) {
      const line = acc.slice();
      while (line.length < len) line.push(false);
      results.push(line);
      return;
    }
    const run = clue[idx];
    // Remaining runs (with their mandatory gaps) that must still fit after this one.
    const remaining = clue.slice(idx + 1).reduce((a, b) => a + b, 0) + (k - idx - 1);
    const maxStart = len - remaining - run;
    for (let start = pos; start <= maxStart; start++) {
      const next = acc.slice();
      while (next.length < start) next.push(false);
      for (let i = 0; i < run; i++) next.push(true);
      if (idx + 1 < k) next.push(false); // mandatory single gap before the next run
      place(idx + 1, next.length, next);
    }
  }
  place(0, 0, []);
  return results;
}

/* Constraint-propagate a grid (null = undetermined) + candidate lists to a
   fixed point: repeatedly drop candidates that conflict with fixed cells,
   then fix any cell every surviving candidate agrees on. Returns null on
   contradiction, else { grid, rowCands, colCands } (candidate lists are kept
   around so a caller can branch on whichever line is least ambiguous). */
function propagate(n, grid, rowCands, colCands) {
  let changed = true;
  while (changed) {
    changed = false;
    for (const [cands, getLine, apply] of [
      [rowCands, (i) => grid[i], (i, j, v) => { grid[i][j] = v; }],
      [colCands, (i) => grid.map((r) => r[i]), (i, j, v) => { grid[j][i] = v; }],
    ]) {
      for (let i = 0; i < n; i++) {
        const line = getLine(i);
        if (cands[i].length > 1) {
          // Only re-filter lines that aren't already pinned — but a pinned
          // singleton still needs its values written into the grid below.
          cands[i] = cands[i].filter((cand) =>
            cand.every((v, j) => line[j] === null || line[j] === v));
          if (cands[i].length === 0) return null; // contradiction: unsatisfiable
        }
        for (let j = 0; j < n; j++) {
          if (line[j] !== null) continue;
          const first = cands[i][0][j];
          if (cands[i].every((cand) => cand[j] === first)) {
            apply(i, j, first);
            changed = true;
          }
        }
      }
    }
  }
  return { grid, rowCands, colCands };
}

/* Counts distinct solutions up to `cap` (default 2 — all we ever need is "is
   it exactly one"). Propagates to a fixed point, then — if cells remain
   undetermined — branches on the single line with the fewest surviving
   candidates (far fewer branches than per-cell guessing) and re-propagates
   after each guess. */
export function countSolutions(bitmap, cap = 2) {
  const n = bitmap.length;
  const { rows, cols } = deriveClues(bitmap);
  let count = 0;

  function search(grid, rowCands, colCands) {
    if (count >= cap) return;
    const seeded = propagate(n, grid, rowCands, colCands);
    if (seeded === null) return; // dead end

    // Pick the most-constrained ambiguous line, row or column.
    let best = null; // { isRow, index, cands }
    for (let i = 0; i < n; i++) {
      if (rowCands[i].length > 1 && (!best || rowCands[i].length < best.cands.length))
        best = { isRow: true, index: i, cands: rowCands[i] };
      if (colCands[i].length > 1 && (!best || colCands[i].length < best.cands.length))
        best = { isRow: false, index: i, cands: colCands[i] };
    }
    if (!best) { count++; return; } // every line pinned: one full solution

    for (const cand of best.cands) {
      if (count >= cap) return;
      const g2 = grid.map((r) => r.slice());
      for (let j = 0; j < n; j++) g2[best.isRow ? best.index : j][best.isRow ? j : best.index] = cand[j];
      const rc2 = rowCands.map((c) => c.slice());
      const cc2 = colCands.map((c) => c.slice());
      if (best.isRow) rc2[best.index] = [cand]; else cc2[best.index] = [cand];
      search(g2, rc2, cc2);
    }
  }

  const grid0 = Array.from({ length: n }, () => new Array(n).fill(null));
  const rowCands0 = rows.map((c) => possibleLines(n, c));
  const colCands0 = cols.map((c) => possibleLines(n, c));
  if (rowCands0.some((c) => c.length === 0) || colCands0.some((c) => c.length === 0)) return 0;
  search(grid0, rowCands0, colCands0);
  return count;
}
