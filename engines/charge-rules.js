/* ============================================================================
   CHARGE — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/charge.js draws the field; this file is the deduction engine
   the authoring tool used to prove the board can be finished by reasoning
   alone, and to prove the variant actually bites.

   The variant: a mine is either light or heavy, and a number is the total
   CHARGE of the mines around it — a heavy mine adds two. You are told how many
   mines there are and how many of those are heavy.

   Everything a minesweeper player knows is built on the number being a count,
   and both of the reflexes go:

     "this 3 has exactly three unknowns left, so they are all mines" — no. It
     could be one heavy and one light, with the third square clean.
     "this 1 already touches a flagged mine, so the rest are safe" — only once
     you know that mine is light, which is itself a deduction, and one that
     travels: a 1 next to a mine proves the mine light, and that fact then
     unlocks a clue three squares away that never saw the 1.

   So the solver is not a count solver with a tweak. Each cell carries a value
   in {0, 1, 2} and every clue is a weighted sum, which makes the whole thing a
   small integer program rather than a subset-counting exercise. As in the
   count version, the search is sound and not complete: it only ever claims a
   square is forced when every consistent completion agrees, and gives up
   rather than guess on the player's behalf.
   ========================================================================== */

export const UNKNOWN = 0, SAFE = 1, MINE = 2;   // MINE = known mine, weight open

export const neighbours = (r, c, h, w) => {
  const out = [];
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (!dr && !dc) continue;
      const nr = r + dr, nc = c + dc;
      if (nr >= 0 && nc >= 0 && nr < h && nc < w) out.push([nr, nc]);
    }
  }
  return out;
};

/* The board as weights: 0 clean, 1 light mine, 2 heavy. */
export function weightsOf(mines, heavy, h, w) {
  const v = new Array(h * w).fill(0);
  for (const k of mines) {
    const [r, c] = k.split(",").map(Number);
    v[r * w + c] = heavy.has(k) ? 2 : 1;
  }
  return v;
}

/* Total charge around each square. */
export function chargesOf(weights, h, w) {
  const out = new Array(h * w).fill(0);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      out[r * w + c] = neighbours(r, c, h, w)
        .reduce((a, [x, y]) => a + weights[x * w + y], 0);
    }
  }
  return out;
}

/* Per-cell domains implied by the state. A deduced mine keeps an open weight —
   knowing a square is deadly is not the same as knowing how deadly. */
function domainOf(s) {
  return s === MINE ? [1, 2] : [0, 1, 2];
}

function constraintsOf(state, charges, h, w) {
  const out = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (state[i] !== SAFE) continue;
      const cells = [];
      for (const [a, b] of neighbours(r, c, h, w)) {
        const j = a * w + b;
        if (state[j] !== SAFE) cells.push(j);   // unknowns AND known mines
      }
      if (cells.length) out.push({ cells, need: charges[i] });
    }
  }
  return out;
}

function components(cons) {
  const parent = cons.map((_, i) => i);
  const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
  const owner = new Map();
  cons.forEach((k, i) => k.cells.forEach((cell) => {
    if (owner.has(cell)) parent[find(i)] = find(owner.get(cell));
    else owner.set(cell, i);
  }));
  const groups = new Map();
  cons.forEach((k, i) => {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, { cons: [], cells: new Set() });
    const g = groups.get(root);
    g.cons.push(k);
    k.cells.forEach((cell) => g.cells.add(cell));
  });
  return [...groups.values()].map((g) => ({ cons: g.cons, cells: [...g.cells] }));
}

/* Every consistent weighting of one component, filed by the (mines, heavies)
   it uses — because the global counts are what decide between them. For each
   such pair we keep which cells were a mine in every solution with that pair,
   and which were never one. */
function summarise(group, state, cap = 400000) {
  const idx = new Map(group.cells.map((cell, i) => [cell, i]));
  const n = group.cells.length;
  const doms = group.cells.map((cell) => domainOf(state[cell]));
  const cons = group.cons.map((k) => ({
    need: k.need, cells: k.cells.map((cell) => idx.get(cell)),
  }));
  const lastOf = cons.map((k) => Math.max(...k.cells));
  const closing = Array.from({ length: n }, () => []);
  cons.forEach((k, i) => closing[lastOf[i]].push(i));
  // Largest charge each constraint can still collect from its open cells.
  const maxOf = doms.map((d) => Math.max(...d));

  const assign = new Array(n).fill(0);
  const byPair = new Map();          // "m,hv" -> { always: bool[], never: bool[] }
  let count = 0, blown = false;

  function rec(i, mines, heavies) {
    if (blown) return;
    if (++count > cap) { blown = true; return; }
    if (i === n) {
      const key = `${mines},${heavies}`;
      let rec2 = byPair.get(key);
      if (!rec2) {
        rec2 = { always: new Array(n).fill(true), never: new Array(n).fill(true) };
        byPair.set(key, rec2);
      }
      for (let k = 0; k < n; k++) {
        if (assign[k]) rec2.never[k] = false; else rec2.always[k] = false;
      }
      return;
    }
    for (const v of doms[i]) {
      assign[i] = v;
      let ok = true;
      for (const ci of closing[i]) {
        const k = cons[ci];
        let s = 0;
        for (const cell of k.cells) s += assign[cell];
        if (s !== k.need) { ok = false; break; }
      }
      if (ok) {
        for (const k of cons) {
          let s = 0, open = 0;
          for (const cell of k.cells) {
            if (cell <= i) s += assign[cell]; else open += maxOf[cell];
          }
          if (s > k.need || s + open < k.need) { ok = false; break; }
        }
      }
      if (ok) rec(i + 1, mines + (v > 0 ? 1 : 0), heavies + (v === 2 ? 1 : 0));
      assign[i] = 0;
    }
  }
  rec(0, 0, 0);
  if (blown || !byPair.size) return null;
  return { cells: group.cells, byPair };
}

