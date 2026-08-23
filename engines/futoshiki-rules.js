/* ============================================================================
   FUTOSHIKI ("More or Less") — rules core
   ----------------------------------------------------------------------------
   DOM-free so the authoring step (and this file's own use at mount time) can
   prove a board has exactly one Latin-square-plus-inequalities solution
   before it ships, and so it can narrate a human solving order for the notes.

   A board is n x n. `constraints` is an array of directed edges
   { r1, c1, r2, c2 } meaning grid[r1][c1] < grid[r2][c2]; every edge is
   between orthogonally adjacent cells. `givens` is an array of [r, c, v].
   ========================================================================== */

const idx = (n, r, c) => r * n + c;

/* Exhaustive backtracking search, capped so callers checking uniqueness can
   stop at the first sign of a second solution instead of enumerating all of
   them. Pruning is just row/col Latin-ness plus checking each inequality the
   moment both of its cells are filled — plenty fast at n=5. */
export function countSolutions(n, constraints, givens, cap = 2) {
  const grid = Array.from({ length: n }, () => new Array(n).fill(0));
  const rowUsed = Array.from({ length: n }, () => new Set());
  const colUsed = Array.from({ length: n }, () => new Set());
  for (const [r, c, v] of givens) { grid[r][c] = v; rowUsed[r].add(v); colUsed[c].add(v); }

  const byCell = new Map();
  for (const con of constraints) {
    const k1 = idx(n, con.r1, con.c1), k2 = idx(n, con.r2, con.c2);
    if (!byCell.has(k1)) byCell.set(k1, []);
    if (!byCell.has(k2)) byCell.set(k2, []);
    byCell.get(k1).push(con);
    byCell.get(k2).push(con);
  }

  const cells = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (!grid[r][c]) cells.push([r, c]);

  const solutions = [];
  function okAt(r, c) {
    for (const con of byCell.get(idx(n, r, c)) || []) {
      const a = grid[con.r1][con.c1], b = grid[con.r2][con.c2];
      if (a && b && !(a < b)) return false;
    }
    return true;
  }
  function backtrack(i) {
    if (solutions.length >= cap) return;
    if (i === cells.length) { solutions.push(grid.map((row) => row.slice())); return; }
    const [r, c] = cells[i];
    for (let v = 1; v <= n; v++) {
      if (rowUsed[r].has(v) || colUsed[c].has(v)) continue;
      grid[r][c] = v; rowUsed[r].add(v); colUsed[c].add(v);
      if (okAt(r, c)) backtrack(i + 1);
      grid[r][c] = 0; rowUsed[r].delete(v); colUsed[c].delete(v);
      if (solutions.length >= cap) return;
    }
  }
  backtrack(0);
  return solutions;
}

/* Find the maximal simple chains in the inequality graph — runs of cells
   a1<a2<...<ak with no branching. These are the interesting deductions:
   a chain of length k on an n-value board pins ai's candidates to
   [i, n-k+i] before any single value is known. */
export function findChains(n, constraints) {
  const nodes = n * n;
  const out = Array.from({ length: nodes }, () => []);
  const inn = Array.from({ length: nodes }, () => []);
  for (const e of constraints) {
    out[idx(n, e.r1, e.c1)].push(idx(n, e.r2, e.c2));
    inn[idx(n, e.r2, e.c2)].push(idx(n, e.r1, e.c1));
  }
  const chains = [];
  const used = new Set();
  for (let s = 0; s < nodes; s++) {
    if (inn[s].length !== 0 || out[s].length !== 1 || used.has(s)) continue;
    const path = [s];
    let cur = s;
    while (out[cur].length === 1) {
      const nxt = out[cur][0];
      if (inn[nxt].length !== 1 || used.has(nxt)) break;
      path.push(nxt);
      cur = nxt;
    }
    if (path.length >= 2) { path.forEach((p) => used.add(p)); chains.push(path); }
  }
  return chains.map((path) => path.map((id) => ({ r: Math.floor(id / n), c: id % n })));
}

