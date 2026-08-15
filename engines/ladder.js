import { el } from "./shared.js";
import { buildGraph, shortestDistance, nextStep, isLegalMove, diffPositions } from "./ladder-rules.js";

/* ============================================================================
   WORD LADDER
   ----------------------------------------------------------------------------
   Three rounds, each a start word and a target word of the same length. Every
   guess has to differ from the current word in exactly one letter and has to
   be in the puzzle's own word list — the list ships in the puzzle data, so
   the whole graph is knowable in advance, and par is the true shortest path
   through it, found by the same BFS in ladder-rules.js that grades a guess.

   Getting stuck is a real outcome, not a failure state: the "stuck" button
   hands over one valid next word from a shortest path and counts against you
   exactly like a wrong guess would on a different puzzle.
   ========================================================================== */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const rounds = puzzle.data.rounds;
    const wordSets = puzzle.data.words; // { "4": [...], "5": [...] }
    const graphs = {};
    for (const len of Object.keys(wordSets)) graphs[len] = buildGraph(wordSets[len]);

    let ri = 0;
    const results = [];

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function grade(moves, par, hints) {
      const over = moves - par;
      if (hints === 0 && over <= 0) return { sq: "🟩", word: "the shortest route", kind: "good" };
      if (over <= 0) return { sq: "💡", word: "shortest route, with a nudge", kind: "ok" };
      if (over <= 2) return { sq: "🟨", word: "close to par", kind: "ok" };
      return { sq: "🟥", word: "the scenic route", kind: "bad" };
    }

    function renderRound() {
      const r = rounds[ri];
      const len = String(r.start.length);
      const adj = graphs[len];
      const par = shortestDistance(adj, r.start, r.target);

      let chain = [r.start];
      let hints = 0;

      wrap.innerHTML = "";
      wrap.appendChild(el("p", "q-num", `Round ${ri + 1} of 3`));
      wrap.appendChild(el("p", "q-detail center",
        `Turn <b>${r.start.toUpperCase()}</b> into <b>${r.target.toUpperCase()}</b>, one letter at a time. ` +
        `Every stop along the way has to be a real word.`));

      const chainEl = el("div", "ladder-chain");
      const msg = el("p", "ladder-msg", "&nbsp;");
      const counter = el("div", "ladder-count", "");

      const inputRow = el("div", "ladder-input-row");
      const input = document.createElement("input");
      input.className = "ladder-input";
      input.maxLength = r.start.length;
      input.autocomplete = "off";
      input.autocapitalize = "off";
      input.spellcheck = false;
      input.placeholder = `${r.start.length}-letter word`;
      const go = el("button", "primary compact", "Climb");
      inputRow.append(input, go);

      const bar = el("div", "fairy-bar");
      const stuckBtn = el("button", "ghost compact", "Stuck? Show one step");
      bar.appendChild(stuckBtn);

      wrap.append(counter, chainEl, msg, inputRow, bar);

      function renderChain() {
        chainEl.innerHTML = "";
        chain.forEach((w, i) => {
          const cls = "ladder-chip" + (i === chain.length - 1 ? " now" : " done");
          chainEl.appendChild(el("span", cls, w.toUpperCase()));
        });
        chainEl.appendChild(el("span", "ladder-chip target", r.target.toUpperCase()));
        const moves = chain.length - 1;
        counter.textContent = `${moves} move${moves === 1 ? "" : "s"}${par ? ` · par ${par}` : ""}`;
      }

      function submit(guess) {
        guess = guess.trim().toLowerCase();
        const current = chain[chain.length - 1];
        if (guess.length !== current.length) {
          msg.textContent = `That's not ${current.length} letters.`;
          return;
        }
        if (guess === current) {
          msg.textContent = "That's the word you're already on.";
          return;
        }
        const diff = diffPositions(current, guess);
        if (diff > 1) {
          msg.textContent = `That changes ${diff} letters — only one is allowed.`;
          return;
        }
        if (!adj.has(guess)) {
          msg.textContent = "Not a word I know.";
          return;
        }
        if (!isLegalMove(adj, current, guess)) {
          msg.textContent = "That's a word, but not one letter away from here.";
          return;
        }
        msg.innerHTML = "&nbsp;";
        chain.push(guess);
        input.value = "";
        renderChain();
        if (guess === r.target) settle();
      }

      go.onclick = () => submit(input.value);
      input.onkeydown = (e) => { if (e.key === "Enter") submit(input.value); };

      stuckBtn.onclick = () => {
        const current = chain[chain.length - 1];
        const step = nextStep(adj, current, r.target);
        if (!step) { msg.textContent = "No route left from here — that shouldn't happen."; return; }
        hints++;
        chain.push(step);
        msg.innerHTML = `Stuck used — <b>${step.toUpperCase()}</b> is one step closer.`;
        renderChain();
        if (step === r.target) settle();
      };

      function settle() {
        const moves = chain.length - 1;
        results.push({ r, chain: chain.slice(), moves, par, hints });
        renderReveal(results[results.length - 1]);
      }

      renderChain();
      input.focus();
    }

    function renderReveal(res) {
      const g = grade(res.moves, res.par, res.hints);
      wrap.innerHTML = "";

      wrap.appendChild(el("div", "reveal-badge " + g.kind, `${g.sq} ${g.word}`));
      wrap.appendChild(el("div", "reveal-nums", `
        <div><span>Your moves</span><b>${res.moves}</b></div>
        <div><span>Par</span><b>${res.par}</b></div>
        <div><span>Stuck used</span><b>${res.hints}</b></div>`));

      const chainEl = el("div", "ladder-chain");
      res.chain.forEach((w) => chainEl.appendChild(el("span", "ladder-chip done", w.toUpperCase())));
      wrap.appendChild(chainEl);

      wrap.appendChild(el("p", "reveal-text",
        res.hints === 0 && res.moves === res.par
          ? `That's the shortest route through — ${res.par} letters changed, one at a time, and every stop
             a real word.`
          : res.hints > 0
          ? `You used "stuck" ${res.hints} time${res.hints === 1 ? "" : "s"}, so this run isn't a solo climb —
             but it still finished in ${res.moves}, against a par of ${res.par}.`
          : `You got there in ${res.moves} against a par of ${res.par} — the shortest route
             was there to find, just not the one you took.`));

      const btn = el("button", "primary", ri === rounds.length - 1 ? "See your score" : "Next round");
      btn.onclick = () => {
        ri++;
        ri < rounds.length ? renderRound() : done();
      };
      wrap.appendChild(btn);
    }

    function done() {
      const totalMoves = results.reduce((a, r) => a + r.moves, 0);
      const totalPar = results.reduce((a, r) => a + r.par, 0);
      const totalHints = results.reduce((a, r) => a + r.hints, 0);
      const clean = results.filter((r) => r.hints === 0 && r.moves === r.par).length;

      api.finish({
        headline: totalHints === 0 && totalMoves === totalPar
          ? `A clean climb — ${totalMoves} moves, every one of them necessary`
          : `${totalMoves} moves against a par of ${totalPar}`,
        squares: results.map((r) => grade(r.moves, r.par, r.hints).sq).join(""),
        stats: [
          ["Total moves", `${totalMoves} / ${totalPar} par`],
          ["Clean rounds", `${clean}/${results.length}`],
          ["Stuck used", String(totalHints)],
        ],
        perfect: clean === results.length,
        extra: [
          `🪜 ${totalMoves} rungs climbed across three ladders`,
          totalHints === 0 ? "🧗 no hints — every step found alone" : `💡 stuck used ${totalHints}×`,
        ],
        notes: results.map((r) =>
          `${grade(r.moves, r.par, r.hints).sq} <b>${r.r.start.toUpperCase()} → ${r.r.target.toUpperCase()}</b> —
           ${r.moves} moves (par ${r.par})${r.hints ? `, stuck used ${r.hints}×` : ""}.
           Route: ${r.chain.map((w) => w.toUpperCase()).join(" → ")}.`),
      });
    }

    renderRound();
  },
};
