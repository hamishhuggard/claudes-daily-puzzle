import { el } from "./shared.js";

/* Probability betting. Score: Brier, lower is better. */
export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const items = puzzle.data.statements;
    let idx = 0;
    const bets = [];

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function render() {
      const it = items[idx];
      wrap.innerHTML = "";
      wrap.appendChild(el("div", "pips", items.map((_, i) =>
        `<i class="${i < idx ? "done" : i === idx ? "now" : ""}"></i>`).join("")));
      wrap.appendChild(el("p", "q-num", `Claim ${idx + 1} of ${items.length}`));
      wrap.appendChild(el("h2", "q-text claim", `“${it.s}”`));

      const readout = el("div", "readout");
      const val = el("b", null, "50%");
      readout.append(val, el("span", "unit", "chance this is true"));
      wrap.appendChild(readout);

      const slider = el("input", "slider");
      slider.type = "range";
      slider.min = "1"; slider.max = "99"; slider.step = "1"; slider.value = "50";
      slider.setAttribute("aria-label", "Probability this claim is true");
      const scale = el("div", "scale", `<span>Certainly false</span><span>Certainly true</span>`);
      const upd = () => {
        val.textContent = slider.value + "%";
        val.className = slider.value > 60 ? "lean-t" : slider.value < 40 ? "lean-f" : "";
      };
      slider.addEventListener("input", upd);
      wrap.append(slider, scale);

      const btn = el("button", "primary", "Lock it in");
      btn.onclick = () => {
        bets.push({ p: Number(slider.value) / 100, it });
        idx++;
        if (idx < items.length) render();
        else done();
      };
      wrap.appendChild(btn);
      upd();
    }

    function sq(b) {
      const o = b.it.t ? 1 : 0;
      const e = Math.abs(b.p - o);
      if (e <= 0.15) return "🟩";   // confident and right
      if (e <= 0.4) return "🟨";    // leaned the right way
      if (e <= 0.6) return "⬜";    // basically a coin flip
      if (e <= 0.85) return "🟧";   // leaned wrong
      return "🟥";                  // confidently wrong
    }

    function done() {
      const brier = bets.reduce((a, b) => a + Math.pow(b.p - (b.it.t ? 1 : 0), 2), 0) / bets.length;
      const acc = bets.filter((b) => (b.p > 0.5) === b.it.t).length;
      const overconf = bets.filter((b) => Math.abs(b.p - (b.it.t ? 1 : 0)) > 0.85).length;

      api.finish({
        headline: `Brier ${brier.toFixed(3)}`,
        squares: bets.map(sq).join(""),
        stats: [
          ["Brier score", brier.toFixed(3)],
          ["Called right", `${acc}/${bets.length}`],
          ["Beat a coin flip?", brier < 0.25 ? "Yes" : "No"],
        ],
        perfect: brier < 0.05,
        extra: [
          `✅ ${acc}/${bets.length} called right`,
          overconf ? `🟥 ${overconf} confidently wrong` : `🛡️ nothing confidently wrong`,
        ],
        notes: bets.map((b) => {
          const o = b.it.t ? 1 : 0;
          return `${sq(b)} You said <b>${Math.round(b.p * 100)}%</b> true. ${b.it.why}`;
        }),
      });
    }

    render();
  },
};
