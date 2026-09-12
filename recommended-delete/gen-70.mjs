#!/usr/bin/env node
/* Generator for puzzle #70 "Struck Off" (engine: hitori).
   Strategy: place a random legal shaded set first (a set with no two cells
   orthogonally adjacent, satisfying the desired row counts), fill the
   unshaded cells so no row/column has a duplicate unshaded value while the
   shaded cells get filler values, verify the unshaded region is connected,
   then read the row counts straight off that arrangement and test
   uniqueness with countSolutions(limit 2). Search seeds until unique.
   Node-budgeted so hopeless seeds bail fast. */

import { countSolutions, check } from "../engines/hitori-rules.js";

function rngFactory(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

function connected(unshaded, n) {
  if (unshaded.size <= 1) return true;
  const start = unshaded.values().next().value;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop();
    const r = Math.floor(i / n), c = i % n;
    for (const [dr, dc] of ORTH) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const j = rr * n + cc;
      if (unshaded.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size === unshaded.size;
}

/* Random legal shaded set: no two orthogonally adjacent, target density
   roughly `density`. Retries until the unshaded region is connected. */
function randomShaded(n, rnd, density) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const shaded = new Set();
    const cells = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) cells.push([r, c]);
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    for (const [r, c] of cells) {
      if (rnd() > density) continue;
      let ok = true;
      for (const [dr, dc] of ORTH) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        if (shaded.has(rr * n + cc)) { ok = false; break; }
      }
      if (ok) shaded.add(r * n + c);
    }
    const unshaded = new Set();
    for (let i = 0; i < n * n; i++) if (!shaded.has(i)) unshaded.add(i);
    if (connected(unshaded, n)) return shaded;
  }
  return null;
}

/* Fill the grid values: unshaded cells in a row/col get distinct values
   from 1..n; shaded cells get a value that duplicates something already in
   its row (that's the "duplicate" the shading resolves), chosen randomly
   from 1..n. */
function fillGrid(n, shaded, rnd) {
  const grid = Array.from({ length: n }, () => new Array(n).fill(0));
  // assign unshaded cells per row a random permutation-ish distinct set,
  // but must also end up column-distinct among unshaded cells. Do a
  // randomized backtracking column-assignment akin to a partial latin square.
  const rows = n, cols = n;

  function colUsed(c) {
    const used = new Set();
    for (let r = 0; r < rows; r++) if (grid[r][c] !== 0 && !shaded.has(r * n + c)) used.add(grid[r][c]);
    return used;
  }

  for (let r = 0; r < rows; r++) {
    const rowUsed = new Set();
    const unshadedCols = [];
    for (let c = 0; c < cols; c++) if (!shaded.has(r * n + c)) unshadedCols.push(c);
    // shuffle
    for (let i = unshadedCols.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [unshadedCols[i], unshadedCols[j]] = [unshadedCols[j], unshadedCols[i]];
    }
    let okRow = true;
    for (const c of unshadedCols) {
      const used = colUsed(c);
      const cands = [];
      for (let v = 1; v <= n; v++) if (!rowUsed.has(v) && !used.has(v)) cands.push(v);
      if (!cands.length) { okRow = false; break; }
      const v = cands[Math.floor(rnd() * cands.length)];
      grid[r][c] = v;
      rowUsed.add(v);
    }
    if (!okRow) return null;
  }
  // shaded cells: pick a value equal to some existing unshaded value in the
  // same row, so shading it is meaningfully "removing a duplicate."
  for (let r = 0; r < rows; r++) {
    const rowVals = [];
    for (let c = 0; c < cols; c++) if (!shaded.has(r * n + c)) rowVals.push(grid[r][c]);
    for (let c = 0; c < cols; c++) {
      if (!shaded.has(r * n + c)) continue;
      if (rowVals.length) grid[r][c] = rowVals[Math.floor(rnd() * rowVals.length)];
      else grid[r][c] = 1 + Math.floor(rnd() * n);
    }
  }
  return grid;
}

function rowCountsFromShaded(n, shaded) {
  const counts = new Array(n).fill(0);
  for (const i of shaded) counts[Math.floor(i / n)]++;
  return counts;
}

function tryOne(n, density, seed) {
  const rnd = rngFactory(seed);
  const shaded = randomShaded(n, rnd, density);
  if (!shaded) return null;
  const grid = fillGrid(n, shaded, rnd);
  if (!grid) return null;
  const rowCounts = rowCountsFromShaded(n, shaded);
  const spec = { n, grid, rowCounts };
  const cells = [...shaded].map((i) => [Math.floor(i / n), i % n]);
  const g = check(spec, cells);
  if (!g.ok) return null;
  const res = countSolutions(spec, 2, 500000);
  if (!res.exhausted || res.count !== 1) return null;
  return { spec, cells };
}

function search(n, density, tries, label) {
  for (let seed = 1; seed <= tries; seed++) {
    const result = tryOne(n, density, seed * 2654435761 % 2147483647 + seed);
    if (result) {
      console.log(`${label}: seed ${seed} -> unique`);
      return result;
    }
  }
  throw new Error(`${label}: no unique puzzle found in ${tries} tries`);
}

function printPuzzle(label, res) {
  const { n, grid, rowCounts } = res.spec;
  console.log(`\n=== ${label} (${n}x${n}) ===`);
  console.log("row counts:", rowCounts);
  console.log("grid:");
  for (let r = 0; r < n; r++) console.log(grid[r].join(" "));
  const set = new Set(res.cells.map(([r, c]) => r * n + c));
  console.log("answer (# = shaded):");
  for (let r = 0; r < n; r++) {
    let row = "";
    for (let c = 0; c < n; c++) row += set.has(r * n + c) ? "#" : ".";
    console.log(row);
  }
  console.log(JSON.stringify({ grid, rowCounts }));
}

const round1 = search(5, 0.28, 6000, "Round 1 (5x5)");
printPuzzle("Round 1", round1);

const round2 = search(6, 0.28, 8000, "Round 2 (6x6)");
printPuzzle("Round 2", round2);

const round3 = search(7, 0.26, 10000, "Round 3 (7x7)");
printPuzzle("Round 3", round3);

console.log("\nDone.");
