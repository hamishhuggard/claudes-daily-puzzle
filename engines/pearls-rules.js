/* ============================================================================
   PEARLS — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/pearls.js draws the water; this file decides what is legal
   and counts how many answers a grid has, so uniqueness is proved by search
   rather than assumed.

   The pearl rules are the familiar ones — a white pearl is run through in a
   straight line but has a turn immediately beside it, a black pearl is turned
   on but the path runs straight for two cells out of both of its ends. What
   is different here is the shape of the answer: not a closed loop, but an
   OPEN path between two fixed points.

   That one change removes the reflex every loop puzzle is built on. In a loop,
   every cell you touch has two edges, so "this cell has one edge and nowhere
   left to go" is an instant contradiction, and parity arguments — a line
   crossing any cut an even number of times — do most of the heavy lifting.
   With two loose ends the parity flips on the two cells that hold them, and
   the dead end stops being absurd: it is where the path is supposed to stop.
   So the deductions have to come from the pearls and from reachability
   instead, and the two anchors become the strongest clues on the board.
   ========================================================================== */

export const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const idx = (spec, r, c) => r * spec.cols + c;
export const pearlAt = (spec, r, c) => spec.pearls[`${r},${c}`] || null;

const dirOf = (a, b) => (a[0] === b[0] ? (b[1] > a[1] ? 3 : 2) : (b[0] > a[0] ? 1 : 0));

/* ---------------------------------------------------------------------------
   Is the pearl rule at path position j satisfied? `full` demands the whole
   rule; without it only the part that can be judged from cells already laid
   down is checked, which is what makes the search prune early.
   ------------------------------------------------------------------------ */
export function pearlOk(spec, path, j, full) {
  if (j <= 0 || j >= path.length - 1) return true;      // ends carry no pearl
  const p = path[j];
  const kind = pearlAt(spec, p[0], p[1]);
  if (!kind) return true;

  const dIn = dirOf(path[j - 1], p);
  const dOut = dirOf(p, path[j + 1]);
  const straight = dIn === dOut;

  if (kind === "W") {
    if (!straight) return false;
    if (!full) return true;
    // A turn has to happen in one of the two cells either side.
    const backTurn = j >= 2 && dirOf(path[j - 2], path[j - 1]) !== dIn;
    const fwdTurn = j + 2 < path.length && dirOf(path[j + 1], path[j + 2]) !== dOut;
    return backTurn || fwdTurn;
  }
  // Black: turn here, then two straight cells out of both ends.
  if (straight) return false;
  if (!full) return true;
  const backStraight = j >= 2 && dirOf(path[j - 2], path[j - 1]) === dIn;
  const fwdStraight = j + 2 < path.length && dirOf(path[j + 1], path[j + 2]) === dOut;
  return backStraight && fwdStraight;
}

/* Every pearl rule, plus "the path actually calls at every pearl". */
export function pathOk(spec, path) {
  for (let j = 0; j < path.length; j++) if (!pearlOk(spec, path, j, true)) return false;
  const on = new Set(path.map(([r, c]) => `${r},${c}`));
  for (const k of Object.keys(spec.pearls)) if (!on.has(k)) return false;
  return true;
}

/* ---------------------------------------------------------------------------
   Enumerate answers by extending a self-avoiding walk from the start anchor,
   stopping once `limit` have been found. Two prunes do the work: a pearl is
   judged the moment its context exists, and every pearl still unvisited has to
   remain reachable through cells the walk has not eaten.
   ------------------------------------------------------------------------ */
export function solve(spec, limit = 2, budget = Infinity) {
  const { rows, cols } = spec;
  const used = new Uint8Array(rows * cols);
  const path = [spec.start];
  used[idx(spec, ...spec.start)] = 1;
  const out = [];
  const pearlKeys = Object.keys(spec.pearls);
  let nodes = 0;
  out.exhausted = true;   // cleared if the node budget runs out first

  function reachableOk() {
    const head = path[path.length - 1];
    const want = pearlKeys.filter((k) => {
      const [r, c] = k.split(",").map(Number);
      return !used[idx(spec, r, c)];
    });
    const endFree = !used[idx(spec, ...spec.end)];
    if (!want.length && !endFree) return true;
    const seen = new Uint8Array(rows * cols);
    const stack = [head];
    seen[idx(spec, ...head)] = 1;
    let hits = 0;
    const need = new Set(want);
    while (stack.length) {
      const [r, c] = stack.pop();
      for (const [dr, dc] of DIRS) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        const i = idx(spec, nr, nc);
        if (seen[i] || used[i]) continue;
        seen[i] = 1;
        if (need.has(`${nr},${nc}`)) hits++;
        stack.push([nr, nc]);
      }
    }
    if (hits < need.size) return false;
    return !endFree || seen[idx(spec, ...spec.end)] === 1;
  }

  function step() {
    if (out.length >= limit || !out.exhausted) return;
    if (++nodes > budget) { out.exhausted = false; return; }
    const i = path.length - 1;
    const head = path[i];

    if (i >= 1 && !pearlOk(spec, path, i - 1, false)) return;
    if (i >= 2 && !pearlOk(spec, path, i - 2, true)) return;

    if (head[0] === spec.end[0] && head[1] === spec.end[1]) {
      if (pathOk(spec, path)) out.push(path.map((p) => [...p]));
      return;                       // the anchor is where the path stops
    }
    if (!reachableOk()) return;

    for (const [dr, dc] of DIRS) {
      const nr = head[0] + dr, nc = head[1] + dc;
      if (nr < 0 || nc < 0 || nr >= spec.rows || nc >= spec.cols) continue;
      const k = idx(spec, nr, nc);
      if (used[k]) continue;
      used[k] = 1; path.push([nr, nc]);
      step();
      path.pop(); used[k] = 0;
      if (out.length >= limit) return;
    }
  }

  step();
  return out;
}

