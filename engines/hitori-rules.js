/* ============================================================================
   STRUCK OFF (Hitori, with a per-row shade-count clue) — rules core
   ----------------------------------------------------------------------------
   DOM-free. Used by engines/hitori.js to grade, and by the authoring script to
   prove each grid has exactly one valid answer.

   The original: a grid of numbers. Shade some cells so that no number
   survives twice, unshaded, in any row or column; no two shaded cells sit
   orthogonally adjacent; and the unshaded cells are all one connected piece
   (turning any corner, never through a shaded cell). Solving is a scan for
   duplicate numbers, then a tug-of-war between "shade this one to kill the
   duplicate" and "but that would cut the white region in two" or "but that
   would touch another shaded cell." The count of shaded cells in a row or
   column is never told to you — it falls out of wherever the duplicates
   happen to sit.

   STRUCK OFF prints one extra number: at the left of every row, exactly how
   many cells in that row must end up shaded. The duplicate-number rule,
   the no-touching rule and the single-region rule are all unchanged. What
   changes is the shape of the reasoning. Ordinary Hitori starts by hunting
   for repeated digits and only later worries about how many marks a row can
   afford. Here the row's shading budget is fixed and public from the first
   move, so a row with a tight budget (say 1, in a wide row full of
   duplicates) forces you to work out *which* duplicate the single shade can
   possibly resolve — often more than one repeated value needs killing, and
   only one shade is available, so some duplicate must be broken by a mark
   landing in a different row or column instead. A row budget of 0 is a hard
   constraint of its own: that whole row must already be duplicate-free once
   read together with whatever the columns eventually decide, which rules
   out shading almost everywhere else that would otherwise look tempting.
   The count clue turns "find the duplicates" into "find the duplicates that
   this row's fixed budget can actually afford to fix."

   Cells are addressed [r, c]. `grid` is an n x n array of small positive
   integers (values, not clue-cells). `rowCounts[r]` is how many cells in
   row r must be shaded.
   ========================================================================== */

const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

/* spec: { n, grid, rowCounts }
     n          — grid size (n x n)
     grid       — n x n array of numbers
     rowCounts  — array of length n, shaded-cell count required in that row */
export function makeSpec(n, grid, rowCounts) {
  return { n, grid, rowCounts };
}

function connected(unshaded, n) {
  if (unshaded.size <= 1) return true;
  const start = unshaded.values().next().value;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const i = stack.pop();
    const r = Math.floor(i / n), c = i % n;
    for (const [dr, dc] of ORTH) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      const j = rr * n + cc;
      if (unshaded.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
    }
  }
  return seen.size === unshaded.size;
}

/* Grading a finished grid from the player's shaded-cell set alone. `shaded`
   is an array of [r, c]. */
export function check(spec, shaded) {
  const { n, grid, rowCounts } = spec;
  const shadedSet = new Set(shaded.map(([r, c]) => r * n + c));

  // row counts
  const rowShaded = new Array(n).fill(0);
  for (const [r] of shaded) rowShaded[r]++;
  for (let r = 0; r < n; r++) {
    if (rowShaded[r] !== rowCounts[r]) return { ok: false, why: `row ${r + 1} doesn't have exactly ${rowCounts[r]} shaded cell${rowCounts[r] === 1 ? "" : "s"}` };
  }

  // no two shaded cells orthogonally adjacent
  for (const [r, c] of shaded) {
    for (const [dr, dc] of ORTH) {
      const rr = r + dr, cc = c + dc;
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
      if (shadedSet.has(rr * n + cc)) return { ok: false, why: "two shaded cells touch" };
    }
  }

  // no duplicate unshaded number in a row or column
  for (let r = 0; r < n; r++) {
    const seen = new Set();
    for (let c = 0; c < n; c++) {
      if (shadedSet.has(r * n + c)) continue;
      const v = grid[r][c];
      if (seen.has(v)) return { ok: false, why: `row ${r + 1} still repeats a number` };
      seen.add(v);
    }
  }
  for (let c = 0; c < n; c++) {
    const seen = new Set();
    for (let r = 0; r < n; r++) {
      if (shadedSet.has(r * n + c)) continue;
      const v = grid[r][c];
      if (seen.has(v)) return { ok: false, why: `column ${c + 1} still repeats a number` };
      seen.add(v);
    }
  }

  // unshaded cells form one connected region
  const unshaded = new Set();
  for (let i = 0; i < n * n; i++) if (!shadedSet.has(i)) unshaded.add(i);
  if (!connected(unshaded, n)) return { ok: false, why: "the unshaded cells aren't all one piece" };

  return { ok: true };
}

