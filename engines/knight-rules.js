/* Two Short Steps — Hamiltonian path with exactly two king moves. */
const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
export function moveKind(a, b) {
  const dr = Math.abs(a[0] - b[0]), dc = Math.abs(a[1] - b[1]);
  if ((dr === 1 && dc === 2) || (dr === 2 && dc === 1)) return "knight";
  if (dr <= 1 && dc <= 1 && dr + dc > 0) return "king";
  return null;
}
export function legalNext(spec, from) {
  const out = [];
  for (const [dr, dc] of KNIGHT) { const p = [from[0] + dr, from[1] + dc]; if (p[0] >= 0 && p[1] >= 0 && p[0] < spec.rows && p[1] < spec.cols) out.push([p[0], p[1], "knight"]); }
  for (const [dr, dc] of KING) { const p = [from[0] + dr, from[1] + dc]; if (p[0] >= 0 && p[1] >= 0 && p[0] < spec.rows && p[1] < spec.cols) out.push([p[0], p[1], "king"]); }
  return out;
}
export function countSolutions(spec, limit = 2) {
  const total = spec.rows * spec.cols, start = spec.start, end = spec.end;
  const seen = new Set([start[0] * spec.cols + start[1]]), path = [start], solutions = [];
  let count = 0;
  const memo = new Map();
  function go(at, kings) {
    if (count >= limit) return;
    if (path.length === total) { if (at[0] === end[0] && at[1] === end[1] && kings === 2) { count++; solutions.push(path.map((p) => [...p])); } return; }
    const stateKey = `${at[0] * spec.cols + at[1]}|${[...seen].sort((a, b) => a - b).join(",")}|${kings}`;
    if (memo.has(stateKey)) return;
    memo.set(stateKey, true);
    for (const [r, c, kind] of legalNext(spec, at)) {
      const k = r * spec.cols + c;
      if (seen.has(k)) continue;
      // The endpoint is a terminal square: entering it before the final
      // visit can never lead to a Hamiltonian path.
      if (r === end[0] && c === end[1] && path.length + 1 < total) continue;
      const nk = kings + (kind === "king" ? 1 : 0);
      if (spec.kingAt && spec.kingAt.includes(path.length) !== (kind === "king")) continue;
      const cp = spec.checkpoints && spec.checkpoints.find((x) => x.i === path.length);
      if (cp && (cp.cell[0] !== r || cp.cell[1] !== c)) continue;
      if (nk > 2 || (total - path.length - 1 < 2 - nk)) continue;
      seen.add(k); path.push([r, c]); go([r, c], nk); path.pop(); seen.delete(k);
    }
  }
  go(start, 0);
  return { count, solutions, exhausted: count < limit };
}
export function check(spec, path) {
  const n = spec.rows * spec.cols;
  if (!Array.isArray(path) || path.length !== n) return { ok: false, why: "visit every square exactly once" };
  if (path[0][0] !== spec.start[0] || path[0][1] !== spec.start[1] || path[n - 1][0] !== spec.end[0] || path[n - 1][1] !== spec.end[1]) return { ok: false, why: "the path has the wrong endpoint" };
  if (spec.checkpoints && spec.checkpoints.some((x) => !path[x.i] || path[x.i][0] !== x.cell[0] || path[x.i][1] !== x.cell[1])) return { ok: false, why: "a marked checkpoint is missed" };
  const set = new Set(path.map(([r, c]) => r * spec.cols + c));
  if (set.size !== n || [...set].some((k) => k < 0 || k >= n)) return { ok: false, why: "a square is repeated" };
  let kings = 0;
  for (let i = 1; i < path.length; i++) { const kind = moveKind(path[i - 1], path[i]); if (!kind) return { ok: false, why: `step ${i} is neither a knight nor a king move` }; if (spec.kingAt && spec.kingAt.includes(i) !== (kind === "king")) return { ok: false, why: "the two short steps are in the wrong places" }; if (kind === "king") kings++; }
  return kings === 2 ? { ok: true } : { ok: false, why: `exactly two king moves are required (you used ${kings})` };
}
export function par(spec) { const r = countSolutions(spec, 2); if (r.count !== 1 || !r.exhausted) throw new Error("knight: puzzle is not uniquely solved"); return spec.rows * spec.cols - 1; }
