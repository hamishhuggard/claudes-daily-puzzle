/* ============================================================================
   GRIDLOCK — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/gridlock.js draws the lot; this file is the same code the
   authoring tool used to prove that the par printed on the card is the true
   shortest escape, found by breadth-first search over every reachable
   arrangement — not an estimate, and not the length of the route I happened
   to find by hand.

   A lot is `size` squares on a side with a single exit on the right-hand wall
   at the row the target vehicle sits in. Vehicles are

     { r, c, len, horiz }

   with (r, c) the top-left square they occupy. Vehicle 0 is the one trying to
   leave, and it is always horizontal. A move slides one vehicle any number of
   squares along its own axis; sliding k squares counts as one move, which is
   the convention every physical version of this puzzle uses.
   ========================================================================== */

export const cellsOf = (v) =>
  Array.from({ length: v.len }, (_, i) => (v.horiz ? [v.r, v.c + i] : [v.r + i, v.c]));

/* Positions are the only thing that changes, so a state is just one number
   per vehicle — its column if horizontal, its row if not. */
export const stateOf = (vs) => vs.map((v) => (v.horiz ? v.c : v.r));

export function withState(vs, st) {
  return vs.map((v, i) => (v.horiz ? { ...v, c: st[i] } : { ...v, r: st[i] }));
}

export function occupancy(vs, size) {
  const grid = Array.from({ length: size }, () => Array(size).fill(-1));
  vs.forEach((v, i) => cellsOf(v).forEach(([r, c]) => { grid[r][c] = i; }));
  return grid;
}

/* Every legal slide from a position, as { car, delta } with delta in squares
   (negative = left or up). A vehicle can never pass through another, so each
   direction stops at the first blocked square. */
export function movesFrom(vs, size) {
  const grid = occupancy(vs, size);
  const out = [];
  vs.forEach((v, i) => {
    for (const dir of [-1, 1]) {
      for (let k = 1; k < size; k++) {
        const d = dir * k;
        // Only the leading square is newly entered; check that one.
        const [lr, lc] = v.horiz
          ? [v.r, dir > 0 ? v.c + v.len - 1 + d : v.c + d]
          : [dir > 0 ? v.r + v.len - 1 + d : v.r + d, v.c];
        if (lr < 0 || lc < 0 || lr >= size || lc >= size) break;
        if (grid[lr][lc] !== -1 && grid[lr][lc] !== i) break;
        out.push({ car: i, delta: d });
      }
    }
  });
  return out;
}

export function applyMove(vs, m) {
  return vs.map((v, i) => {
    if (i !== m.car) return v;
    return v.horiz ? { ...v, c: v.c + m.delta } : { ...v, r: v.r + m.delta };
  });
}

/* The target escapes the moment nothing stands between its nose and the wall. */
export function isSolved(vs, size) {
  const t = vs[0];
  const grid = occupancy(vs, size);
  for (let c = t.c + t.len; c < size; c++) if (grid[t.r][c] !== -1) return false;
  return true;
}

/* Shortest escape, by breadth-first search over every reachable arrangement.
   Returns { moves, path, explored }, or null if the lot is a true deadlock. */
export function solve(vehicles, size) {
  if (isSolved(vehicles, size)) return { moves: 0, path: [], explored: 1 };
  const start = stateOf(vehicles).join(",");
  const seen = new Map([[start, null]]);
  let frontier = [stateOf(vehicles)];
  let depth = 0;
  while (frontier.length && depth <= 60) {
    depth++;
    const next = [];
    for (const st of frontier) {
      const vs = withState(vehicles, st);
      for (const m of movesFrom(vs, size)) {
        const nvs = applyMove(vs, m);
        const key = stateOf(nvs).join(",");
        if (seen.has(key)) continue;
        seen.set(key, { from: st.join(","), m });
        if (isSolved(nvs, size)) {
          const path = [];
          for (let cur = key; seen.get(cur); cur = seen.get(cur).from) path.push(seen.get(cur).m);
          return { moves: depth, path: path.reverse(), explored: seen.size };
        }
        next.push(stateOf(nvs));
      }
    }
    frontier = next;
  }
  return null;
}
