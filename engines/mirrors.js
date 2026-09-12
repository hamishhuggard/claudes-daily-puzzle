import { el } from "./shared.js";
import { check, par } from "./mirrors-rules.js";

export default {
  usesTimer: true,
  mount(root, puzzle, api) {
    const rounds = puzzle.data.rounds;
    let ri = 0, placement = {}, moves = 0;
    const wrap = el("div", "stack"); root.appendChild(wrap);
    function render() {
      const rd = rounds[ri], s = rd.spec; wrap.innerHTML = "";
      const title = el("p", "q-detail center");
      title.innerHTML = `Round ${ri + 1} of ${rounds.length}: enter at <b>${s.entry}</b>, leave at <b>${s.target}</b>; use exactly ${s.budget.slash} “/” and ${s.budget.back} “\\” mirrors, with ${rd.crossN} self-crossing${rd.crossN === 1 ? "" : "s"}.`;
      wrap.appendChild(title);
      const board = el("div", "grid-board"); board.style.gridTemplateColumns = `repeat(${s.cols}, 2.5rem)`;
      for (let r = 0; r < s.rows; r++) for (let c = 0; c < s.cols; c++) {
        const b = el("button", "grid-cell"); const k = `${r},${c}`;
        b.textContent = placement[k] || (s.grid[r][c] === "#" ? "·" : "");
        b.disabled = s.grid[r][c] === "#";
        if (s.grid[r][c] === "#") b.classList.add("given");
        b.onclick = () => { moves++; placement[k] = placement[k] === undefined ? "/" : placement[k] === "/" ? "\\" : placement[k] === "\\" ? "" : "/"; if (!placement[k]) delete placement[k]; render(); };
        board.appendChild(b);
      }
      wrap.appendChild(board);
      const info = el("p", "q-detail center"); info.textContent = `Mirrors placed: ${Object.keys(placement).length}. “/” ${Object.values(placement).filter(v => v === "/").length}/${s.budget.slash}; “\\” ${Object.values(placement).filter(v => v === "\\").length}/${s.budget.back}.`;
      wrap.appendChild(info);
      const bar = el("div", "fairy-bar grid-bar");
      const submit = el("button", "primary compact", ri + 1 === rounds.length ? "Check route" : "Check round");
      submit.onclick = () => { const out = check(s, placement, rd.crossN); if (!out.ok) { info.textContent = out.why; info.classList.add("error"); return; } if (ri + 1 < rounds.length) { ri++; placement = {}; render(); return; } const totalPar = rounds.reduce((a, x) => a + par(x.spec, x.crossN), 0); api.finish({ headline: moves === totalPar ? "Every bend on par" : "Route found", squares: rounds.map(() => "🟩").join(""), stats: [["Rounds", `${rounds.length}/${rounds.length}`], ["Mirror taps", String(moves)], ["Par", String(totalPar)]], perfect: moves === totalPar }); };
      const clear = el("button", "ghost compact", "Clear"); clear.onclick = () => { placement = {}; render(); };
      bar.append(submit, clear); wrap.appendChild(bar);
    }
    render();
  }
};
