/* ============================================================================
   DOMINOES (dissection) — rules core
   ----------------------------------------------------------------------------
   No DOM in here. engines/dominoes.js draws the board; this same module is
   what the authoring script used to prove each grid has exactly one solution,
   and what the engine uses at mount to grade a drawn dissection.

   The classic form: a rectangle of digits hides a full double-N domino set,
   one piece per cell-pair, and the player cuts the seams to reveal it. The
   variant here breaks the one bit of bookkeeping that classic form leans on —
   "cross a piece off the list as you place it, and when the list is empty
   you're done." Exactly one piece in the laid-out set has been used TWICE and
   exactly one piece is MISSING, so the tally still empties out at 28 (or 15)
   dominoes placed, but one of those crossings-off was a lie. The player has
   to find which.

   The pleasant consequence: grading never touches a stored answer. Any
   complete dissection (every cell paired with exactly one neighbour) yields a
   multiset of pieces straight off the digits, and "is this dissection right"
   is just "does that multiset have exactly one piece appearing twice, exactly
   one piece appearing zero times, and everything else exactly once" — a rule
   check, not a comparison. Naming the duplicate and the missing piece is
   naming what that multiset already says. countSolutions exists only to prove
   at authoring time (and again at mount) that exactly one seam-pattern on the
   shipped grid satisfies that rule at all.

   Search strategy: cells are covered by dominoes one pair at a time. At every
   step we branch on the currently most-constrained *uncovered* cell (fewest
   legal uncovered neighbours) rather than scanning in row-major order, which
   prunes dead corners immediately instead of discovering them many moves
   later. Placements are pruned hard by the piece tally itself: a piece may
   never be placed a third time, and at most one piece may ever reach a count
   of two (the one duplicate the puzzle allows) — so the search never wastes
   time completing tilings that could not possibly qualify. A node budget lets
   the generator bail out of hopeless seeds instead of hanging.
   ========================================================================== */

/* All pieces of a double-N set, as [a,b] with a <= b, including doubles. */
export function allPieces(maxPips) {
  const out = [];
  for (let a = 0; a <= maxPips; a++) for (let b = a; b <= maxPips; b++) out.push([a, b]);
  return out;
}

export function pieceKey(a, b) {
  return a <= b ? `${a}-${b}` : `${b}-${a}`;
}

/* Exhaustive search for dissections of `grid` (rows x cols digits, each
   0..maxPips) into dominoes such that the resulting piece multiset has
   exactly one piece twice and exactly one piece missing, everything else
   exactly once. Returns { count, solutions, truncated }, stopping as soon as
   `limit` solutions are found or `nodeBudget` placements have been tried. */
export function countSolutions(grid, maxPips, limit = 2, nodeBudget = 4_000_000) {
  const rows = grid.length, cols = grid[0].length;
  const total = rows * cols;
  if (total % 2 !== 0) throw new Error("dominoes: grid must have an even number of cells");
  const pieces = allPieces(maxPips);
  const expected = pieces.length;
  if (total / 2 !== expected) {
    throw new Error(`dominoes: ${total / 2} dominoes needed but the double-${maxPips} set has ${expected} pieces`);
  }

  const covered = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const counts = new Map(pieces.map((p) => [pieceKey(p[0], p[1]), 0]));
  let dupKey = null; // the one piece currently at count 2, if any
  const placed = []; // stack of {r1,c1,r2,c2,key}

  const solutions = [];
  let found = 0, nodes = 0, truncated = false;

  function neighboursOf(r, c) {
    const out = [];
    if (r + 1 < rows) out.push([r + 1, c]);
    if (c + 1 < cols) out.push([r, c + 1]);
    if (r - 1 >= 0) out.push([r - 1, c]);
    if (c - 1 >= 0) out.push([r, c - 1]);
    return out;
  }

  /* Pick the uncovered cell with fewest legal uncovered neighbours. Returns
     null when the board is full. */
  function pickCell() {
    let best = null, bestDeg = Infinity;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (covered[r][c]) continue;
        let deg = 0;
        for (const [rr, cc] of neighboursOf(r, c)) if (!covered[rr][cc]) deg++;
        if (deg < bestDeg) { bestDeg = deg; best = [r, c]; if (deg === 0) return best; }
      }
    }
    return best;
  }

  function anyUncovered() {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (!covered[r][c]) return true;
    return false;
  }

  function finalizeIfSolved() {
    let dup = null, miss = null, ok = true;
    for (const [key, n] of counts) {
      if (n === 1) continue;
      if (n === 0) { if (miss) { ok = false; break; } miss = key; }
      else if (n === 2) { if (dup) { ok = false; break; } dup = key; }
      else { ok = false; break; }
    }
    if (ok && dup && miss) {
      const dominoes = placed.map((p) => ({ cells: [[p.r1, p.c1], [p.r2, p.c2]], pips: [grid[p.r1][p.c1], grid[p.r2][p.c2]] }));
      solutions.push({
        dominoes,
        duplicate: dup.split("-").map(Number),
        missing: miss.split("-").map(Number),
      });
      found++;
    }
  }

  function go() {
    if (found >= limit || truncated) return;
    if (!anyUncovered()) { finalizeIfSolved(); return; }

    const cell = pickCell();
    if (!cell) return;
    const [r, c] = cell;
    const opts = neighboursOf(r, c).filter(([rr, cc]) => !covered[rr][cc]);
    if (!opts.length) return; // dead corner, prune

    for (const [rr, cc] of opts) {
      if (found >= limit || truncated) return;
      nodes++;
      if (nodes > nodeBudget) { truncated = true; return; }

      const a = grid[r][c], b = grid[rr][cc];
      const key = pieceKey(a, b);
      const n = counts.get(key);
      if (n >= 2) continue;                 // already the duplicate, never a triple
      if (n === 1 && dupKey && dupKey !== key) continue; // only one piece may double

      covered[r][c] = true; covered[rr][cc] = true;
      counts.set(key, n + 1);
      const hadDup = dupKey;
      if (n + 1 === 2) dupKey = key;
      placed.push({ r1: r, c1: c, r2: rr, c2: cc, key });

      go();

      placed.pop();
      counts.set(key, n);
      dupKey = hadDup;
      covered[r][c] = false; covered[rr][cc] = false;
    }
  }

  go();
  return { count: found, solutions, truncated };
}

