import { el } from "./shared.js";

/* Posterior estimation. You're given a base rate and a piece of evidence, and
   asked for the probability afterwards. Score: total absolute error in
   percentage points, lower is better.

   Unlike the calibration engine, there is a single correct number here and it
   is computable — so the reveal shows the arithmetic rather than a citation. */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const qs = puzzle.data.scenarios;
    let idx = 0;
    const rounds = [];

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function grade(err) {
      if (err <= 4) return { sq: "🟩", word: "spot on", kind: "good" };
      if (err <= 10) return { sq: "🟨", word: "close", kind: "ok" };
      if (err <= 25) return { sq: "🟧", word: "off", kind: "ok" };
      return { sq: "🟥", word: "way off", kind: "bad" };
    }

    const pct = (p) => (p < 0.01 ? p * 100 < 0.5 ? "0.1%" : (p * 100).toFixed(1) + "%"
                                : Math.round(p * 100) + "%");

    function render() {
      const q = qs[idx];
      wrap.innerHTML = "";

      wrap.appendChild(el("div", "pips", qs.map((_, i) =>
        `<i class="${i < idx ? "done" : i === idx ? "now" : ""}"></i>`).join("")));
      wrap.appendChild(el("p", "q-num", `Scenario ${idx + 1} of ${qs.length}`));
      wrap.appendChild(el("h2", "q-text", q.q));

      const facts = el("div", "facts");
      q.facts.forEach((f) => facts.appendChild(el("div", "fact", f)));
      wrap.appendChild(facts);

      wrap.appendChild(el("p", "q-detail center", q.ask));

      const readout = el("div", "readout");
      const val = el("b", null, "—");
      readout.append(val, el("span", "unit", "probability"));
      wrap.appendChild(readout);

      const slider = el("input", "slider");
      slider.type = "range"; slider.min = "0"; slider.max = "100"; slider.step = "1";
      // Park the handle away from the answer so the default is never free.
      slider.value = q.answer > 0.5 ? "25" : "75";
      slider.setAttribute("aria-label", "Your probability");
      const upd = () => { val.textContent = slider.value + "%"; };
      slider.addEventListener("input", upd);
      wrap.append(slider, el("div", "scale", "<span>Impossible</span><span>Certain</span>"));

      const btn = el("button", "primary", "Lock it in");
      btn.onclick = () => {
        const guess = Number(slider.value) / 100;
        const err = Math.abs(guess - q.answer) * 100;
        rounds.push({ q, guess, err });
        showReveal(rounds[rounds.length - 1]);
      };
      wrap.appendChild(btn);
      upd();
    }

    function showReveal(r) {
      const g = grade(r.err);
      wrap.innerHTML = "";
      wrap.appendChild(el("div", "reveal-badge " + g.kind, `${g.sq} ${g.word}`));
      wrap.appendChild(el("div", "reveal-nums", `
        <div><span>You said</span><b>${Math.round(r.guess * 100)}%</b></div>
        <div><span>Actually</span><b>${pct(r.q.answer)}</b></div>`));
      wrap.appendChild(el("div", "working", r.q.working));
      wrap.appendChild(el("p", "reveal-text", r.q.reveal));

      const btn = el("button", "primary",
        idx === qs.length - 1 ? "See your score" : "Next scenario");
      btn.onclick = () => { idx++; idx < qs.length ? render() : done(); };
      wrap.appendChild(btn);
    }

    function done() {
      const total = rounds.reduce((a, r) => a + r.err, 0);
      const avg = total / rounds.length;
      const hits = rounds.filter((r) => r.err <= 4).length;
      // Answering above the truth is the signature error here: it's what
      // ignoring the base rate does to you.
      const high = rounds.filter((r) => r.guess - r.q.answer > 0.1).length;

      api.finish({
        headline: `${avg.toFixed(1)} points off, on average`,
        squares: rounds.map((r) => grade(r.err).sq).join(""),
        stats: [
          ["Average miss", `${avg.toFixed(1)} pts`],
          ["Spot on", `${hits}/${rounds.length}`],
          ["Overshot", `${high}/${rounds.length}`],
        ],
        perfect: hits === rounds.length,
        extra: [
          `🎯 ${hits}/${rounds.length} within 4 points`,
          high > rounds.length / 2 ? `📈 overshot ${high} of ${rounds.length} — the base rate got away`
                                   : `⚖️ base rates respected`,
        ],
        notes: rounds.map((r) =>
          `${grade(r.err).sq} You said <b>${Math.round(r.guess * 100)}%</b>, it's
           <b>${pct(r.q.answer)}</b>. ${r.q.reveal}`),
      });
    }

    render();
  },
};