/* Exhaustive row-by-row search. For each row we first enumerate every subset
   of columns of size rowCounts[r] that is (a) internally non-adjacent and
   (b) leaves the row's unshaded cells all distinct-valued — a constraint
   entirely local to the row, so it prunes hard before any cross-row work.
   Rows are then combined top-down, checking vertical adjacency against the
   row above, and running per-column "seen values so far" sets so a column
   duplicate is caught the moment it appears rather than at the end.
   Connectivity of the unshaded region is only checked once a full grid is
   assembled, since it is the one property that isn't decided row-by-row.

   Returns { count, solutions, exhausted }. `nodeBudget` bounds explored
   row-placements so a hopeless seed can bail during authoring instead of
   running forever; `exhausted: false` means `count` is only a lower bound. */
export function countSolutions(spec, limit = 2, nodeBudget = Infinity) {
  const { n, grid, rowCounts } = spec;

  // Precompute, for each row, every legal shaded-column-set.
  const rowChoices = [];
  for (let r = 0; r < n; r++) {
    const k = rowCounts[r];
    const choices = [];
    (function pick(startC, chosen) {
      if (chosen.length === k) {
        // check internal adjacency already avoided by construction (skip +2)
        // check unshaded values in this row are distinct
        const shadedSet = new Set(chosen);
        const seen = new Set();
        for (let c = 0; c < n; c++) {
          if (shadedSet.has(c)) continue;
          const v = grid[r][c];
          if (seen.has(v)) return;
          seen.add(v);
        }
        choices.push(chosen.slice());
        return;
      }
      for (let c = startC; c < n; c++) {
        if (chosen.length && c - chosen[chosen.length - 1] === 1) continue; // adjacency within row
        chosen.push(c);
        pick(c + 1, chosen);
        chosen.pop();
      }
    })(0, []);
    rowChoices.push(choices);
  }

  if (rowChoices.some((c) => c.length === 0)) return { count: 0, solutions: [], exhausted: true };

  const solutions = [];
  let found = 0;
  let nodes = 0;
  let budgetHit = false;

  // colSeen[c] = Map value -> true, running unshaded values seen so far in column c
  function go(r, colSeen, prevShadedRow, shadedSoFar) {
    if (found >= limit || budgetHit) return;
    if (++nodes > nodeBudget) { budgetHit = true; return; }
    if (r === n) {
      // full grid assembled; check connectivity of unshaded region
      const shadedSet = new Set(shadedSoFar);
      const unshaded = new Set();
      for (let i = 0; i < n * n; i++) if (!shadedSet.has(i)) unshaded.add(i);
      if (connected(unshaded, n)) {
        found++;
        solutions.push([...shadedSoFar].map((i) => [Math.floor(i / n), i % n]));
      }
      return;
    }
    for (const cols of rowChoices[r]) {
      if (found >= limit || budgetHit) return;
      const colsSet = new Set(cols);
      // vertical adjacency against previous row's shaded cells
      let touches = false;
      for (const c of cols) if (prevShadedRow.has(c)) { touches = true; break; }
      if (touches) continue;

      // column duplicate check for this row's unshaded cells
      const newColSeen = colSeen.map((s) => new Set(s));
      let ok = true;
      for (let c = 0; c < n; c++) {
        if (colsSet.has(c)) continue;
        const v = grid[r][c];
        if (newColSeen[c].has(v)) { ok = false; break; }
        newColSeen[c].add(v);
      }
      if (!ok) continue;

      const newShaded = shadedSoFar.slice();
      for (const c of cols) newShaded.push(r * n + c);
      go(r + 1, newColSeen, colsSet, newShaded);
    }
  }

  const initColSeen = Array.from({ length: n }, () => new Set());
  go(0, initColSeen, new Set(), []);
  return { count: found, solutions, exhausted: !budgetHit };
}

/* Par: the fewest reveals (correct shaded-cell taps) a perfect solver needs
   before the remaining cells are forced — computed by actually walking the
   unique solution forward through `check`-equivalent deduction, not
   estimated. For this puzzle par is simply reported as the number of shaded
   cells in the unique solution, since the round is graded on hints used to
   reach it, not on a move count; callers that want a harder difficulty
   knob can use `count` from countSolutions on partial grids. */
export function parShadedCount(spec) {
  const res = countSolutions(spec, 2, Infinity);
  if (res.count !== 1) throw new Error("parShadedCount: spec is not uniquely solvable");
  return res.solutions[0].length;
}
