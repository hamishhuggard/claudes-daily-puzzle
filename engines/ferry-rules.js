/* ============================================================================
   FERRY — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/ferry.js draws the river; this file computes par by actually
   searching every position, so par is the true minimum.

   The river-crossing puzzle everyone knows has one boatman who is always in
   the boat. He supervises whichever bank he is on, the feuds only matter on
   the bank he has left, and every crossing is the same shape: take someone
   over, come back, take the next. The only question is the ORDER.

   Here nobody is a boatman. The boat holds at most two, only some of the
   passengers can row at all, and — the rule that does the work — nobody may
   row two crossings in a row. Whoever rowed the boat over is too tired to row
   it back, so somebody else has to be standing on that bank ready to take
   over.

   Just requiring a rower is not enough on its own to change anything: one
   rower can simply ride every crossing, and measured over thousands of random
   set-ups it costs at most two extra crossings. Making rowers tire is what
   binds. Oars stop being a property of a person and become a resource with a
   cooling-off period, so the question turns from "in what order" into "who
   will be able to row the next one" — and a rower sometimes has to be ferried
   back purely so they are available later, which the classic never asks.

   People are bits. A position is (who is on the far bank, which side the boat
   is on, who rowed last). Feuds are pairs who must never be left on a bank the
   boat is not at — the boat's presence is what keeps the peace.
   ========================================================================== */

/* Is a position legal? The bank WITHOUT the boat is unsupervised, so no feuding
   pair may be sitting on it. */
export function safe(spec, farMask, boatFar) {
  const all = (1 << spec.people.length) - 1;
  const unsupervised = boatFar ? (all & ~farMask) : farMask;
  for (const [a, b] of spec.feuds) {
    if ((unsupervised & (1 << a)) && (unsupervised & (1 << b))) return false;
  }
  return true;
}

/* Everyone who can pull an oar, as a bitmask. */
export function rowerMask(spec) {
  let m = 0;
  spec.people.forEach((p, i) => { if (p.rows) m |= (1 << i); });
  return m;
}

/* Every legal crossing from a position: one or two people from the boat's
   bank, together with which of them is doing the rowing. The rower must be
   able to row and must not be the person who rowed the previous crossing.
   Returns {load, rower} so the engine can say who took the oars. */
export function moves(spec, farMask, boatFar, lastRower) {
  const n = spec.people.length;
  const all = (1 << n) - 1;
  const here = boatFar ? farMask : (all & ~farMask);
  const rowers = rowerMask(spec);
  const out = [];
  const onBank = [];
  for (let i = 0; i < n; i++) if (here & (1 << i)) onBank.push(i);

  const groups = [];
  for (let a = 0; a < onBank.length; a++) {
    groups.push([onBank[a]]);
    for (let b = a + 1; b < onBank.length; b++) groups.push([onBank[a], onBank[b]]);
  }
  for (const g of groups) {
    const load = g.reduce((m, i) => m | (1 << i), 0);
    for (const r of g) {
      if (!((1 << r) & rowers)) continue;
      if (!spec.neverTired && r === lastRower) continue;   // still winded
      out.push({ load, rower: r });
    }
  }
  return out;
}

export function apply(farMask, boatFar, load) {
  return boatFar
    ? { farMask: farMask & ~load, boatFar: false }
    : { farMask: farMask | load, boatFar: true };
}

const key = (farMask, boatFar, lastRower) =>
  (farMask * 2 + (boatFar ? 1 : 0)) * 16 + (lastRower + 1);

/* --------------------------------------------------------------------------
   Par, by breadth-first search over every (who is across, which side the boat
   is on). That is 2^people * 2 positions, so the sweep is exhaustive and the
   number it returns is the true minimum. `from` lets the engine re-search from
   wherever the player has got to, so a hint is the best next crossing rather
   than the next step of a route they have already left.
   ------------------------------------------------------------------------ */
export function solve(spec, from) {
  const n = spec.people.length;
  const all = (1 << n) - 1;
  const startFar = from ? from.farMask : 0;
  const startBoat = from ? from.boatFar : false;
  const startLast = from && from.lastRower != null ? from.lastRower : -1;

  if (!safe(spec, startFar, startBoat)) return null;

  const seen = new Set([key(startFar, startBoat, startLast)]);
  let frontier = [{ farMask: startFar, boatFar: startBoat, lastRower: startLast }];
  let depth = 0;

  while (frontier.length) {
    const done = frontier.find((s) => s.farMask === all);
    if (done) return { par: depth, route: rebuild(done) };

    const next = [];
    for (const s of frontier) {
      for (const { load, rower } of moves(spec, s.farMask, s.boatFar, s.lastRower)) {
        const ns = apply(s.farMask, s.boatFar, load);
        if (!safe(spec, ns.farMask, ns.boatFar)) continue;
        const k = key(ns.farMask, ns.boatFar, rower);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ ...ns, lastRower: rower, from: s, load, rower });
      }
    }
    frontier = next;
    depth++;
  }
  return null;

  function rebuild(goal) {
    const out = [];
    let cur = goal;
    while (cur && cur.from) { out.push({ load: cur.load, rower: cur.rower }); cur = cur.from; }
    return out.reverse();
  }
}

/* What the same crossing would cost without the tiring rule — anyone who can
   row may row every crossing. The gap is what the rule is worth. */
export function parIfNeverTired(spec) {
  const res = solve({ ...spec, neverTired: true });
  return res ? res.par : null;
}