/* Player state: which cells are joined into a domino. hJoin[r][c] means cell
   (r,c) is joined to (r,c+1); vJoin[r][c] means (r,c) is joined to (r+1,c). */
export function cellDegrees(hJoin, vJoin, rows, cols) {
  const deg = Array.from({ length: rows }, () => new Array(cols).fill(0));
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 1; c++) {
    if (hJoin[r][c]) { deg[r][c]++; deg[r][c + 1]++; }
  }
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) {
    if (vJoin[r][c]) { deg[r][c]++; deg[r + 1][c]++; }
  }
  return deg;
}

/* Read the player's dissection straight off the grid — no stored answer.
   Returns:
     complete   every cell has degree exactly 1 (a legal full dissection)
     overlaps   cells with degree > 1 (a cell joined two ways — always wrong)
     pieces     the dominoes as drawn, once complete
     counts     Map<pieceKey, occurrences>
     duplicate  the one piece occurring twice, once complete+valid, else null
     missing    the one piece occurring zero times, once complete+valid, else null
     valid      true iff complete and the tally has exactly one double, one
                zero, everything else exactly one — the actual win condition */
export function readDissection(grid, hJoin, vJoin, maxPips) {
  const rows = grid.length, cols = grid[0].length;
  const deg = cellDegrees(hJoin, vJoin, rows, cols);
  const overlaps = [];
  let complete = true;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (deg[r][c] > 1) overlaps.push([r, c]);
    if (deg[r][c] !== 1) complete = false;
  }

  const pieces = allPieces(maxPips);
  const counts = new Map(pieces.map((p) => [pieceKey(p[0], p[1]), 0]));
  const dominoes = [];
  if (overlaps.length === 0) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 1; c++) {
      if (hJoin[r][c]) {
        const key = pieceKey(grid[r][c], grid[r][c + 1]);
        counts.set(key, (counts.get(key) || 0) + 1);
        dominoes.push({ cells: [[r, c], [r, c + 1]], pips: [grid[r][c], grid[r][c + 1]] });
      }
    }
    for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) {
      if (vJoin[r][c]) {
        const key = pieceKey(grid[r][c], grid[r + 1][c]);
        counts.set(key, (counts.get(key) || 0) + 1);
        dominoes.push({ cells: [[r, c], [r + 1, c]], pips: [grid[r][c], grid[r + 1][c]] });
      }
    }
  }

  let duplicate = null, missing = null, valid = complete && overlaps.length === 0;
  if (valid) {
    for (const [key, n] of counts) {
      if (n === 1) continue;
      if (n === 0) { if (missing) { valid = false; break; } missing = key; }
      else if (n === 2) { if (duplicate) { valid = false; break; } duplicate = key; }
      else { valid = false; break; }
    }
    if (!duplicate || !missing) valid = false;
  }

  return {
    complete,
    overlaps,
    pieces: dominoes,
    counts,
    duplicate: valid ? duplicate.split("-").map(Number) : null,
    missing: valid ? missing.split("-").map(Number) : null,
    valid,
  };
}