/* ---------------------------------------------------------------------------
   The player's drawing, read straight off the segments rather than compared
   against a stored answer. h[r][c] is the edge between (r,c) and (r,c+1);
   v[r][c] the edge between (r,c) and (r+1,c). Returns the path when the
   drawing is a finished, legal answer.
   ------------------------------------------------------------------------ */
export function readDrawing(spec, h, v) {
  const { rows, cols } = spec;
  const deg = [], nb = [];
  for (let r = 0; r < rows; r++) {
    deg.push(new Array(cols).fill(0));
    nb.push(Array.from({ length: cols }, () => []));
  }
  const link = (r1, c1, r2, c2) => {
    deg[r1][c1]++; deg[r2][c2]++;
    nb[r1][c1].push([r2, c2]); nb[r2][c2].push([r1, c1]);
  };
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 1; c++) if (h[r][c] === 1) link(r, c, r, c + 1);
  for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) if (v[r][c] === 1) link(r, c, r + 1, c);

  let drawn = 0;
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) drawn += deg[r][c];
  drawn /= 2;
  if (!drawn) return { state: "empty", deg };

  const isEnd = (r, c) => (r === spec.start[0] && c === spec.start[1]) || (r === spec.end[0] && c === spec.end[1]);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    if (deg[r][c] > 2) return { state: "bad", deg, msg: "The line crosses itself." };
    if (deg[r][c] === 1 && !isEnd(r, c)) return { state: "open", deg, msg: "That leaves a loose end away from an anchor." };
    if (isEnd(r, c) && deg[r][c] === 2) return { state: "bad", deg, msg: "The line has to stop at an anchor, not run through it." };
  }
  if (deg[spec.start[0]][spec.start[1]] !== 1 || deg[spec.end[0]][spec.end[1]] !== 1) {
    return { state: "open", deg, msg: "Both anchors need exactly one line leaving them." };
  }

  // Walk it from the start anchor; anything left over is a second component.
  const path = [spec.start];
  const seen = new Set([`${spec.start[0]},${spec.start[1]}`]);
  let cur = spec.start, prev = null;
  for (;;) {
    const nxt = nb[cur[0]][cur[1]].find((p) => !prev || p[0] !== prev[0] || p[1] !== prev[1]);
    if (!nxt) break;
    if (seen.has(`${nxt[0]},${nxt[1]}`)) return { state: "bad", deg, msg: "The line closes on itself." };
    seen.add(`${nxt[0]},${nxt[1]}`);
    path.push(nxt); prev = cur; cur = nxt;
    if (cur[0] === spec.end[0] && cur[1] === spec.end[1]) break;
  }
  if (path.length - 1 !== drawn) return { state: "open", deg, msg: "Some of that line isn't joined to the anchors." };

  const missed = Object.keys(spec.pearls).filter((k) => !seen.has(k));
  if (missed.length) return { state: "open", deg, path, msg: `The line misses ${missed.length} pearl${missed.length === 1 ? "" : "s"}.` };

  for (let j = 0; j < path.length; j++) {
    if (pearlOk(spec, path, j, true)) continue;
    const kind = pearlAt(spec, path[j][0], path[j][1]);
    return {
      state: "wrong", deg, path,
      msg: kind === "W"
        ? "A white pearl isn't being run straight through with a turn beside it."
        : "A black pearl isn't being turned on with two straight cells out of both ends.",
    };
  }
  return { state: "solved", deg, path };
}

/* Turn a path into the edge grids the engine draws and the hint compares to. */
export function pathEdges(spec, path) {
  const h = Array.from({ length: spec.rows }, () => new Array(spec.cols - 1).fill(0));
  const v = Array.from({ length: spec.rows - 1 }, () => new Array(spec.cols).fill(0));
  for (let i = 0; i + 1 < path.length; i++) {
    const [r1, c1] = path[i], [r2, c2] = path[i + 1];
    if (r1 === r2) h[r1][Math.min(c1, c2)] = 1;
    else v[Math.min(r1, r2)][c1] = 1;
  }
  return { h, v };
}
