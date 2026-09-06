/* ============================================================================
   PARCELS — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/parcels.js draws the field; this file is the solver that
   proved the board has one answer and that re-proves it on mount.

   The familiar region-carving puzzle asks you to cut a grid into regions where
   each region's size matches the number written in it, and two regions of the
   SAME size may not share an edge. Sizes repeat constantly — a board is mostly
   3s and 4s — so the reasoning is local: look at a number, look at its
   neighbours, decide where the border goes.

   This variant allows each size exactly once on the whole board. On a 6x6 that
   is not a decoration, it is forced arithmetic: 1+2+3+4+5+6+7+8 = 36, exactly
   the number of squares, so the moment you accept "all different" the board
   must be eight regions of sizes 1,2,3,4,5,6,7 and 8 — one of each, no
   choice about it. Every clue is therefore global. Finding the 7 tells you
   something about where the 8 can go, because there is only one of each and
   they have to add up.

   That is the whole strategic difference: the original is solved region by
   region, this one is solved by budget. A shape that would be perfectly legal
   on its own is refused because it would leave the rest of the grid unable to
   pay for the sizes still outstanding.

   Clues are given squares carrying their own region's size, and because each
   size is used exactly once, two squares showing the same number are
   necessarily in the SAME region — a deduction the original cannot even
   express, since there it only means "not adjacent". Every size has at least
   one given, so no region is a complete unknown.

   A board is `rows` x `cols` with a `givens` map from cell index to the size
   of the region that square belongs to. Cells are indexed r * cols + c.
   ========================================================================== */

export const D4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

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

/* The sizes a board of this many squares must use, given they are all
   different and every square is covered: 1..k for the k that fits exactly.
   Returns null when no such run exists, which is how the generator refuses a
   grid whose area is not triangular. */
export function forcedSizes(area) {
  let sum = 0;
  for (let k = 1; ; k++) {
    sum += k;
    if (sum === area) return Array.from({ length: k }, (_, i) => i + 1);
    if (sum > area) return null;
  }
}

/* What is wrong with a proposed carving. `owner` is an array over cells giving
   a representative cell of the region each square belongs to, or -1. */
export function faults(spec, owner) {
  const { rows, cols, givens } = spec;
  const N = rows * cols;
  const nb = neighbours(rows, cols);
  const out = [];

  const groups = new Map();          // representative -> [cells]
  for (let i = 0; i < N; i++) {
    if (owner[i] === -1) { out.push({ kind: "unassigned", i }); continue; }
    if (!groups.has(owner[i])) groups.set(owner[i], []);
    groups.get(owner[i]).push(i);
  }

  /* Sizes must be all different and cover the forced run exactly. */
  const sizes = [...groups.values()].map((g) => g.length).sort((a, b) => a - b);
  const want = forcedSizes(N) || [];
  if (sizes.length !== want.length || sizes.some((v, k) => v !== want[k])) {
    out.push({ kind: "sizes", got: sizes, want });
  }

  for (const [rep, cells] of groups) {
    // Connected?
    const set = new Set(cells);
    const seen = new Set([rep]);
    const stack = [rep];
    while (stack.length) {
      for (const j of nb(stack.pop())) {
        if (set.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
      }
    }
    if (seen.size !== cells.length) out.push({ kind: "split", rep });

    // Every given inside it must agree with its size.
    for (const c of cells) {
      if (c in givens && givens[c] !== cells.length) {
        out.push({ kind: "clue", i: c, want: givens[c], got: cells.length });
      }
    }
  }
  return out;
}

export const isSolved = (spec, owner) => faults(spec, owner).length === 0;

/* --------------------------------------------------------------------------
   Solver.

   Regions are placed largest first, because the big ones have the fewest legal
   shapes once the board starts filling up. For each size we enumerate the
   connected sets of free squares that contain every given carrying that
   number and no given carrying a different one.

   The prune that makes it quick is the budget: after each placement, every
   connected pocket of free squares must be exactly payable by the sizes still
   living in it. A pocket of 5 squares holding only the 3 is dead, and so is a
   pocket of 5 holding the 2 and the 8. This is the same reasoning the variant
   asks the player to do, which is a good sign it is the real mechanic and not
   an artefact of the search order.
   ------------------------------------------------------------------------ */
export function solve(spec, limit = 2) {
  const { rows, cols, givens } = spec;
  const N = rows * cols;
  const nb = neighbours(rows, cols);
  const NB = Array.from({ length: N }, (_, i) => nb(i));

  const sizes = forcedSizes(N);
  if (!sizes) return [];

  /* Every size needs at least one given, or the region carrying it could sit
     anywhere and the search would have nothing to hang itself on. Boards are
     generated to guarantee this. */
  const required = new Map(sizes.map((s) => [s, []]));
  for (const [cell, size] of Object.entries(givens)) {
    if (!required.has(size)) return [];
    required.get(size).push(Number(cell));
  }
  if (sizes.some((s) => required.get(s).length === 0)) return [];

  const owner = new Int32Array(N).fill(-1);
  const found = [];

  /* Every free pocket must be exactly payable by the sizes still living in
     it. A size lives wherever its givens are, and all givens of one size end
     up in one region, hence in one pocket. */
  function budgetOk(placed) {
    const seen = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      if (owner[i] !== -1 || seen[i]) continue;
      let size = 0;
      const vals = new Set();
      const stack = [i]; seen[i] = 1;
      while (stack.length) {
        const c = stack.pop();
        size++;
        if (c in givens && !placed.has(givens[c])) vals.add(givens[c]);
        for (const j of NB[c]) {
          if (owner[j] === -1 && !seen[j]) { seen[j] = 1; stack.push(j); }
        }
      }
      let owed = 0;
      for (const v of vals) owed += v;
      if (size !== owed) return false;
    }
    return true;
  }

  /* Connected sets of exactly `size` free squares containing every cell in
     `must` and no given belonging to a different size. */
  function shapes(must, size) {
    const out = [];
    const start = must[0];
    const chosen = [start];
    const inSet = new Uint8Array(N); inSet[start] = 1;
    const banned = new Uint8Array(N);

    const allowed = (j) => {
      if (owner[j] !== -1 || inSet[j] || banned[j]) return false;
      if (j in givens && givens[j] !== size) return false;
      return true;
    };

    (function rec() {
      if (out.length > 20000) return;                 // runaway guard
      if (chosen.length === size) {
        if (must.every((m) => inSet[m])) out.push(chosen.slice());
        return;
      }
      const frontier = [];
      for (const c of chosen) {
        for (const j of NB[c]) if (allowed(j) && !frontier.includes(j)) frontier.push(j);
      }
      for (const j of frontier) {
        inSet[j] = 1; chosen.push(j);
        rec();
        chosen.pop(); inSet[j] = 0;
        banned[j] = 1;                                // canonical: never revisit
      }
      for (const j of frontier) banned[j] = 0;
    })();

    return out;
  }

  // Largest first: the big regions are the ones with the fewest legal shapes.
  const order = sizes.slice().sort((a, b) => b - a);

  (function place(k, placed) {
    if (found.length >= limit) return;
    if (k === order.length) {
      if (owner.every((v) => v !== -1)) found.push(Int32Array.from(owner));
      return;
    }
    const size = order[k];
    const must = required.get(size);
    for (const shape of shapes(must, size)) {
      const rep = shape[0];
      for (const c of shape) owner[c] = rep;
      const next = new Set(placed); next.add(size);
      if (budgetOk(next)) place(k + 1, next);
      for (const c of shape) owner[c] = -1;
      if (found.length >= limit) return;
    }
  })(0, new Set());

  return found;
}
