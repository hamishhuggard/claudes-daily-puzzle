import { el, rng } from "./shared.js";

/* Estimating correlation by eye. The clouds are generated from the seed in the
   data, so every player sees the same dots; the answer scored against is the
   *sample* r of those dots, not the r they were drawn from — you are judged on
   what was on the screen.

   Score: total absolute error across the six plots. */

const N_POINTS = 48;
const PAD = 20;

/* Reveals are keyed by what the round asked for, not by position, so the data
   can be reordered without the text following the wrong plot. */
const REVEALS = {
  "-0.85": `A strong negative relationship, and the easiest kind to read: when the
    cloud is a thin band running downhill, most people land within a tenth. Sign is
    almost never the thing people get wrong — magnitude is.`,
  "0.2": `Barely there. A weak positive correlation looks, to the eye, like nothing
    at all, and that is close to the right reaction — a correlation this small
    explains only a couple of percent of the variation. Calling it zero costs you
    almost nothing in truth, and a fraction of a point here.`,
  "0.55": `This is the one that catches people. A correlation of about a half is a
    serious relationship — it is what you find between height and weight in adults —
    and it still looks like a shapeless smear. Almost everyone guesses low here.`,
  "0.9": `Tight enough that you can imagine the line, which is exactly when the eye
    starts overshooting. A cloud like this gets called 0.95 or 0.99 far more often
    than it deserves; the scatter you can still see is doing real work.`,
  "-0.4": `A moderate negative. The drift downhill is visible but the cloud is wide,
    and the honest reading is somewhere in the middle — which is uncomfortable,
    because the eye prefers to call things either related or not.`,
  "0.75": `Strong, and the point where the eye starts to run ahead of the number.
    A cloud this tidy invites a guess in the nineties, but a quarter of the variation
    is still unaccounted for — that visible fuzz is not rounding error.`,
  "-0.15": `Essentially nothing, sloping very slightly downhill. Whatever structure
    you found in here — a clump, a gap, a diagonal streak — was pattern-matching on
    noise, which is what eyes are for and why plots need numbers attached.`,
  "0.45": `The awkward middle, and the honest answer is an awkward number. Anything
    in the high thirties to mid fifties is a good read; the common failure is to look
    at a smear like this and call it 0.2, because it doesn't <i>look</i> like a
    relationship yet.`,
  "-0.99": `Near-determinism, and worth seeing once so the merely strong plots stop
    getting mistaken for it. When the points sit on the line this tightly, you are
    usually looking at a definition or a measurement of the same thing twice, not a
    discovery.`,
  "0.3": `Weak but real. In a large enough sample this is a publishable, useful
    relationship, and it looks to the eye like a shapeless blob — which is the single
    most important calibration in this whole puzzle.`,
  "0.65": `Solidly strong, and the range most people compress: plots worth 0.55 and
    plots worth 0.75 tend to get the same guess, because the eye reads the width of
    the band and r is a claim about shared variance.`,
  "quad": `Here is the trap. The relationship in this plot is perfect — every point
    sits on a parabola — and the correlation is about zero, because r measures
    <b>linear</b> association and nothing else. This is the lesson of Anscombe's
    quartet: four datasets with the same r, the same means, the same regression
    line, and four completely different pictures.`,
};

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const d = puzzle.data;
    const rand = rng(d.seed);
    let idx = 0;
    const answers = [];

    /* Box–Muller. Guard the log against a zero draw. */
    function gauss() {
      const u1 = Math.max(rand(), 1e-9), u2 = rand();
      return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    }

    function pearson(pts) {
      const n = pts.length;
      const mx = pts.reduce((a, p) => a + p.x, 0) / n;
      const my = pts.reduce((a, p) => a + p.y, 0) / n;
      let sxy = 0, sxx = 0, syy = 0;
      for (const p of pts) {
        const dx = p.x - mx, dy = p.y - my;
        sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
      }
      return { r: sxy / Math.sqrt(sxx * syy), mx, my };
    }

    // Every cloud is built up front, in order, so the seed pins the whole set.
    const plots = d.rounds.map((rd) => {
      const pts = [];
      if (rd.kind === "quad") {
        // Mirrored pairs: the parabola has to be symmetric about its vertex,
        // or the sample r drifts away from zero and ruins the point of it.
        for (let i = 0; i < N_POINTS / 2; i++) {
          const m = 0.15 + 1.7 * rand();
          pts.push({ x: m, y: m * m - 1 + 0.09 * gauss() });
          pts.push({ x: -m, y: m * m - 1 + 0.09 * gauss() });
        }
      } else {
        for (let i = 0; i < N_POINTS; i++) {
          const x = gauss();
          pts.push({ x, y: rd.r * x + Math.sqrt(1 - rd.r * rd.r) * gauss() });
        }
      }
      const { r, mx, my } = pearson(pts);
      return { key: String(rd.kind || rd.r), pts, truth: r, mx, my };
    });

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    const fmt = (v) => (v < 0 ? "−" : v > 0 ? "+" : "") + Math.abs(v).toFixed(2);

    function grade(err) {
      if (err <= 0.05) return { sq: "🟩", word: "dead on", kind: "good" };
      if (err <= 0.15) return { sq: "🟨", word: "close", kind: "ok" };
      if (err <= 0.3) return { sq: "🟧", word: "off", kind: "ok" };
      return { sq: "🟥", word: "way off", kind: "bad" };
    }

    function svgFor(plot) {
      const xs = plot.pts.map((p) => p.x), ys = plot.pts.map((p) => p.y);
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      const y0 = Math.min(...ys), y1 = Math.max(...ys);
      const sx = (v) => PAD + ((v - x0) / (x1 - x0)) * (300 - 2 * PAD);
      const sy = (v) => 300 - PAD - ((v - y0) / (y1 - y0)) * (300 - 2 * PAD);

      // Colours come from the stylesheet, not from presentation attributes:
      // var() inside fill="" is not reliable everywhere.
      const dots = plot.pts.map((p) =>
        `<circle cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="3.4"/>`).join("");

      return `<svg viewBox="0 0 300 300" width="100%" role="img"
                   aria-label="Scatterplot of ${N_POINTS} points">
        <line x1="${sx(plot.mx).toFixed(1)}" y1="6" x2="${sx(plot.mx).toFixed(1)}" y2="294"/>
        <line x1="6" y1="${sy(plot.my).toFixed(1)}" x2="294" y2="${sy(plot.my).toFixed(1)}"/>
        ${dots}</svg>`;
    }

    function render() {
      const plot = plots[idx];
      wrap.innerHTML = "";

      wrap.appendChild(el("div", "pips", plots.map((_, i) =>
        `<i class="${i < idx ? "done" : i === idx ? "now" : ""}"></i>`).join("")));
      wrap.appendChild(el("p", "q-num", `Plot ${idx + 1} of ${plots.length}`));
      wrap.appendChild(el("div", "plot", svgFor(plot)));

      const readout = el("div", "readout");
      const val = el("b", null, "0.00");
      readout.append(val, el("span", "unit", "correlation"));
      wrap.appendChild(readout);

      const slider = el("input", "slider");
      slider.type = "range"; slider.min = "-100"; slider.max = "100"; slider.step = "5";
      // Park the handle where it isn't already the answer — zero is a free hit
      // on the flat rounds otherwise.
      slider.value = Math.abs(plot.truth) < 0.25 ? "60" : "0";
      slider.setAttribute("aria-label", "Your correlation estimate");
      const upd = () => { val.textContent = fmt(Number(slider.value) / 100); };
      slider.addEventListener("input", upd);
      wrap.append(slider, el("div", "scale",
        "<span>−1 · perfectly down</span><span>+1 · perfectly up</span>"));
      upd();

      const btn = el("button", "primary", "Lock it in");
      btn.onclick = () => {
        const guess = Number(slider.value) / 100;
        answers.push({ plot, guess, err: Math.abs(guess - plot.truth) });
        showReveal(answers[answers.length - 1]);
      };
      wrap.appendChild(btn);
    }

    function showReveal(a) {
      const g = grade(a.err);
      wrap.innerHTML = "";
      wrap.appendChild(el("div", "reveal-badge " + g.kind, `${g.sq} ${g.word}`));
      wrap.appendChild(el("div", "reveal-nums", `
        <div><span>You said</span><b>${fmt(a.guess)}</b></div>
        <div><span>Actually</span><b>${fmt(a.plot.truth)}</b></div>
        <div><span>Off by</span><b>${a.err.toFixed(2)}</b></div>`));
      wrap.appendChild(el("div", "plot", svgFor(a.plot)));
      wrap.appendChild(el("p", "reveal-text", REVEALS[a.plot.key]));

      const btn = el("button", "primary",
        idx === plots.length - 1 ? "See your score" : "Next plot");
      btn.onclick = () => { idx++; idx < plots.length ? render() : done(); };
      wrap.appendChild(btn);
    }

    function done() {
      const total = answers.reduce((a, x) => a + x.err, 0);
      const hits = answers.filter((x) => x.err <= 0.05).length;
      const worst = answers.reduce((a, x) => (x.err > a.err ? x : a), answers[0]);

      api.finish({
        headline: `${total.toFixed(2)} total error across six plots`,
        squares: answers.map((a) => grade(a.err).sq).join(""),
        stats: [
          ["Total error", total.toFixed(2)],
          ["Dead on", `${hits}/${answers.length}`],
          ["Worst miss", worst.err.toFixed(2)],
        ],
        perfect: hits === answers.length,
        extra: [
          `📉 ${total.toFixed(2)} total error, ${hits}/${answers.length} within 0.05`,
        ],
        notes: answers.map((a) =>
          `${grade(a.err).sq} You said <b>${fmt(a.guess)}</b>, it was
           <b>${fmt(a.plot.truth)}</b>.`),
      });
    }

    render();
  },
};
