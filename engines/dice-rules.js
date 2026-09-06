/* ============================================================================
   DICE — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/dice.js draws the yard; this file computes par by actually
   searching the whole position space, so par is the true minimum.

   A rolling-die maze normally asks you to get the die from one square to
   another. The die's faces are scenery: the route is a route, and the
   orientation is just something that happens along the way.

   Here the orientation IS the puzzle. Several squares are marked with a
   number, and a mark is only collected when the die is standing on it with
   that number face UP. So the shortest walk to a square is very often the
   wrong walk, because it arrives showing the wrong face — and the only way to
   change what is showing is to roll, which also moves you somewhere else. You
   cannot separate "where am I" from "what am I showing".

   Two consequences that the plain version has nothing like. Detours stop being
   waste: rolling a square out of your way and back leaves you where you
   started showing a different face, which is sometimes exactly what is needed.
   And the marks may be collected in ANY order, so the route is chosen partly
   for which faces the die will happen to be showing as it passes.

   A die is tracked as (top, north, east). Opposite faces sum to seven, so
   those three fix the whole die. Rolling is the four rotations:

       north: (t, n, e) -> (7-n, t, e)        south: (t, n, e) -> (n, 7-t, e)
       east:  (t, n, e) -> (7-e, n, t)        west:  (t, n, e) -> (e, n, 7-t)

   Cells are indexed r * cols + c. `walls` is a Set of blocked cells.
   ========================================================================== */

export const DIRS = [
  { name: "north", dr: -1, dc: 0, roll: (t, n, e) => [7 - n, t, e] },
  { name: "south", dr: 1, dc: 0, roll: (t, n, e) => [n, 7 - t, e] },
  { name: "east", dr: 0, dc: 1, roll: (t, n, e) => [7 - e, n, t] },
  { name: "west", dr: 0, dc: -1, roll: (t, n, e) => [e, n, 7 - t] },
];

/* A die's orientation packed small enough to index an array. `east` is fixed
   once top and north are known — the die is rigid — so it is not part of the
   key, but it is still carried so rolling stays a pure lookup. */
export const orientKey = (t, n) => (t - 1) * 6 + (n - 1);

export function stateKey(pos, t, n, mask, cells) {
  return ((pos * 36 + orientKey(t, n)) * (1 << cells)) + mask;
}

/* Which marks does standing here with this face up collect? */
function collect(pos, top, marks, mask) {
  let m = mask;
  for (let k = 0; k < marks.length; k++) {
    if (marks[k].cell === pos && marks[k].face === top) m |= (1 << k);
  }
  return m;
}

/* --------------------------------------------------------------------------
   Par, by breadth-first search over (square, orientation, marks collected).

   That product is small — squares x 24 orientations x 2^marks — so the search
   is exhaustive and the number it returns is the true minimum, not an
   estimate. It also returns the route, which the hint button walks.
   ------------------------------------------------------------------------ */
export function solve(spec, from) {
  const { rows, cols, marks } = spec;
  const start = from || spec.start;
  const walls = new Set(spec.walls || []);
  const K = marks.length;
  const FULL = (1 << K) - 1;

  /* `from` lets the engine re-search from wherever the player has actually
     got to, which is what makes a hint mid-game the true best next roll
     rather than the next roll of a route they left long ago. */
  const startMask = collect(start.cell, start.top, marks, from ? (from.mask || 0) : 0);
  const startState = {
    pos: start.cell, t: start.top, n: start.north, e: start.east, mask: startMask,
  };
  const key = (s) => stateKey(s.pos, s.t, s.n, s.mask, K);

  const seen = new Map([[key(startState), null]]);
  let frontier = [startState];
  let depth = 0;

  while (frontier.length) {
    if (frontier.some((s) => s.mask === FULL)) {
      const goal = frontier.find((s) => s.mask === FULL);
      return { par: depth, route: rebuild(goal), goal };
    }
    const next = [];
    for (const s of frontier) {
      const r = Math.floor(s.pos / cols), c = s.pos % cols;
      for (const d of DIRS) {
        const rr = r + d.dr, cc = c + d.dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const np = rr * cols + cc;
        if (walls.has(np)) continue;
        const [t, n, e] = d.roll(s.t, s.n, s.e);
        const mask = collect(np, t, marks, s.mask);
        const ns = { pos: np, t, n, e, mask, from: s, dir: d.name };
        const k = key(ns);
        if (seen.has(k)) continue;
        seen.set(k, ns);
        next.push(ns);
      }
    }
    frontier = next;
    depth++;
  }
  return null;

  function rebuild(goal) {
    const out = [];
    let cur = goal;
    while (cur && cur.from) { out.push(cur.dir); cur = cur.from; }
    return out.reverse();
  }
}

/* The shortest route that ignores faces entirely — walk to each mark in the
   best order, treating it as an ordinary maze. This is what the plain version
   of the puzzle would cost, and the gap is the variant. */
export function faceBlindPar(spec) {
  const { rows, cols, start, marks } = spec;
  const walls = new Set(spec.walls || []);
  const N = rows * cols;

  const dist = (from) => {
    const d = new Array(N).fill(Infinity);
    d[from] = 0;
    const q = [from];
    while (q.length) {
      const i = q.shift();
      const r = Math.floor(i / cols), c = i % cols;
      for (const dir of DIRS) {
        const rr = r + dir.dr, cc = c + dir.dc;
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        const j = rr * cols + cc;
        if (walls.has(j) || d[j] !== Infinity) continue;
        d[j] = d[i] + 1;
        q.push(j);
      }
    }
    return d;
  };

  const points = [start.cell, ...marks.map((m) => m.cell)];
  const table = points.map((p) => dist(p));
  let best = Infinity;
  const order = [...marks.keys()];
  (function perm(rest, at, cost) {
    if (cost >= best) return;
    if (!rest.length) { best = Math.min(best, cost); return; }
    for (let i = 0; i < rest.length; i++) {
      const k = rest[i];
      perm(rest.filter((_, j) => j !== i), k + 1, cost + table[at][marks[k].cell]);
    }
  })(order, 0, 0);
  return best;
}
