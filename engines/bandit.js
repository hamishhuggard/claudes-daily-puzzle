import { el } from "./shared.js";

/* Three Machines — explore vs exploit. Each machine's payouts are a fixed,
   pre-baked sequence (puzzle.data), consumed in order as the player pulls it.
   No live randomness: machine A's 7th pull is the same for every player in
   the world, so share cards are comparable and a screenshot of round two
   means the same thing to everyone who sees it.

   Two rounds, two different days: round one has a machine that separates
   itself from the pack within a handful of pulls; round two has two machines
   close enough that forty pulls genuinely cannot tell them apart. Scoring is
   against two yardsticks — the oracle (every pull on whichever machine truly
   paid best) and the best-fixed-arm baseline — reported as regret, plus how
   many pulls went to the losing machines: the price of finding out. */

const LETTERS = ["A", "B", "C"];
const BUDGET = 40;

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const rounds = puzzle.data.rounds; // [{label, machines: {A:[...40 nums]}}, ...]
    let ri = 0;
    const roundResults = [];

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function sparkline(vals) {
      if (!vals.length) return "";
      const max = Math.max(...vals, 1);
      return `<span class="bandit-spark">${vals.map((v) =>
        `<i style="height:${4 + Math.round((v / max) * 14)}px"></i>`).join("")}</span>`;
    }

    function grade(regretPct) {
      // regretPct: how far below the best-fixed-arm total, as a fraction.
      if (regretPct <= 0.02) return { sq: "🟩", word: "essentially optimal", kind: "good" };
      if (regretPct <= 0.1) return { sq: "🟨", word: "close", kind: "ok" };
      if (regretPct <= 0.25) return { sq: "🟧", word: "costly", kind: "ok" };
      return { sq: "🟥", word: "expensive lesson", kind: "bad" };
    }

    function newRoundState(r) {
      const idx = { A: 0, B: 0, C: 0 };
      const history = { A: [], B: [], C: [] };
      return { r, idx, history, pulls: 0, total: 0 };
    }

    function renderRound(state) {
      wrap.innerHTML = "";
      const remaining = BUDGET - state.pulls;

      wrap.appendChild(el("p", "q-num", `Round ${ri + 1} of ${rounds.length} — ${state.r.label}`));
      wrap.appendChild(el("div", "pips", Array.from({ length: BUDGET }, (_, i) =>
        `<i class="${i < state.pulls ? "done" : i === state.pulls ? "now" : ""}"></i>`).join("")));

      const readout = el("div", "readout");
      readout.append(el("b", null, String(state.total)), el("span", "unit", "total credits"));
      wrap.appendChild(readout);
      wrap.appendChild(el("p", "q-detail center",
        `${remaining} of ${BUDGET} pulls left`));

      const grid = el("div", "bandit-grid");
      LETTERS.forEach((L) => {
        const n = state.idx[L];
        const hist = state.history[L];
        const mean = n ? (hist.reduce((a, b) => a + b, 0) / n) : null;
        const card = el("div", "bandit-card");
        card.appendChild(el("div", "bandit-name", `Machine ${L}`));
        card.appendChild(el("div", "bandit-stat",
          n ? `<b>${mean.toFixed(2)}</b><span>avg over ${n} pull${n === 1 ? "" : "s"}</span>`
            : `<b>—</b><span>never pulled</span>`));
        card.appendChild(el("div", "bandit-spark-wrap", sparkline(hist.slice(-20))));
        const btn = el("button", "primary bandit-pull", "Pull");
        btn.disabled = remaining <= 0;
        btn.onclick = () => pull(state, L);
        card.appendChild(btn);
        grid.appendChild(card);
      });
      wrap.appendChild(grid);

      if (remaining <= 0) {
        const btn = el("button", "primary", "See what happened");
        btn.onclick = () => revealRound(state);
        wrap.appendChild(btn);
      }
    }

    function pull(state, L) {
      const seq = state.r.machines[L];
      const v = seq[state.idx[L]];
      state.idx[L]++;
      state.history[L].push(v);
      state.pulls++;
      state.total += v;
      renderRound(state);
    }

    function revealRound(state) {
      const totals = {};
      LETTERS.forEach((L) => {
        totals[L] = state.r.machines[L].reduce((a, b) => a + b, 0);
      });
      const trueRates = {};
      LETTERS.forEach((L) => { trueRates[L] = totals[L] / BUDGET; });
      const bestArm = LETTERS.reduce((a, b) => (totals[b] > totals[a] ? b : a));
      const oracleTotal = totals[bestArm];
      const regret = oracleTotal - state.total;
      const regretPct = oracleTotal > 0 ? Math.max(0, regret) / oracleTotal : 0;

      const pullsOnLosers = LETTERS.filter((L) => L !== bestArm)
        .reduce((a, L) => a + state.idx[L], 0);

      const g = grade(regretPct);
      const result = { r: state.r, state, totals, trueRates, bestArm, oracleTotal, regret, regretPct, pullsOnLosers, g };
      roundResults.push(result);

      wrap.innerHTML = "";
      wrap.appendChild(el("div", "reveal-badge " + g.kind, `${g.sq} ${g.word}`));
      wrap.appendChild(el("div", "reveal-nums", `
        <div><span>You earned</span><b>${state.total}</b></div>
        <div><span>Oracle (all on best)</span><b>${oracleTotal}</b></div>
        <div><span>Regret</span><b>${Math.max(0, regret)}</b></div>`));

      const rateRow = el("div", "bandit-rates");
      LETTERS.forEach((L) => {
        const cls = "bandit-rate" + (L === bestArm ? " best" : "");
        rateRow.appendChild(el("div", cls,
          `<small>Machine ${L}</small><b>${trueRates[L].toFixed(2)}</b>
           <span>${state.idx[L]} pull${state.idx[L] === 1 ? "" : "s"}</span>`));
      });
      wrap.appendChild(rateRow);

      const verdict = regretPct <= 0.02
        ? `That's bad luck's ceiling — there was almost nothing left on the table. Machine
           ${bestArm} really was the best, at a true rate of ${trueRates[bestArm].toFixed(2)}
           per pull, and you found it and stayed.`
        : (pullsOnLosers / BUDGET) > 0.4
        ? `Most of the regret here is policy, not luck: ${pullsOnLosers} of your ${BUDGET}
           pulls went to machines other than the one that actually paid best — that's the
           price of information, and here it ran high.`
        : `The true rates were close enough (${LETTERS.map((L) => trueRates[L].toFixed(2)).join(" / ")})
           that forty pulls per machine can't fully separate them — some of this regret is
           bad luck a perfect policy couldn't have avoided, not a bad decision.`;
      wrap.appendChild(el("p", "reveal-text", verdict));

      const btn = el("button", "primary",
        ri === rounds.length - 1 ? "See your score" : "Next round");
      btn.onclick = () => {
        ri++;
        if (ri < rounds.length) renderRound(newRoundState(rounds[ri]));
        else done();
      };
      wrap.appendChild(btn);
    }

    function done() {
      const totalEarned = roundResults.reduce((a, r) => a + r.state.total, 0);
      const totalOracle = roundResults.reduce((a, r) => a + r.oracleTotal, 0);
      const totalRegret = roundResults.reduce((a, r) => a + Math.max(0, r.regret), 0);
      const totalLoserPulls = roundResults.reduce((a, r) => a + r.pullsOnLosers, 0);
      const avgRegretPct = totalOracle > 0 ? totalRegret / totalOracle : 0;

      api.finish({
        headline: `${totalEarned} credits earned, ${totalRegret} of regret against the oracle`,
        squares: roundResults.map((r) => r.g.sq).join(""),
        stats: [
          ["Total earned", String(totalEarned)],
          ["Oracle total", String(totalOracle)],
          ["Total regret", String(totalRegret)],
          ["Pulls on losers", `${totalLoserPulls}/${roundResults.length * BUDGET}`],
        ],
        perfect: avgRegretPct <= 0.02,
        extra: [
          `🎰 ${totalEarned} credits, ${totalRegret} regret across ${roundResults.length} rounds`,
          totalLoserPulls / (roundResults.length * BUDGET) <= 0.2
            ? "🎯 found the best machine early and mostly stuck with it"
            : "🔎 spent a lot of pulls exploring",
        ],
        notes: roundResults.map((r) =>
          `${r.g.sq} <b>${r.r.label}</b> — earned ${r.state.total} of a possible ${r.oracleTotal}
           (true rates ${LETTERS.map((L) => `${L}: ${r.trueRates[L].toFixed(2)}`).join(", ")}),
           ${r.pullsOnLosers} pulls spent on the losing machines.`),
      });
    }

    renderRound(newRoundState(rounds[ri]));
  },
};
