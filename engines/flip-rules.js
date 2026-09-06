/* ============================================================================
   FLIP — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/flip.js draws the stack; this file computes par by actually
   solving the position, breadth-first, so par is the true minimum rather than
   an estimate.

   The plain version of this sorts a stack by repeatedly sliding a spatula in
   somewhere and flipping everything above it. Only the ORDER matters, and it
   has an easy greedy method: bring the biggest unplaced item to the top, then
   flip it down to where it belongs. Two flips per item, and you never have to
   think.

   This variant burns one side of every item. A flip still reverses the run
   above the spatula, but it also turns each of those items over, and the stack
   is only finished when everything is in order AND every burnt side is facing
   down.

   That breaks the greedy method outright. Getting the biggest item to the
   bottom is no longer worth two flips if it lands burnt-side-up, and fixing
   one item's orientation disturbs the orientation of everything above it.
   Order and orientation cannot be solved one after the other — a flip that
   improves the order can spoil the facing, so the two have to come right
   together. That is the whole difference, and it is why the greedy answer is
   usually several flips off the true minimum.

   A stack is an array of signed integers, index 0 = the top. The magnitude is
   the size; a POSITIVE value means the burnt side is already face down, a
   negative one means it is face up. The finished stack is [1, 2, ... n], all
   positive: smallest on top, nothing burnt showing.
   ========================================================================== */

/* Slide the spatula under the first `k` and turn that whole run over. */
export function flip(stack, k) {
  const out = stack.slice();
  const run = out.slice(0, k).reverse().map((v) => -v);
  for (let i = 0; i < k; i++) out[i] = run[i];
  return out;
}

export const isSolved = (stack) => stack.every((v, i) => v === i + 1);

export const key = (stack) => stack.join(",");

export function goalFor(n) {
  return Array.from({ length: n }, (_, i) => i + 1);
}

/* --------------------------------------------------------------------------
   Par, by search.

   A flip is its own inverse — turning the same run over twice puts it back —
   so a breadth-first sweep outward from the FINISHED stack labels every
   reachable position with its true distance to the goal in one pass. For a
   stack of six that is 6! * 2^6 = 46,080 positions, which is nothing.

   k runs from 1, not 2. Flipping only the top item is a legal move — it turns
   that one item over without moving anything — and it is sometimes the entire
   remaining solution, as in [-1, 2, 3]. Leaving it out of the sweep would have
   quietly overstated par for every position whose last correction is a single
   facing.

   Returns a Map from position key to the minimum number of flips it needs,
   which the engine also uses to tell a player whether the flip they just made
   actually got them anywhere.
   ------------------------------------------------------------------------ */
export function distanceMap(n) {
  const goal = goalFor(n);
  const dist = new Map([[key(goal), 0]]);
  let frontier = [goal];
  while (frontier.length) {
    const next = [];
    for (const state of frontier) {
      const d = dist.get(key(state));
      for (let k = 1; k <= n; k++) {
        const s = flip(state, k);
        const kk = key(s);
        if (dist.has(kk)) continue;
        dist.set(kk, d + 1);
        next.push(s);
      }
    }
    frontier = next;
  }
  return dist;
}

export function par(stack, dist) {
  const d = dist.get(key(stack));
  return d === undefined ? Infinity : d;
}

/* One flip that reduces the distance to the goal — the hint. */
export function bestFlip(stack, dist) {
  const here = par(stack, dist);
  for (let k = 1; k <= stack.length; k++) {
    if (par(flip(stack, k), dist) === here - 1) return k;
  }
  return null;
}
