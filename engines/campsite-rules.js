/* ============================================================================
   CAMPSITE (Tents and Trees) — rules core
   ----------------------------------------------------------------------------
   DOM-free. Used by engines/campsite.js to grade, and by the authoring script
   to prove each board has exactly one valid pitch.

   Rules, precisely — note that both adjacency rules here are DIAGONAL, which
   is the inversion this variant is built on:
     - Every tree gets exactly one tent, placed DIAGONALLY from it.
     - Every tent belongs to exactly one tree — it's a perfect matching
       between trees and tents, not just "each tent touches some tree".
     - No two tents touch CORNER TO CORNER. Tents may stand shoulder to
       shoulder, orthogonally adjacent, all day long.
     - The numbers give the tent count for each row and column.

   The familiar version of this puzzle has both rules the other way round, and
   swapping them changes how it is solved rather than how it looks. Committing
   to a tent no longer forces a cross of grass around it, it forces an X, so
   the constraint travels along diagonals and rows fill up in a way that feels
   wrong for the first few minutes. Tents in a row may now sit in an unbroken
   line, which the ordinary game forbids outright and which is where most of
   this variant's deductions come from.

   The matching condition is the one people get wrong, and the one a naive
   solver gets wrong too: a layout where two trees are both served by the same
   tent, with a third tree left over, satisfies every adjacency check locally
   and is still illegal. So the final test here is a real bipartite matching
   (Hopcroft-Karp would be overkill; augmenting paths on boards this size is
   instant).
   ========================================================================== */

export const TREE = 1, TENT = 2;

/* A tent pairs with a tree diagonally, and blocks other tents diagonally. */
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

/* Can these tents be matched one-to-one onto the trees they touch? */
export function tentsMatchTrees(trees, tents, rows, cols) {
  if (trees.length !== tents.length) return false;
  const key = (r, c) => r * cols + c;
  const tentAt = new Map(tents.map(([r, c], i) => [key(r, c), i]));
  // options[treeIndex] = tent indices orthogonally adjacent to that tree
  const options = trees.map(([r, c]) => {
    const o = [];
    for (const [dr, dc] of DIAG) {
      const i = tentAt.get(key(r + dr, c + dc));
      if (i !== undefined) o.push(i);
    }
    return o;
  });
  const assigned = new Array(tents.length).fill(-1);
  const tryTree = (t, seen) => {
    for (const tent of options[t]) {
      if (seen.has(tent)) continue;
      seen.add(tent);
      if (assigned[tent] === -1 || tryTree(assigned[tent], seen)) {
        assigned[tent] = t;
        return true;
      }
    }
    return false;
  };
  for (let t = 0; t < trees.length; t++) if (!tryTree(t, new Set())) return false;
  return true;
}

export function noTentsTouch(tents, cols) {
  const set = new Set(tents.map(([r, c]) => r * cols + c));
  for (const [r, c] of tents) {
    for (const [dr, dc] of DIAG) if (set.has((r + dr) * cols + (c + dc))) return false;
  }
  return true;
}

/* board: rows x cols, 1 where a tree stands, 0 otherwise.
   rowCounts / colCounts: required number of tents.
   Returns { count, solutions } with solutions as arrays of [r,c] tent cells. */
export function countSolutions(board, rowCounts, colCounts, limit = 2) {
  const rows = board.length, cols = board[0].length;
  const trees = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] === TREE) trees.push([r, c]);

  const tent = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const rowLeft = rowCounts.slice(), colLeft = colCounts.slice();
  const solutions = [];
  let found = 0;

  // A cell can only hold a tent if some tree sits diagonally from it; anything
  // else is a dead branch no matter what the counts say.
  const nearTree = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => {
    if (board[r][c] === TREE) return false;
    return DIAG.some(([dr, dc]) => board[r + dr]?.[c + dc] === TREE);
  }));

  function place(r, c, on) {
    tent[r][c] = on;
    rowLeft[r] += on ? -1 : 1;
    colLeft[c] += on ? -1 : 1;
  }

  function touchesTent(r, c) {
    return DIAG.some(([dr, dc]) => tent[r + dr]?.[c + dc]);
  }

  function go(i) {
    if (found >= limit) return;
    const r = Math.floor(i / cols), c = i % cols;
    if (i === rows * cols) {
      if (rowLeft.some((n) => n !== 0) || colLeft.some((n) => n !== 0)) return;
      const tents = [];
      for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) if (tent[rr][cc]) tents.push([rr, cc]);
      if (tentsMatchTrees(trees, tents, rows, cols)) { found++; solutions.push(tents); }
      return;
    }
    // Row is finished: its count must be exactly met before moving on.
    if (c === 0 && r > 0 && rowLeft[r - 1] !== 0) return;
    if (colLeft[c] < 0 || rowLeft[r] < 0) return;
    // Not enough cells left in this row to make up the remaining count.
    if (rowLeft[r] > cols - c) return;

    if (nearTree[r][c] && rowLeft[r] > 0 && colLeft[c] > 0 && !touchesTent(r, c)) {
      place(r, c, true);
      go(i + 1);
      place(r, c, false);
      if (found >= limit) return;
    }
    // Not enough rows left below to satisfy this column.
    if (colLeft[c] > rows - r - 1) return;
    go(i + 1);
  }

  go(0);
  return { count: found, solutions };
}

/* Grading a finished board, from the player's marks alone. */
export function check(board, rowCounts, colCounts, tents) {
  const rows = board.length, cols = board[0].length;
  const trees = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (board[r][c] === TREE) trees.push([r, c]);
  const rc = new Array(rows).fill(0), cc = new Array(cols).fill(0);
  for (const [r, c] of tents) { rc[r]++; cc[c]++; }
  if (rc.some((n, i) => n !== rowCounts[i])) return { ok: false, why: "row counts" };
  if (cc.some((n, i) => n !== colCounts[i])) return { ok: false, why: "column counts" };
  if (!noTentsTouch(tents, cols)) return { ok: false, why: "two tents meet at a corner" };
  if (!tentsMatchTrees(trees, tents, rows, cols)) return { ok: false, why: "tents and trees don't pair up one-to-one diagonally" };
  return { ok: true };
}
