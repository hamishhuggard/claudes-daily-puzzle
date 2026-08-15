/* ============================================================================
   STONES — rules core
   ----------------------------------------------------------------------------
   Deliberately free of DOM: engines/stones.js draws the board and this file
   is the same code the authoring tool uses to prove every starting position
   is a first-player win, and that the opponent never hands a win back.

   A position is an array of heap sizes, e.g. [13] or [3,4,5]. A move takes
   `take` stones (1..limit) from heap `heap`, where limit is maxTake or (if
   maxTake is null) the whole heap. The game ends the instant a move empties
   every heap; who wins depends on `variant`:

     "normal" — the player who takes the last stone wins.
     "misere" — the player who takes the last stone loses.
   ========================================================================== */

export function legalMoves(heaps, maxTake) {
  const out = [];
  for (let h = 0; h < heaps.length; h++) {
    const cap = maxTake == null ? heaps[h] : Math.min(maxTake, heaps[h]);
    for (let take = 1; take <= cap; take++) out.push({ heap: h, take });
  }
  return out;
}

export function applyMove(heaps, mv) {
  const next = heaps.slice();
  next[mv.heap] -= mv.take;
  return next;
}

export const isAllZero = (heaps) => heaps.every((h) => h === 0);

/* Can the player to move at `heaps` force a win? Memoised on the heap
   tuple, so this is a full game-tree search, not a formula. */
export function canWin(heaps, variant, maxTake, memo = new Map()) {
  const key = heaps.join(",");
  if (memo.has(key)) return memo.get(key);
  memo.set(key, false); // guard against pathological re-entry; overwritten below
  let result = false;
  for (const mv of legalMoves(heaps, maxTake)) {
    const next = applyMove(heaps, mv);
    if (isAllZero(next)) {
      // This move takes the last stone(s) — the outcome is immediate and
      // depends only on the variant, not on further search.
      if (variant === "normal") { result = true; break; }
      else continue; // misere: taking the last stone loses, so skip this move
    }
    if (!canWin(next, variant, maxTake, memo)) { result = true; break; }
  }
  memo.set(key, result);
  return result;
}

/* A move that wins immediately if one exists, else any legal move (used both
   to check "did the player just blunder" and to drive the opponent). */
export function bestMove(heaps, variant, maxTake, memo = new Map()) {
  const moves = legalMoves(heaps, maxTake);
  for (const mv of moves) {
    const next = applyMove(heaps, mv);
    if (isAllZero(next)) {
      if (variant === "normal") return mv; // wins immediately
      else continue; // misere: this move loses, keep looking
    }
    if (!canWin(next, variant, maxTake, memo)) return mv;
  }
  return moves[0] || null;
}
