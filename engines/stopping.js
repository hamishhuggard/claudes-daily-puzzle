import { el } from "./shared.js";

/* Optimal stopping. Offers arrive one at a time and a pass is final, so the
   only real decision is when to stop looking. The sequences are fixed in the
   data rather than generated, so everyone faces the same three temptations.

   Score: capture ratio — what you took over the best that was available. */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const rounds = puzzle.data.rounds;
    let ri = 0, oi = 0;
    const results = [];

    const money = (n) => "$" + n.toLocaleString();

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function grade(ratio) {
      if (ratio >= 1) return { sq: "🟩", word: "the best offer", kind: "good" };
      if (ratio >= 0.9) return { sq: "🟨", word: "near the top", kind: "ok" };
      if (ratio >= 0.75) return { sq: "🟧", word: "left money behind", kind: "ok" };
      return { sq: "🟥", word: "stopped too soon", kind: "bad" };
    }

    function renderOffer() {
      const r = rounds[ri];
      wrap.innerHTML = "";

      wrap.appendChild(el("p", "q-num", `Round ${ri + 1} of 3 — ${r.label}`));
      wrap.appendChild(el("div", "pips", r.offers.map((_, i) =>
        `<i class="${i < oi ? "done" : i === oi ? "now" : ""}"></i>`).join("")));
      wrap.appendChild(el("p", "q-detail center", `Offer ${oi + 1} of ${r.offers.length}`));

      const readout = el("div", "readout");
      readout.append(el("b", null, money(r.offers[oi])), el("span", "unit", r.unit));
      wrap.appendChild(readout);

      // Past offers stay visible: this is a decision problem, not a memory test.
      const past = el("div", "seen-strip");
      for (let i = 0; i < oi; i++) past.appendChild(el("span", "seen", money(r.offers[i])));
      if (oi) wrap.appendChild(past);

      const take = el("button", "primary", "Take it");
      take.onclick = () => settle(oi, false);
      wrap.appendChild(take);

      const pass = el("button", "ghost wide-btn",
        oi === r.offers.length - 1 ? "Pass (nothing left to wait for)" : "Pass");
      pass.onclick = () => {
        if (oi === r.offers.length - 1) return settle(oi, true);
        oi++;
        renderOffer();
      };
      wrap.append(pass);
      wrap.appendChild(el("p", "q-detail center fine",
        "A pass is final. The offer does not come back."));
    }

    function settle(taken, forced) {
      const r = rounds[ri];
      const best = Math.max(...r.offers);
      results.push({ r, taken, forced, got: r.offers[taken], best, ratio: r.offers[taken] / best });
      renderReveal(results[results.length - 1]);
    }

    function renderReveal(res) {
      const g = grade(res.ratio);
      const bestAt = res.r.offers.indexOf(res.best);
      wrap.innerHTML = "";

      wrap.appendChild(el("div", "reveal-badge " + g.kind, `${g.sq} ${g.word}`));
      wrap.appendChild(el("div", "reveal-nums", `
        <div><span>You took</span><b>${money(res.got)}</b></div>
        <div><span>Best on offer</span><b>${money(res.best)}</b></div>
        <div><span>Captured</span><b>${Math.round(res.ratio * 100)}%</b></div>`));

      const strip = el("div", "offer-grid");
      res.r.offers.forEach((v, i) => {
        const cls = "offer" + (i === bestAt ? " best" : "") + (i === res.taken ? " mine" : "");
        strip.appendChild(el("span", cls, `<small>${i + 1}</small>${money(v)}`));
      });
      wrap.appendChild(strip);

      wrap.appendChild(el("p", "reveal-text", res.forced
        ? `You passed on all fifteen, so the last offer was yours by default — that is
           what "no backsies" costs when nothing ever looks good enough. The best offer
           of the round was ${money(res.best)}, at number ${bestAt + 1}.`
        : res.ratio >= 1
        ? `That was the best offer in the round, and you had no way of knowing it at
           the time. Stopping well and stopping luckily look identical from the inside.`
        : `The best offer was ${money(res.best)}, at number ${bestAt + 1} — ${
             bestAt < res.taken ? "already behind you when you stopped" : "still ahead of you"}.`));

      const btn = el("button", "primary",
        ri === rounds.length - 1 ? "See your score" : "Next round");
      btn.onclick = () => {
        ri++; oi = 0;
        ri < rounds.length ? renderOffer() : done();
      };
      wrap.appendChild(btn);
    }

    function done() {
      const avg = results.reduce((a, r) => a + r.ratio, 0) / results.length;
      const bests = results.filter((r) => r.ratio >= 1).length;
      const earliest = Math.min(...results.map((r) => r.taken)) + 1;

      api.finish({
        headline: `${Math.round(avg * 100)}% of what was on the table`,
        squares: results.map((r) => grade(r.ratio).sq).join(""),
        stats: [
          ["Average capture", `${Math.round(avg * 100)}%`],
          ["Best taken", `${bests}/${results.length}`],
          ["Earliest take", `offer ${earliest}`],
        ],
        perfect: bests === results.length,
        extra: [
          `🏷️ ${bests}/${results.length} rounds ended on the best offer`,
          earliest <= 4 ? "⚡ stopped early and lived with it" : "🕰️ held out",
        ],
        notes: results.map((r) =>
          `${grade(r.ratio).sq} <b>${r.r.label}</b> — took ${money(r.got)} at offer
           ${r.taken + 1}${r.forced ? " (forced)" : ""}; best was ${money(r.best)}.
           ${Math.round(r.ratio * 100)}% captured.`),
      });
    }

    renderOffer();
  },
};