/* Which (mines, heavies) totals can a run of `n` untouched squares hold? */
function outsidePairs(n, maxMines, maxHeavies) {
  const out = [];
  for (let m = 0; m <= Math.min(n, maxMines); m++) {
    for (let hv = 0; hv <= Math.min(m, maxHeavies); hv++) out.push([m, hv]);
  }
  return out;
}

/* Every square whose status is forced by the current state. Sound: a square is
   listed only if every completion consistent with the clues AND with the two
   global counts agrees about it. */
export function forced(state, charges, h, w, totalMines, totalHeavy) {
  const groups = components(constraintsOf(state, charges, h, w));
  const sums = [];
  let skipped = false;
  for (const g of groups) {
    const s = summarise(g, state);
    if (!s) { skipped = true; continue; }
    sums.push(s);
  }

  const safe = new Set(), mine = new Set();

  // Whatever the global counts turn out to be, a cell that is a mine in every
  // solution of its own component is a mine. This much needs no arithmetic.
  for (const s of sums) {
    const pairs = [...s.byPair.values()];
    s.cells.forEach((cell, i) => {
      if (pairs.every((p) => p.always[i])) mine.add(cell);
      else if (pairs.every((p) => p.never[i])) safe.add(cell);
    });
  }

  if (skipped) return { safe: [...safe].filter((i) => !mine.has(i)), mine: [...mine] };

  // Now the global counts. Known mines outside every component still spend
  // from the budget, and their weight is still open.
  const frontier = new Set(sums.flatMap((s) => s.cells));
  const loose = [], outside = [];
  for (let i = 0; i < state.length; i++) {
    if (frontier.has(i) || state[i] === SAFE) continue;
    (state[i] === MINE ? loose : outside).push(i);
  }

  // Combine components, the loose known mines and the untouched region, and
  // keep only the per-component pairs that survive in some global total.
  const keep = sums.map(() => new Set());
  let outsideCanHoldMines = false, outsideCanBeEmpty = false, anyGlobal = false;
  const looseN = loose.length;
  const walk = (gi, m, hv, chosen) => {
    if (gi === sums.length) {
      // loose mines: each is a mine, weight open
      for (let lh = 0; lh <= looseN; lh++) {
        const m2 = m + looseN, hv2 = hv + lh;
        if (m2 > totalMines || hv2 > totalHeavy) continue;
        for (const [om, oh] of outsidePairs(outside.length,
          totalMines - m2, totalHeavy - hv2)) {
          if (m2 + om !== totalMines || hv2 + oh !== totalHeavy) continue;
          anyGlobal = true;
          chosen.forEach((key, i) => keep[i].add(key));
          if (om > 0) outsideCanHoldMines = true; else outsideCanBeEmpty = true;
        }
      }
      return;
    }
    for (const key of sums[gi].byPair.keys()) {
      const [gm, gh] = key.split(",").map(Number);
      if (m + gm > totalMines || hv + gh > totalHeavy) continue;
      chosen.push(key);
      walk(gi + 1, m + gm, hv + gh, chosen);
      chosen.pop();
    }
  };
  walk(0, 0, 0, []);
  if (!anyGlobal) return { safe: [...safe].filter((i) => !mine.has(i)), mine: [...mine] };

  sums.forEach((s, gi) => {
    const pairs = [...keep[gi]].map((k) => s.byPair.get(k));
    if (!pairs.length) return;
    s.cells.forEach((cell, i) => {
      if (pairs.every((p) => p.always[i])) mine.add(cell);
      else if (pairs.every((p) => p.never[i])) safe.add(cell);
    });
  });
  if (outside.length && !outsideCanHoldMines) outside.forEach((i) => safe.add(i));

  return { safe: [...safe].filter((i) => !mine.has(i)), mine: [...mine] };
}

/* Play the board out using nothing but forced moves. True only if that is
   enough to finish it — the promise the puzzle makes. */
export function fullySolvable(mines, heavy, opening, h, w) {
  const weights = weightsOf(mines, heavy, h, w);
  const charges = chargesOf(weights, h, w);
  const state = new Array(h * w).fill(UNKNOWN);

  const flood = (r, c) => {
    const i = r * w + c;
    if (state[i] !== UNKNOWN) return;
    if (weights[i]) return;
    state[i] = SAFE;
    if (charges[i] === 0) neighbours(r, c, h, w).forEach(([a, b]) => flood(a, b));
  };
  opening.forEach(([r, c]) => flood(r, c));

  const trace = [];
  for (let step = 0; step < h * w * 2; step++) {
    let left = 0;
    for (let i = 0; i < state.length; i++) {
      if (state[i] !== SAFE && !weights[i]) left++;
    }
    if (!left) return { solved: true, charges, weights, state, trace };

    const f = forced(state, charges, h, w, mines.size, heavy.size);
    if (!f.safe.length && !f.mine.length) return { solved: false, charges, weights, state, trace };
    trace.push({ safe: f.safe.length, mine: f.mine.length });
    f.mine.forEach((i) => { state[i] = MINE; });
    f.safe.forEach((i) => flood(Math.floor(i / w), i % w));
  }
  return { solved: false, charges, weights, state, trace };
}
