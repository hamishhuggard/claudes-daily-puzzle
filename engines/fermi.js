import { el, bigNum } from "./shared.js";

/* Five estimates on a log slider. Score: total log-error, lower is better. */
export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const qs = puzzle.data.questions;
    let idx = 0;
    const errors = [];

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function grade(err) {
      // err is |log10(guess) - log10(answer)|
      if (err < 0.301) return { sq: "🟩", word: "within 2×", kind: "good" };
      if (err < 0.7) return { sq: "🟨", word: "within 5×", kind: "ok" };
      if (err < 1.3) return { sq: "🟧", word: "within 20×", kind: "ok" };
      return { sq: "🟥", word: "way off", kind: "bad" };
    }

    function render() {
      const q = qs[idx];
      wrap.innerHTML = "";

      wrap.appendChild(el("div", "pips", qs.map((_, i) =>
        `<i class="${i < idx ? "done" : i === idx ? "now" : ""}"></i>`).join("")));

      wrap.appendChild(el("p", "q-num", `Estimate ${idx + 1} of ${qs.length}`));
      wrap.appendChild(el("h2", "q-text", q.q));
      if (q.detail) wrap.appendChild(el("p", "q-detail", q.detail));

      const readout = el("div", "readout");
      const val = el("b", null, "—");
      const unit = el("span", "unit", q.unit);
      readout.append(val, unit);
      wrap.appendChild(readout);

      const lo = Math.log10(q.min), hi = Math.log10(q.max);
      const slider = el("input", "slider");
      slider.type = "range";
      slider.min = "0"; slider.max = "1000"; slider.step = "1";
      // Start well away from the answer so the midpoint is never a free hit.
      const answerPos = ((Math.log10(q.answer) - lo) / (hi - lo)) * 1000;
      slider.value = String(answerPos > 500 ? 300 : 700);
      slider.setAttribute("aria-label", "Your estimate");

      const scale = el("div", "scale",
        `<span>${bigNum(q.min)}</span><span>${bigNum(q.max)}</span>`);

      const guessOf = () => Math.pow(10, lo + (slider.value / 1000) * (hi - lo));
      const update = () => { val.textContent = bigNum(guessOf()); };
      slider.addEventListener("input", update);
      update();

      wrap.append(slider, scale);

      const btn = el("button", "primary", "Lock it in");
      btn.onclick = () => {
        const guess = guessOf();
        const err = Math.abs(Math.log10(guess) - Math.log10(q.answer));
        errors.push(err);
        showReveal(q, guess, err);
      };
      wrap.appendChild(btn);
    }

    function showReveal(q, guess, err) {
      const g = grade(err);
      wrap.innerHTML = "";
      wrap.appendChild(el("div", "reveal-badge " + g.kind, `${g.sq} ${g.word}`));
      wrap.appendChild(el("div", "reveal-nums", `
        <div><span>You said</span><b>${bigNum(guess)}</b></div>
        <div><span>Actually</span><b>${bigNum(q.answer)}</b></div>`));
      wrap.appendChild(el("p", "reveal-text", q.reveal));

      const btn = el("button", "primary", idx === qs.length - 1 ? "See your score" : "Next estimate");
      btn.onclick = () => {
        idx++;
        if (idx < qs.length) render();
        else done();
      };
      wrap.appendChild(btn);
    }

    function done() {
      const total = errors.reduce((a, b) => a + b, 0);
      const avg = total / errors.length;
      const hits = errors.filter((e) => e < 0.301).length;
      api.finish({
        headline: total.toFixed(2) + " total error",
        squares: errors.map((e) => grade(e).sq).join(""),
        stats: [
          ["Total error", total.toFixed(2)],
          ["Within 2×", `${hits}/${errors.length}`],
          ["Typical miss", `${Math.pow(10, avg).toFixed(1)}×`],
        ],
        perfect: hits === errors.length,
        extra: [`🎯 ${hits}/${errors.length} within a factor of two`],
      });
    }

    render();
  },
};
