/* ============================================================================
   ZEBRA — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/zebra.js draws the grid; this file is the solver the
   authoring tool used to prove the clue list pins down exactly one answer, and
   that no clue in it is redundant.

   The world is `n` positions in a row (floors of a building, seats at a table)
   and a set of `categories`, each holding `n` items, one per position. A
   solution assigns every category a permutation: `sol[cat][pos] = item`.

   Clues are data, not prose — the prose is generated from them, so the two can
   never drift apart:

     { kind: "at",      a, pos }        item a sits at this position
     { kind: "same",    a, b }          a and b share a position
     { kind: "notSame", a, b }          a and b do not
     { kind: "immLeft", a, b }          a is directly left of b
     { kind: "nextTo",  a, b }          a and b are adjacent
     { kind: "leftOf",  a, b }          a is somewhere left of b
     { kind: "between", a, b, c }       a is strictly between b and c

   `a`, `b`, `c` are [category, item] pairs.
   ========================================================================== */

export const posOf = (sol, [cat, item]) => sol[cat].indexOf(item);

export function holds(clue, sol) {
  const p = (ref) => posOf(sol, ref);
  switch (clue.kind) {
    case "at":      return p(clue.a) === clue.pos;
    case "same":    return p(clue.a) === p(clue.b);
    case "notSame": return p(clue.a) !== p(clue.b);
    case "immLeft": return p(clue.a) + 1 === p(clue.b);
    case "nextTo":  return Math.abs(p(clue.a) - p(clue.b)) === 1;
    case "leftOf":  return p(clue.a) < p(clue.b);
    case "between": {
      const x = p(clue.a), lo = Math.min(p(clue.b), p(clue.c)), hi = Math.max(p(clue.b), p(clue.c));
      return x > lo && x < hi;
    }
    default: throw new Error(`unknown clue kind ${clue.kind}`);
  }
}

const catsOf = (clue) => [clue.a, clue.b, clue.c].filter(Boolean).map((r) => r[0]);

function permutations(items) {
  if (items.length <= 1) return [items];
  const out = [];
  items.forEach((x, i) => {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const p of permutations(rest)) out.push([x, ...p]);
  });
  return out;
}

/* Solutions consistent with every clue, stopping at `limit`. Categories are
   filled one at a time and a clue is checked the moment all the categories it
   mentions are assigned, which keeps this small enough to run in the browser
   on every mount. */
export function solve(n, categories, clues, limit = 2) {
  const perms = permutations([...Array(n).keys()]);
  const found = [];
  const sol = categories.map(() => null);

  // Clues become checkable once their last category is filled.
  const dueAt = categories.map(() => []);
  clues.forEach((clue) => { dueAt[Math.max(...catsOf(clue))].push(clue); });

  (function rec(cat) {
    if (found.length >= limit) return;
    if (cat === categories.length) { found.push(sol.map((p) => p.slice())); return; }
    for (const perm of perms) {
      sol[cat] = perm;
      if (dueAt[cat].every((clue) => holds(clue, sol))) rec(cat + 1);
      if (found.length >= limit) break;
    }
    sol[cat] = null;
  })(0);

  return found;
}

/* Is every clue pulling its weight? Drop each in turn: if the puzzle is still
   unique without it, that clue was decoration. */
export function redundantClues(n, categories, clues) {
  const out = [];
  clues.forEach((_, i) => {
    const without = clues.filter((__, j) => j !== i);
    if (solve(n, categories, without, 2).length === 1) out.push(i);
  });
  return out;
}

/* The prose. Generated from the clue data so the wording can never disagree
   with what the solver is actually enforcing.

   `lex` carries the puzzle's vocabulary — what a position is called, and which
   words mean "one step lower" and "one step higher" — so the same solver can
   serve a row of seats or a stack of floors. */
export function clueText(clue, categories, lex) {
  const name = ([cat, item]) => categories[cat].items[item];
  const the = ([cat, item]) => categories[cat].the
    ? `${categories[cat].the} ${name([cat, item])}`
    : name([cat, item]);
  switch (clue.kind) {
    case "at":      return `${the(clue.a)} is ${lex.positions[clue.pos]}.`;
    case "same":    return `${the(clue.a)} and ${the(clue.b)} share ${lex.aSlot}.`;
    case "notSame": return `${the(clue.a)} is not ${the(clue.b)}.`;
    case "immLeft": return `${the(clue.a)} is directly ${lex.under} ${the(clue.b)}.`;
    case "nextTo":  return `${the(clue.a)} is directly ${lex.under} or directly ${lex.over} ${the(clue.b)}.`;
    case "leftOf":  return `${the(clue.a)} is somewhere ${lex.under} ${the(clue.b)}.`;
    case "between": return `${the(clue.a)} is somewhere between ${the(clue.b)} and ${the(clue.c)}.`;
    default: return "";
  }
}
