/* ============================================================================
   UNEVEN SKIES (Star Battle, uneven regions) — rules core
   ----------------------------------------------------------------------------
   DOM-free. Used by engines/skies.js to grade, and by the authoring script to
   prove each grid has exactly one valid sky.

   This is Star Battle's skeleton with the one symmetry that makes ordinary
   Star Battle tractable removed on purpose.

   The familiar game: an N x N grid cut into N regions, every row, every
   column AND every region holding the same count of stars (usually 1 or 2),
   no two stars touching even diagonally. Because every line and every region
   carry the *same* number, a region and a line are interchangeable currency —
   "this region's stars must be these two rows" and "these two rows' stars
   must be in this region" are the same deduction read backwards. Almost every
   published solving technique (the count-per-region overlap trick, "if a
   region touches only two rows, it swallows their stars") is secretly that
   symmetry doing the work.

   UNEVEN SKIES breaks it two ways:
     - Rows and columns still each hold exactly two stars — the line rule is
       held constant so the mechanic doesn't wobble between rounds.
     - Regions do NOT match the line count. Each region is printed with its
       own number of stars: 0, 1, 2 or 3, and different regions get different
       numbers. A region marked 0 is pure dead space — useful only for ruling
       cells out. A region marked 3 must be crowded, which given the
       no-touching rule pins its shape hard. There are also strictly more
       regions than rows/columns, so counting "regions vs lines" can no
       longer be balanced one-for-one; some deductions only close by working
       within a single region's own budget, independent of what any line
       needs.

   Net effect: the overlap trick that lets Star Battle regulars solve almost
   by pattern-matching doesn't fire here, because a region's count no longer
   tells you anything about the rows it touches. Every deduction has to route
   through the no-touching rule and the per-region, per-row, per-column
   budgets separately.
   ========================================================================== */

const DIAG = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

/* spec: { n, regions, regionCounts, perLine }
     n            — grid size (n x n)
     regions      — n x n array of region ids (0..R-1)
     regionCounts — array of length R, stars required in that region
     perLine      — stars required per row/column (2, held constant here) */

export function makeSpec(n, regions, regionCounts, perLine = 2) {
  return { n, regions, regionCounts, perLine };
}

/* Exhaustive row-by-row search with pruning on column/region counts and
   adjacency. Returns { count, solutions, exhausted } where solutions are
   arrays of [r, c] star cells, capped at `limit`. `nodeBudget` bounds the
   number of row-placements explored, so the authoring search can bail on a
   hopeless seed instead of exhausting it; `exhausted: false` on the result
   means the budget ran out before the search finished, so `count` is only a
   lower bound and must not be trusted as a real answer. */
export function countSolutions(spec, limit = 2, nodeBudget = Infinity) {
  const { n, regions, regionCounts, perLine } = spec;
  const R = regionCounts.length;

  const colLeft = new Array(n).fill(perLine);
  const regionLeft = regionCounts.slice();
  const stars = Array.from({ length: n }, () => new Array(n).fill(false));
  const solutions = [];
  let found = 0;
  let nodes = 0;
  let budgetHit = false;

  // rowsLeftBelow[r] = how many rows including r remain, for column feasibility.
  function go(r, rowStars, colLeftArr, regionLeftArr) {
    if (found >= limit || budgetHit) return;
    if (++nodes > nodeBudget) { budgetHit = true; return; }
    if (r === n) {
      if (colLeftArr.every((x) => x === 0) && regionLeftArr.every((x) => x === 0)) {
        found++;
        const cells = [];
        for (let rr = 0; rr < n; rr++) for (let cc = 0; cc < n; cc++) if (stars[rr][cc]) cells.push([rr, cc]);
        solutions.push(cells);
      }
      return;
    }
    // Prune: each remaining column still needs colLeft[c] stars, and only
    // (n - r) rows remain to supply them.
    const rowsLeft = n - r;
    for (let c = 0; c < n; c++) if (colLeftArr[c] > rowsLeft) return;

    // Enumerate combinations of `perLine` columns for this row that are
    // mutually non-adjacent and legal against column/region budgets.
    const choices = [];
    (function pick(startC, chosen) {
      if (found >= limit) return;
      if (chosen.length === perLine) { choices.push(chosen.slice()); return; }
      for (let c = startC; c < n; c++) {
        if (colLeftArr[c] <= 0) continue;
        if (chosen.length && c - chosen[chosen.length - 1] === 1) continue; // horizontal touch
        // vertical/diagonal touch against row above
        if (stars[r - 1]?.[c - 1] || stars[r - 1]?.[c] || stars[r - 1]?.[c + 1]) continue;
        const reg = regions[r][c];
        if (regionLeftArr[reg] <= 0) continue;
        chosen.push(c);
        pick(c + 2, chosen); // +2: skip the immediately adjacent column too
        chosen.pop();
      }
    })(0, []);

    for (const cols of choices) {
      if (found >= limit) return;
      // check region budget doesn't get double-spent within same row pick
      const regUse = {};
      let ok = true;
      for (const c of cols) {
        const reg = regions[r][c];
        regUse[reg] = (regUse[reg] || 0) + 1;
        if (regUse[reg] > regionLeftArr[reg]) { ok = false; break; }
      }
      if (!ok) continue;

      for (const c of cols) stars[r][c] = true;
      const newCol = colLeftArr.slice();
      const newReg = regionLeftArr.slice();
      for (const c of cols) { newCol[c]--; newReg[regions[r][c]]--; }
      go(r + 1, cols, newCol, newReg);
      for (const c of cols) stars[r][c] = false;
      if (found >= limit) return;
    }
  }

  go(0, [], colLeft, regionLeft);
  return { count: found, solutions, exhausted: !budgetHit };
}

/* Grading a finished grid from the player's marks (1 = star) alone. */
export function check(spec, cells) {
  const { n, regions, regionCounts, perLine } = spec;
  const R = regionCounts.length;
  const rowCount = new Array(n).fill(0), colCount = new Array(n).fill(0), regCount = new Array(R).fill(0);
  const set = new Set(cells.map(([r, c]) => r * n + c));
  for (const [r, c] of cells) { rowCount[r]++; colCount[c]++; regCount[regions[r][c]]++; }

  if (rowCount.some((x) => x !== perLine)) return { ok: false, why: "some row doesn't have exactly two stars" };
  if (colCount.some((x) => x !== perLine)) return { ok: false, why: "some column doesn't have exactly two stars" };
  if (regCount.some((x, i) => x !== regionCounts[i])) return { ok: false, why: "a region doesn't match its printed count" };
  for (const [r, c] of cells) {
    for (const [dr, dc] of DIAG) {
      if (set.has((r + dr) * n + (c + dc))) return { ok: false, why: "two stars touch" };
    }
  }
  return { ok: true };
}
