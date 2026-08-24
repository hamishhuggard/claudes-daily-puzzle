/* ============================================================================
   BRIDGES — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/bridges.js draws the archipelago; this file is the same code
   the authoring tool used to prove the layout has exactly one solution, by
   enumerating solutions and stopping at two.

   An island is { r, c, need }. A span is a straight horizontal or vertical run
   of open water between two islands with nothing in between; each span carries
   0, 1 or 2 bridges. A layout is finished when

     - every island's bridge count equals its `need`,
     - no two bridges cross, and
     - the whole archipelago is one connected piece.

   That last condition is the one that makes the puzzle worth playing: the
   counting is local and easy, and the connectivity is what forces you to
   think globally.
   ========================================================================== */

/* Every pair of islands that could be joined: same row or column, clear water
   between them. Returned in a fixed order so indices are stable everywhere. */
export function spansOf(islands) {
  const out = [];
  const at = new Map(islands.map((v, i) => [`${v.r},${v.c}`, i]));
  islands.forEach((a, i) => {
    for (const [dr, dc] of [[0, 1], [1, 0]]) {
      let r = a.r + dr, c = a.c + dc;
      while (r < 40 && c < 40) {
        const j = at.get(`${r},${c}`);
        if (j !== undefined) { out.push({ a: i, b: j, horiz: dr === 0 }); break; }
        r += dr; c += dc;
      }
    }
  });
  return out;
}

/* Two spans cross when one is horizontal, the other vertical, and they meet at
   open water. Precomputed once — the solver checks it constantly. */
export function crossingPairs(islands, spans) {
  const seg = spans.map((s) => {
    const a = islands[s.a], b = islands[s.b];
    return s.horiz
      ? { horiz: true, r: a.r, lo: Math.min(a.c, b.c), hi: Math.max(a.c, b.c) }
      : { horiz: false, c: a.c, lo: Math.min(a.r, b.r), hi: Math.max(a.r, b.r) };
  });
  const out = spans.map(() => []);
  for (let i = 0; i < spans.length; i++) {
    for (let j = i + 1; j < spans.length; j++) {
      const p = seg[i], q = seg[j];
      if (p.horiz === q.horiz) continue;
      const h = p.horiz ? p : q, v = p.horiz ? q : p;
      if (v.c > h.lo && v.c < h.hi && h.r > v.lo && h.r < v.hi) {
        out[i].push(j); out[j].push(i);
      }
    }
  }
  return out;
}

export function connected(islands, spans, counts) {
  const adj = islands.map(() => []);
  spans.forEach((s, i) => { if (counts[i] > 0) { adj[s.a].push(s.b); adj[s.b].push(s.a); } });
  const seen = new Set([0]);
  const stack = [0];
  while (stack.length) {
    for (const nb of adj[stack.pop()]) if (!seen.has(nb)) { seen.add(nb); stack.push(nb); }
  }
  return seen.size === islands.length;
}

/* Depth-first over spans, assigning 0/1/2 to each. Two prunes carry the search:
   an island can never exceed its need, and once every span touching it is
   decided it must hit its need exactly. Stops as soon as `limit` solutions are
   found, so uniqueness costs no more than finding two answers. */
export function solutions(islands, limit = 2) {
  const spans = spansOf(islands);
  const cross = crossingPairs(islands, spans);
  const touching = islands.map(() => []);
  spans.forEach((s, i) => { touching[s.a].push(i); touching[s.b].push(i); });

  const counts = spans.map(() => -1);
  const deg = islands.map(() => 0);
  const found = [];

  // How many spans at this island are still undecided?
  const openAt = (v) => touching[v].filter((i) => counts[i] < 0).length;

  function feasible(v) {
    if (deg[v] > islands[v].need) return false;
    if (deg[v] + 2 * openAt(v) < islands[v].need) return false;
    return true;
  }

  function rec(k) {
    if (found.length >= limit) return;
    if (k === spans.length) {
      if (deg.every((d, v) => d === islands[v].need) && connected(islands, spans, counts)) {
        found.push(counts.slice());
      }
      return;
    }
    const s = spans[k];
    for (let n = 0; n <= 2; n++) {
      if (n > 0 && cross[k].some((j) => counts[j] > 0)) break; // crossing
      counts[k] = n;
      deg[s.a] += n; deg[s.b] += n;
      if (feasible(s.a) && feasible(s.b)) rec(k + 1);
      deg[s.a] -= n; deg[s.b] -= n;
      counts[k] = -1;
      if (found.length >= limit) return;
    }
  }

  rec(0);
  return { spans, found };
}
