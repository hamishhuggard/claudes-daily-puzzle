import { el } from "./shared.js";
import { countSolutions, check } from "./norinori-rules.js";

export default {
  usesTimer: false,
  mount(root, puzzle, api) {
    const rounds = puzzle.data.rounds;
    const solved = rounds.map((rd) => {
      const r = countSolutions(rd.spec, 2);
      if (r.count !== 1 || !r.exhausted) throw new Error(`norinori: round has ${r.count} solutions`);
      return r.solutions[0];
    });
    let ri = 0, hints = 0, wrong = 0, marks, status;
    const results = [];
    const wrap = el("div"); root.appendChild(wrap);
    function cells() { const { rows, cols } = rounds[ri].spec; const out = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (marks[r][c] === 1) out.push([r, c]); return out; }
    function start() { const s = rounds[ri].spec; marks = Array.from({ length: s.rows }, () => Array(s.cols).fill(0)); status = ""; render(); }
    function render() {
      const s = rounds[ri].spec, n = cells().length, total = s.regionCounts.reduce((a, x) => a + x, 0); wrap.innerHTML = "";
      wrap.appendChild(el("p", "q-detail center", `Grid ${ri + 1} of ${rounds.length} · ${n}/${total} shaded${hints ? ` · ${hints} hint${hints === 1 ? "" : "s"}` : ""}`));
      const board = el("div"); board.style.display = "grid"; board.style.gridTemplateColumns = `repeat(${s.cols},1fr)`; board.style.maxWidth = "360px"; board.style.margin = "0 auto";
      for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
        const m = marks[r][c], b = el("button", null, m === 1 ? "" : m === 2 ? "×" : String(s.regions[r][c] + 1)); b.style.aspectRatio = "1"; b.style.padding = "0"; b.style.border = "1px solid rgba(255,255,255,.25)"; b.style.background = m === 1 ? "rgba(255,255,255,.9)" : m === 2 ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.08)"; b.style.color = m === 1 ? "#111" : "inherit"; b.style.textDecoration = m === 2 ? "line-through" : "none"; b.onclick = () => { marks[r][c] = (m + 1) % 3; after(); }; board.appendChild(b);
      }
      wrap.appendChild(board); const counts = el("p", "q-detail center", s.regionCounts.map((x, i) => `R${i + 1}: ${x}`).join(" · ")); wrap.appendChild(counts);
      const msg = el("p", "order-feedback show", status); wrap.appendChild(msg);
      const bar = el("div", "stack"); bar.style.flexDirection = "row"; bar.style.justifyContent = "center"; bar.style.gap = "10px";
      const hint = el("button", "ghost compact", "Hint"); hint.onclick = () => { const missing = solved[ri].filter(([r, c]) => marks[r][c] !== 1); if (missing.length) { const [r, c] = missing[0]; marks[r][c] = 1; hints++; after(); } };
      const clear = el("button", "ghost compact", "Clear"); clear.onclick = start; bar.append(hint, clear); wrap.appendChild(bar);
    }
    function after() { const s = rounds[ri].spec, shaded = cells(), total = s.regionCounts.reduce((a, x) => a + x, 0); if (shaded.length !== total) { status = ""; render(); return; } const r = check(s, shaded); if (!r.ok) { wrong++; status = `Not yet — ${r.why}.`; render(); return; } results.push({ hints }); if (ri + 1 < rounds.length) { ri++; hints = 0; start(); } else finish(); }
    function finish() { const totalHints = results.reduce((a, x) => a + x.hints, 0), clean = !totalHints && !wrong; root.innerHTML = ""; root.appendChild(el("div", `reveal-badge ${clean ? "good" : "ok"}`, clean ? "🖤 Every pair, clean" : `🖤 Pairs placed · ${totalHints} hints`)); api.finish({ headline: clean ? "Every pair, no hints" : `Every pair · ${totalHints} hints`, squares: results.map((x) => x.hints ? "◻️" : "⬛").join(""), stats: [["Grids", `${rounds.length}/${rounds.length}`], ["Hints", String(totalHints)], ["Wrong grids", String(wrong)]], perfect: clean, extra: [clean ? "🎯 unaided" : `💡 ${totalHints} hints`], notes: solved.map((sol, i) => { const s = rounds[i].spec, set = new Set(sol.map(([r, c]) => r * s.cols + c)); return `Grid ${i + 1} — shaded cells:<br><span style="font-family:ui-monospace,monospace">${Array.from({ length: s.rows }, (_, r) => Array.from({ length: s.cols }, (_, c) => set.has(r * s.cols + c) ? "#" : ".").join("")).join("\n")}</span>`; }).concat("The printed number belongs to the region, not to the puzzle as a whole. A zero region kills every candidate domino through it; a four or six makes the no-three-touch rule do most of the work. Because dominoes may cross a region boundary, a pair can spend two different regional budgets, so the useful question is always which neighbour completes a pair while leaving both printed totals possible. The authoring solver checks every shading and exhausts the search after proving one answer.") }); }
    start();
  },
};
