/* ============================================================================
   TRIPLES — rules core (DOM-free)
   ----------------------------------------------------------------------------
   The whole "Set" validity check and the brute-force search over it, shared
   by engines/triples.js and the authoring script that picked the tableau.
   ========================================================================== */

export const ATTRS = ["n", "shape", "shade", "color"];

export function isTriple(a, b, c) {
  for (const attr of ATTRS) {
    const vs = [a[attr], b[attr], c[attr]];
    const allSame = vs[0] === vs[1] && vs[1] === vs[2];
    const allDiff = vs[0] !== vs[1] && vs[1] !== vs[2] && vs[0] !== vs[2];
    if (!allSame && !allDiff) return false;
  }
  return true;
}

/* All index triples [i,j,k] (i<j<k) among `cards` that are valid sets. */
export function findAllTriples(cards) {
  const out = [];
  for (let i = 0; i < cards.length; i++)
    for (let j = i + 1; j < cards.length; j++)
      for (let k = j + 1; k < cards.length; k++)
        if (isTriple(cards[i], cards[j], cards[k])) out.push([i, j, k]);
  return out;
}
