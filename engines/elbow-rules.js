/* ============================================================================
   ELBOW — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/elbow.js draws the grid; this file is the solver that proved
   the board has one answer and that re-proves it on mount.

   The original fills each region with 1..n and asks only that touching cells
   be DIFFERENT — edges and corners alike. Any neighbour that isn't the same
   digit is fine, so "different" treats every digit exactly the same way.

   This variant makes a trade: corners stop mattering entirely, and in
   exchange two cells sharing an EDGE must differ by at least two.

       edge-sharing:   |a - b| >= 2
       corner-sharing:  anything

   The point is not that it is tighter — it is that the constraint acquires a
   shape. In the original, knowing a cell is 3 tells you its neighbours are
   "not 3". Here it tells you they are not 2, 3 or 4: it rules out a band
   around the value, so the middle digits become the expensive ones and the
   extremes are what fit into tight spots. Putting a 3 down costs far more
   than putting a 1 down, and nothing in the original has that asymmetry.

   The trade is also what keeps the puzzle alive. Both rules at once is not a
   harder puzzle, it is no puzzle: of 86 random six-region partitions of a 6x6,
   zero admit any filling under edge>=2 plus the corner rule, and 83 admit one
   with corners free.

   A board is `rows` x `cols`, `regions[i]` gives the region id of cell i, and
   `givens` maps cell index to a fixed value. Cells are indexed r * cols + c.
   ========================================================================== */

const D4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

function stepper(rows, cols, dirs) {
  return (i) => {
    const r = Math.floor(i / cols), c = i % cols, out = [];
    for (const [dr, dc] of dirs) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < rows && cc < cols) out.push(rr * cols + cc);
    }
    return out;
  };
}
export const edgeNeighbours = (rows, cols) => stepper(rows, cols, D4);
export const cornerNeighbours = (rows, cols) => stepper(rows, cols, DIAG);

/* Region id -> list of cells. */
export function regionCells(spec) {
  const m = new Map();
  spec.regions.forEach((g, i) => {
    if (!m.has(g)) m.set(g, []);
    m.get(g).push(i);
  });
  return m;
}

/* What is wrong with a filled grid. `grid` is value per cell, 0 = blank. */
export function faults(spec, grid) {
  const { rows, cols } = spec;
  const N = rows * cols;
  const edge = edgeNeighbours(rows, cols);
  const out = [];

  for (const [g, cells] of regionCells(spec)) {
    const seen = new Map();
    for (const i of cells) {
      const v = grid[i];
      if (!v) { out.push({ kind: "blank", i }); continue; }
      if (v < 1 || v > cells.length) out.push({ kind: "range", i, max: cells.length });
      if (seen.has(v)) out.push({ kind: "repeat", i, j: seen.get(v), g, v });
      seen.set(v, i);
    }
  }

  for (let i = 0; i < N; i++) {
    if (!grid[i]) continue;
    for (const j of edge(i)) {
      if (!grid[j] || j < i) continue;
      if (Math.abs(grid[i] - grid[j]) < 2) out.push({ kind: "edge", i, j });
    }
  }
  return out;
}

export const isSolved = (spec, grid) => faults(spec, grid).length === 0;

/* Is putting `v` in cell `i` consistent with what is already placed? */
export function allows(spec, grid, i, v, ctx) {
  const { edge, cells } = ctx;
  if (v < 1 || v > cells.get(spec.regions[i]).length) return false;
  for (const j of cells.get(spec.regions[i])) {
    if (j !== i && grid[j] === v) return false;
  }
  for (const j of edge[i]) if (grid[j] && Math.abs(grid[j] - v) < 2) return false;
  return true;
}

export function context(spec) {
  const { rows, cols } = spec;
  const N = rows * cols;
  const e = edgeNeighbours(rows, cols);
  return {
    edge: Array.from({ length: N }, (_, i) => e(i)),
    cells: regionCells(spec),
  };
}

/* --------------------------------------------------------------------------
   Solver. Plain backtracking, but always on the blank cell with the fewest
   candidates — with a band-shaped constraint that prunes hard, and the boards
   are small.
   ------------------------------------------------------------------------ */
export function solve(spec, limit = 2) {
  const { rows, cols, givens } = spec;
  const N = rows * cols;
  const ctx = context(spec);
  const grid = new Int8Array(N);
  for (const [i, v] of Object.entries(givens || {})) grid[Number(i)] = v;

  // The givens themselves must be legal, or there is nothing to find.
  for (let i = 0; i < N; i++) {
    if (!grid[i]) continue;
    const v = grid[i]; grid[i] = 0;
    const ok = allows(spec, grid, i, v, ctx);
    grid[i] = v;
    if (!ok) return [];
  }

  const found = [];
  (function rec() {
    if (found.length >= limit) return;

    let best = -1, bestOpts = null;
    for (let i = 0; i < N; i++) {
      if (grid[i]) continue;
      const max = ctx.cells.get(spec.regions[i]).length;
      const opts = [];
      for (let v = 1; v <= max; v++) if (allows(spec, grid, i, v, ctx)) opts.push(v);
      if (!opts.length) return;                       // dead cell, back out
      if (!bestOpts || opts.length < bestOpts.length) { best = i; bestOpts = opts; }
      if (opts.length === 1) break;                   // can't do better
    }
    if (best === -1) { found.push(Int8Array.from(grid)); return; }

    for (const v of bestOpts) {
      grid[best] = v;
      rec();
      grid[best] = 0;
      if (found.length >= limit) return;
    }
  })();

  return found;
}
