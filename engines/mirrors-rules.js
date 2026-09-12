/* ============================================================================
   ANGLE OF INCIDENCE — rules core
   ----------------------------------------------------------------------------
   DOM-free. Used by engines/mirrors.js to grade, and by the authoring script
   to prove each board has exactly one valid mirror placement.

   The standard puzzle this borrows its skeleton from: a beam enters a grid at
   a labelled port travelling in a straight line, and the player drops
   diagonal mirrors ("/" and "\") on empty cells to bend it 90 degrees,
   trying to route it out through a target port. Ordinarily the mirror
   supply is a soft limit — you have "up to K" of each kind, and any legal
   route that uses no more than that is a win, so the puzzle is really just
   "find a path and cash in mirrors along the way."

   ANGLE OF INCIDENCE changes two things at once:
     - The mirror budget is EXACT, not a ceiling. You are handed precisely K
       "/" and precisely M "\" and must place every single one somewhere on
       the grid — an unused mirror is as illegal as running out early. That
       turns "route the beam" into "route the beam through a path that has
       room for exactly this many bends of exactly these two handednesses,"
       which is a much tighter combinatorial fit than "any legal route."
     - The finished path must cross itself exactly N times, where N is
       printed on the board. A crossing is defined rigorously below: it is
       counted whenever the beam enters the same grid CELL on two different
       traversals travelling along different axes (one horizontal pass, one
       vertical pass) — that is a true X through the middle of the cell, not
       the beam re-entering a cell it merely reflected in before, and not two
       straight passes over the same cell along the same axis (which would
       be an overlap, not a crossing, and is disallowed outright as a
       degenerate route).

   Together these two constraints are the actual bottleneck. Path length is
   irrelevant — a short route and a long one are equally valid — what makes
   a board hard is that almost every placement either strands a mirror
   unused, or produces the wrong number of self-crossings. The solver below
   is a brute search over every way to assign the fixed mirror multiset to
   empty cells (bounded by the grid's empty-cell count, which authoring
   keeps small), tracing the beam for each assignment and checking exact
   budget use, exact crossing count, and correct exit port.
   ========================================================================== */

// Directions as [dr, dc]. 0=up,1=right,2=down,3=left.
const DIRV = [[-1, 0], [0, 1], [1, 0], [0, -1]];

// How a mirror bends an incoming direction. "/" swaps: up<->right, down<->left.
// "\" swaps: up<->left, down<->right.
const BEND_SLASH = { 0: 1, 1: 0, 2: 3, 3: 2 };
const BEND_BACK = { 0: 3, 3: 0, 1: 2, 2: 1 };

/* spec: { rows, cols, grid, ports, entry, target, budget }
     grid    — rows x cols array of "." (empty, placeable) or "#" (blocked)
     ports   — map "name" -> { r, c, dir } where dir is the direction the
               beam travels when ENTERING the grid at that port (the port
               cell itself is the first grid cell the beam occupies)
     entry   — port name the beam starts at
     target  — port name the beam must exit through, travelling outward in
               that port's own listed dir (i.e. same direction it would enter
               with, since exiting there means passing off the grid the same way)
     budget  — { slash: K, back: M } exact mirror counts to place, no more no less */

export function makeSpec(rows, cols, grid, ports, entry, target, budget) {
  return { rows, cols, grid, ports, entry, target, budget };
}

function inBounds(spec, r, c) {
  return r >= 0 && r < spec.rows && c >= 0 && c < spec.cols;
}

/* Trace the beam given a mirror placement (Map "r,c" -> "/" or "\").
   Returns { ok, exitPort, crossings, cellsVisited, steps } or { ok:false, why }.
   Terminates on: exiting the grid (checked against ports), or a loop
   (revisiting the same (cell,direction) state), which is always illegal. */
export function trace(spec, placement) {
  const { rows, cols, grid, ports, entry } = spec;
  const start = ports[entry];
  // A port's direction points outward so it can identify a valid exit.
  // At the entry port the beam therefore travels in the opposite direction.
  let r = start.r, c = start.c, dir = (start.dir + 2) % 4;

  // visits: for crossing detection, record which AXIS (0=horizontal move,
  // 1=vertical move) has passed through each cell, and how many times.
  const axisAt = new Map(); // "r,c" -> Set of axes used while passing through
  const seenState = new Set();
  let crossings = 0;
  let steps = 0;
  const MAXSTEPS = rows * cols * 4 + 10;

  while (true) {
    if (!inBounds(spec, r, c)) {
      // stepped off the grid on the previous iteration's move; shouldn't get here
      return { ok: false, why: "left grid without a port" };
    }
    const key = `${r},${c},${dir}`;
    if (seenState.has(key)) return { ok: false, why: "infinite loop" };
    seenState.add(key);
    steps++;
    if (steps > MAXSTEPS) return { ok: false, why: "step budget exceeded" };

    // Determine axis of travel through this cell for THIS pass.
    const axis = (dir === 0 || dir === 2) ? 1 : 0; // 1=vertical, 0=horizontal
    const cellKey = `${r},${c}`;
    let axes = axisAt.get(cellKey);
    if (!axes) { axes = new Set(); axisAt.set(cellKey, axes); }
    if (axes.has(axis)) {
      // Same-axis re-traverse of a cell: overlap, not a crossing. Illegal route.
      return { ok: false, why: "beam overlaps its own path" };
    }
    if (axes.size >= 1) {
      // A different axis already passed through here: a true crossing.
      crossings++;
    }
    axes.add(axis);

    // Apply mirror if present, bending direction; else keep going straight.
    const m = placement.get(cellKey);
    let newDir = dir;
    if (m === "/") newDir = BEND_SLASH[dir];
    else if (m === "\\") newDir = BEND_BACK[dir];

    // Check if this cell is the target port and the (possibly bent) direction
    // matches the port's own outward direction — that's a clean exit.
    for (const [name, p] of Object.entries(ports)) {
      if (p.r === r && p.c === c) {
        if (newDir === p.dir) {
          // stepping one more cell in newDir must leave the grid (or reach
          // another in-grid cell — only a true edge port counts as exit)
          const [dr, dc] = DIRV[newDir];
          const nr = r + dr, nc = c + dc;
          if (!inBounds(spec, nr, nc)) {
            return { ok: true, exitPort: name, crossings, steps };
          }
        }
      }
    }

    const [dr, dc] = DIRV[newDir];
    const nr = r + dr, nc = c + dc;
    if (!inBounds(spec, nr, nc)) {
      // Left the grid without matching a listed port exactly: illegal.
      return { ok: false, why: "exited off-grid, not at a port" };
    }
    r = nr; c = nc; dir = newDir;
  }
}

