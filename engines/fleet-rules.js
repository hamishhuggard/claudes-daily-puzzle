/* ============================================================================
   FLEET (solitaire Battleships) — rules core
   ----------------------------------------------------------------------------
   DOM-free. engines/fleet.js draws and grades; the authoring script used this
   same code to prove each sea has exactly one fleet in it.

   Rules: place the whole fleet — one 4, two 3s, three 2s, four 1s — flat on
   the grid, horizontally or vertically. No two ships touch, not even at a
   corner. The numbers count occupied squares in each row and column.

   The variant: instead of revealing squares, this version gives SONAR. A buoy
   always floats on water, and reports how many ship squares lie in the 3x3
   block around it. So nothing is ever handed over directly — a reading of 3
   might be a 3-ship lying alongside, or a 2 and a single, or three separate
   ships clipping the corners. Ordinary Battleships gives you certainties to
   build from; this gives you a constraint you have to squeeze, and the
   no-touching rule is what makes squeezing possible, since it caps how much
   fleet can fit near any one buoy.

   Counting solutions honestly needs one piece of care: ships of the same
   length are interchangeable, so the same sea reached by "3-ship A here,
   3-ship B there" and the swap is ONE solution, not two. Placements within a
   size group are therefore forced into increasing index order, which counts
   each distinct sea exactly once. Getting this wrong doesn't just inflate a
   number — it makes a unique puzzle look ambiguous and get thrown away.
   ========================================================================== */

export const FLEET = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

/* A sonar buoy: { r, c, n } — the buoy's own square is always water, and n is
   the number of ship squares in the 3x3 block centred on it (0..8). */
const BLOCK = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 0], [0, 1], [1, -1], [1, 0], [1, 1]];

export function readingAt(occ, r, c) {
  let n = 0;
  for (const [dr, dc] of BLOCK) if (occ[r + dr]?.[c + dc]) n++;
  return n;
}

function placements(size, rows, cols) {
  const out = [];
  if (size === 1) {
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push([[r, c]]);
    return out;
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c + size <= cols; c++) {
    out.push(Array.from({ length: size }, (_, i) => [r, c + i]));
  }
  for (let c = 0; c < cols; c++) for (let r = 0; r + size <= rows; r++) {
    out.push(Array.from({ length: size }, (_, i) => [r + i, c]));
  }
  return out;
}

const ALL8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

/* Every candidate placement, precomputed once per grid size. */
export function allPlacements(rows, cols) {
  const cache = new Map();
  for (const size of new Set(FLEET)) cache.set(size, placements(size, rows, cols));
  return cache;
}

export function countSolutions(rowCounts, colCounts, hints, limit = 2) {
  const rows = rowCounts.length, cols = colCounts.length;
  const cache = allPlacements(rows, cols);
  const occ = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const rowLeft = rowCounts.slice(), colLeft = colCounts.slice();
  const solutions = [];
  let found = 0;

  const buoyAt = new Set(hints.map((h) => h.r * cols + h.c));

  function fits(cells) {
    for (const [r, c] of cells) {
      if (occ[r][c]) return false;
      if (buoyAt.has(r * cols + c)) return false; // a buoy floats on water
      for (const [dr, dc] of ALL8) if (occ[r + dr]?.[c + dc]) return false;
    }
    // counts must survive this placement
    const dr = new Map(), dc = new Map();
    for (const [r, c] of cells) {
      dr.set(r, (dr.get(r) || 0) + 1);
      dc.set(c, (dc.get(c) || 0) + 1);
    }
    for (const [r, n] of dr) if (rowLeft[r] < n) return false;
    for (const [c, n] of dc) if (colLeft[c] < n) return false;
    return true;
  }

  // A buoy's reading can only ever be reached, never exceeded — checking it on
  // the way down prunes far more than checking completed fleets would.
  function buoysStillPossible() {
    for (const h of hints) if (readingAt(occ, h.r, h.c) > h.n) return false;
    return true;
  }

  function put(cells, on) {
    for (const [r, c] of cells) {
      occ[r][c] = on;
      rowLeft[r] += on ? -1 : 1;
      colLeft[c] += on ? -1 : 1;
    }
  }

  function go(shipIdx, startFrom) {
    if (found >= limit) return;
    if (shipIdx === FLEET.length) {
      if (rowLeft.some((n) => n !== 0) || colLeft.some((n) => n !== 0)) return;
      for (const h of hints) if (readingAt(occ, h.r, h.c) !== h.n) return;
      found++;
      solutions.push(occ.map((r) => r.slice()));
      return;
    }
    const size = FLEET[shipIdx];
    // Same-size ships are identical, so only ever place them in increasing
    // index order — otherwise every distinct sea is counted size! times over.
    const sameAsPrev = shipIdx > 0 && FLEET[shipIdx - 1] === size;
    const list = cache.get(size);
    for (let i = sameAsPrev ? startFrom : 0; i < list.length; i++) {
      const cells = list[i];
      if (!fits(cells)) continue;
      put(cells, true);
      if (buoysStillPossible()) go(shipIdx + 1, i + 1);
      put(cells, false);
      if (found >= limit) return;
    }
  }

  go(0, 0);
  return { count: found, solutions };
}

/* Grade a finished sea from the player's own marks. */
export function check(rowCounts, colCounts, hints, occ) {
  const rows = rowCounts.length, cols = colCounts.length;
  const rc = new Array(rows).fill(0), cc = new Array(cols).fill(0);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (occ[r][c]) { rc[r]++; cc[c]++; }
  if (rc.some((n, i) => n !== rowCounts[i])) return { ok: false, why: "row counts" };
  if (cc.some((n, i) => n !== colCounts[i])) return { ok: false, why: "column counts" };
  for (const h of hints) {
    if (occ[h.r][h.c]) return { ok: false, why: "a ship is sitting on a sonar buoy" };
    if (readingAt(occ, h.r, h.c) !== h.n) return { ok: false, why: `the buoy reading ${h.n} isn't met` };
  }
  const ships = shipsOf(occ);
  if (!ships) return { ok: false, why: "ships are touching, or one isn't straight" };
  const got = ships.map((s) => s.length).sort((a, b) => b - a).join(",");
  if (got !== FLEET.join(",")) return { ok: false, why: `the fleet is wrong (${got || "nothing"})` };
  return { ok: true };
}

/* Split occupied squares into ships. Returns null if any two ships touch
   diagonally or a blob isn't a straight line. */
export function shipsOf(occ) {
  const rows = occ.length, cols = occ[0].length;
  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const ships = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!occ[r][c] || seen[r][c]) continue;
    const cells = [];
    const stack = [[r, c]];
    seen[r][c] = true;
    while (stack.length) {
      const [rr, cc] = stack.pop();
      cells.push([rr, cc]);
      for (const [dr, dc] of ALL8) {
        const nr = rr + dr, nc = cc + dc;
        if (occ[nr]?.[nc] && !seen[nr][nc]) { seen[nr][nc] = true; stack.push([nr, nc]); }
      }
    }
    const sameRow = cells.every(([rr]) => rr === cells[0][0]);
    const sameCol = cells.every(([, cc]) => cc === cells[0][1]);
    if (!sameRow && !sameCol) return null; // an L or a diagonal touch
    ships.push(cells);
  }
  return ships;
}
