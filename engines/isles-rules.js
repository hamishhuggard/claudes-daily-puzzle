/* ============================================================================
   ISLES — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/isles.js draws the map; this file is the solver that proved
   the board has one answer and that re-proves it on mount.

   The original: every numbered square belongs to an island of exactly that
   many squares, islands never touch edge-to-edge, the water is all one piece,
   and — the shape rule — the water contains no 2x2 block. Land is free to be
   any shape at all, so a 4 is usually just a fat square and the puzzle is
   about where islands sit, not what they look like.

   This variant applies the shape rule to BOTH kinds of square:

       no 2x2 block anywhere on the map is all the same kind

   So the 2x2 ban stops being a fact about water and becomes a fact about the
   map. Islands can no longer be blobs — every island of four or more has to
   snake — and that cuts the number of shapes an island can take enormously
   while also fixing where its neighbours can be. The original's fat 4 becomes
   an L or an S or a line, and knowing which one is now a deduction rather
   than an afterthought.

   It also runs the constraint in a direction the original never does. In
   ordinary Nurikabe the shape rule only ever tells you where water CAN'T be,
   so it is used to force land. Here the same rule pushes back on land too, so
   a number that has plenty of room can still be pinned down by the shape it is
   forced into.

   Cells are indexed r * cols + c. `clues` maps a cell index to its island size.
   ========================================================================== */

const D4 = [[-1, 0], [1, 0], [0, -1], [0, 1]];

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

export function connected(cells, rows, cols) {
  if (cells.size <= 1) return true;
  const nb = neighbours(rows, cols);
  const start = cells.values().next().value;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    for (const j of nb(stack.pop())) {
      if (cells.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size === cells.size;
}

/* Any 2x2 block whose four squares are all the same kind. `land` is a
   predicate over cell indices. */
export function squareBlocks(rows, cols, land) {
  const bad = [];
  for (let r = 0; r + 1 < rows; r++) {
    for (let c = 0; c + 1 < cols; c++) {
      const q = [r * cols + c, r * cols + c + 1, (r + 1) * cols + c, (r + 1) * cols + c + 1];
      const kinds = q.map(land);
      if (kinds.every(Boolean) || kinds.every((v) => !v)) bad.push(q);
    }
  }
  return bad;
}

/* What is wrong with a map. `landSet` is a Set of land cell indices. */
export function faults(spec, landSet) {
  const { rows, cols, clues } = spec;
  const N = rows * cols;
  const nb = neighbours(rows, cols);
  const out = [];

  // Islands: the connected pieces of land.
  const seen = new Set();
  const islands = [];
  for (const i of landSet) {
    if (seen.has(i)) continue;
    const piece = new Set([i]);
    const stack = [i];
    seen.add(i);
    while (stack.length) {
      for (const j of nb(stack.pop())) {
        if (landSet.has(j) && !seen.has(j)) { seen.add(j); piece.add(j); stack.push(j); }
      }
    }
    islands.push(piece);
  }

  for (const piece of islands) {
    const numbers = [...piece].filter((i) => i in clues);
    if (numbers.length === 0) out.push({ kind: "unclued", cells: [...piece] });
    else if (numbers.length > 1) out.push({ kind: "twoclues", cells: numbers });
    else if (clues[numbers[0]] !== piece.size) {
      out.push({ kind: "size", clue: numbers[0], want: clues[numbers[0]], got: piece.size });
    }
  }

  /* A numbered square is part of its island by definition, so it can never be
     water. Without this the checker happily accepts a map that simply ignores
     a clue, which is how the first brute-force cross-check "found" solutions
     the solver was right to reject. */
  for (const c of Object.keys(clues).map(Number)) {
    if (!landSet.has(c)) out.push({ kind: "cluewater", i: c });
  }

  const water = new Set();
  for (let i = 0; i < N; i++) if (!landSet.has(i)) water.add(i);
  if (!connected(water, rows, cols)) out.push({ kind: "water" });

  for (const q of squareBlocks(rows, cols, (i) => landSet.has(i))) {
    out.push({ kind: "block", cells: q, land: landSet.has(q[0]) });
  }
  return out;
}

export const isSolved = (spec, landSet) => faults(spec, landSet).length === 0;

/* --------------------------------------------------------------------------
   Solver.

   Islands are placed largest first. For each clue we enumerate the connected
   sets of exactly its size that contain it, avoid every other clue, avoid
   squares already used, never sit edge-to-edge with an island already placed,
   and contain no 2x2 of their own. Then the leftover squares are water and the
   water rules are checked.
   ------------------------------------------------------------------------ */
export function solve(spec, limit = 2) {
  const { rows, cols, clues } = spec;
  const N = rows * cols;
  const nb = neighbours(rows, cols);
  const NB = Array.from({ length: N }, (_, i) => nb(i));

  const clueCells = Object.keys(clues).map(Number);
  const isClue = new Uint8Array(N);
  for (const c of clueCells) isClue[c] = 1;

  const total = clueCells.reduce((a, c) => a + clues[c], 0);
  if (total >= N) return [];

  const land = new Uint8Array(N);        // 1 = land already placed
  const found = [];

  /* Would adding these cells make a 2x2 of land? */
  function makesLandBlock(cells) {
    const test = (i) => land[i] === 1 || cells.has(i);
    for (const i of cells) {
      const r = Math.floor(i / cols), c = i % cols;
      for (const [dr, dc] of [[0, 0], [-1, 0], [0, -1], [-1, -1]]) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr + 1 >= rows || cc + 1 >= cols) continue;
        const q = [rr * cols + cc, rr * cols + cc + 1, (rr + 1) * cols + cc, (rr + 1) * cols + cc + 1];
        if (q.every(test)) return true;
      }
    }
    return false;
  }

  /* Connected sets of exactly `size` containing `seed`, canonically enumerated
     so each shape appears once. */
  function shapes(seed, size) {
    const out = [];
    const chosen = [seed];
    const inSet = new Set([seed]);
    const banned = new Uint8Array(N);

    const allowed = (j) => {
      if (land[j] || inSet.has(j) || banned[j]) return false;
      if (isClue[j] && j !== seed) return false;
      // never edge-to-edge with an island already on the map
      for (const k of NB[j]) if (land[k]) return false;
      return true;
    };

    (function rec() {
      if (out.length > 30000) return;
      if (chosen.length === size) {
        if (!makesLandBlock(inSet)) out.push(new Set(inSet));
        return;
      }
      const frontier = [];
      for (const c of chosen) {
        for (const j of NB[c]) if (allowed(j) && !frontier.includes(j)) frontier.push(j);
      }
      for (const j of frontier) {
        inSet.add(j); chosen.push(j);
        rec();
        chosen.pop(); inSet.delete(j);
        banned[j] = 1;
      }
      for (const j of frontier) banned[j] = 0;
    })();

    return out;
  }

  const order = clueCells.slice().sort((a, b) => clues[b] - clues[a]);

  (function place(k) {
    if (found.length >= limit) return;
    if (k === order.length) {
      const landSet = new Set();
      for (let i = 0; i < N; i++) if (land[i]) landSet.add(i);
      if (isSolved(spec, landSet)) found.push(landSet);
      return;
    }
    const seed = order[k];
    for (const shape of shapes(seed, clues[seed])) {
      for (const c of shape) land[c] = 1;
      place(k + 1);
      for (const c of shape) land[c] = 0;
      if (found.length >= limit) return;
    }
  })(0);

  return found;
}
