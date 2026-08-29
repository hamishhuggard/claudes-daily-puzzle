/* ============================================================================
   FENCES (Slitherlink) — rules core
   ----------------------------------------------------------------------------
   No DOM in here. engines/fences.js draws the board; this same module is what
   the authoring script used to prove each grid has exactly one solution, and
   what the engine uses at mount to check a drawn loop.

   This variant asks for a fixed NUMBER of separate closed loops, not one, and
   that single change is the whole puzzle. In ordinary Slitherlink the strongest
   habit is "never close a loop early" — any closure that doesn't use every clue
   is wrong. Here two closures are required, so that habit inverts: closing is
   the goal, and the work is deciding which cells belong to which loop.

   The trick that makes it tractable: never search over edges. A set of disjoint
   closed loops on a grid is exactly a two-colouring of the cells — inside some
   loop, or outside — where the outside stays connected around the border (no
   loop may sit inside another) and the inside splits into exactly as many
   connected components as there are loops. The loops are then just the seams
   between the colours, and a clue counts how many of a cell's four neighbours
   are the opposite colour. So the search space is 2^cells with heavy pruning,
   not the astronomically larger space of edge subsets, and "is there exactly
   one solution" becomes a plain exhaustive count.
   ========================================================================== */

/* clues: rows x cols array, integer 0..3 or null. labels: same shape, 1 =
   inside the loop, 0 = outside. */

export function neighbours(r, c, rows, cols) {
  const out = [];
  if (r > 0) out.push([r - 1, c]);
  if (r < rows - 1) out.push([r + 1, c]);
  if (c > 0) out.push([r, c - 1]);
  if (c < cols - 1) out.push([r, c + 1]);
  return out;
}

/* A cell's clue = how many of its four sides are loop segments = how many of
   its four neighbours have the opposite label. Off-grid neighbours count as
   outside. */
export function clueOf(labels, r, c) {
  const rows = labels.length, cols = labels[0].length;
  const me = labels[r][c];
  let n = 0;
  for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    const rr = r + dr, cc = c + dc;
    const them = (rr < 0 || cc < 0 || rr >= rows || cc >= cols) ? 0 : labels[rr][cc];
    if (them !== me) n++;
  }
  return n;
}

export function allClues(labels) {
  return labels.map((row, r) => row.map((_, c) => clueOf(labels, r, c)));
}

function connected(labels, want) {
  const rows = labels.length, cols = labels[0].length;
  const cells = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (labels[r][c] === want) cells.push([r, c]);
  if (!cells.length) return false;
  const seen = new Set([cells[0][0] * cols + cells[0][1]]);
  const stack = [cells[0]];
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [rr, cc] of neighbours(r, c, rows, cols)) {
      const k = rr * cols + cc;
      if (labels[rr][cc] === want && !seen.has(k)) { seen.add(k); stack.push([rr, cc]); }
    }
  }
  return seen.size === cells.length;
}

/* Outside must be connected *through the border*, so treat everything beyond
   the grid as one extra outside cell. A ring of outside cells around a hole
   would otherwise pass a naive connectivity test and give two loops. */
function outsideConnectedViaBorder(labels) {
  const rows = labels.length, cols = labels[0].length;
  const seen = new Set();
  const stack = [];
  for (let r = 0; r < rows; r++) for (const c of [0, cols - 1]) {
    if (labels[r][c] === 0 && !seen.has(r * cols + c)) { seen.add(r * cols + c); stack.push([r, c]); }
  }
  for (let c = 0; c < cols; c++) for (const r of [0, rows - 1]) {
    if (labels[r][c] === 0 && !seen.has(r * cols + c)) { seen.add(r * cols + c); stack.push([r, c]); }
  }
  while (stack.length) {
    const [r, c] = stack.pop();
    for (const [rr, cc] of neighbours(r, c, rows, cols)) {
      const k = rr * cols + cc;
      if (labels[rr][cc] === 0 && !seen.has(k)) { seen.add(k); stack.push([rr, cc]); }
    }
  }
  let total = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (labels[r][c] === 0) total++;
  return seen.size === total;
}

/* How many separate loops does this colouring describe? Returns null when the
   colouring isn't a legal set of loops at all: the outside must stay connected
   around the border (otherwise a loop is nested inside another), and two inside
   components must never touch diagonally, which would put four segments on one
   dot and leave the drawing ambiguous. */
export function loopCount(labels) {
  const rows = labels.length, cols = labels[0].length;
  if (!outsideConnectedViaBorder(labels)) return null;

  const comp = Array.from({ length: rows }, () => new Array(cols).fill(-1));
  let n = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (labels[r][c] !== 1 || comp[r][c] !== -1) continue;
    const stack = [[r, c]];
    comp[r][c] = n;
    while (stack.length) {
      const [rr, cc] = stack.pop();
      for (const [nr, nc] of neighbours(rr, cc, rows, cols)) {
        if (labels[nr][nc] === 1 && comp[nr][nc] === -1) { comp[nr][nc] = n; stack.push([nr, nc]); }
      }
    }
    n++;
  }
  for (let r = 0; r + 1 < rows; r++) for (let c = 0; c + 1 < cols; c++) {
    for (const [[ar, ac], [br, bc]] of [[[r, c], [r + 1, c + 1]], [[r, c + 1], [r + 1, c]]]) {
      if (labels[ar][ac] === 1 && labels[br][bc] === 1 && comp[ar][ac] !== comp[br][bc]) return null;
    }
  }
  return n;
}