/* All empty (".") cells eligible to hold a mirror. Port cells at the border
   are still "." in `grid` and ARE placeable, matching how the puzzle reads:
   a port cell can carry a mirror that redirects the beam immediately. */
export function emptyCells(spec) {
  const out = [];
  for (let r = 0; r < spec.rows; r++) for (let c = 0; c < spec.cols; c++) {
    if (spec.grid[r][c] === ".") out.push([r, c]);
  }
  return out;
}

/* Exhaustive search over every way to place the exact mirror multiset
   (budget.slash "/"s and budget.back "\"s) onto the empty cells, tracing
   each and keeping those that reach `target` with exactly `crossN`
   self-crossings. Capped at `limit` found solutions. */
export function countSolutions(spec, crossN, limit = 2, nodeBudget = Infinity) {
  const cells = emptyCells(spec);
  const { slash, back } = spec.budget;
  const total = slash + back;
  if (total > cells.length) return { count: 0, solutions: [], exhausted: true };

  const solutions = [];
  let found = 0, nodes = 0, budgetHit = false;
  const placement = new Map();

  // Choose `total` cells out of `cells` (combination), then assign which
  // `slash` of them are "/" and rest "\" (permutation over the chosen set).
  function assignAndTest(chosenCells) {
    if (found >= limit || budgetHit) return;
    const k = chosenCells.length;
    // iterate over all subsets of size `slash` within chosenCells for the "/" role
    const idx = [...Array(k).keys()];
    (function pickSlash(start, chosenIdx) {
      if (found >= limit || budgetHit) return;
      if (chosenIdx.length === slash) {
        if (++nodes > nodeBudget) { budgetHit = true; return; }
        placement.clear();
        const slashSet = new Set(chosenIdx);
        for (let i = 0; i < k; i++) {
          const [r, c] = chosenCells[i];
          placement.set(`${r},${c}`, slashSet.has(i) ? "/" : "\\");
        }
        const res = trace(spec, placement);
        if (res.ok && res.exitPort === spec.target && res.crossings === crossN) {
          found++;
          solutions.push(new Map(placement));
        }
        return;
      }
      for (let i = start; i < k; i++) {
        chosenIdx.push(i);
        pickSlash(i + 1, chosenIdx);
        chosenIdx.pop();
        if (found >= limit || budgetHit) return;
      }
    })(0, []);
  }

  (function pickCells(start, chosen) {
    if (found >= limit || budgetHit) return;
    if (chosen.length === total) { assignAndTest(chosen.slice()); return; }
    for (let i = start; i < cells.length; i++) {
      chosen.push(cells[i]);
      pickCells(i + 1, chosen);
      chosen.pop();
      if (found >= limit || budgetHit) return;
    }
  })(0, []);

  return { count: found, solutions, exhausted: !budgetHit };
}

/* Legality check of a finished player placement: map "r,c"->"/"|"\\" over
   the *entire* grid's empty cells (unset entries treated as no mirror). */
export function check(spec, placementObj, crossN) {
  const placement = new Map();
  let slashUsed = 0, backUsed = 0;
  for (const [k, v] of Object.entries(placementObj)) {
    if (v !== "/" && v !== "\\") continue;
    placement.set(k, v);
    if (v === "/") slashUsed++; else backUsed++;
  }
  if (slashUsed !== spec.budget.slash) {
    return { ok: false, why: `used ${slashUsed} of ${spec.budget.slash} "/" mirrors` };
  }
  if (backUsed !== spec.budget.back) {
    return { ok: false, why: `used ${backUsed} of ${spec.budget.back} "\\" mirrors` };
  }
  // every mirror on a valid empty cell
  for (const k of placement.keys()) {
    const [r, c] = k.split(",").map(Number);
    if (!inBounds(spec, r, c) || spec.grid[r][c] !== ".") {
      return { ok: false, why: "mirror placed on a blocked cell" };
    }
  }
  const res = trace(spec, placement);
  if (!res.ok) return { ok: false, why: res.why };
  if (res.exitPort !== spec.target) return { ok: false, why: "beam exits the wrong port" };
  if (res.crossings !== crossN) {
    return { ok: false, why: `beam crosses itself ${res.crossings} time${res.crossings === 1 ? "" : "s"}, needs exactly ${crossN}` };
  }
  return { ok: true, crossings: res.crossings };
}

export function par(spec, crossN) {
  const res = countSolutions(spec, crossN, 2);
  if (res.count !== 1 || !res.exhausted) throw new Error("mirrors: puzzle is not uniquely solved");
  return spec.budget.slash + spec.budget.back;
}
