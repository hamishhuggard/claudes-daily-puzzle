/* ============================================================================
   WORD LADDER — rules core
   ----------------------------------------------------------------------------
   Deliberately free of DOM: engines/ladder.js drives the chain the player
   climbs, and this same module is used by the authoring script (and the
   tests) to prove every par is the real shortest route, not a guess.

   A "word list" here is just an array of same-length lowercase words. Two
   words are neighbours if they are the same length and differ in exactly one
   letter position — that's the whole graph.
   ========================================================================== */

/* How many positions do a and b differ in? Words must be the same length. */
export function diffPositions(a, b) {
  if (a.length !== b.length) return Infinity;
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

/* Build an adjacency map for a word list: word -> Set of one-letter-off
   neighbours also in the list. Grouping by wildcard pattern ("c_ld") keeps
   this at O(words * length) instead of O(words^2). */
export function buildGraph(words) {
  const byPattern = new Map();
  for (const w of words) {
    for (let i = 0; i < w.length; i++) {
      const pat = w.slice(0, i) + "_" + w.slice(i + 1);
      if (!byPattern.has(pat)) byPattern.set(pat, []);
      byPattern.get(pat).push(w);
    }
  }
  const adj = new Map(words.map((w) => [w, new Set()]));
  for (const bucket of byPattern.values()) {
    if (bucket.length < 2) continue;
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        adj.get(bucket[i]).add(bucket[j]);
        adj.get(bucket[j]).add(bucket[i]);
      }
    }
  }
  return adj;
}

/* Distances from `start` to every word reachable from it, by BFS. */
export function bfsDistances(adj, start) {
  const dist = new Map([[start, 0]]);
  let frontier = [start];
  while (frontier.length) {
    const next = [];
    for (const u of frontier) {
      const nbrs = adj.get(u);
      if (!nbrs) continue;
      for (const v of nbrs) {
        if (dist.has(v)) continue;
        dist.set(v, dist.get(u) + 1);
        next.push(v);
      }
    }
    frontier = next;
  }
  return dist;
}

/* Shortest-path length from start to target, or null if unreachable. */
export function shortestDistance(adj, start, target) {
  const dist = bfsDistances(adj, start);
  return dist.has(target) ? dist.get(target) : null;
}

/* One valid next word from a shortest path from `current` to `target` — used
   for the "stuck" reveal. Deterministic (alphabetically first among the
   neighbours that actually lie on a shortest route), so the hint doesn't
   depend on iteration order of a Set. */
export function nextStep(adj, current, target) {
  const distToTarget = bfsDistances(adj, target);
  const here = distToTarget.get(current);
  if (here == null || here === 0) return null;
  const nbrs = adj.get(current);
  if (!nbrs) return null;
  const onPath = [...nbrs].filter((n) => distToTarget.get(n) === here - 1);
  onPath.sort();
  return onPath[0] || null;
}

/* Is `guess` a legal move from `current` in this word list? */
export function isLegalMove(adj, current, guess) {
  return adj.has(guess) && adj.get(current).has(guess);
}
