/* ============================================================================
   DISPATCH — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/dispatch.js draws the warehouse; this file computes par by
   breadth-first search over every reachable state, and is the same code the
   authoring tool ran.

   The variant: a crate that reaches a mark is SIGNED FOR. It stops being a
   crate and becomes part of the building — it can never be pushed again, and
   the square it stands on is a wall from that moment on.

   In ordinary Sokoban a crate on a goal is still furniture. You park one
   there, use it, shove it off, come back to it; the order you fill the marks
   in barely matters because nothing is ever final until the last push. Here
   every delivery permanently reshapes the room, so the ORDER is the puzzle
   and it is the player's to choose. Fill the near mark first and you may have
   just built a wall across the only corridor to the far one.

   It also turns the marks themselves into hazards. You cannot push a crate
   *through* a mark to somewhere better — the moment it lands there it is
   signed for and stuck — so routes that would be obvious in the ordinary game
   have to detour around the very squares you are aiming at.

   A state is (worker, movable crate squares, sealed squares).
   Par is counted in steps, because steps are what the player spends.
   ========================================================================== */

export const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export const parseRoom = (rows) => rows.map((line) => line.split(""));

export const isWall = (room, r, c) =>
  r < 0 || c < 0 || r >= room.length || c >= room[r].length || room[r][c] === "#";

/* Walls, plus every mark already signed for. */
export const blocked = (room, cell, sealed, cols) =>
  isWall(room, Math.floor(cell / cols), cell % cols) || sealed.has(cell);

const sortNums = (s) => [...s].sort((a, b) => a - b).join(",");
const key = (w, crates, sealed) => `${w}|${sortNums(crates)}|${sortNums(sealed)}`;

/* One step. Returns the new state, or null if the move is illegal. A push that
   lands a crate on any unfilled mark signs it off there and then: the crate
   leaves the movable set and its square joins the walls. */
export function step(room, w, crates, sealed, goals, dir, cols) {
  const [dr, dc] = DIRS[dir];
  const r = Math.floor(w / cols) + dr, c = (w % cols) + dc;
  const target = r * cols + c;
  if (isWall(room, r, c)) return null;
  if (blocked(room, target, sealed, cols)) return null;          // sealed square
  if (!crates.has(target)) return { worker: target, crates, sealed };

  const br = r + dr, bc = c + dc;
  if (isWall(room, br, bc)) return null;
  const beyond = br * cols + bc;
  if (crates.has(beyond)) return null;
  if (blocked(room, beyond, sealed, cols)) return null;

  const next = new Set(crates);
  next.delete(target);
  if (goals.includes(beyond)) {
    const sealedNext = new Set(sealed);
    sealedNext.add(beyond);
    return { worker: target, crates: next, sealed: sealedNext, pushed: true, signing: true };
  }
  next.add(beyond);
  return { worker: target, crates: next, sealed, pushed: true };
}

export const allSigned = (sealed, goals) => sealed.size >= goals.length;

/* Shortest run in steps, by breadth-first search over the whole reachable
   space. Returns { steps, pushes, path, explored } or null if the numbered
   marks cannot be served in order at all. */
export function solve(room, worker, crateList, goals, cols, cap = 2000000) {
  const start = new Set(crateList);
  const noneSealed = new Set();
  if (allSigned(noneSealed, goals)) return { steps: 0, pushes: 0, path: [] };

  const seen = new Map([[key(worker, start, noneSealed), null]]);
  let frontier = [{ worker, crates: start, sealed: noneSealed }];
  let depth = 0;

  while (frontier.length && seen.size < cap) {
    depth++;
    const next = [];
    for (const st of frontier) {
      for (let dir = 0; dir < 4; dir++) {
        const nx = step(room, st.worker, st.crates, st.sealed, goals, dir, cols);
        if (!nx) continue;
        const k = key(nx.worker, nx.crates, nx.sealed);
        if (seen.has(k)) continue;
        seen.set(k, { from: key(st.worker, st.crates, st.sealed), dir });
        if (allSigned(nx.sealed, goals)) {
          const path = [];
          for (let cur = k; seen.get(cur); cur = seen.get(cur).from) path.push(seen.get(cur).dir);
          path.reverse();
          let w2 = worker, cr = new Set(start), sl = new Set(), pushes = 0;
          for (const d of path) {
            const s2 = step(room, w2, cr, sl, goals, d, cols);
            w2 = s2.worker; cr = s2.crates; sl = s2.sealed;
            if (s2.pushed) pushes++;
          }
          return { steps: depth, pushes, path, explored: seen.size };
        }
        next.push(nx);
      }
    }
    frontier = next;
  }
  return null;
}

/* Is this state already lost? Two ways, and the second is the variant's own.
     - a crate wedged in a corner, where the corner may now be made of sealed
       marks as much as of walls;
     - fewer crates left than marks left to fill, which cannot happen in the
       ordinary game at all.
   Deliberately incomplete, as in the ordinary version: it reports a room that
   is provably dead, never one that a delivery has merely made much harder.
   Telling you which order has ruined the room would be telling you the
   answer. */
export function deadlocked(room, crates, sealed, goals, cols) {
  if (crates.size < goals.length - sealed.size) return true;
  for (const cell of crates) {
    const r = Math.floor(cell / cols), c = cell % cols;
    const wall = (rr, cc) =>
      isWall(room, rr, cc) || sealed.has(rr * cols + cc);
    if ((wall(r - 1, c) || wall(r + 1, c)) && (wall(r, c - 1) || wall(r, c + 1))) return true;
  }
  return false;
}
