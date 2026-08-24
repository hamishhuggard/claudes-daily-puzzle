/* ============================================================================
   CRATES — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/crates.js draws the warehouse; this file is the same code
   the authoring tool used to compute par, by breadth-first search over every
   reachable state of the room.

   A room is a grid of "#" (wall) and " " (floor). Crates sit on floor squares,
   some floor squares are marked as goals, and one worker walks the floor. The
   worker can step onto empty floor, or push a single crate one square ahead if
   the square beyond it is empty floor. Crates cannot be pulled. That last
   rule is what makes this a search problem rather than a shuffle: a crate
   pushed into a corner stays there, and the room is quietly ruined.

   A state is (worker square, sorted crate squares). Par is counted in steps,
   because steps are what the player actually spends.
   ========================================================================== */

export const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export const parseRoom = (rows) => rows.map((line) => line.split(""));

export const isWall = (room, r, c) =>
  r < 0 || c < 0 || r >= room.length || c >= room[r].length || room[r][c] === "#";

const key = (worker, crates) => `${worker}|${[...crates].sort((a, b) => a - b).join(",")}`;

/* One step. Returns the new state, or null if the worker would walk into a
   wall, into a crate with no room behind it, or into two crates at once. */
export function step(room, w, crates, dir, cols) {
  const [dr, dc] = DIRS[dir];
  const r = Math.floor(w / cols) + dr, c = (w % cols) + dc;
  if (isWall(room, r, c)) return null;
  const target = r * cols + c;
  if (!crates.has(target)) return { worker: target, crates };

  const br = r + dr, bc = c + dc;
  if (isWall(room, br, bc)) return null;
  const beyond = br * cols + bc;
  if (crates.has(beyond)) return null;

  const next = new Set(crates);
  next.delete(target);
  next.add(beyond);
  return { worker: target, crates: next, pushed: true };
}

export const solved = (crates, goals) => goals.every((g) => crates.has(g));

/* Shortest solution in steps, by breadth-first search. Returns
   { steps, pushes, path } where path is a list of direction indices, or null
   if the room cannot be solved at all. */
export function solve(room, worker, crateList, goals, cols, cap = 2000000) {
  const start = new Set(crateList);
  if (solved(start, goals)) return { steps: 0, pushes: 0, path: [] };

  const seen = new Map([[key(worker, start), null]]);
  let frontier = [{ worker, crates: start }];
  let depth = 0;

  while (frontier.length && seen.size < cap) {
    depth++;
    const next = [];
    for (const st of frontier) {
      for (let dir = 0; dir < 4; dir++) {
        const nx = step(room, st.worker, st.crates, dir, cols);
        if (!nx) continue;
        const k = key(nx.worker, nx.crates);
        if (seen.has(k)) continue;
        seen.set(k, { from: key(st.worker, st.crates), dir });
        if (solved(nx.crates, goals)) {
          const path = [];
          for (let cur = k; seen.get(cur); cur = seen.get(cur).from) path.push(seen.get(cur).dir);
          path.reverse();
          // Replay to count how many of those steps were pushes.
          let w2 = worker, cr = new Set(start), pushes = 0;
          for (const d of path) {
            const s2 = step(room, w2, cr, d, cols);
            w2 = s2.worker; cr = s2.crates;
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

/* Is this state already lost? A crate not on a goal, wedged into a corner of
   walls, can never move again. Used by the engine to tell the player their
   room is dead instead of letting them shuffle around a ruined warehouse. */
export function deadlocked(room, crates, goals, cols) {
  for (const cell of crates) {
    if (goals.includes(cell)) continue;
    const r = Math.floor(cell / cols), c = cell % cols;
    const up = isWall(room, r - 1, c), down = isWall(room, r + 1, c);
    const left = isWall(room, r, c - 1), right = isWall(room, r, c + 1);
    if ((up || down) && (left || right)) return true;
  }
  return false;
}
