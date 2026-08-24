/* ============================================================================
   SWEEP — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/sweep.js draws the field; this file is the deduction engine
   the authoring tool used to prove that the board can be finished by reasoning
   alone — that at no point is the player asked to guess.

   That guarantee is the entire reason this mechanic is here. A normal
   minesweeper board will cheerfully hand you a 50/50 at move forty and call it
   your fault. A board that has been checked against `fullySolvable` below
   never does: from the opening, there is always at least one square whose
   status is *forced*, right through to the last mine.

   Everything here is sound and not necessarily complete — it only ever claims
   a square is forced when it provably is. Being incomplete costs generation
   yield; being unsound would cost the promise, so the search never guesses on
   the player's behalf.
   ========================================================================== */

export const UNKNOWN = 0, SAFE = 1, MINE = 2;

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

/* How many mines touch this square, on the true board. */
export function countAt(mines, r, c, h, w) {
  return neighbours(r, c, h, w).filter(([a, b]) => mines.has(`${a},${b}`)).length;
}

/* A knowledge state is a flat array of UNKNOWN/SAFE/MINE, one per square.
   SAFE means "revealed, and its number is visible"; MINE means "known to be
   a mine". UNKNOWN is everything still in play. */

/* The constraints a state implies: for each revealed square, its number minus
   the mines already known around it, over the unknown squares around it. */
function constraintsOf(state, numbers, h, w) {
  const out = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const i = r * w + c;
      if (state[i] !== SAFE) continue;
      const cells = [], nbs = neighbours(r, c, h, w);
      let known = 0;
      for (const [a, b] of nbs) {
        const j = a * w + b;
        if (state[j] === MINE) known++;
        else if (state[j] === UNKNOWN) cells.push(j);
      }
      if (cells.length) out.push({ cells, need: numbers[i] - known });
    }
  }
  return out;
}

/* Split the constraints into independent groups, so enumeration stays cheap:
   two constraints interact only if they share an unknown square. */
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

/* Every consistent mine/safe assignment for one component, summarised: which
   squares were a mine every time, which never, and the range of totals. */
function summarise(group, cap = 300000) {
  const idx = new Map(group.cells.map((cell, i) => [cell, i]));
  const n = group.cells.length;
  const cons = group.cons.map((k) => ({ need: k.need, cells: k.cells.map((cell) => idx.get(cell)) }));
  // Which constraints finish at each position, so they can be checked as soon
  // as they are fully assigned rather than only at the end.
  const lastOf = cons.map((k) => Math.max(...k.cells));
  const closing = Array.from({ length: n }, () => []);
  cons.forEach((k, i) => closing[lastOf[i]].push(i));

  const assign = new Array(n).fill(0);
  const alwaysMine = new Array(n).fill(true);
  const neverMine = new Array(n).fill(true);
  const totals = new Set();
  let count = 0, blown = false;

  function rec(i, used) {
    if (blown) return;
    if (++count > cap) { blown = true; return; }
    if (i === n) {
      for (let k = 0; k < n; k++) {
        if (assign[k]) neverMine[k] = false; else alwaysMine[k] = false;
      }
      totals.add(used);
      return;
    }
    for (const v of [0, 1]) {
      assign[i] = v;
      let ok = true;
      for (const ci of closing[i]) {
        const k = cons[ci];
        let s = 0;
        for (const cell of k.cells) s += assign[cell];
        if (s !== k.need) { ok = false; break; }
      }
      // cheap prune: no constraint can already be over its need
      if (ok) {
        for (const k of cons) {
          let s = 0, open = 0;
          for (const cell of k.cells) {
            if (cell <= i) s += assign[cell]; else open++;
          }
          if (s > k.need || s + open < k.need) { ok = false; break; }
        }
      }
      if (ok) rec(i + 1, used + v);
      assign[i] = 0;
    }
  }
  rec(0, 0);
  if (blown) return null;
  return { cells: group.cells, alwaysMine, neverMine, totals: [...totals] };
}

/* Every square whose status is forced by the current state, as
   { safe: [...indices], mine: [...indices] }. Sound: a square appears here
   only if every consistent completion agrees about it. */
export function forced(state, numbers, h, w, totalMines) {
  const cons = constraintsOf(state, numbers, h, w);
  const groups = components(cons);
  const safe = new Set(), mine = new Set();

  const sums = [];
  let skipped = false;
  for (const g of groups) {
    const s = summarise(g);
    if (!s) { skipped = true; continue; }   // too big to enumerate: claim nothing
    sums.push(s);
    s.cells.forEach((cell, i) => {
      if (s.alwaysMine[i]) mine.add(cell);
      else if (s.neverMine[i]) safe.add(cell);
    });
  }

  // The global count. Squares touching nothing revealed ("outside") are only
  // ever decidable by arithmetic on the total: if the frontier must already
  // account for every mine, everything outside is safe; if the outside must
  // absorb all the mines it can hold, it is all mines.
  const known = state.filter((s) => s === MINE).length;
  const frontier = new Set(sums.flatMap((s) => s.cells));
  const outside = [];
  for (let i = 0; i < state.length; i++) {
    if (state[i] === UNKNOWN && !frontier.has(i)) outside.push(i);
  }
  // Only safe to reason about the total if every group was actually
  // enumerated — a group we gave up on could hold any number of mines.
  if (!skipped) {
    const minFrontier = sums.reduce((a, s) => a + Math.min(...s.totals), 0);
    const maxFrontier = sums.reduce((a, s) => a + Math.max(...s.totals), 0);
    const remaining = totalMines - known;
    if (minFrontier === remaining) outside.forEach((i) => safe.add(i));
    if (outside.length && maxFrontier + outside.length === remaining) {
      outside.forEach((i) => mine.add(i));
    }
  }

  return { safe: [...safe].filter((i) => !mine.has(i)), mine: [...mine] };
}

/* Play the board out using nothing but forced moves. Returns true only if that
   is enough to finish it — which is the promise the puzzle makes. */
export function fullySolvable(mines, opening, h, w) {
  const numbers = new Array(h * w).fill(0);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) numbers[r * w + c] = countAt(mines, r, c, h, w);
  }
  const state = new Array(h * w).fill(UNKNOWN);
  // The opening is revealed for free — including, as in every version of this
  // game, the whole blank region it opens up.
  const flood = (r, c) => {
    const i = r * w + c;
    if (state[i] !== UNKNOWN) return;
    if (mines.has(`${r},${c}`)) return;
    state[i] = SAFE;
    if (numbers[i] === 0) neighbours(r, c, h, w).forEach(([a, b]) => flood(a, b));
  };
  opening.forEach(([r, c]) => flood(r, c));

  for (let step = 0; step < h * w * 2; step++) {
    const total = mines.size;
    // Finished means every square that isn't a mine has been revealed; the
    // mines themselves don't have to be individually flagged.
    const unknownSafe = [];
    for (let r = 0; r < h; r++) {
      for (let c = 0; c < w; c++) {
        const i = r * w + c;
        if (state[i] === UNKNOWN && !mines.has(`${r},${c}`)) unknownSafe.push([r, c]);
      }
    }
    if (!unknownSafe.length) return { solved: true, numbers, state };

    const f = forced(state, numbers, h, w, total);
    if (!f.safe.length && !f.mine.length) return { solved: false, numbers, state };
    f.mine.forEach((i) => { state[i] = MINE; });
    f.safe.forEach((i) => { flood(Math.floor(i / w), i % w); });
  }
  return { solved: false, numbers, state };
}
