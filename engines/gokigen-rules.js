/* One Loop Allowed — Gokigen Naname with exactly one diagonal loop. */
const D = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
export function edges(spec, bits) { const out = []; for (let r = 0; r < spec.rows; r++) for (let c = 0; c < spec.cols; c++) { const slash = bits[r * spec.cols + c] === 1; out.push(slash ? [[r, c + 1], [r + 1, c]] : [[r, c], [r + 1, c + 1]]); } return out; }
export function loopCount(spec, bits) {
  const adj = new Map(); for (const [[r1, c1], [r2, c2]] of edges(spec, bits)) { const a = `${r1},${c1}`, b = `${r2},${c2}`; if (!adj.has(a)) adj.set(a, []); if (!adj.has(b)) adj.set(b, []); adj.get(a).push(b); adj.get(b).push(a); }
  let loops = 0; const seen = new Set();
  for (const [start] of adj) { if (seen.has(start)) continue; const q = [start]; seen.add(start); let v = 0, e = 0; while (q.length) { const x = q.pop(); v++; const nn = adj.get(x) || []; e += nn.length; for (const y of nn) if (!seen.has(y)) { seen.add(y); q.push(y); } } loops += Math.max(0, e / 2 - v + 1); }
  return loops;
}
export function clueCounts(spec, bits) { const n = Array.from({ length: spec.rows + 1 }, () => Array(spec.cols + 1).fill(0)); for (const [[r1, c1], [r2, c2]] of edges(spec, bits)) { n[r1][c1]++; n[r2][c2]++; } return n; }
export function check(spec, bits) { if (!Array.isArray(bits) || bits.length !== spec.rows * spec.cols || bits.some((x) => x !== 0 && x !== 1)) return { ok: false, why: "choose one diagonal in every square" }; const counts = clueCounts(spec, bits); for (let r = 0; r <= spec.rows; r++) for (let c = 0; c <= spec.cols; c++) if (spec.clues[r][c] != null && counts[r][c] !== spec.clues[r][c]) return { ok: false, why: "a numbered corner has the wrong number of diagonals" }; return loopCount(spec, bits) === 1 ? { ok: true } : { ok: false, why: "the finished diagonals must contain exactly one closed loop" }; }
export function countSolutions(spec, limit = 2) { const total = spec.rows * spec.cols, bits = new Array(total).fill(0), solutions = []; let count = 0; function go(i) { if (count >= limit) return; if (i === total) { const r = check(spec, bits); if (r.ok) { count++; solutions.push(bits.slice()); } return; } for (const b of [0, 1]) { bits[i] = b; go(i + 1); } } go(0); return { count, solutions, exhausted: count < limit }; }
export function par(spec) { const r = countSolutions(spec, 2); if (r.count !== 1 || !r.exhausted) throw new Error("gokigen: puzzle is not uniquely solved"); return spec.rows * spec.cols; }
