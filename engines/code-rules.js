/* ============================================================================
   CODE — rules core (Cracking the Safe)
   ----------------------------------------------------------------------------
   Deliberately free of DOM: engines/code.js draws the board and this file is
   the same code the authoring tool uses to prove a code is solvable and to
   compute par — the number of guesses a good solver needs against it.

   A code is an array of `slots` distinct symbol indices drawn from
   0..symbols-1 (no repeats — that's what keeps 6 symbols / 4 slots down to
   a tractable 360 possibilities instead of 1296). A guess is scored against
   a secret with two numbers only:
     bulls — right symbol, right position.
     cows  — right symbol, wrong position.
   Never which positions. That opacity is the entire puzzle; this file never
   exposes anything more than bulls/cows to a caller that doesn't already
   have the secret in hand.
   ========================================================================== */

export const SYMBOLS = 6;
export const SLOTS = 4;

/* Every ordered arrangement of `slots` distinct values from 0..symbols-1. */
export function allCodes(symbols = SYMBOLS, slots = SLOTS) {
  const codes = [];
  const pool = Array.from({ length: symbols }, (_, i) => i);
  (function permute(remaining, current) {
    if (current.length === slots) { codes.push(current.slice()); return; }
    for (let i = 0; i < remaining.length; i++) {
      const next = remaining.slice();
      const sym = next.splice(i, 1)[0];
      current.push(sym);
      permute(next, current);
      current.pop();
    }
  })(pool, []);
  return codes;
}

export function feedback(guess, secret) {
  let bulls = 0;
  for (let i = 0; i < guess.length; i++) if (guess[i] === secret[i]) bulls++;
  const common = guess.filter((s) => secret.includes(s)).length;
  return { bulls, cows: common - bulls };
}

const fbKey = (fb) => `${fb.bulls},${fb.cows}`;
const codeKey = (c) => c.join(",");

/* Knuth-style minimax: among all legal guesses, pick the one whose worst-case
   response partitions the remaining candidates the least — i.e. the guess
   that, no matter what the safe says back, narrows the field the most. Ties
   favour a guess that is itself still a live candidate, so the solver can
   win outright rather than only ever probing. */
export function bestGuess(candidates, allGuesses) {
  if (candidates.length === 1) return candidates[0];
  const candidateSet = new Set(candidates.map(codeKey));
  let best = null;
  let bestScore = Infinity;
  for (const guess of allGuesses) {
    const buckets = new Map();
    for (const cand of candidates) {
      const k = fbKey(feedback(guess, cand));
      buckets.set(k, (buckets.get(k) || 0) + 1);
    }
    let worst = 0;
    for (const v of buckets.values()) if (v > worst) worst = v;
    const score = worst - (candidateSet.has(codeKey(guess)) ? 0.5 : 0);
    if (score < bestScore) { bestScore = score; best = guess; }
  }
  return best;
}

/* Run the minimax solver against `secret` and return how many guesses it
   needs (the final, fully-correct guess included) plus its guess/feedback
   trail. Returns { guesses: null } if it fails to close within maxGuesses —
   callers must treat that as a broken puzzle, not a player-facing outcome. */
export function solve(secret, allGuesses, maxGuesses = 10) {
  let candidates = allGuesses.slice();
  const history = [];
  for (let i = 0; i < maxGuesses; i++) {
    const guess = bestGuess(candidates, allGuesses);
    const fb = feedback(guess, secret);
    history.push({ guess, fb });
    if (fb.bulls === guess.length) return { guesses: i + 1, history };
    candidates = candidates.filter((c) => {
      const cfb = feedback(guess, c);
      return cfb.bulls === fb.bulls && cfb.cows === fb.cows;
    });
  }
  return { guesses: null, history };
}

/* Candidates still consistent with a real guess/feedback history — used both
   to narrate the deductive chain and to grade how informative each of the
   player's own guesses was. */
export function remainingCandidates(allGuesses, history) {
  return allGuesses.filter((c) =>
    history.every(({ guess, fb }) => {
      const cfb = feedback(guess, c);
      return cfb.bulls === fb.bulls && cfb.cows === fb.cows;
    }));
}
