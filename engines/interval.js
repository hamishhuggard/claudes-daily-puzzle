import { el, bigNum } from "./shared.js";

/* Confidence intervals. You give a low and a high bound you're 90% sure
   contains the answer. Score: how many you caught (target is most of them),
   with the width of your ranges as the honest tiebreak — catching everything
   by answering "somewhere between zero and infinity" is not calibration. */

/* bigNum rounds to integers, which turns 2 metres into "2" and 0.5 into "1".
   Intervals need the small end to survive. */
const fmt = (v) => {
  if (v >= 1000) return bigNum(v);
  if (v >= 10) return String(Math.round(v));
  if (v >= 1) return v.toFixed(1);
  if (v >= 0.01) return v.toFixed(2);
  return v.toPrecision(1);
};

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const qs = puzzle.data.questions;
    const CONF = puzzle.data.confidence || 90;
    let idx = 0;
    const rounds = [];

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function render() {
      const q = qs[idx];
      wrap.innerHTML = "";

      wrap.appendChild(el("div", "pips", qs.map((_, i) =>
        `<i class="${i < idx ? "done" : i === idx ? "now" : ""}"></i>`).join("")));

      wrap.appendChild(el("p", "q-num", `Range ${idx + 1} of ${qs.length}`));
      wrap.appendChild(el("h2", "q-text", q.q));
      wrap.appendChild(el("p", "q-detail",
        q.detail ? `${q.detail} Set a range you're ${CONF}% sure contains the answer.`
                 : `Set a range you're ${CONF}% sure contains the answer.`));

      const lo = Math.log10(q.min), hi = Math.log10(q.max);
      const at = (pos) => Math.pow(10, lo + (pos / 1000) * (hi - lo));

      const band = el("div", "band");
      const fill = el("i");
      band.appendChild(fill);

      const readout = el("div", "readout");
      const val = el("b", null, "—");
      readout.append(val, el("span", "unit", q.unit));

      /* Start the window off to one side of the true answer, so leaving the
         sliders alone is never a free catch. */
      const ansPos = ((Math.log10(q.answer) - lo) / (hi - lo)) * 1000;
      const start = ansPos > 500 ? [120, 320] : [680, 880];

      const mk = (label, value) => {
        const s = el("input", "slider");
        s.type = "range"; s.min = "0"; s.max = "1000"; s.step = "1";
        s.value = String(value);
        s.setAttribute("aria-label", label);
        return s;
      };
      const loS = mk("Low end of your range", start[0]);
      const hiS = mk("High end of your range", start[1]);

      const update = (leader) => {
        // The bounds may touch but never cross.
        if (Number(loS.value) > Number(hiS.value)) {
          if (leader === "lo") hiS.value = loS.value; else loS.value = hiS.value;
        }
        const a = at(Number(loS.value)), b = at(Number(hiS.value));
        val.innerHTML = `${fmt(a)} <span class="dash">to</span> ${fmt(b)}`;
        fill.style.left = Number(loS.value) / 10 + "%";
        fill.style.right = (1000 - Number(hiS.value)) / 10 + "%";
      };
      loS.addEventListener("input", () => update("lo"));
      hiS.addEventListener("input", () => update("hi"));

      wrap.append(readout, band);
      wrap.append(el("div", "bound-label", "<span>Low end</span>"), loS);
      wrap.append(el("div", "bound-label", "<span>High end</span>"), hiS);
      wrap.appendChild(el("div", "scale", `<span>${fmt(q.min)}</span><span>${fmt(q.max)}</span>`));

      const btn = el("button", "primary", "Lock it in");
      btn.onclick = () => {
        const a = at(Number(loS.value)), b = at(Number(hiS.value));
        rounds.push({ q, lo: a, hi: b, caught: q.answer >= a && q.answer <= b,
                      width: Math.log10(b / a) });
        showReveal(rounds[rounds.length - 1]);
      };
      wrap.appendChild(btn);
      update("lo");
    }

    function showReveal(r) {
      wrap.innerHTML = "";
      wrap.appendChild(el("div", "reveal-badge " + (r.caught ? "good" : "bad"),
        r.caught ? "🟩 caught it" : "🟥 outside your range"));
      wrap.appendChild(el("div", "reveal-nums", `
        <div><span>Your range</span><b>${fmt(r.lo)} – ${fmt(r.hi)}</b></div>
        <div><span>Actually</span><b>${fmt(r.q.answer)}</b></div>`));
      wrap.appendChild(el("p", "reveal-text", r.q.reveal));

      const btn = el("button", "primary",
        idx === qs.length - 1 ? "See your score" : "Next range");
      btn.onclick = () => { idx++; idx < qs.length ? render() : done(); };
      wrap.appendChild(btn);
    }

    function done() {
      const caught = rounds.filter((r) => r.caught).length;
      const target = Math.round((CONF / 100) * qs.length);
      const avgW = rounds.reduce((a, r) => a + r.width, 0) / rounds.length;
      const spread = Math.pow(10, avgW);
      const tight = avgW <= 1.2;

      const verdict =
        caught < target - 1 ? "Overconfident"
        : caught >= qs.length && !tight ? "Playing it safe"
        : tight ? "Well calibrated" : "Honest but roomy";

      api.finish({
        headline: `${caught}/${qs.length} caught`,
        squares: rounds.map((r) => (r.caught ? "🟩" : "🟥")).join(""),
        stats: [
          ["Caught", `${caught}/${qs.length}`],
          [`Aiming for ${CONF}%`, `${target}/${qs.length}`],
          ["Typical range", `${spread < 10 ? spread.toFixed(1) : Math.round(spread)}× wide`],
          ["Verdict", verdict],
        ],
        perfect: caught >= target && tight,
        extra: [
          `📏 typical range ${spread < 10 ? spread.toFixed(1) : Math.round(spread)}× wide`,
          `⚖️ ${verdict.toLowerCase()}`,
        ],
        notes: rounds.map((r) =>
          `${r.caught ? "🟩" : "🟥"} You said <b>${fmt(r.lo)}–${fmt(r.hi)}</b>. ${r.q.reveal}`),
      });
    }

    render();
  },
};
