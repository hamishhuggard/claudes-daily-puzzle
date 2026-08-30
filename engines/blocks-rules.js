/* ============================================================================
   BLOCKS — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/blocks.js draws the yard; this file checks a stacking and
   computes par, and is the same code the authoring tool used.

   The puzzle: a base grid of cells, some of them blocked. On every free cell
   you may stack cubes. Two shadows are cast — one along the rows, one along
   the columns — and a shadow records the TALLEST stack it passes over. You
   are given both shadows and asked to cast them with as few cubes as you can.

   The whole thing turns on one observation, and everything else is bookkeeping
   around it. To make a row's shadow you need at least one stack of exactly
   that height somewhere in the row, and likewise for each column. A single
   stack can do both jobs at once — but only if the row's number and the
   column's number are equal, since one stack has one height. So the game is
   pairing up rows and columns that happen to want the same height, and every
   pair you find saves you a whole stack.

   Which is why the blocked cells matter, and why they are placed rather than
   scattered. Without them, pairing is free: any row wanting 3 can be served by
   any column wanting 3, and the answer collapses into arithmetic. Block the
   cell where a row and a column cross and that particular saving is off the
   table, so the pairing becomes a real search over which savings can coexist.
   ========================================================================== */

/* A stacking is a grid of heights, 0 for empty. `blocked` is the same shape. */

export const shadowsOf = (heights, rows, cols) => {
  const rowMax = new Array(rows).fill(0);
  const colMax = new Array(cols).fill(0);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      rowMax[r] = Math.max(rowMax[r], heights[r][c]);
      colMax[c] = Math.max(colMax[c], heights[r][c]);
    }
  }
  return { rowMax, colMax };
};

export const cubesIn = (heights) =>
  heights.reduce((a, row) => a + row.reduce((x, y) => x + y, 0), 0);

/* Does this stacking cast exactly the shadows asked for, and stay off the
   blocked cells? Returns a list of what is wrong, so the engine can say. */
export function faults(heights, blocked, want) {
  const rows = want.side.length, cols = want.front.length;
  const out = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (blocked[r][c] && heights[r][c]) out.push({ kind: "blocked", r, c });
      if (heights[r][c] > Math.min(want.side[r], want.front[c])) {
        out.push({ kind: "tooTall", r, c });
      }
    }
  }
  const { rowMax, colMax } = shadowsOf(heights, rows, cols);
  rowMax.forEach((h, r) => { if (h !== want.side[r]) out.push({ kind: "row", r, is: h }); });
  colMax.forEach((h, c) => { if (h !== want.front[c]) out.push({ kind: "col", c, is: h }); });
  return out;
}

/* The fewest cubes that can cast these shadows.

   A minimal stacking is made only of "peaks": a cell whose height equals its
   row's number, or its column's number, or both. Everything else can be zero.
   So the search is over which cells are peaks, and it is small enough to do
   exactly: try every way of serving each row, remembering which columns get
   served for free along the way. */
export function par(blocked, want) {
  const rows = want.side.length, cols = want.front.length;

  // For each row, the cells that could carry its peak, and which column (if
  // any) that peak would also serve.
  const rowOptions = [];
  for (let r = 0; r < rows; r++) {
    const opts = [];
    for (let c = 0; c < cols; c++) {
      if (blocked[r][c]) continue;
      if (want.side[r] > want.front[c]) continue;      // would overshoot the column
      opts.push({ c, alsoServes: want.front[c] === want.side[r] ? c : -1 });
    }
    rowOptions.push(opts);
  }
  if (rowOptions.some((o) => !o.length)) return null;  // some row cannot be served

  let best = Infinity, bestGrid = null;
  const chosen = new Array(rows).fill(null);

  (function rec(r, served) {
    if (r === rows) {
      // Any column still unserved needs a peak of its own, on a free cell that
      // does not overshoot that cell's row.
      let extra = 0;
      const extras = [];
      for (let c = 0; c < cols; c++) {
        if (served.has(c)) continue;
        let ok = -1;
        for (let rr = 0; rr < rows; rr++) {
          if (blocked[rr][c]) continue;
          if (want.front[c] > want.side[rr]) continue;
          ok = rr; break;
        }
        if (ok === -1) { extra = Infinity; break; }
        extra += want.front[c];
        extras.push({ r: ok, c });
      }
      const total = chosen.reduce((a, x) => a + want.side[x.r], 0) + extra;
      if (total < best) {
        best = total;
        const grid = Array.from({ length: rows }, () => new Array(cols).fill(0));
        chosen.forEach((x) => { grid[x.r][x.c] = Math.max(grid[x.r][x.c], want.side[x.r]); });
        extras.forEach((x) => { grid[x.r][x.c] = Math.max(grid[x.r][x.c], want.front[x.c]); });
        bestGrid = grid;
      }
      return;
    }
    for (const o of rowOptions[r]) {
      chosen[r] = { r, c: o.c };
      if (o.alsoServes === -1) rec(r + 1, served);
      else {
        const had = served.has(o.alsoServes);
        served.add(o.alsoServes);
        rec(r + 1, served);
        if (!had) served.delete(o.alsoServes);
      }
    }
    chosen[r] = null;
  })(0, new Set());

  if (best === Infinity) return null;
  return { cubes: best, grid: bestGrid };
}

/* The lazy answer: fill every free cell as high as both shadows allow. It
   always works and it is always wasteful — the number worth beating. */
export function greedy(blocked, want) {
  const rows = want.side.length, cols = want.front.length;
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) =>
      (blocked[r][c] ? 0 : Math.min(want.side[r], want.front[c]))));
  return { cubes: cubesIn(grid), grid };
}
