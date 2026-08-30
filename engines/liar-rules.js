/* ============================================================================
   LIAR — rules core
   ----------------------------------------------------------------------------
   No DOM. A logic-grid puzzle in which exactly one clue on the list is FALSE,
   and finding which one is part of the answer.

   The world, the clue kinds and the prose all come from zebra-rules.js
   unchanged — this file only changes what counts as a solution, which is the
   whole point of the variant. An ordinary logic grid is solved by propagation:
   every clue is a fact, facts compose, and a contradiction means you made a
   mistake. Put one lie on the list and propagation stops being safe. A
   contradiction no longer means you erred; it is evidence, and the skill
   becomes locating which clue is the source of it rather than trusting any
   clue far enough to build on.

   An answer here is a PAIR: an arrangement, and the clue it breaks. The
   puzzle is well posed only if exactly one such pair exists — not one
   arrangement, one pair — and that is what `solveWithLiar` checks.
   ========================================================================== */

import { solve, holds } from "./zebra-rules.js";

/* Every (arrangement, liar) pair: an arrangement satisfying all clues but one,
   and failing that one. `limit` caps the work per candidate liar. */
export function solveWithLiar(n, categories, clues, limit = 40) {
  const pairs = [];
  clues.forEach((clue, i) => {
    const without = clues.filter((_, j) => j !== i);
    for (const sol of solve(n, categories, without, limit)) {
      // Exactly one lie: an arrangement that satisfies the dropped clue too
      // would make the list all true, which the puzzle says it is not.
      if (!holds(clue, sol)) pairs.push({ sol, liar: i });
    }
  });
  return pairs;
}

/* Is every clue pulling its weight? Dropping a clue from a liar puzzle leaves
   a puzzle with one fewer clue and still one lie; if that is still uniquely
   solvable, the clue was decoration. The honest clue this reports as spare is
   spare in a stronger sense than in the ordinary game, because here a clue
   also earns its place by being a candidate liar worth ruling out. */
export function redundantClues(n, categories, clues) {
  const out = [];
  clues.forEach((_, i) => {
    const without = clues.filter((__, j) => j !== i);
    if (solveWithLiar(n, categories, without).length === 1) out.push(i);
  });
  return out;
}
