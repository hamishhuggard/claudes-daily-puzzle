/* ============================================================================
   KNOWING — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/knowing.js runs the conversation; this file is the logic
   underneath it, and the same code the authoring tool used to check that each
   conversation narrows the possibilities to exactly one.

   The setup: a list of candidates, each a pair [a, b]. One person is told only
   `a`, the other only `b`. Both know the full list of candidates, and both know
   the other is a perfect reasoner. Then they speak, and every statement is
   heard by everyone.

   The trick — the thing that makes these puzzles feel like sleight of hand — is
   that "I don't know" is information. It rules out every candidate under which
   the speaker *would* have known. Each statement is therefore a filter applied
   to the set of candidates still standing, and the set shrinks even though
   nobody has said anything about their own value.

   Statements:
     { who, kind: "dontKnow" }   the speaker cannot identify the candidate
     { who, kind: "know" }       the speaker now can
     { who, kind: "knewYouDidnt" }
                                 the speaker knew, before the other spoke, that
                                 the other could not know — and this says
                                 nothing about whether the speaker knows
     { who, kind: "neitherOfUs" }
                                 the speaker does not know, *and* knew the
                                 other could not either. This is the line from
                                 the famous version of the puzzle, and it is
                                 strictly stronger than the one above; they are
                                 kept separate because conflating them silently
                                 changes the answer.

   `who` is 0 or 1: which half of the pair that person was told.
   ========================================================================== */

const share = (set, who, cand) => set.filter((d) => d[who] === cand[who]);

/* Does this statement hold, for a speaker holding `cand`, given that `set` is
   what everyone knows is still possible? */
export function holdsFor(stmt, cand, set) {
  const me = stmt.who, you = 1 - stmt.who;
  switch (stmt.kind) {
    case "dontKnow": return share(set, me, cand).length >= 2;
    case "know":     return share(set, me, cand).length === 1;
    case "knewYouDidnt":
      // Everything I consider possible leaves you with at least two options.
      return share(set, me, cand).every((d) => share(set, you, d).length >= 2);
    case "neitherOfUs":
      return share(set, me, cand).length >= 2
        && share(set, me, cand).every((d) => share(set, you, d).length >= 2);
    default: throw new Error(`unknown statement ${stmt.kind}`);
  }
}

/* Apply one statement: whoever is left must be someone for whom it was true. */
export const applyStatement = (set, stmt) => set.filter((c) => holdsFor(stmt, c, set));

/* Run the whole conversation, returning the surviving set after each line —
   which is exactly the working-out the puzzle asks the player to do. */
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
    if (s.remaining.length === 0) return { ok: false, why: "ruled everything out", steps };
    prev = s.remaining.length;
  }
  return { ok: true, answer: final[0], steps };
}
