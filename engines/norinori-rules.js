/* ============================================================================
   PAIRS AND SPARES — Norinori rules core
   ----------------------------------------------------------------------------
   DOM-free. Used by engines/norinori.js to grade, and by the authoring script
   to prove each grid has exactly one valid shading.

   Standard Norinori: a grid is cut into regions. Shade cells so that every
   shaded cell is part of exactly one domino — a pair of orthogonally
   adjacent shaded cells — and no shaded cell may touch a third shaded cell
   orthogonally (so shaded cells form disjoint dominoes only, never an L or a
   line of three). The one extra rule that makes ordinary Norinori playable
   by pattern: every region holds exactly two shaded cells, always, no matter
   its size. Once a solver knows that, a region's own size becomes almost
   free information — a big region just has more empty room, a small one has
   less, but the target never moves.

   PAIRS AND SPARES removes that constant. Each region prints its OWN
   required count of shaded cells: 0, 2, 4 or 6 (never odd — dominoes only
   ever cover cells in twos). Regions of the same size can require different
   counts, and dominoes are free to straddle a region border, so a domino's
   two halves need not even agree on which region's budget they spend.

   That changes the strategy in three ways:
     - A region printed 0 is not "usually empty," it is dead: nothing in it
       may ever be shaded, which prunes every domino touching it immediately.
     - A region printed 6 forces most of that region shaded, which — given
       the no-triple-touch rule — pins exactly which cells stay empty and how
       the dominoes inside must pair up, often before anything else on the
       board is settled.
     - Because regions no longer share one number, "this region is big, so
       assume the average" stops working. A five-cell region marked 2 and a
       five-cell region marked 4 look identical until their counts are read,
       and the two boards they force are nothing alike. Every deduction has
       to route through the per-region budget and the no-triple-touch rule
       directly, not through a size/count shortcut that no longer holds.

   spec: { rows, cols, regions, regionCounts }
     rows, cols   — grid dimensions
     regions      — rows x cols array of region ids (0..R-1)
     regionCounts — array of length R, shaded cells required in that region
                    (each value even: 0, 2, 4 or 6)
   ========================================================================== */

const D4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function makeSpec(rows, cols, regions, regionCounts) {
  return { rows, cols, regions, regionCounts };
}

/* Exhaustive cell-by-cell search (row-major order) with pruning on region
   budgets and the no-triple-touch / domino-only-shape rule. Returns
   { count, solutions, exhausted } where solutions are arrays of [r, c]
   shaded cells, capped at `limit`. `nodeBudget` bounds explored placements
   so a hopeless seed can bail instead of exhausting; `exhausted: false`
   means the budget ran out first, so `count` is only a lower bound. */
export function countSolutions(spec, limit = 2, nodeBudget = Infinity) {
  const { rows, cols, regions, regionCounts } = spec;
  const R = regionCounts.length;
  const total = rows * cols;

  const shaded = new Array(total).fill(false);
  // partner[i] = index of the cell i is domino-paired with, once decided.
  const partner = new Array(total).fill(-1);
  const solutions = [];
  let found = 0;
  let nodes = 0;
  let budgetHit = false;

  const idx = (r, c) => r * cols + c;
  const inb = (r, c) => r >= 0 && r < rows && c >= 0 && c < cols;

  function neighbours(r, c) {
    const out = [];
    for (const [dr, dc] of D4) {
      const rr = r + dr, cc = c + dc;
      if (inb(rr, cc)) out.push(idx(rr, cc));
    }
    return out;
  }

  // orthogonal shaded-neighbour count of cell i, given current `shaded`.
  function shadedNbrCount(i) {
    const r = Math.floor(i / cols), c = i % cols;
    let n = 0;
    for (const j of neighbours(r, c)) if (shaded[j]) n++;
    return n;
  }

  function regionLeftFeasible(regionLeft) {
    // Remaining budget per region must be satisfiable by remaining unshaded
    // cells still available in that region — cheap necessary check done via
    // a running "cellsLeft" count computed by caller each step is overkill;
    // instead just ensure no region has negative-left, checked at assignment.
    return regionLeft.every((x) => x >= 0);
  }

  // regionCapacity[g] = number of cells of region g not yet visited (i.e.
  // still available to be shaded), tracked incrementally.
  const regionCapacity = new Array(R).fill(0);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) regionCapacity[regions[r][c]]++;

  function go(i, regionLeft, regionCap) {
    if (found >= limit || budgetHit) return;
    if (++nodes > nodeBudget) { budgetHit = true; return; }

    if (i === total) {
      if (regionLeft.every((x) => x === 0)) {
        // every shaded cell must have exactly one shaded neighbour (domino)
        let ok = true;
        for (let k = 0; k < total; k++) {
          if (!shaded[k]) continue;
          const r = Math.floor(k / cols), c = k % cols;
          let n = 0;
          for (const j of neighbours(r, c)) if (shaded[j]) n++;
          if (n !== 1) { ok = false; break; }
        }
        if (ok) {
          found++;
          const cells = [];
          for (let k = 0; k < total; k++) if (shaded[k]) cells.push([Math.floor(k / cols), k % cols]);
          solutions.push(cells);
        }
      }
      return;
    }

    const r = Math.floor(i / cols), c = i % cols;
    const g = regions[r][c];

    // Option A: leave cell i unshaded.
    {
      const newCap = regionCap.slice();
      newCap[g]--;
      if (newCap[g] >= regionLeft[g]) {
        go(i + 1, regionLeft, newCap);
        if (found >= limit || budgetHit) return;
      }
    }

    // Option B: shade cell i. It must end up with exactly one shaded
    // neighbour; check feasibility against already-decided neighbours
    // (those with smaller index, i.e. above/left) that are already shaded.
    if (regionLeft[g] > 0) {
      let priorShadedTouch = 0;
      for (const j of neighbours(r, c)) if (j < i && shaded[j]) priorShadedTouch++;
      if (priorShadedTouch <= 1) {
        shaded[i] = true;
        const newRegionLeft = regionLeft.slice();
        newRegionLeft[g]--;
        const newCap = regionCap.slice();
        newCap[g]--;
        if (newCap[g] >= newRegionLeft[g]) {
          go(i + 1, newRegionLeft, newCap);
        }
        shaded[i] = false;
        if (found >= limit || budgetHit) return;
      }
    }
  }

  go(0, regionCounts.slice(), regionCapacity.slice());
  return { count: found, solutions, exhausted: !budgetHit };
}

/* Grading a finished grid from the player's own shaded cells alone. */
export function check(spec, cells) {
  const { rows, cols, regions, regionCounts } = spec;
  const R = regionCounts.length;
  const set = new Set(cells.map(([r, c]) => r * cols + c));
  const regCount = new Array(R).fill(0);
  for (const [r, c] of cells) regCount[regions[r][c]]++;

  if (regCount.some((x, i) => x !== regionCounts[i])) {
    return { ok: false, why: "a region doesn't match its printed count" };
  }

  for (const [r, c] of cells) {
    let n = 0;
    for (const [dr, dc] of D4) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols && set.has(rr * cols + cc)) n++;
    }
    if (n !== 1) return { ok: false, why: n === 0 ? "a shaded cell has no domino partner" : "a shaded cell touches more than one other shaded cell" };
  }
  return { ok: true };
}
