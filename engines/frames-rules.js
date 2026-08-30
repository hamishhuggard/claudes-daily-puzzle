/* ============================================================================
   FRAMES — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/frames.js draws the board; this file is the solver the
   authoring tool used to prove each board has exactly one answer, and which
   the engine re-runs on mount.

   The puzzle: cut the whole grid into rectangles so that every rectangle
   contains exactly one numbered cell, and the number is the rectangle's
   PERIMETER. Every cell ends up in exactly one rectangle.

   The familiar version of this shape gives the AREA, and swapping the two
   changes what a clue is for:

     - An area factorises. A 12 is 1x12, 2x6, 3x4 (and their transposes), and
       a prime area is a single strip — the strongest clue in the game.
     - A perimeter partitions. A 12 means width + height = 6, so 1x5, 2x4,
       3x3, and back again. There are no primes to lean on, and every odd
       number is impossible, which sounds like a loss of information until
       you notice that a 6 forces a 1x2 domino, exactly.

   The bigger difference is global. In the area version the numbers must sum
   to the area of the grid, which is a free consistency check on any partial
   solution, and most solvers use it constantly. Perimeters give you no such
   thing: the areas are not determined by the clues at all. What you get
   instead is that the sum of (width + height) over all rectangles is half the
   sum of the clues, which constrains the shapes rather than the coverage.
   ========================================================================== */

/* A clue is { r, c, p } — a cell and the perimeter of the rectangle it owns. */

export const perimeter = (w, h) => 2 * (w + h);

/* Every rectangle of the right perimeter that covers this clue and no other. */
export function optionsFor(clue, clues, rows, cols) {
  const out = [];
  const half = clue.p / 2;                       // width + height
  for (let w = 1; w < half; w++) {
    const h = half - w;
    if (w > cols || h > rows) continue;
    for (let r0 = Math.max(0, clue.r - h + 1); r0 <= clue.r; r0++) {
      for (let c0 = Math.max(0, clue.c - w + 1); c0 <= clue.c; c0++) {
        if (r0 + h > rows || c0 + w > cols) continue;
        // exactly one clue inside, and it is this one
        let n = 0;
        for (const k of clues) {
          if (k.r >= r0 && k.r < r0 + h && k.c >= c0 && k.c < c0 + w) n++;
        }
        if (n !== 1) continue;
        out.push({ r0, c0, w, h });
      }
    }
  }
  return out;
}

const cellsOf = (rect, cols) => {
  const out = [];
  for (let r = rect.r0; r < rect.r0 + rect.h; r++) {
    for (let c = rect.c0; c < rect.c0 + rect.w; c++) out.push(r * cols + c);
  }
  return out;
};

/* Solutions, stopping at `limit`. Clues are taken most-constrained first, and
   after each placement every still-uncovered cell must remain reachable by
   some clue that has not been placed — which is what keeps this fast enough
   to run in a browser on mount. */
export function solve(clues, rows, cols, limit = 2) {
  const opts = clues.map((k) => optionsFor(k, clues, rows, cols)
    .map((rect) => ({ rect, cells: cellsOf(rect, cols) })));
  if (opts.some((o) => !o.length)) return [];

  const order = clues.map((_, i) => i).sort((a, b) => opts[a].length - opts[b].length);
  const covered = new Array(rows * cols).fill(-1);
  const found = [];
  const chosen = new Array(clues.length).fill(null);

  /* Could every uncovered cell still be reached by some unplaced clue? */
  function reachable(placedCount) {
    const rest = order.slice(placedCount);
    const can = new Array(rows * cols).fill(false);
    for (const i of rest) {
      for (const o of opts[i]) {
        if (o.cells.some((x) => covered[x] !== -1)) continue;
        for (const x of o.cells) can[x] = true;
      }
    }
    for (let x = 0; x < can.length; x++) if (covered[x] === -1 && !can[x]) return false;
    return true;
  }

  (function rec(depth) {
    if (found.length >= limit) return;
    if (depth === order.length) {
      if (covered.every((x) => x !== -1)) found.push(chosen.map((r) => ({ ...r })));
      return;
    }
    const i = order[depth];
    for (const o of opts[i]) {
      if (o.cells.some((x) => covered[x] !== -1)) continue;
      o.cells.forEach((x) => { covered[x] = i; });
      chosen[i] = o.rect;
      if (reachable(depth + 1)) rec(depth + 1);
      o.cells.forEach((x) => { covered[x] = -1; });
      chosen[i] = null;
      if (found.length >= limit) return;
    }
  })(0);

  return found;
}

/* Which clues are settled with no thought at all — a perimeter with only one
   legal rectangle anywhere on the board. A puzzle that is mostly these is not
   a puzzle. */
export function forcedClues(clues, rows, cols) {
  return clues.reduce((n, k) =>
    n + (optionsFor(k, clues, rows, cols).length === 1 ? 1 : 0), 0);
}
