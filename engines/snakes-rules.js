/* ============================================================================
   SNAKES — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/snakes.js draws the board; this file is the solver that
   proved the board has one answer and that re-proves it on mount.

   The familiar version of this puzzle hides ONE snake: a single-width path
   between two marked ends that never touches itself, not even at a corner,
   and the row and column counts tell you how many of its cells sit in each
   line. Once you know a cell is filled, you know whose it is, because there
   is only one candidate.

   This variant hides TWO snakes, and — the part that matters — the row and
   column counts are given for the **total**, never per snake. So a count of 4
   no longer says "four cells of the snake"; it says "four cells, split
   between two snakes in a way you have to work out". Deciding *whether* a
   square is filled and deciding *whose* it is stop being the same deduction.

   Two rules keep the bodies legible even though the clues never distinguish
   them:

       1. A snake never touches itself: no square sits edge-to-edge with
          another square of the same snake except its own neighbours along
          the snake. (Corners are exempt, and have to be — a snake that
          turns always puts two of its squares diagonally together, so
          banning diagonal self-contact would ban turning at all and every
          snake would be a straight line.)
       2. The two snakes never touch each other, not even at a corner.

   Rule 1 is the classic one and is what forbids tight U-turns. Rule 2 is what
   stops the pair merging into one ambiguous blob, and it is what makes the
   shared counts solvable: wherever two filled squares touch diagonally, you
   know instantly they belong to the SAME snake, and wherever a filled square
   has a filled orthogonal neighbour, they are consecutive. The counts tell
   you where the squares are; these two rules tell you whose they are.

   Cells are indexed r * cols + c throughout. A "snake" is an ordered array of
   cell indices, head first, tail last.
   ========================================================================== */

const D4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];
const D8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];

export const rc = (i, cols) => [Math.floor(i / cols), i % cols];

function stepper(rows, cols, dirs) {
  return (i) => {
    const r = Math.floor(i / cols), c = i % cols;
    const out = [];
    for (const [dr, dc] of dirs) {
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && cc >= 0 && rr < rows && cc < cols) out.push(rr * cols + cc);
    }
    return out;
  };
}

export const neighbours4 = (rows, cols) => stepper(rows, cols, D4);
export const neighbours8 = (rows, cols) => stepper(rows, cols, D8);

/* --------------------------------------------------------------------------
   Checking a finished position.
   `snakes` is an array of two ordered paths. Returns a list of complaints, so
   the engine can say what is wrong rather than just "no".
   ------------------------------------------------------------------------ */
export function faults(spec, snakes) {
  const { rows, cols, rowCounts, colCounts, ends } = spec;
  const n8 = neighbours8(rows, cols);
  const out = [];

  const owner = new Map();          // cell -> [snake index, position]
  for (let s = 0; s < snakes.length; s++) {
    for (let k = 0; k < snakes[s].length; k++) {
      const i = snakes[s][k];
      if (owner.has(i)) out.push({ kind: "overlap", i });
      owner.set(i, [s, k]);
    }
  }

  for (let s = 0; s < snakes.length; s++) {
    const path = snakes[s];
    if (!path.length) { out.push({ kind: "empty", s }); continue; }

    // Consecutive cells must actually be orthogonal neighbours.
    for (let k = 1; k < path.length; k++) {
      const [r0, c0] = rc(path[k - 1], cols), [r1, c1] = rc(path[k], cols);
      if (Math.abs(r0 - r1) + Math.abs(c0 - c1) !== 1) {
        out.push({ kind: "broken", s, k, i: path[k] });
      }
    }

    // The two marked ends are the two ends of this snake, either way round.
    const [h, t] = ends[s];
    const a = path[0], b = path[path.length - 1];
    if (!((a === h && b === t) || (a === t && b === h))) {
      out.push({ kind: "ends", s });
    }
  }

  /* Rule 1 is orthogonal only; rule 2 covers all eight directions. */
  const n4 = neighbours4(rows, cols);
  for (const [i, [s, k]] of owner) {
    for (const j of n4(i)) {
      const o = owner.get(j);
      if (!o) continue;
      const [s2, k2] = o;
      if (s2 !== s) continue;                       // handled by the rule-2 pass
      if (Math.abs(k2 - k) === 1) continue;         // its own neighbour, fine
      out.push({ kind: "self", i, j });
    }
    for (const j of n8(i)) {
      const o = owner.get(j);
      if (!o) continue;
      if (o[0] !== s) out.push({ kind: "touch", i, j });
    }
  }

  // Row and column totals, both snakes together.
  const rowGot = new Array(rows).fill(0), colGot = new Array(cols).fill(0);
  for (const i of owner.keys()) { rowGot[Math.floor(i / cols)]++; colGot[i % cols]++; }
  for (let r = 0; r < rows; r++) if (rowGot[r] !== rowCounts[r]) out.push({ kind: "row", r, want: rowCounts[r], got: rowGot[r] });
  for (let c = 0; c < cols; c++) if (colGot[c] !== colCounts[c]) out.push({ kind: "col", c, want: colCounts[c], got: colGot[c] });

  return out;
}

