/* ============================================================================
   TALLY — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/tally.js runs the conversation; this file is the logic
   underneath, and the same code the authoring tool used to check each one.

   The setup is the familiar one. A list of candidates, each a pair [a, b]. One
   person is told only `a`, the other only `b`. Both know the full list, both
   know the other reasons perfectly, and everything said is heard by everyone.

   The variant is what they are allowed to say. In the famous version of this
   puzzle every line is "I don't know" or "now I do", and the deduction runs
   entirely on ignorance. Here every line is a COUNT: "I have it down to four."
   That is the same kind of statement — still nothing about the speaker's own
   value — but it is exact where the original is a threshold, and the
   difference reshapes the whole puzzle:

     - "I don't know" means the speaker's group has size >= 2, so it can only
       ever kill groups that are too SMALL. Every elimination in the original
       runs one way.
     - "I have it down to four" kills every group whose size is not exactly
       four — including the big ones. A candidate can now die for being in too
       much company, which the original has no way of expressing.

   So the reflex the original teaches — hunt for the values that appear only
   once, and strike them — is only half the work here, and the other half runs
   in the opposite direction.

   Statements:
     { who, k }   the speaker has it down to exactly k candidates

   `who` is 0 or 1: which half of the pair that person was told. k === 1 is the
   line that ends a conversation, and needs no special case.
   ========================================================================== */

const share = (set, who, cand) => set.filter((d) => d[who] === cand[who]);

/* Is this statement true for a speaker holding `cand`, given that `set` is
   what everyone knows is still possible? */
export function holdsFor(stmt, cand, set) {
  return share(set, stmt.who, cand).length === stmt.k;
}

/* Apply one statement: whoever is left must be someone for whom it was true. */
export const applyStatement = (set, stmt) => set.filter((c) => holdsFor(stmt, c, set));

/* The whole conversation, with the survivors after each line — exactly the
   working-out the puzzle asks the player to do. */
export function trace(candidates, script) {
  const steps = [];
  let set = candidates.slice();
  for (const stmt of script) {
    set = applyStatement(set, stmt);
    steps.push({ stmt, remaining: set.slice() });
  }
  return steps;
}

/* A conversation is usable only if it ends on exactly one candidate and no
   line along the way was wasted breath. */
export function check(candidates, script) {
  const steps = trace(candidates, script);
  if (!steps.length) return { ok: false, why: "no statements" };
  const final = steps[steps.length - 1].remaining;
  if (final.length !== 1) return { ok: false, why: `${final.length} survivors`, steps };
  let prev = candidates.length;
  for (const s of steps) {
    if (s.remaining.length === prev) return { ok: false, why: "a statement changed nothing", steps };
    if (!s.remaining.length) return { ok: false, why: "ruled everything out", steps };
    prev = s.remaining.length;
  }
  return { ok: true, answer: final[0], steps };
}

/* How many candidates each line killed for being in a group that was too big
   rather than too small — the eliminations the original version of this puzzle
   cannot make at all. Used to prove the variant is doing something. */
export function upwardKills(candidates, script) {
  let set = candidates.slice(), n = 0;
  for (const stmt of script) {
    const next = applyStatement(set, stmt);
    for (const c of set) {
      if (next.includes(c)) continue;
      if (share(set, stmt.who, c).length > stmt.k) n++;
    }
    set = next;
  }
  return n;
}
