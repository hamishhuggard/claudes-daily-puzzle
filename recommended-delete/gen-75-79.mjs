#!/usr/bin/env node
/* Authoring search for #75-#79. Kept as an audit trail; the packed blobs are
   the shipped artifacts. */
import { countSolutions as statueCount } from "../engines/statue-rules.js";
import { countSolutions as knightCount } from "../engines/knight-rules.js";
import { countSolutions as caveCount } from "../engines/cave-rules.js";
import { countSolutions as noriCount } from "../engines/norinori-rules.js";
import { clueCounts, countSolutions as gokiCount } from "../engines/gokigen-rules.js";

const key = (cells) => cells.map(([r, c]) => `${r},${c}`).sort().join(";");
function rng(seed) { let x = seed >>> 0; return () => ((x = Math.imul(x ^ x >>> 15, 2246822519) ^ Math.imul(x ^ x >>> 13, 3266489917)) >>> 0) / 4294967296; }

function statue() {
  const rand = rng(7501), cells = [...Array(25).keys()];
  function connected(s) { const set = new Set(s), seen = new Set([s[0]]), q = [s[0]]; while (q.length) { const i = q.pop(), r = Math.floor(i / 5), c = i % 5; for (const j of [i - 5, i + 5, i - 1, i + 1]) { if (j < 0 || j >= 25 || (j === i - 1 && c === 0) || (j === i + 1 && c === 4) || !set.has(j) || seen.has(j)) continue; seen.add(j); q.push(j); } } return seen.size === s.length; }
  function choose(rem, out) { if (!rem.length) { const pieces = out.map((s, i) => { const minr = Math.min(...s.map((x) => Math.floor(x / 5))), minc = Math.min(...s.map((x) => x % 5)); return { id: `P${i + 1}`, shape: s.map((x) => [Math.floor(x / 5) - minr, x % 5 - minc]) }; }); if (new Set(pieces.map((p) => key(p.shape))).size !== pieces.length) return null; const spec = { rows: 5, cols: 5, pieces }; const r = statueCount(spec, 2); if (r.count === 1 && r.exhausted) return spec; return null; }
    const first = rem[0]; const candidates = [];
    // Deterministic random candidates around the first remaining square.
    for (let t = 0; t < 500; t++) { const s = [first]; const pool = rem.slice(1); while (s.length < 5 && pool.length) s.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]); if (s.length === 5 && connected(s)) candidates.push(s); }
    for (const s of candidates) { const rest = rem.filter((x) => !s.includes(x)); const got = choose(rest, out.concat([s])); if (got) return got; }
    return null;
  }
  // A bounded restart makes this practical without baking a random answer in.
  for (let t = 0; t < 1000; t++) { const got = choose(cells, []); if (got) return got; }
  throw new Error("no statue instance");
}

function knight() {
  for (let rows = 4; rows <= 5; rows++) for (let cols = 4; cols <= 5; cols++) for (let sr = 0; sr < rows; sr++) for (let sc = 0; sc < cols; sc++) for (let er = 0; er < rows; er++) for (let ec = 0; ec < cols; ec++) { if (sr === er && sc === ec) continue; const spec = { rows, cols, start: [sr, sc], end: [er, ec] }; const r = knightCount(spec, 2); if (r.count === 1 && r.exhausted) return spec; }
  throw new Error("no knight instance");
}

function cave() {
  const rows = 4, cols = 4, target = [1, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 1, 1, 1];
  const clues = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => { let n = 0; for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) { let rr = r + dr, cc = c + dc; while (rr >= 0 && cc >= 0 && rr < rows && cc < cols && target[rr * cols + cc]) { n++; rr += dr; cc += dc; } } return n; }));
  const spec = { rows, cols, clues }; const r = caveCount(spec, 2); if (r.count !== 1 || !r.exhausted) throw new Error(`cave target has ${r.count}`); return spec;
}

function norinori() {
  const rows = 4, cols = 4, target = [[0, 0], [0, 1], [1, 2], [1, 3], [2, 0], [2, 1], [3, 2], [3, 3]];
  for (let variant = 0; variant < 20000; variant++) { const rand = rng(7800 + variant), regions = Array.from({ length: rows }, () => Array(cols).fill(0)); const R = 6; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) regions[r][c] = Math.floor(rand() * R); const counts = Array(R).fill(0); for (const [r, c] of target) counts[regions[r][c]]++; if (counts.some((x) => x % 2 || x > 6)) continue; const spec = { rows, cols, regions, regionCounts: counts }; const q = noriCount(spec, 2); if (q.count === 1 && q.exhausted && q.solutions[0].length === target.length) return spec; }
  throw new Error("no norinori instance");
}

function gokigen() {
  const rows = 3, cols = 3, bits = [1, 0, 1, 0, 1, 0, 1, 0, 0], all = clueCounts({ rows, cols }, bits), clues = all.map((row) => row.map((x) => x));
  const spec = { rows, cols, clues }; const r = gokiCount(spec, 2); if (r.count !== 1 || !r.exhausted) throw new Error(`gokigen target has ${r.count}`); return spec;
}

console.log(JSON.stringify({ statue: statue(), knight: knight(), cave: cave(), norinori: norinori(), gokigen: gokigen() }, null, 2));
