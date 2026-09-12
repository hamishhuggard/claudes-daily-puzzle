/* ============================================================================
   TWO ACROSS, THREE DOWN — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/heyawake.js draws the grid; this file is the solver that
   proved the board has one shading and re-proves it on mount.

   The original (Heyawake): a grid cut into bold-bordered rooms, some rooms
   printed with a number. Shade cells so no two shaded cells touch edge to
   edge, every unshaded cell is one connected region, and each numbered room
   holds exactly that many shaded cells. The rule that actually drives play
   is the one with no number attached to it at all: a straight, unbroken run
   of unshaded cells may not pass through more than two rooms — cross a
   second room border in a line and a shaded cell has to sit somewhere in
   that stretch to break it. That "line rule" is what stops the puzzle from
   being pure room arithmetic; it forces shading even through rooms that
   carry no clue of their own.

   TWO ACROSS, THREE DOWN gives that line rule a different budget in each
   direction. A HORIZONTAL run may still only cross ONE extra border beyond
   the original (span up to three rooms — two borders — before it needs a
   break). A VERTICAL run gets one more: it may span up to four rooms — three
   borders — before it needs a break. Same grid, same rooms, but a long
   unbroken row and a long unbroken column are no longer interchangeable
   facts. A horizontal stretch that looks safe because it only just crosses
   two borders can be exactly the stretch that has to be broken, while a
   vertical stretch crossing the same number of borders is still fine — so
   solving now has to track direction, not just distance, every time a run
   nears its limit.

   Cells are indexed [r][c]. `rooms` is an r x c array of room ids; a room id
   with no entry in `roomCounts` (or a null entry) carries no clue and is
   only ever a source of borders to break.
   ========================================================================== */

const H_LIMIT = 2; // horizontal run: at most 2 borders crossed unbroken (spans <=3 rooms)
const V_LIMIT = 3; // vertical run: at most 3 borders crossed unbroken (spans <=4 rooms)

export function makeSpec(rows, cols, rooms, roomCounts) {
  return { rows, cols, rooms, roomCounts };
}

function inBounds(r, c, rows, cols) { return r >= 0 && r < rows && c >= 0 && c < cols; }

/* Flood fill over the unshaded cells; true iff they form one component
   (or there are none/one). */
export function unshadedConnected(shaded, rows, cols) {
  let start = null, total = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!shaded[r][c]) { total++; if (!start) start = [r, c]; }
  }
  if (total <= 1) return true;
  const seen = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const stack = [start];
  seen[start[0]][start[1]] = true;
  let count = 1;
  const D4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [dr, dc] of D4) {
      const rr = r + dr, cc = c + dc;
      if (inBounds(rr, cc, rows, cols) && !shaded[rr][cc] && !seen[rr][cc]) {
        seen[rr][cc] = true; count++; stack.push([rr, cc]);
      }
    }
  }
  return count === total;
}

/* No two shaded cells orthogonally adjacent. */
export function noAdjacentShaded(shaded, rows, cols) {
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (!shaded[r][c]) continue;
    if (c + 1 < cols && shaded[r][c + 1]) return false;
    if (r + 1 < rows && shaded[r + 1][c]) return false;
  }
  return true;
}

/* Every numbered room holds exactly its printed count of shaded cells. */
export function roomCountsOk(shaded, rooms, rows, cols, roomCounts) {
  const have = {};
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (shaded[r][c]) { const g = rooms[r][c]; have[g] = (have[g] || 0) + 1; }
  }
  for (let g = 0; g < roomCounts.length; g++) {
    const want = roomCounts[g];
    if (want == null) continue;
    if ((have[g] || 0) !== want) return false;
  }
  return true;
}

/* The asymmetric line rule: scan every maximal run of unshaded cells in
   every row (horizontal) and every column (vertical); count how many room
   borders it crosses (a border crossing is any step within the run where
   the room id changes from the previous cell). Horizontal runs may cross at
   most H_LIMIT, vertical runs at most V_LIMIT. */
export function runsOk(shaded, rooms, rows, cols) {
  // horizontal
  for (let r = 0; r < rows; r++) {
    let crossings = 0, lastRoom = null, active = false;
    for (let c = 0; c < cols; c++) {
      if (shaded[r][c]) { active = false; crossings = 0; lastRoom = null; continue; }
      if (!active) { active = true; crossings = 0; lastRoom = rooms[r][c]; continue; }
      if (rooms[r][c] !== lastRoom) {
        crossings++;
        lastRoom = rooms[r][c];
        if (crossings > H_LIMIT) return false;
      }
    }
  }
  // vertical
  for (let c = 0; c < cols; c++) {
    let crossings = 0, lastRoom = null, active = false;
    for (let r = 0; r < rows; r++) {
      if (shaded[r][c]) { active = false; crossings = 0; lastRoom = null; continue; }
      if (!active) { active = true; crossings = 0; lastRoom = rooms[r][c]; continue; }
      if (rooms[r][c] !== lastRoom) {
        crossings++;
        lastRoom = rooms[r][c];
        if (crossings > V_LIMIT) return false;
      }
    }
  }
  return true;
}

