import { el } from "./shared.js";
import { countSolutions, deduceOrder } from "./futoshiki-rules.js";

/* ============================================================================
   FUTOSHIKI — "More or Less"
   ----------------------------------------------------------------------------
   A 5x5 Latin square (1-5 once per row/column) with a handful of < / >
   signs between adjacent cells. Almost no starting digits — the chains of
   inequalities carry the information instead. A run a<b<c<d<e across a
   whole row of five distinct values only has one possible filling, and
   that's the intended way in: chase the longest chain first.

   Mount-time asserts the authored board has exactly one solution by
   exhaustive search (futoshiki-rules.countSolutions), and reuses the same
   module's deduceOrder() to write the after-solve notes.
   ========================================================================== */

const STYLE = `
  .futo-wrap { display: flex; flex-direction: column; align-items: center; gap: 14px; }
  .futo-grid {
    display: grid;
    grid-template-columns: repeat(5, 1fr) 0;
    grid-template-rows: repeat(5, 1fr) 0;
    width: 100%; max-width: 340px;
  }
  .futo-cellrow, .futo-signrow { display: contents; }
  .futo-cell {
    aspect-ratio: 1; display: flex; align-items: center; justify-content: center;
    background: var(--panel); border: 1px solid var(--line); border-radius: 8px;
    position: relative; cursor: pointer; user-select: none;
  }
  .futo-cell.given { background: var(--panel-2); cursor: default; }
  .futo-cell.sel { border-color: var(--accent); box-shadow: inset 0 0 0 2px var(--accent); }
  .futo-cell.rowbad, .futo-cell.colbad { background: rgba(224,106,90,.14); }
  .futo-cell b { font-size: 1.35rem; font-family: var(--serif); font-weight: 600; }
  .futo-cell.given b { color: var(--accent-2); }
  .futo-pencil {
    display: grid; grid-template-columns: repeat(3, 1fr); width: 100%; height: 100%;
    padding: 3px; gap: 0;
  }
  .futo-pencil span {
    font-size: .58rem; color: var(--faint); display: flex; align-items: center; justify-content: center;
    font-variant-numeric: tabular-nums;
  }
  .futo-pencil span.on { color: var(--accent-2); font-weight: 700; }
  .futo-hgap, .futo-vgap { display: flex; align-items: center; justify-content: center; }
  .futo-sign {
    width: 11px; height: 11px; background: var(--faint); flex: none;
  }
  .futo-sign.bad { background: var(--bad); }
  .futo-sign.left  { clip-path: polygon(0 50%, 100% 0, 100% 100%); }
  .futo-sign.right { clip-path: polygon(100% 50%, 0 0, 0 100%); }
  .futo-sign.up    { clip-path: polygon(50% 0, 100% 100%, 0 100%); }
  .futo-sign.down  { clip-path: polygon(50% 100%, 0 0, 100% 0); }
  .futo-pad { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; width: 100%; max-width: 340px; }
  .futo-pad button {
    aspect-ratio: 1; background: var(--panel); border: 1px solid var(--line); color: var(--text);
    font-size: 1.1rem; font-weight: 700; border-radius: 8px;
  }
  .futo-pad button:active { background: var(--panel-2); }
  .futo-bar { display: flex; gap: 8px; width: 100%; max-width: 340px; }
  .futo-bar button { flex: 1; }
  .futo-bar .on { border-color: var(--accent); color: var(--accent); }
`;

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const d = puzzle.data;
    const n = d.n;
    const constraints = d.constraints; // [{r1,c1,r2,c2}] meaning grid[r1][c1] < grid[r2][c2]
    const givens = d.givens || [];
    const maxHints = d.maxHints ?? 2;

    // Dev-time integrity check: the authored board must have exactly one
    // Latin-square-plus-inequalities solution.
    const solutions = countSolutions(n, constraints, givens, 2);
    if (solutions.length !== 1) {
      throw new Error(`futoshiki: expected exactly one solution, found ${solutions.length}`);
    }
    const solution = solutions[0];
    const solveLog = deduceOrder(n, constraints, givens, solution);

    root.appendChild(el("style", null, STYLE));

    const byCell = new Map(); // "r,c" -> constraints touching it
    for (const con of constraints) {
      const k1 = `${con.r1},${con.c1}`, k2 = `${con.r2},${con.c2}`;
      if (!byCell.has(k1)) byCell.set(k1, []);
      if (!byCell.has(k2)) byCell.set(k2, []);
      byCell.get(k1).push(con);
      byCell.get(k2).push(con);
    }

    const grid = Array.from({ length: n }, () => new Array(n).fill(0));
    const pencil = Array.from({ length: n }, () => Array.from({ length: n }, () => new Set()));
    const isGiven = Array.from({ length: n }, () => new Array(n).fill(false));
    for (const [r, c, v] of givens) { grid[r][c] = v; isGiven[r][c] = true; }

    let sel = null; // [r,c]
    let pencilMode = false;
    let mistakes = 0;
    let hintsUsed = 0;
    const mistakeCells = new Set(); // cells that have ever committed a violation, for scoring only

    root.appendChild(el("p", "q-detail center",
      "Fill 1-5 once per row and column. The &lt; / &gt; signs between cells must hold. " +
      "Chase the longest chain of signs first — it pins values before you know a single one."));

    const wrap = el("div", "futo-wrap");
    root.appendChild(wrap);

    const gridEl = el("div", "futo-grid");
    gridEl.style.gridTemplateColumns = `repeat(${n}, 1fr) 0`;
    gridEl.style.gridTemplateRows = `repeat(${n}, 1fr) 0`;
    wrap.appendChild(gridEl);

    const cellEls = Array.from({ length: n }, () => new Array(n));
    // gaps: hGap[r][c] = sign to the right of (r,c); vGap[r][c] = sign below (r,c)
    const hGapEls = Array.from({ length: n }, () => new Array(n).fill(null));
    const vGapEls = Array.from({ length: n }, () => new Array(n).fill(null));

    function signClass(dir) { return dir; } // "left" | "right" | "up" | "down"

    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const cellCol = 2 * c + 1, cellRow = 2 * r + 1;
        const cellWrap = el("div", "futo-cell");
        cellWrap.style.gridColumn = String(cellCol);
        cellWrap.style.gridRow = String(cellRow);
        cellWrap.onclick = () => selectCell(r, c);
        gridEl.appendChild(cellWrap);
        cellEls[r][c] = cellWrap;

        if (c < n - 1) {
          const con = (byCell.get(`${r},${c}`) || []).find((e) =>
            (e.r1 === r && e.c1 === c && e.r2 === r && e.c2 === c + 1) ||
            (e.r2 === r && e.c2 === c && e.r1 === r && e.c1 === c + 1));
          const gap = el("div", "futo-hgap");
          gap.style.gridColumn = String(cellCol + 1);
          gap.style.gridRow = String(cellRow);
          if (con) {
            const dir = (con.r1 === r && con.c1 === c) ? "left" : "right";
            const sign = el("div", `futo-sign ${signClass(dir)}`);
            sign.dataset.dir = dir;
            gap.appendChild(sign);
            gap._con = con; gap._sign = sign;
          }
          gridEl.appendChild(gap);
          hGapEls[r][c] = gap;
        }
        if (r < n - 1) {
          const con = (byCell.get(`${r},${c}`) || []).find((e) =>
            (e.r1 === r && e.c1 === c && e.r2 === r + 1 && e.c2 === c) ||
            (e.r2 === r && e.c2 === c && e.r1 === r + 1 && e.c1 === c));
          const gap = el("div", "futo-vgap");
          gap.style.gridColumn = String(cellCol);
          gap.style.gridRow = String(cellRow + 1);
          if (con) {
            const dir = (con.r1 === r && con.c1 === c) ? "up" : "down";
            const sign = el("div", `futo-sign ${signClass(dir)}`);
            sign.dataset.dir = dir;
            gap.appendChild(sign);
            gap._con = con; gap._sign = sign;
          }
          gridEl.appendChild(gap);
          vGapEls[r][c] = gap;
        }
      }
    }

    const pad = el("div", "futo-pad");
    wrap.appendChild(pad);
    const digitBtns = [];
    for (let v = 1; v <= n; v++) {
      const b = el("button", null, String(v));
      b.onclick = () => enterDigit(v);
      pad.appendChild(b);
      digitBtns.push(b);
    }

    const bar = el("div", "futo-bar");
    wrap.appendChild(bar);
    const pencilBtn = el("button", "ghost compact", "✏️ Pencil");
    pencilBtn.onclick = () => { pencilMode = !pencilMode; pencilBtn.classList.toggle("on", pencilMode); };
    const clearBtn = el("button", "ghost compact", "Clear cell");
    clearBtn.onclick = () => clearCell();
    const hintBtn = el("button", "ghost compact", `💡 Hint (${maxHints})`);
    hintBtn.onclick = () => useHint();
    bar.append(pencilBtn, clearBtn, hintBtn);

    const feedback = el("div", "order-feedback", "&nbsp;");
    root.appendChild(feedback);

    function selectCell(r, c) {
      if (isGiven[r][c]) return;
      sel = [r, c];
      render();
    }

    function clearCell() {
      if (!sel) return;
      const [r, c] = sel;
      if (isGiven[r][c]) return;
      grid[r][c] = 0;
      pencil[r][c].clear();
      render();
      checkDone();
    }

    function enterDigit(v) {
      if (!sel) {
        feedback.className = "order-feedback show";
        feedback.textContent = "Tap a cell first.";
        return;
      }
      const [r, c] = sel;
      if (isGiven[r][c]) return;
      feedback.textContent = "";
      feedback.className = "order-feedback";

      if (pencilMode) {
        if (grid[r][c]) grid[r][c] = 0;
        if (pencil[r][c].has(v)) pencil[r][c].delete(v);
        else pencil[r][c].add(v);
        render();
        return;
      }

      pencil[r][c].clear();
      grid[r][c] = v;
      const violated = cellViolations(r, c).length > 0;
      if (violated) mistakes++;
      render();
      checkDone();
    }

    function useHint() {
      if (hintsUsed >= maxHints) return;
      // Prefer the next unfilled cell in the teaching solve order.
      const target = solveLog.find((step) => !grid[step.r][step.c] || grid[step.r][step.c] !== solution[step.r][step.c]);
      if (!target) return;
      hintsUsed++;
      grid[target.r][target.c] = solution[target.r][target.c];
      pencil[target.r][target.c].clear();
      isGiven[target.r][target.c] = true; // hinted cells lock, like givens
      hintBtn.textContent = `💡 Hint (${maxHints - hintsUsed})`;
      if (hintsUsed >= maxHints) hintBtn.disabled = true;
      render();
      checkDone();
    }

    // Row/col duplicate positions (a set of "r,c" keys currently repeating a value).
    function dupCells() {
      const bad = new Set();
      for (let r = 0; r < n; r++) {
        const seen = new Map();
        for (let c = 0; c < n; c++) {
          const v = grid[r][c];
          if (!v) continue;
          if (!seen.has(v)) seen.set(v, []);
          seen.get(v).push(c);
        }
        for (const cols of seen.values()) if (cols.length > 1) cols.forEach((c) => bad.add(`row,${r},${c}`));
      }
      for (let c = 0; c < n; c++) {
        const seen = new Map();
        for (let r = 0; r < n; r++) {
          const v = grid[r][c];
          if (!v) continue;
          if (!seen.has(v)) seen.set(v, []);
          seen.get(v).push(r);
        }
        for (const rows of seen.values()) if (rows.length > 1) rows.forEach((r) => bad.add(`col,${r},${c}`));
      }
      return bad;
    }

    function cellViolations(r, c) {
      const out = [];
      const bad = dupCells();
      if (bad.has(`row,${r},${c}`)) out.push("row");
      if (bad.has(`col,${r},${c}`)) out.push("col");
      for (const con of byCell.get(`${r},${c}`) || []) {
        const a = grid[con.r1][con.c1], b = grid[con.r2][con.c2];
        if (a && b && !(a < b)) out.push(con);
      }
      return out;
    }

    function allConstraintsOk() {
      return constraints.every((con) => {
        const a = grid[con.r1][con.c1], b = grid[con.r2][con.c2];
        return !(a && b) || a < b;
      });
    }

    function render() {
      const bad = dupCells();
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const cellWrap = cellEls[r][c];
          cellWrap.className = "futo-cell" + (isGiven[r][c] ? " given" : "");
          if (sel && sel[0] === r && sel[1] === c) cellWrap.classList.add("sel");
          if (bad.has(`row,${r},${c}`)) cellWrap.classList.add("rowbad");
          if (bad.has(`col,${r},${c}`)) cellWrap.classList.add("colbad");
          cellWrap.innerHTML = "";
          if (grid[r][c]) {
            cellWrap.appendChild(el("b", null, String(grid[r][c])));
          } else if (pencil[r][c].size) {
            const p = el("div", "futo-pencil");
            for (let v = 1; v <= n; v++) {
              p.appendChild(el("span", pencil[r][c].has(v) ? "on" : "", String(v)));
            }
            cellWrap.appendChild(p);
          }
        }
      }
      // inequality sign violation highlight
      for (const con of constraints) {
        const a = grid[con.r1][con.c1], b = grid[con.r2][con.c2];
        const violated = a && b && !(a < b);
        const gap = con.r1 === con.r2 ? hGapEls[con.r1][Math.min(con.c1, con.c2)] : vGapEls[Math.min(con.r1, con.r2)][con.c1];
        if (gap && gap._sign) gap._sign.classList.toggle("bad", !!violated);
      }
    }

    function checkDone() {
      const full = grid.every((row) => row.every((v) => v));
      if (!full) return;
      if (!allConstraintsOk()) return;
      const bad = dupCells();
      if (bad.size) return;
      done();
    }

    render();

    function done() {
      root.innerHTML = "";
      const perfect = mistakes === 0 && hintsUsed === 0;

      root.appendChild(el("div", "reveal-badge " + (perfect ? "good" : hintsUsed ? "ok" : "bad"),
        `🔢 ${mistakes} mistake${mistakes === 1 ? "" : "s"} · ${hintsUsed} hint${hintsUsed === 1 ? "" : "s"}`));

      const statsGrid = el("div", "reveal-nums");
      statsGrid.append(
        el("div", null, `<span>Mistakes</span><b>${mistakes}</b>`),
        el("div", null, `<span>Hints used</span><b>${hintsUsed}/${maxHints}</b>`),
        el("div", null, `<span>Verdict</span><b>${perfect ? "Unaided" : "Assisted"}</b>`),
      );
      root.appendChild(statsGrid);

      const solvedGrid = el("div", "q-detail center",
        solution.map((row) => row.join(" ")).join("<br>"));
      root.appendChild(solvedGrid);

      const squares = "💡".repeat(hintsUsed) + "❌".repeat(Math.min(mistakes, 5)) + "✅";

      api.finish({
        headline: perfect
          ? "Solved cold — every chain traced, zero mistakes"
          : hintsUsed
            ? `Solved with ${hintsUsed} hint${hintsUsed === 1 ? "" : "s"}`
            : `Solved with ${mistakes} mistake${mistakes === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Mistakes", String(mistakes)],
          ["Hints used", `${hintsUsed}/${maxHints}`],
          ["Verdict", perfect ? "Cold solve" : "Assisted"],
        ],
        perfect,
        extra: [
          mistakes === 0 ? "✅ zero mistakes" : `❌ ${mistakes} mistake${mistakes === 1 ? "" : "s"}`,
          hintsUsed === 0 ? "💡 no hints" : `💡 ${hintsUsed} hint${hintsUsed === 1 ? "" : "s"} used`,
        ],
        notes: solveLog.map((step) =>
          `<b>R${step.r + 1}C${step.c + 1}</b> = ${step.v} — ${step.reason}`),
      });
    }
  },
};
