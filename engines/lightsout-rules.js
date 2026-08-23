/* ============================================================================
   LIGHTS OUT — rules core
   ----------------------------------------------------------------------------
   Deliberately free of DOM: engines/lightsout.js drives the grid, and this
   same module is what the authoring script uses to prove a board is
   solvable at all, and to compute the true minimum number of taps (par) —
   never a guess based on how the board was built.

   Board and press-pattern are both 25-bit masks over a 5x5 grid, cell index
   r*5+c, bit i set = "on" (board) or "press this cell" (pattern). Pressing
   cell i toggles itself and its orthogonal neighbours — that whole toggle
   is EFFECT[i], a fixed mask independent of anything else. Because XOR is
   commutative and self-inverse, the order taps happen in, and whether a
   cell gets pressed twice, cannot affect the outcome: only the *set* of
   cells pressed an odd number of times matters. That's why this is solved
   as a system of linear equations over GF(2), not as a search over move
   sequences.
   ========================================================================== */

export const SIZE = 5;
export const N = SIZE * SIZE;

function effectMask(c) {
  const r = Math.floor(c / SIZE), col = c % SIZE;
  let m = 1 << c;
  if (r > 0) m |= 1 << (c - SIZE);
  if (r < SIZE - 1) m |= 1 << (c + SIZE);
  if (col > 0) m |= 1 << (c - 1);
  if (col < SIZE - 1) m |= 1 << (c + 1);
  return m;
}

// EFFECT[i] = mask of cells that flip when cell i is pressed. Symmetric:
// EFFECT is also, row for row, exactly the coefficient matrix of the
// "which presses affect light c" system, since the neighbour relation is
// symmetric and every cell affects itself.
export const EFFECT = Array.from({ length: N }, (_, c) => effectMask(c));

export function popcount(x) {
  let c = 0;
  while (x) { x &= x - 1; c++; }
  return c;
}

export function cellsOf(mask) {
  const out = [];
  for (let i = 0; i < N; i++) if (mask & (1 << i)) out.push(i);
  return out;
}

export function applyPress(boardMask, cell) {
  return boardMask ^ EFFECT[cell];
}

/* Solve EFFECT * x = boardMask over GF(2) by Gaussian elimination.
   Returns { solvable: false } or { solvable: true, particular, nullBasis }
   where every valid press-pattern is `particular` XOR any combination of
   `nullBasis` vectors — the null space is exactly the set of "quiet
   patterns" that toggle no light at all. */
export function solveSystem(boardMask) {
  const FULL = (1 << N) - 1;
  const rows = EFFECT.map((m, c) => m | (((boardMask >> c) & 1) << N));
  const pivotCol = new Array(N).fill(-1);
  let r = 0;
  for (let col = 0; col < N && r < N; col++) {
    let sel = -1;
    for (let i = r; i < N; i++) if (rows[i] & (1 << col)) { sel = i; break; }
    if (sel === -1) continue;
    [rows[r], rows[sel]] = [rows[sel], rows[r]];
    for (let i = 0; i < N; i++) {
      if (i !== r && (rows[i] & (1 << col))) rows[i] ^= rows[r];
    }
    pivotCol[col] = r;
    r++;
  }
  const rank = r;
  for (let i = rank; i < N; i++) {
    if ((rows[i] & FULL) === 0 && (rows[i] & (1 << N))) {
      return { solvable: false }; // 0 = 1, contradiction: unsolvable board
    }
  }
  const freeCols = [];
  for (let col = 0; col < N; col++) if (pivotCol[col] === -1) freeCols.push(col);

  let particular = 0;
  for (let col = 0; col < N; col++) {
    if (pivotCol[col] !== -1 && (rows[pivotCol[col]] & (1 << N))) particular |= 1 << col;
  }

  const nullBasis = freeCols.map((fc) => {
    let v = 1 << fc;
    for (let col = 0; col < N; col++) {
      if (pivotCol[col] !== -1 && (rows[pivotCol[col]] & (1 << fc))) v |= 1 << col;
    }
    return v;
  });

  return { solvable: true, particular, nullBasis };
}

/* The genuinely minimal solution: enumerate every member of the solution
   coset (2^nullity of them — 16 at most for a solvable 5x5 board, since the
   null space here has dimension 4) and keep the one with fewest presses. */
export function minimalSolution(boardMask) {
  const sol = solveSystem(boardMask);
  if (!sol.solvable) return null;
  const { particular, nullBasis } = sol;
  const k = nullBasis.length;
  let best = particular, bestCount = popcount(particular);
  for (let mask = 1; mask < (1 << k); mask++) {
    let v = particular;
    for (let i = 0; i < k; i++) if (mask & (1 << i)) v ^= nullBasis[i];
    const c = popcount(v);
    if (c < bestCount) { bestCount = c; best = v; }
  }
  return { pressMask: best, taps: bestCount };
}

export function isSolvable(boardMask) {
  return solveSystem(boardMask).solvable;
}
