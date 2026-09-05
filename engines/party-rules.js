/* ============================================================================
   PARTY — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/party.js draws the room; this file computes what each guest
   would say and proves the answer is the only one that fits.

   The setup: some pairs of guests shook hands. Nobody will tell you how many
   hands they shook themselves. What each guest tells you is the TOTAL number
   of hands shaken by the people they shook hands with — a fact entirely about
   other people. You are also told the seven handshake counts as an unordered
   list, with no indication of whose is whose.

   Why that is a puzzle rather than a search: a report is a sum over your
   neighbours' degrees, so it mixes together how many people you met with how
   popular they were. A guest reporting a large number might have met one very
   sociable person or four hermits. The one place it comes apart cleanly is at
   the bottom — a guest who shook exactly one hand reports precisely their
   partner's count, which turns their report into a name.

   Uniqueness was proved at authoring time by enumerating all 2,097,152 graphs
   on seven guests: exactly one produces the shipped report. `countMatching`
   below re-proves it on mount the cheap way, within the handshake counts the
   player is given, which is the space the player is actually searching.
   ========================================================================== */

export const pairsOf = (n) => {
  const out = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) out.push([i, j]);
  return out;
};

export const degreesOf = (n, shakes) => {
  const d = new Array(n).fill(0);
  for (const [a, b] of shakes) { d[a]++; d[b]++; }
  return d;
};

/* What each guest says: the total shaken by everyone they shook with. */
export function reportOf(n, shakes) {
  const d = degreesOf(n, shakes);
  const s = new Array(n).fill(0);
  for (const [a, b] of shakes) { s[a] += d[b]; s[b] += d[a]; }
  return s;
}

const sorted = (a) => a.slice().sort((x, y) => x - y);
export const sameMultiset = (a, b) => sorted(a).join() === sorted(b).join();

/* Every distinct way of handing the known handshake counts to the guests. */
function degreeAssignments(counts) {
  const seen = new Set(), out = [];
  const perm = (rest, acc) => {
    if (!rest.length) {
      const key = acc.join(",");
      if (!seen.has(key)) { seen.add(key); out.push(acc.slice()); }
      return;
    }
    for (let i = 0; i < rest.length; i++) {
      acc.push(rest[i]);
      perm(rest.slice(0, i).concat(rest.slice(i + 1)), acc);
      acc.pop();
    }
  };
  perm(counts, []);
  return out;
}

/* How many handshake sets produce exactly this report, among graphs whose
   handshake counts are the ones the player was given? Stops at `limit`. */
export function countMatching(n, report, counts, limit = 2) {
  const pairs = pairsOf(n);
  let found = 0;
  const hits = [];

  for (const deg of degreeAssignments(counts)) {
    // Each guest's report is fixed once the degrees are, so check it can work
    // before building any graphs: a guest of degree 0 must report 0.
    if (deg.some((d, i) => (d === 0) !== (report[i] === 0))) continue;

    const left = deg.slice();
    const chosen = [];
    const rec = (k) => {
      if (found >= limit) return;
      if (k === pairs.length) {
        if (left.some((x) => x !== 0)) return;
        const rep = reportOf(n, chosen);
        if (rep.every((x, i) => x === report[i])) { found++; hits.push(chosen.slice()); }
        return;
      }
      const [a, b] = pairs[k];
      // Prune: whatever degree is still owed must fit in the pairs still to come.
      let remaining = 0;
      for (let m = k; m < pairs.length; m++) remaining += 2;
      if (left.reduce((x, y) => x + y, 0) > remaining) return;

      if (left[a] > 0 && left[b] > 0) {
        left[a]--; left[b]--; chosen.push(pairs[k]);
        rec(k + 1);
        chosen.pop(); left[a]++; left[b]++;
      }
      rec(k + 1);
    };
    rec(0);
    if (found >= limit) break;
  }
  return { count: found, solutions: hits };
}