export function matchesClues(labels, clues) {
  const rows = labels.length, cols = labels[0].length;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (clues[r][c] != null && clueOf(labels, r, c) !== clues[r][c]) return false;
  }
  return true;
}

/* Exhaustive count, stopping at `limit` solutions. Cells are assigned in
   row-major order; a clue is checked the moment all four of its neighbours
   are decided, which happens a full row before the search would otherwise
   notice, and that is what keeps this fast enough to run in the browser. */
export function countSolutions(clues, wantLoops = 1, limit = 2) {
  const rows = clues.length, cols = clues[0].length;
  const labels = Array.from({ length: rows }, () => new Array(cols).fill(0));
  const N = rows * cols;
  let found = 0;
  const solutions = [];

  const decided = (r, c, idx) => r * cols + c < idx;

  function checkable(r, c, idx) {
    if (clues[r][c] == null) return false;
    if (!decided(r, c, idx)) return false;
    for (const [rr, cc] of neighbours(r, c, rows, cols)) if (!decided(rr, cc, idx)) return false;
    return true;
  }

  function go(i) {
    if (found >= limit) return;
    if (i === N) {
      if (loopCount(labels) === wantLoops) {
        found++;
        solutions.push(labels.map((r) => r.slice()));
      }
      return;
    }
    const r = Math.floor(i / cols), c = i % cols;
    for (const v of [0, 1]) {
      labels[r][c] = v;
      // Every clue whose neighbourhood just became fully decided must hold.
      let ok = true;
      for (const [rr, cc] of [[r, c], [r - 1, c], [r, c - 1], [r + 1, c], [r, c + 1]]) {
        if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
        if (checkable(rr, cc, i + 1) && clueOf(labels, rr, cc) !== clues[rr][cc]) { ok = false; break; }
      }
      if (ok) go(i + 1);
      if (found >= limit) return;
    }
    labels[r][c] = 0;
  }

  go(0);
  return { count: found, solutions };
}

/* The loop itself, as the set of segments between differently-labelled cells.
   h[r][c] is the horizontal segment above cell (r,c) — r runs 0..rows.
   v[r][c] is the vertical segment left of cell (r,c) — c runs 0..cols. */
export function loopEdges(labels) {
  const rows = labels.length, cols = labels[0].length;
  const at = (r, c) => (r < 0 || c < 0 || r >= rows || c >= cols) ? 0 : labels[r][c];
  const h = Array.from({ length: rows + 1 }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (at(r - 1, c) !== at(r, c) ? 1 : 0)));
  const v = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols + 1 }, (_, c) => (at(r, c - 1) !== at(r, c) ? 1 : 0)));
  return { h, v };
}

/* How many closed loops has the player drawn? Every dot must have degree 0 or
   2 — anything else is a dangling end or a crossing and returns null. Otherwise
   each connected component is a loop, and the caller checks the count. */
export function drawnLoopCount(h, v, rows, cols) {
  const deg = Array.from({ length: (rows + 1) * (cols + 1) }, () => 0);
  const dot = (r, c) => r * (cols + 1) + c;
  const edges = [];
  for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) {
    if (h[r][c]) { deg[dot(r, c)]++; deg[dot(r, c + 1)]++; edges.push([dot(r, c), dot(r, c + 1)]); }
  }
  for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
    if (v[r][c]) { deg[dot(r, c)]++; deg[dot(r + 1, c)]++; edges.push([dot(r, c), dot(r + 1, c)]); }
  }
  if (!edges.length) return 0;
  if (deg.some((d) => d !== 0 && d !== 2)) return null; // a dangling end or a crossing

  const adj = new Map();
  for (const [a, b] of edges) {
    if (!adj.has(a)) adj.set(a, []);
    if (!adj.has(b)) adj.set(b, []);
    adj.get(a).push(b);
    adj.get(b).push(a);
  }
  // Every dot has degree 0 or 2, so each connected component is itself a loop.
  const seen = new Set();
  let loops = 0;
  for (const start of adj.keys()) {
    if (seen.has(start)) continue;
    loops++;
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      for (const nb of adj.get(stack.pop())) if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
    }
  }
  return loops;
}

/* Clue satisfaction read straight off the drawn segments, independent of any
   stored solution — so a player who finds a different loop that happens to
   satisfy everything would still be graded correct (there isn't one; every
   shipped grid is checked unique). */
export function drawnClueCounts(h, v, rows, cols) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => h[r][c] + h[r + 1][c] + v[r][c] + v[r][c + 1]));
}
