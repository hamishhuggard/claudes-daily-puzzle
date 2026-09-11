/* ============================================================================
   SHUNT — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/shunt.js draws the yard; this file computes par by actually
   searching every position, so par is the true minimum.

   A train sits on an inbound track in a fixed order and has to leave, one
   wagon at a time, onto an outbound track in a TARGET order. There are three
   sidings to park wagons in along the way. Two are dead ends: push a wagon in
   and it sits on top of whatever's already there, and only that top wagon can
   come back out — a stack, last in first out. Ordinary shunting puzzles stop
   there, and the whole thing reduces to "which stack do I unstack first," a
   fact you can read off the target order without much searching.

   The third siding is different: it's a loop line, not a dead end. Wagons
   come out of it in the same order they went in — a queue, first in first
   out. That's what turns this into a real search. A stack can only ever give
   you back a reversed run, so it's for wagons whose relative order still
   needs flipping. The loop can't flip anything — whatever you feed it comes
   back untouched — so it's exactly the right place to park a run that is
   *already* in the order the target wants, out of the way, without scrambling
   it. Deciding which siding gets which run, and when to just send a wagon
   straight through instead of parking it, is the puzzle.

   Once a wagon is sent to the outbound track it is committed — no move ever
   touches it again — so it must be exactly the next wagon the target needs at
   that moment, or the move is illegal outright.

   A position is: how many wagons remain on the inbound track (its order is
   fixed, so this is just a count from the front), the contents of each
   siding (ordered arrays; front/back mean different things for a stack vs a
   queue), and how many wagons have gone out (the outbound order is forced by
   the target, so again just a count). BFS over that space is exhaustive, so
   the number it returns is the true minimum.
   ========================================================================== */

/* A siding is { kind: "stack" | "loop", cap: number, items: [wagon...] }.
   For a stack, items[items.length-1] is the top (push/pop end).
   For a loop, items[0] is the front (the only end that can be released);
   pushes append to the back, items[items.length-1]. */

function cloneSidings(sidings) {
  return sidings.map((s) => ({ kind: s.kind, cap: s.cap, items: s.items.slice() }));
}

/* Every legal move from a state. Kinds:
     { type: "through" }                 — send inbound front straight out
     { type: "push", siding: i }         — push inbound front into siding i
     { type: "release", siding: i }      — release siding i's available wagon out
   A move onto the outbound track is only legal if the wagon matches the next
   slot of spec.target exactly. */
export function legalMoves(spec, state) {
  const { inbound, sidings, outCount } = state;
  const out = [];
  const nextTarget = spec.target[outCount];

  if (inbound.length) {
    const front = inbound[0];
    if (front === nextTarget) out.push({ type: "through" });
    sidings.forEach((s, i) => {
      if (s.items.length < s.cap) out.push({ type: "push", siding: i });
    });
  }

  sidings.forEach((s, i) => {
    if (!s.items.length) return;
    const avail = s.kind === "stack" ? s.items[s.items.length - 1] : s.items[0];
    if (avail === nextTarget) out.push({ type: "release", siding: i });
  });

  return out;
}

export function apply(spec, state, move) {
  const inbound = state.inbound.slice();
  const sidings = cloneSidings(state.sidings);
  let outCount = state.outCount;

  if (move.type === "through") {
    inbound.shift();
    outCount++;
  } else if (move.type === "push") {
    const w = inbound.shift();
    sidings[move.siding].items.push(w);
  } else if (move.type === "release") {
    const s = sidings[move.siding];
    if (s.kind === "stack") s.items.pop();
    else s.items.shift();
    outCount++;
  }

  return { inbound, sidings, outCount };
}

function stateKey(state) {
  return state.inbound.join(",") + "|"
    + state.sidings.map((s) => s.items.join(".")).join("|")
    + "|" + state.outCount;
}

function initialState(spec) {
  return {
    inbound: spec.inbound.slice(),
    sidings: spec.sidings.map((s) => ({ kind: s.kind, cap: s.cap, items: [] })),
    outCount: 0,
  };
}

/* --------------------------------------------------------------------------
   Par, by breadth-first search over every reachable state. `from` lets the
   engine re-search from wherever the player has got to, so a hint is the
   best NEXT move rather than the next step of a route already abandoned.
   ------------------------------------------------------------------------ */
export function solve(spec, from) {
  const start = from
    ? { inbound: from.inbound.slice(), sidings: cloneSidings(from.sidings), outCount: from.outCount }
    : initialState(spec);

  const n = spec.target.length;
  if (start.outCount === n) return { par: 0, route: [] };

  const seen = new Set([stateKey(start)]);
  let frontier = [{ state: start, from: null, move: null }];
  let depth = 0;

  while (frontier.length) {
    const done = frontier.find((f) => f.state.outCount === n);
    if (done) return { par: depth, route: rebuild(done) };

    const next = [];
    for (const f of frontier) {
      for (const move of legalMoves(spec, f.state)) {
        const ns = apply(spec, f.state, move);
        const k = stateKey(ns);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ state: ns, from: f, move });
      }
    }
    frontier = next;
    depth++;
  }
  return null;

  function rebuild(goal) {
    const out = [];
    let cur = goal;
    while (cur && cur.from) { out.push(cur.move); cur = cur.from; }
    return out.reverse();
  }
}

/* What the same job would cost if the loop line were a third dead-end stack
   instead — i.e. every siding is LIFO. Some jobs become impossible outright
   (return null); others just get more expensive. The gap is what the loop
   line is worth. */
export function parIfAllDeadEnds(spec) {
  const asStacks = { ...spec, sidings: spec.sidings.map((s) => ({ ...s, kind: "stack" })) };
  const res = solve(asStacks);
  return res ? res.par : null;
}
