/* Fixed in Place — exact-cover core for fixed-orientation pentomino parks. */

const ORTH = [[-1, 0], [1, 0], [0, -1], [0, 1]];

export function placementsFor(spec, pieceIndex) {
  const { rows, cols, blocked = [] } = spec;
  const blockedSet = new Set(blocked.map(([r, c]) => `${r},${c}`));
  const shape = spec.pieces[pieceIndex].shape;
  const out = [];
  for (let ar = 0; ar < rows; ar++) for (let ac = 0; ac < cols; ac++) {
    const cells = shape.map(([dr, dc]) => [ar + dr, ac + dc]);
    if (cells.some(([r, c]) => r < 0 || c < 0 || r >= rows || c >= cols || blockedSet.has(`${r},${c}`))) continue;
    const keys = cells.map(([r, c]) => r * cols + c);
    if (new Set(keys).size !== keys.length) continue;
    out.push({ anchor: [ar, ac], cells });
  }
  return out;
}

export function countSolutions(spec, limit = 2) {
  const { rows, cols, blocked = [], pieces } = spec;
  const blockedSet = new Set(blocked.map(([r, c]) => r * cols + c));
  const open = rows * cols - blockedSet.size;
  if (pieces.length * 5 !== open) return { count: 0, solutions: [], exhausted: true };
  const all = pieces.map((_, i) => placementsFor(spec, i));
  if (all.some((p) => !p.length)) return { count: 0, solutions: [], exhausted: true };
  const order = [...pieces.keys()].sort((a, b) => all[a].length - all[b].length);
  const used = new Set(blockedSet);
  const chosen = new Array(pieces.length);
  const solutions = [];
  let count = 0;
  function go(k) {
    if (count >= limit) return;
    if (k === order.length) {
      count++;
      solutions.push(chosen.map((p) => p.cells.map((x) => [...x])));
      return;
    }
    const pi = order[k];
    for (const p of all[pi]) {
      if (p.cells.some(([r, c]) => used.has(r * cols + c))) continue;
      for (const [r, c] of p.cells) used.add(r * cols + c);
      chosen[pi] = p;
      go(k + 1);
      for (const [r, c] of p.cells) used.delete(r * cols + c);
      if (count >= limit) return;
    }
  }
  go(0);
  return { count, solutions, exhausted: count < limit };
}

export function check(spec, answer) {
  if (!Array.isArray(answer) || answer.length !== spec.pieces.length) return { ok: false, why: "choose one placement for every statue" };
  const blocked = new Set((spec.blocked || []).map(([r, c]) => r * spec.cols + c));
  const used = new Set(blocked);
  for (let i = 0; i < answer.length; i++) {
    const cells = answer[i];
    if (!Array.isArray(cells) || cells.length !== 5) return { ok: false, why: "every statue must cover five squares" };
    const wanted = new Set(placementsFor(spec, i).map((p) => p.cells.map(([r, c]) => `${r},${c}`).sort().join(";")));
    const key = cells.map(([r, c]) => `${r},${c}`).sort().join(";");
    if (!wanted.has(key)) return { ok: false, why: `statue ${i + 1} is in a forbidden orientation or position` };
    for (const [r, c] of cells) {
      const k = r * spec.cols + c;
      if (used.has(k)) return { ok: false, why: "statues overlap or cover a marked pond" };
      used.add(k);
    }
  }
  return { ok: true };
}

export function par(spec) {
  const res = countSolutions(spec, 2);
  if (res.count !== 1 || !res.exhausted) throw new Error("statue: puzzle is not uniquely solved");
  return spec.pieces.length;
}