export const isSolved = (spec, snakes) => faults(spec, snakes).length === 0;

/* --------------------------------------------------------------------------
   Solver.

   Snake 0 is grown one cell at a time from its head; when it lands on its
   tail and is legal, snake 1 is grown the same way in what is left. The
   pruning that makes this tractable is the counts: a line that is already
   full is closed to both snakes, and a line that still needs more cells than
   it has room for is dead. Stops once `limit` solutions are in hand, so
   uniqueness costs a search for two.
   ------------------------------------------------------------------------ */
export function solve(spec, limit = 2) {
  const { rows, cols, rowCounts, colCounts, ends } = spec;
  const N = rows * cols;
  const n4 = neighbours4(rows, cols), n8 = neighbours8(rows, cols);
  const NB4 = Array.from({ length: N }, (_, i) => n4(i));
  const NB8 = Array.from({ length: N }, (_, i) => n8(i));

  const total = rowCounts.reduce((a, b) => a + b, 0);
  if (total !== colCounts.reduce((a, b) => a + b, 0)) return [];

  const fill = new Int8Array(N).fill(-1);      // -1 empty, else snake index
  const pos = new Int32Array(N).fill(-1);      // position along its snake
  const rowLeft = rowCounts.slice(), colLeft = colCounts.slice();
  const found = [];
  const paths = [[], []];

  /* May cell i be occupied by snake s at position k, given what is placed?

     `exempt` is the snake's own tail. All four marked ends sit on the board
     from the start so that they block the other snake and count towards the
     line totals, but that means a snake's own tail would otherwise veto the
     very cell that has to arrive next to it. The tail's neighbourhood is
     checked properly on arrival instead — see the `j === tail` branch below,
     which rejects any path that ran alongside the tail on the way past. */
  function placeable(i, s, k, exempt) {
    if (fill[i] !== -1) return false;
    const r = Math.floor(i / cols), c = i % cols;
    if (rowLeft[r] === 0 || colLeft[c] === 0) return false;
    for (const j of NB8[i]) {                 // rule 2: no contact at all
      if (fill[j] !== -1 && fill[j] !== s) return false;
    }
    for (const j of NB4[i]) {                 // rule 1: edges only
      if (j === exempt) continue;
      if (fill[j] === s && pos[j] !== k - 1) return false;
    }
    return true;
  }

  /* The tail is pre-placed, so arriving at it needs the same two checks. */
  function tailOk(tail, s, k) {
    for (const j of NB8[tail]) {
      if (fill[j] !== -1 && fill[j] !== s) return false;
    }
    for (const j of NB4[tail]) {
      if (fill[j] === s && pos[j] !== k - 1 && j !== tail) return false;
    }
    return true;
  }

  function put(i, s, k) {
    fill[i] = s; pos[i] = k;
    rowLeft[Math.floor(i / cols)]--; colLeft[i % cols]--;
    paths[s].push(i);
  }
  function take(i, s) {
    fill[i] = -1; pos[i] = -1;
    rowLeft[Math.floor(i / cols)]++; colLeft[i % cols]++;
    paths[s].pop();
  }

  /* Cheap global sanity: every line still needing cells must have somewhere
     to put them, and no line may be over-subscribed. */
  function linesAlive() {
    for (let r = 0; r < rows; r++) {
      if (rowLeft[r] < 0) return false;
      if (rowLeft[r] > 0) {
        let room = 0;
        for (let c = 0; c < cols; c++) if (fill[r * cols + c] === -1 && colLeft[c] > 0) room++;
        if (room < rowLeft[r]) return false;
      }
    }
    for (let c = 0; c < cols; c++) {
      if (colLeft[c] < 0) return false;
      if (colLeft[c] > 0) {
        let room = 0;
        for (let r = 0; r < rows; r++) if (fill[r * cols + c] === -1 && rowLeft[r] > 0) room++;
        if (room < colLeft[c]) return false;
      }
    }
    return true;
  }

  /* The tail must stay reachable through empty cells, or this branch is dead.
     A plain flood is enough — it only has to catch the hopeless cases. */
  function tailReachable(from, tail) {
    if (from === tail) return true;
    const seen = new Uint8Array(N);
    const stack = [from];
    seen[from] = 1;
    while (stack.length) {
      const i = stack.pop();
      for (const j of NB4[i]) {
        if (seen[j]) continue;
        if (j !== tail && fill[j] !== -1) continue;
        seen[j] = 1;
        if (j === tail) return true;
        stack.push(j);
      }
    }
    return false;
  }

  function growB(cur, tail) {
    if (found.length >= limit) return;
    if (cur === tail) {
      if (rowLeft.every((v) => v === 0) && colLeft.every((v) => v === 0)) {
        found.push([paths[0].slice(), paths[1].slice()]);
      }
      return;
    }
    if (!linesAlive() || !tailReachable(cur, tail)) return;
    const k = paths[1].length;
    for (const j of NB4[cur]) {
      if (j === tail) {
        // Landing on the tail: it is pre-placed, so check it the same way.
        if (tailOk(tail, 1, k)) {
          pos[tail] = k; paths[1].push(tail);
          growB(tail, tail);
          paths[1].pop(); pos[tail] = -1;
        }
        continue;
      }
      if (!placeable(j, 1, k, tail)) continue;
      put(j, 1, k);
      growB(j, tail);
      take(j, 1);
      if (found.length >= limit) return;
    }
  }

  function startB() {
    const [h, t] = ends[1];
    // Both ends of snake 1 are already on the board as fixed cells, but the
    // head still has to be the first entry of the path — its line totals were
    // charged up front, so leaving it out would let a short snake look legal.
    pos[h] = 0;
    paths[1].push(h);
    growB(h, t);
    paths[1].pop();
    pos[h] = -1;
  }

  function growA(cur, tail) {
    if (found.length >= limit) return;
    if (cur === tail) { startB(); return; }
    if (!linesAlive() || !tailReachable(cur, tail)) return;
    const k = paths[0].length;
    for (const j of NB4[cur]) {
      if (j === tail) {
        if (tailOk(tail, 0, k)) {
          pos[tail] = k; paths[0].push(tail);
          growA(tail, tail);
          paths[0].pop(); pos[tail] = -1;
        }
        continue;
      }
      if (!placeable(j, 0, k, tail)) continue;
      put(j, 0, k);
      growA(j, tail);
      take(j, 0);
      if (found.length >= limit) return;
    }
  }

  /* The four marked ends are on the board from the start — they are clues, so
     the counts must already allow for them. */
  const fixed = [ends[0][0], ends[0][1], ends[1][0], ends[1][1]];
  if (new Set(fixed).size !== 4) return [];
  for (let s = 0; s < 2; s++) {
    for (const i of ends[s]) {
      fill[i] = s;
      rowLeft[Math.floor(i / cols)]--; colLeft[i % cols]--;
    }
  }
  if (rowLeft.some((v) => v < 0) || colLeft.some((v) => v < 0)) return [];

  pos[ends[0][0]] = 0;
  paths[0].push(ends[0][0]);
  growA(ends[0][0], ends[0][1]);

  return found;
}