/* A best-effort *human-style* solving order: repeatedly tighten candidate
   sets by (a) chain range-forcing, (b) inequality bound propagation, and
   (c) row/column elimination once a cell is known, logging each cell the
   moment it collapses to one candidate. Anything propagation can't crack
   (rare, once the givens/inequalities are chosen well) is appended at the
   end labelled as a last-value-standing deduction, so the log always
   covers every cell — solution[r][c] is the ground truth throughout. */
export function deduceOrder(n, constraints, givens, solution) {
  const cand = Array.from({ length: n }, () =>
    Array.from({ length: n }, () => new Set(Array.from({ length: n }, (_, i) => i + 1))));
  for (const [r, c, v] of givens) cand[r][c] = new Set([v]);
  const fixed = new Set(givens.map(([r, c]) => `${r},${c}`));
  const chains = findChains(n, constraints).filter((ch) => ch.length >= 3);
  const label = (r, c) => `R${r + 1}C${c + 1}`;
  const log = givens.map(([r, c, v]) => ({ r, c, v, reason: "given" }));

  let changed = true, guard = 0;
  while (changed && guard++ < 1000) {
    changed = false;

    for (const chain of chains) {
      const L = chain.length;
      chain.forEach(({ r, c }, i) => {
        const before = cand[r][c].size;
        for (const v of [...cand[r][c]]) if (v < i + 1 || v > n - L + 1 + i) cand[r][c].delete(v);
        if (cand[r][c].size < before) changed = true;
      });
    }

    for (const e of constraints) {
      const A = cand[e.r1][e.c1], B = cand[e.r2][e.c2];
      const maxB = Math.max(...B), minA = Math.min(...A);
      let before = A.size;
      for (const v of [...A]) if (v >= maxB) A.delete(v);
      if (A.size !== before) changed = true;
      before = B.size;
      for (const v of [...B]) if (v <= minA) B.delete(v);
      if (B.size !== before) changed = true;
    }

    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      if (!fixed.has(`${r},${c}`)) continue;
      const v = [...cand[r][c]][0];
      for (let cc = 0; cc < n; cc++) if (cc !== c && cand[r][cc].delete(v)) changed = true;
      for (let rr = 0; rr < n; rr++) if (rr !== r && cand[rr][c].delete(v)) changed = true;
    }

    // hidden singles: a value with only one legal home left in a row/col
    // must go there, even if that cell still shows other candidates.
    for (let r = 0; r < n; r++) for (let v = 1; v <= n; v++) {
      const spots = [];
      for (let c = 0; c < n; c++) if (cand[r][c].has(v)) spots.push(c);
      if (spots.length === 1 && cand[r][spots[0]].size > 1) { cand[r][spots[0]] = new Set([v]); changed = true; }
    }
    for (let c = 0; c < n; c++) for (let v = 1; v <= n; v++) {
      const spots = [];
      for (let r = 0; r < n; r++) if (cand[r][c].has(v)) spots.push(r);
      if (spots.length === 1 && cand[spots[0]][c].size > 1) { cand[spots[0]][c] = new Set([v]); changed = true; }
    }

    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const k = `${r},${c}`;
      if (fixed.has(k) || cand[r][c].size !== 1) continue;
      const v = [...cand[r][c]][0];
      const chain = chains.find((ch) => ch.some((p) => p.r === r && p.c === c));
      const reason = chain
        ? `part of the chain ${chain.map((p) => label(p.r, p.c)).join("<")} — a run of ${chain.length} forces this end toward its extreme`
        : "pinned by row/column elimination against its inequality neighbours";
      fixed.add(k);
      log.push({ r, c, v, reason });
      changed = true;
    }
  }

  // Fallback for anything propagation alone couldn't finish (shouldn't
  // trigger on a well-authored board, but keeps the notes complete).
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const k = `${r},${c}`;
    if (fixed.has(k)) continue;
    fixed.add(k);
    log.push({ r, c, v: solution[r][c], reason: "the last value consistent with everything else placed" });
  }
  return log;
}