/* Grading a finished grid from the player's shaded cells alone. */
export function check(spec, shadedCells) {
  const { rows, cols, rooms, roomCounts } = spec;
  const shaded = Array.from({ length: rows }, () => new Array(cols).fill(false));
  for (const [r, c] of shadedCells) shaded[r][c] = true;

  if (!noAdjacentShaded(shaded, rows, cols)) return { ok: false, why: "two shaded cells touch" };
  if (!roomCountsOk(shaded, rooms, rows, cols, roomCounts)) return { ok: false, why: "a numbered room is wrong" };
  if (!unshadedConnected(shaded, rows, cols)) return { ok: false, why: "the unshaded cells split into more than one region" };
  if (!runsOk(shaded, rooms, rows, cols)) return { ok: false, why: "an unbroken run crosses too many room borders" };
  return { ok: true };
}

/* Exhaustive row-major backtracking search with pruning on adjacency, room
   budgets and the run-length rule as cells are placed; connectivity is only
   checked once the grid is complete since it's a global property. Returns
   { count, solutions, exhausted } exactly as the other engines' solvers do —
   `exhausted: false` means the node budget ran out and `count` is only a
   lower bound. */
export function countSolutions(spec, limit = 2, nodeBudget = Infinity) {
  const { rows, cols, rooms, roomCounts } = spec;
  const shaded = Array.from({ length: rows }, () => new Array(cols).fill(false));
  const roomLeft = roomCounts.map((v) => (v == null ? Infinity : v));
  const solutions = [];
  let found = 0, nodes = 0, budgetHit = false;

  const rowRun = { active: false, crossings: 0, lastRoom: null };
  const colRun = Array.from({ length: cols }, () => ({ active: false, crossings: 0, lastRoom: null }));

  function go(r, c) {
    if (found >= limit || budgetHit) return;
    if (++nodes > nodeBudget) { budgetHit = true; return; }

    if (r === rows) {
      // full grid placed — check global constraints
      if (roomLeft.some((v) => v !== 0 && v !== Infinity)) return;
      if (!unshadedConnected(shaded, rows, cols)) return;
      found++;
      const cells = [];
      for (let rr = 0; rr < rows; rr++) for (let cc = 0; cc < cols; cc++) if (shaded[rr][cc]) cells.push([rr, cc]);
      solutions.push(cells);
      return;
    }
    const nr = c + 1 === cols ? r + 1 : r;
    const nc = c + 1 === cols ? 0 : c + 1;

    // snapshot the run state we're about to mutate
    const savedRow = { ...rowRun };
    const savedCol = { ...colRun[c] };

    // --- try shading this cell ---
    const g = rooms[r][c];
    const leftShaded = c > 0 && shaded[r][c - 1];
    const topShaded = r > 0 && shaded[r - 1][c];
    if (!leftShaded && !topShaded && roomLeft[g] > 0) {
      shaded[r][c] = true;
      const hadInf = roomLeft[g] === Infinity;
      if (!hadInf) roomLeft[g]--;
      rowRun.active = false; rowRun.crossings = 0; rowRun.lastRoom = null;
      colRun[c].active = false; colRun[c].crossings = 0; colRun[c].lastRoom = null;

      go(nr, nc);

      shaded[r][c] = false;
      if (!hadInf) roomLeft[g]++;
      Object.assign(rowRun, savedRow);
      Object.assign(colRun[c], savedCol);
      if (found >= limit || budgetHit) return;
    }

    // --- try leaving this cell unshaded ---
    let hCrossings = rowRun.crossings, hActive = true, hLast = rowRun.lastRoom;
    if (!rowRun.active) { hCrossings = 0; hLast = g; }
    else if (g !== rowRun.lastRoom) { hCrossings = rowRun.crossings + 1; hLast = g; }
    let vCrossings = colRun[c].crossings, vLast = colRun[c].lastRoom;
    if (!colRun[c].active) { vCrossings = 0; vLast = g; }
    else if (g !== colRun[c].lastRoom) { vCrossings = colRun[c].crossings + 1; vLast = g; }

    if (hCrossings <= H_LIMIT && vCrossings <= V_LIMIT) {
      rowRun.active = true; rowRun.crossings = hCrossings; rowRun.lastRoom = hLast;
      colRun[c].active = true; colRun[c].crossings = vCrossings; colRun[c].lastRoom = vLast;

      go(nr, nc);

      Object.assign(rowRun, savedRow);
      Object.assign(colRun[c], savedCol);
    }
  }

  go(0, 0);
  return { count: found, solutions, exhausted: !budgetHit };
}

/* Par: the true minimum number of shaded cells across the (unique) solution,
   found by actually solving rather than estimating — the room clues fix the
   shaded count exactly, so this doubles as a sanity check that the puzzle's
   solution is really unique before it ships. */
export function par(spec) {
  const res = countSolutions(spec, 1);
  if (res.count !== 1) throw new Error(`heyawake: par requires a unique solution, found ${res.count}`);
  return res.solutions[0].length;
}
