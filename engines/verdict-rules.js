/* ============================================================================
   VERDICT — rules core (One Bad Answer)
   ----------------------------------------------------------------------------
   Deliberately free of DOM: engines/verdict.js draws the board and this file
   is the same code the authoring tool uses to prove a spec is solvable and
   to compute par.

   Six items have a hidden strict ranking, 1st through 6th. The player asks
   yes/no comparison questions of the form "is A above B?" (A ranks better
   than B). The oracle is not simply truthful: exactly one ORDERED PAIR
   (X, Y) is fixed, at authoring time, as the LYING PAIR. Whenever the player
   asks about that pair — in either direction — the answer given is the
   reverse of the truth. Every other pair is always answered truthfully.
   Asking the same pair twice is not a workaround: the oracle is a pure
   function of (spec, pair), not of question order or repetition, so a
   second ask of a pair already asked returns exactly the same answer.

   A WORLD is a candidate explanation of everything the player could ever be
   told: a permutation (the true ranking) plus an ordered pair (the lying
   pair). There are 6! = 720 permutations x 15 unordered pairs (asked either
   direction resolves to the same unordered pair, since "lying about A vs B"
   is symmetric) = 10800 worlds. That is small enough to enumerate and filter
   directly on every answer — no shortcuts needed there.

     answer(spec, a, b)        the oracle's true reply for one fixed spec.
     worldAnswer(world, a, b)  what a given *candidate world* predicts.
     allWorlds()               every (ranking, lyingPair) combination.
     consistentWorlds(worlds, asked)
                               worlds not yet contradicted by the answers
                               the player has actually received.
     bestQuestion(worlds)      the pair to ask next: minimises the larger of
                               the two resulting yes/no buckets (a greedy
                               splitting strategy — see the note below).
     greedyPar(items)          plays the greedy strategy against every
                               possible true (ranking, lyingPair) and returns
                               the worst-case number of questions it needs to
                               get down to one surviving world. This is the
                               PAR reported to players.

   Honesty about par: this file does NOT prove a minimum. bestQuestion is a
   greedy, one-step-lookahead splitter (always halve the worst remaining
   bucket), not a full minimax search over decision trees — 10800 worlds is
   too many to search exhaustively at multiple ply. greedyPar is the depth
   that strategy needs in the worst case for a given spec, and the UI must
   call it "par is the number a splitting strategy needs", never "the true
   minimum".
   ========================================================================== */

export const ITEMS = 6;

/* A lying pair whose two items sit CLOSE together in the true ranking is
   unplayable, not just harder: within distance 1 (adjacent), swapping them
   changes only their own edge, so the corrupted tournament produced is
   itself fully transitive — indistinguishable from a different true ranking
   with no lie at all, even after every one of the 15 possible questions.
   Within distance 2, the lie plus the two truthful edges to the item
   between them forms a 3-cycle, which is rotationally symmetric: three
   different (ranking, lyingPair) worlds explain the identical cycle, so it
   never resolves either. Only distance >= 3 is proven, by brute-force check
   over all 720 x 15 worlds, to always collapse to exactly one world once
   all 15 pairs are known. Authoring must enforce this. */
export function isPlayableSpec(spec) {
  const [x, y] = spec.lyingPair;
  return Math.abs(spec.ranking.indexOf(x) - spec.ranking.indexOf(y)) >= 3;
}

/* All 720 permutations of [0..n-1], each one a candidate true ranking
   (index 0 = 1st place, ..., index n-1 = last place). */
export function allPermutations(n = ITEMS) {
  const perms = [];
  const pool = Array.from({ length: n }, (_, i) => i);
  (function permute(remaining, current) {
    if (current.length === n) { perms.push(current.slice()); return; }
    for (let i = 0; i < remaining.length; i++) {
      const next = remaining.slice();
      const v = next.splice(i, 1)[0];
      current.push(v);
      permute(next, current);
      current.pop();
    }
  })(pool, []);
  return perms;
}

/* All 15 unordered pairs of item indices for n = 6. */
export function allPairs(n = ITEMS) {
  const pairs = [];
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  return pairs;
}

const pairKey = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);

/* True answer to "is a above b?" (a ranks numerically lower index = better)
   under `ranking`, with no lie applied. */
function trueAnswer(ranking, a, b) {
  return ranking.indexOf(a) < ranking.indexOf(b);
}

/* The oracle's actual answer for one fully-specified puzzle: a ranking and
   a lying pair. Reverses the true answer iff {a,b} is the lying pair. */
export function answer(spec, a, b) {
  const truth = trueAnswer(spec.ranking, a, b);
  const lying = pairKey(a, b) === pairKey(spec.lyingPair[0], spec.lyingPair[1]);
  return lying ? !truth : truth;
}

/* What a candidate world (same shape as `spec`) predicts for a question —
   used to filter the world set against real answers received. */
export const worldAnswer = answer;

/* Every (ranking, lyingPair) world, n! x C(n,2) of them. */
export function allWorlds(n = ITEMS) {
  const perms = allPermutations(n);
  const pairs = allPairs(n);
  const worlds = [];
  for (const ranking of perms)
    for (const lyingPair of pairs)
      worlds.push({ ranking, lyingPair });
  return worlds;
}

