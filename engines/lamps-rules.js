/* ============================================================================
   LAMPS — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/lamps.js draws the room; this file is the solver that proved
   the board has one answer and that re-proves it on mount.

   The familiar version of this puzzle has two rules: light every white square,
   and never let two lamps see each other along a clear row or column. This
   variant replaces both with one — **every white square is lit exactly once**.

   That is a strictly stronger rule and it does more work than it looks:

     - It implies the old one. Two lamps that can see each other each light the
       other's square twice over, so they are already illegal.
     - It forbids something the old one allowed. In ordinary Akari a square may
       be lit from its row AND its column at once — by two lamps that cannot
       see each other — and nobody minds. Here that square is lit twice and the
       position is dead.

   The consequence is that overlap becomes a deduction rather than a
   non-event. In the ordinary game a lamp only ever tells you where light IS;
   here every lamp also fences off a cross of squares that no other lamp may
   reach, so placing one prunes the rest of the board in a way the original
   has no way to express.

   Walls are "#", numbered walls carry a digit giving exactly how many lamps
   sit orthogonally against them, and floor is " ".
   ========================================================================== */

export const isWall = (ch) => ch !== " ";
export const isNumber = (ch) => ch >= "0" && ch <= "9";

/* How many times each floor square is lit, given a set of lamp positions. */
export function litCounts(grid, lamps, rows, cols) {
  const count = new Array(rows * cols).fill(0);
  const DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  for (const p of lamps) {
    const r0 = Math.floor(p / cols), c0 = p % cols;
    count[p]++;                                    // a lamp lights its own square
    for (const [dr, dc] of DIRS) {
      let r = r0 + dr, c = c0 + dc;
      while (r >= 0 && c >= 0 && r < rows && c < cols && !isWall(grid[r][c])) {
        count[r * cols + c]++;
        r += dr; c += dc;
      }
    }
  }
  return count;
}

/* What is wrong with this arrangement, if anything. */
export function faults(grid, lamps, rows, cols) {
  const set = new Set(lamps);
  const count = litCounts(grid, lamps, rows, cols);
  const dark = [], twice = [], wrongWalls = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (isWall(grid[r][c])) {
        if (!isNumber(grid[r][c])) continue;
        const want = Number(grid[r][c]);
        let got = 0;
        for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          const rr = r + dr, cc = c + dc;
          if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) continue;
          if (set.has(rr * cols + cc)) got++;
        }
        if (got !== want) wrongWalls.push({ i, want, got });
        continue;
      }
      if (count[i] === 0) dark.push(i);
      else if (count[i] > 1) twice.push(i);
    }
  }
  return { dark, twice, wrongWalls };
}

export const isSolved = (grid, lamps, rows, cols) => {
  const f = faults(grid, lamps, rows, cols);
  return !f.dark.length && !f.twice.length && !f.wrongWalls.length;
};

/* Solutions under the strict rule, stopping at `limit`. Squares are taken in
   order and the search always works on the first square that is still dark,
   which keeps the branching tied to a real obligation rather than to the
   whole board. */
export function solve(grid, rows, cols, limit = 2, strict = true) {
  const floor = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) if (!isWall(grid[r][c])) floor.push(r * cols + c);
  }
  const found = [];
  const lamps = [];

  /* Every floor square that could light `i` — including i itself. */
  const lighters = new Map();
  for (const i of floor) {
    const r0 = Math.floor(i / cols), c0 = i % cols;
    const out = [i];
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      let r = r0 + dr, c = c0 + dc;
      while (r >= 0 && c >= 0 && r < rows && c < cols && !isWall(grid[r][c])) {
        out.push(r * cols + c);
        r += dr; c += dc;
      }
    }
    lighters.set(i, out);
  }

  const ok = () => {
    const f = faults(grid, lamps, rows, cols);
    if (strict && f.twice.length) return false;
    // A wall can never gain lamps it has already overshot.
    return !f.wrongWalls.some((w) => w.got > w.want);
  };

  (function rec() {
    if (found.length >= limit) return;
    if (!ok()) return;
    const count = litCounts(grid, lamps, rows, cols);
    const dark = floor.find((i) => count[i] === 0);
    if (dark === undefined) {
      const f = faults(grid, lamps, rows, cols);
      if (!f.wrongWalls.length && (!strict || !f.twice.length)) found.push(lamps.slice());
      return;
    }
    for (const p of lighters.get(dark)) {
      if (lamps.includes(p)) continue;
      lamps.push(p);
      rec();
      lamps.pop();
      if (found.length >= limit) return;
    }
  })();

  return found;
}
