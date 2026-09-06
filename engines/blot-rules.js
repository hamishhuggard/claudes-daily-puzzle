/* ============================================================================
   BLOT — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/blot.js draws the grid; this file computes par by actually
   finding the smallest legal blot, so par is the true minimum.

   The original blacks out squares until no number repeats in any row or
   column, under two structural rules: blacked-out squares may never touch, and
   the squares left showing must all stay connected. The ink ends up as
   scattered dots, and the reasoning is local — two 3s clash, and these two
   candidates are adjacent so they can't both go.

   This variant inverts the ink and drops the counting rule for a cost:

       no number repeats in any row or column among the squares still showing
       every blacked-out square touches another — the ink is ONE connected blot
       use as little ink as you can

   Inverting non-adjacency into connectivity is what changes the strategy, and
   the minimum is what makes it a puzzle at all. Without a cost there is
   nothing to solve: with both of the original's structural rules gone, inking
   the entire grid satisfies every remaining condition, because a grid with
   nothing showing has no repeats to find. Brute force over small boards
   confirms it — hundreds of "answers", almost all of them just large. Charging
   for ink is what puts the pressure back.

   And the two rules pull against each other. The squares you are forced to
   ink — one of each clashing pair — are scattered around the grid by
   construction, but they have to end up joined, so you pay extra squares
   purely to connect things that had no reason to be near each other. Choosing
   WHICH member of each clashing pair to ink stops being arbitrary and becomes
   a routing problem: pick the ones that lie on the way to each other. That
   trade does not exist in the original, where the ink is forbidden to touch.

   Cells are indexed r * cols + c. `grid[i]` is the number printed there.
   ========================================================================== */

const D4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function neighbours(rows, cols) {
  return (i) => {
    const r = Math.floor(i / cols), c = i % cols, out = [];
    for (const [dr, dc] of D4) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < rows && cc < cols) out.push(rr * cols + cc);
    }
    return out;
  };
}

/* Is this set one orthogonally connected piece? An empty blot counts as
   connected — a grid with no repeats at all needs no ink. */
export function connected(cells, rows, cols) {
  if (cells.size <= 1) return true;
  const nb = neighbours(rows, cols);
  const start = cells.values().next().value;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    for (const j of nb(stack.pop())) {
      if (cells.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size === cells.size;
}

/* Each group is the cells of one line that share a number. At most one of them
   may stay showing, so at least (size - 1) of them must be inked. These are
   the only content constraints on the board. */
export function groups(spec) {
  const { rows, cols, grid } = spec;
  const out = [];
  const collect = (cellsOfLine) => {
    const byValue = new Map();
    for (const i of cellsOfLine) {
      if (!byValue.has(grid[i])) byValue.set(grid[i], []);
      byValue.get(grid[i]).push(i);
    }
    for (const g of byValue.values()) if (g.length > 1) out.push(g);
  };
  for (let r = 0; r < rows; r++) {
    collect([...Array(cols).keys()].map((c) => r * cols + c));
  }
  for (let c = 0; c < cols; c++) {
    collect([...Array(rows).keys()].map((r) => r * cols + c));
  }
  return out;
}

/* How many more squares of each group still have to be inked, added up. */
export function deficit(gs, inked) {
  let d = 0;
  for (const g of gs) {
    let got = 0;
    for (const i of g) if (inked.has(i)) got++;
    const need = g.length - 1 - got;
    if (need > 0) d += need;
  }
  return d;
}

export function faults(spec, inked) {
  const { rows, cols } = spec;
  const out = [];
  for (const g of groups(spec)) {
    const showing = g.filter((i) => !inked.has(i));
    if (showing.length > 1) out.push({ kind: "repeat", cells: showing });
  }
  if (!connected(inked, rows, cols)) out.push({ kind: "split" });
  return out;
}

export const isSolved = (spec, inked) => faults(spec, inked).length === 0;

/* --------------------------------------------------------------------------
   Par: the smallest legal blot.

   Deepening by size. For each budget k, every connected set of exactly k
   squares is enumerated once — anchored at its lowest-numbered square, and
   grown by frontier expansion with a canonical ban so no set is produced
   twice — and checked against the groups.

   The prune is what makes it finish. One inked square can serve at most two
   groups (the one in its row and the one in its column), so a position needing
   `deficit` more group-slots needs at least ceil(deficit / 2) more squares.
   Any branch where that overshoots the budget is dead.
   ------------------------------------------------------------------------ */
export function minBlot(spec, cap = 24) {
  const { rows, cols } = spec;
  const N = rows * cols;
  const nb = neighbours(rows, cols);
  const NB = Array.from({ length: N }, (_, i) => nb(i));
  const gs = groups(spec);

  if (deficit(gs, new Set()) === 0) return { size: 0, blot: new Set() };

  for (let k = 1; k <= cap; k++) {
    const found = searchSize(k);
    if (found) return { size: k, blot: found };
  }
  return null;

  function searchSize(k) {
    for (let anchor = 0; anchor < N; anchor++) {
      const inked = new Set([anchor]);
      const banned = new Uint8Array(N);
      const hit = grow(anchor, inked, banned, k);
      if (hit) return hit;
    }
    return null;
  }

  function grow(anchor, inked, banned, k) {
    const d = deficit(gs, inked);
    if (inked.size + Math.ceil(d / 2) > k) return null;
    if (inked.size === k) return d === 0 ? new Set(inked) : null;

    /* Frontier: squares touching the blot, above the anchor, not already
       tried at this level. */
    const frontier = [];
    for (const c of inked) {
      for (const j of NB[c]) {
        if (j < anchor || inked.has(j) || banned[j]) continue;
        if (!frontier.includes(j)) frontier.push(j);
      }
    }
    for (const j of frontier) {
      inked.add(j);
      const hit = grow(anchor, inked, banned, k);
      inked.delete(j);
      if (hit) return hit;
      banned[j] = 1;                 // canonical: never revisit at this level
    }
    for (const j of frontier) banned[j] = 0;
    return null;
  }
}

/* The smallest set that kills every clash while IGNORING connectivity. The gap
   between this and the real par is exactly what joining the ink costs, which
   is the number the author's note is about. */
export function minHittingSet(spec, cap = 24) {
  const gs = groups(spec);
  const inked = new Set();
  for (let k = 0; k <= cap; k++) {
    if (rec(k)) return k;
  }
  return null;

  function rec(budget) {
    const d = deficit(gs, inked);
    if (d === 0) return true;
    if (budget <= 0) return false;
    if (Math.ceil(d / 2) > budget) return false;
    // Serve the first unsatisfied group; one of its members must go.
    for (const g of gs) {
      let got = 0;
      for (const i of g) if (inked.has(i)) got++;
      if (g.length - 1 - got <= 0) continue;
      for (const i of g) {
        if (inked.has(i)) continue;
        inked.add(i);
        const ok = rec(budget - 1);
        inked.delete(i);
        if (ok) return true;
      }
      return false;
    }
    return false;
  }
}