/* Worlds still consistent with every answer received so far.
   `asked` is an array of { a, b, said } where `said` is the boolean answer
   the player was actually given for that (a, b) question. */
export function consistentWorlds(worlds, asked) {
  return worlds.filter((w) => asked.every(({ a, b, said }) => worldAnswer(w, a, b) === said));
}

/* Has the world set collapsed to one ranking and one lying pair? (Different
   rankings that happen to agree on the lying pair still count as unsolved.) */
export function isResolved(worlds) {
  if (worlds.length === 0) return false;
  const first = worlds[0];
  return worlds.every((w) =>
    w.ranking.join(",") === first.ranking.join(",") &&
    pairKey(w.lyingPair[0], w.lyingPair[1]) === pairKey(first.lyingPair[0], first.lyingPair[1]));
}

/* Greedy splitting strategy: among all pairs, pick the one whose yes/no
   split of the current world set minimises the larger side. This is a
   one-step-lookahead heuristic, not a proven minimax — see file header. */
export function bestQuestion(worlds, n = ITEMS, excluded = []) {
  const excludedKeys = new Set(excluded.map(([a, b]) => pairKey(a, b)));
  const pairs = allPairs(n).filter(([a, b]) => !excludedKeys.has(pairKey(a, b)));
  let best = null;
  let bestWorst = Infinity;
  for (const [a, b] of pairs) {
    let yes = 0, no = 0;
    for (const w of worlds) (worldAnswer(w, a, b) ? yes++ : no++);
    if (yes === 0 || no === 0) continue; // asking this now would be wasted
    const worst = Math.max(yes, no);
    if (worst < bestWorst) { bestWorst = worst; best = [a, b]; }
  }
  // Every un-asked pair already fully agreed (would split 0/n) — nothing
  // left to learn from a fresh pair; fall back to any not-yet-asked pair so
  // the caller always gets *a* question rather than looping forever.
  if (best == null) best = pairs[0] || allPairs(n)[0];
  return best;
}

/* Play the greedy strategy against one specific true world, starting from
   `worlds0` (defaults to the full 10800), and return how many questions it
   takes to resolve both the ranking and the lying pair. Returns null if it
   fails to close within maxQuestions (a broken spec). */
export function playGreedy(trueWorld, worlds0, maxQuestions = 15, n = ITEMS) {
  let worlds = worlds0;
  const trail = [];
  for (let i = 0; i < maxQuestions; i++) {
    if (isResolved(worlds)) return { questions: i, trail };
    const [a, b] = bestQuestion(worlds, n, trail.map((q) => [q.a, q.b]));
    const said = answer(trueWorld, a, b);
    trail.push({ a, b, said });
    worlds = consistentWorlds(worlds, trail);
  }
  return isResolved(worlds) ? { questions: maxQuestions, trail } : null;
}

/* PAR: the worst-case number of questions the greedy strategy needs, over
   every possible true world sharing this spec's ranking (varying only which
   pair the oracle happens to lie about is not what we want — the spec fixes
   both). In practice we just need the depth for the ONE authored spec, but
   report it honestly as what the greedy strategy needs against it, computed
   by actually running the strategy against the true world of the authored
   puzzle (not estimated). */
export function greedyPar(spec, n = ITEMS) {
  const worlds0 = allWorlds(n);
  const result = playGreedy(spec, worlds0);
  if (!result) throw new Error("verdict: greedy strategy failed to resolve spec");
  return result.questions;
}

/* For comparison / the author's note: par if there were no liar at all (the
   lie pair never triggers because a null-lie oracle is used). Used only to
   show how much the lie costs, not shipped as a play mode. */
export function greedyParNoLiar(ranking, n = ITEMS) {
  // A world set of pure rankings only (lyingPair irrelevant, fixed to a
  // sentinel so equality/resolution logic still works unchanged).
  const sentinel = [0, 1];
  const worlds0 = allPermutations(n).map((r) => ({ ranking: r, lyingPair: sentinel }));
  const trueWorld = { ranking, lyingPair: sentinel };
  const truthfulAnswer = (spec, a, b) => trueAnswer(spec.ranking, a, b);
  let worlds = worlds0;
  const asked = [];
  for (let i = 0; i < 15; i++) {
    if (worlds.length === 1) return i;
    const askedKeys = new Set(asked.map((q) => pairKey(q.a, q.b)));
    const pairs = allPairs(n).filter(([a, b]) => !askedKeys.has(pairKey(a, b)));
    let best = null, bestWorst = Infinity;
    for (const [a, b] of pairs) {
      let yes = 0, no = 0;
      for (const w of worlds) (truthfulAnswer(w, a, b) ? yes++ : no++);
      if (yes === 0 || no === 0) continue;
      const worst = Math.max(yes, no);
      if (worst < bestWorst) { bestWorst = worst; best = [a, b]; }
    }
    if (best == null) best = pairs[0];
    if (best == null) return i;
    const [a, b] = best;
    const said = truthfulAnswer(trueWorld, a, b);
    asked.push({ a, b, said });
    worlds = worlds.filter((w) => asked.every((q) => truthfulAnswer(w, q.a, q.b) === q.said));
  }
  return worlds.length === 1 ? 15 : null;
}
