/* ============================================================================
   PEGS — rules core
   ----------------------------------------------------------------------------
   Deliberately free of DOM: engines/pegs.js draws the triangular board, and
   this same module is used to prove a starting position can be solved down
   to one peg, and to find exactly where a given game stopped being able to.

   The board is the classic 15-hole triangle (5 rows), not the 33-hole English
   cross. Holes are numbered 0..14, row by row:

         0
        1  2
       3  4  5
      6  7  8  9
    10 11 12 13 14

   A state is a 15-bit integer, bit i set means hole i has a peg. A move jumps
   a peg over an adjacent peg into an empty hole two steps beyond it, along one
   of three axes (horizontal, and the board's two diagonals); the jumped peg
   is removed. This is a strict one-player DAG — every move removes exactly
   one peg, so there are no cycles and plain memoisation on the bitmask is
   enough to search it exhaustively.
   ========================================================================== */

export const HOLE_COUNT = 15;
export const ROWS = 5;

// row/col for each hole index, and the reverse lookup.
export const COORD = [];
export const IDX = new Map(); // "r,c" -> idx
{
  let i = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= r; c++) {
      COORD.push([r, c]);
      IDX.set(`${r},${c}`, i);
      i++;
    }
  }
}

// The three axes a jump can run along, each given as a +step and its
// opposite so every direction is covered.
const DIRS = [[0, 1], [0, -1], [1, 0], [-1, 0], [1, 1], [-1, -1]];

// For every hole, the jump {mid, to} reachable in each direction that stays
// on the board. Precomputed once — this is the whole "adjacency" of the game.
const JUMPS = COORD.map(([r, c]) => {
  const out = [];
  for (const [dr, dc] of DIRS) {
    const mr = r + dr, mc = c + dc;
    const tr = r + 2 * dr, tc = c + 2 * dc;
    const mid = IDX.get(`${mr},${mc}`);
    const to = IDX.get(`${tr},${tc}`);
    if (mid == null || to == null) continue;
    // A hole exists at (r,c) only while 0 <= c <= r; the map lookup above
    // already enforces that for mid/to, so nothing further to check.
    out.push({ mid, to });
  }
  return out;
});

export const popcount = (state) => {
  let n = 0;
  for (let s = state; s; s >>= 1) n += s & 1;
  return n;
};

export function fullState(emptyIdx) {
  let s = (1 << HOLE_COUNT) - 1;
  return s & ~(1 << emptyIdx);
}

export function hasPeg(state, idx) { return !!(state & (1 << idx)); }

/* All legal moves from `state`, as {from, mid, to}. */
export function legalMoves(state) {
  const out = [];
  for (let from = 0; from < HOLE_COUNT; from++) {
    if (!hasPeg(state, from)) continue;
    for (const { mid, to } of JUMPS[from]) {
      if (hasPeg(state, mid) && !hasPeg(state, to)) out.push({ from, mid, to });
    }
  }
  return out;
}

export function applyMove(state, mv) {
  return (state & ~(1 << mv.from) & ~(1 << mv.mid)) | (1 << mv.to);
}

/* Best (fewest-peg) outcome reachable from `state`, and the move that starts
   toward it. Memoised on the bitmask; the state space is a DAG of at most
   2^15 nodes so this terminates and is cheap. */
export function bestOutcome(state, memo = new Map()) {
  if (memo.has(state)) return memo.get(state);
  const moves = legalMoves(state);
  if (moves.length === 0) {
    const leaf = { pegs: popcount(state), move: null };
    memo.set(state, leaf);
    return leaf;
  }
  let best = null;
  for (const mv of moves) {
    const r = bestOutcome(applyMove(state, mv), memo);
    if (!best || r.pegs < best.pegs) best = { pegs: r.pegs, move: mv };
  }
  memo.set(state, best);
  return best;
}

/* Every distinct final peg-count reachable from `state` by any full playout
   — the "distribution of achievable end states" the notes can draw on. */
export function outcomeDistribution(state, memo = new Map()) {
  if (memo.has(state)) return memo.get(state);
  const moves = legalMoves(state);
  if (moves.length === 0) {
    const s = new Set([popcount(state)]);
    memo.set(state, s);
    return s;
  }
  const s = new Set();
  memo.set(state, s); // moves strictly shrink peg count, so no re-entrancy risk
  for (const mv of moves) {
    for (const p of outcomeDistribution(applyMove(state, mv), memo)) s.add(p);
  }
  return s;
}

export function canReachOne(state, memo) { return bestOutcome(state, memo).pegs === 1; }

/* Walk `bestOutcome` from `state` to build one full solution (a move list)
   down to its best achievable finish. */
export function solutionFrom(state, memo) {
  const moves = [];
  let s = state;
  while (true) {
    const { move } = bestOutcome(s, memo);
    if (!move) break;
    moves.push(move);
    s = applyMove(s, move);
  }
  return moves;
}
