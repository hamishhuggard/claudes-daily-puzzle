import { el } from "./shared.js";
import { flip, isSolved, distanceMap, par, bestFlip } from "./flip-rules.js";

/* ============================================================================
   FLIP — "burnt side down"
   ----------------------------------------------------------------------------
   Sort the stack smallest-on-top by sliding a spatula in and turning over
   everything above it. One side of every piece is burnt, a flip turns each
   piece it lifts over, and the stack is only done when it is both in order and
   showing no burnt side at all.

   Without the burning there is a greedy method that never needs thought:
   biggest piece to the top, then flip it down to the bottom, twice per piece.
   Burning it breaks that, because a flip that fixes the order can spoil the
   facing of everything it touched — order and facing have to come right
   together.

   Par is the true minimum, from a breadth-first sweep of the whole position
   space in flip-rules.js.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const rounds = puzzle.data.rounds.map((r) => {
      const dist = distanceMap(r.stack.length);
      return { start: r.stack.slice(), dist, par: par(r.stack, dist) };
    });

    let ri = 0;
    let stack = rounds[0].start.slice();
    let flips = 0, hints = 0, message = "";
    const results = [];

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    const round = () => rounds[ri];
    const allDone = () => results.length === rounds.length;

    function doFlip(k) {
      if (allDone()) return;
      stack = flip(stack, k);
      flips++;
      message = "";
      if (isSolved(stack)) finishRound();
      else render();
    }

    function finishRound() {
      results.push({ par: round().par, flips, hints, n: round().start.length });
      if (ri === rounds.length - 1) { render(); return; }
      ri++;
      stack = rounds[ri].start.slice();
      /* Both counters are per round; the totals are summed back out of
         `results`. Leaving hints running here made round two report round
         one's hints a second time. */
      flips = 0;
      hints = 0;
      message = "";
      render();
    }

    function hint() {
      const k = bestFlip(stack, round().dist);
      if (k == null) return;
      hints++;
      message = `Hint: turn over the top ${k}.`;
      stack = flip(stack, k);
      flips++;
      if (isSolved(stack)) finishRound();
      else render();
    }

    function render() {
      wrap.innerHTML = "";
      const totalPar = rounds.reduce((a, r) => a + r.par, 0);
      const spent = results.reduce((a, r) => a + r.flips, 0) + (allDone() ? 0 : flips);
      const usedHints = results.reduce((a, r) => a + r.hints, 0) + (allDone() ? 0 : hints);

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Round</small><b>${Math.min(results.length + 1, rounds.length)}/${rounds.length}</b>`),
        el("div", "grid-score-cell", `<small>Flips</small><b>${spent}</b>`),
        el("div", "grid-score-cell", `<small>Par</small><b>${totalPar}</b>`),
      );
      wrap.appendChild(head);

      if (allDone()) {
        const msg = el("p", "q-detail center flp-msg",
          spent === totalPar
            ? "Both stacks sorted in the true minimum — order and facing together."
            : `Both stacks sorted in ${spent} flips against a par of ${totalPar}.`);
        wrap.appendChild(msg);
        const bar = el("div", "fairy-bar grid-bar");
        const b = el("button", "primary compact", "See your score");
        b.onclick = finish;
        bar.appendChild(b);
        wrap.appendChild(bar);
        return;
      }

      const board = el("div", "flp-stack");
      const n = stack.length;
      for (let i = 0; i < n; i++) {
        const v = stack[i];
        const size = Math.abs(v);
        const row = el("button", "flp-row" + (v < 0 ? " burnt" : ""));
        row.style.setProperty("--w", `${28 + (size / n) * 72}%`);
        row.innerHTML = `<span class="flp-bar"><b>${size}</b></span>`;
        row.setAttribute("aria-label",
          `piece ${size}, burnt side ${v < 0 ? "up" : "down"}; `
          + `turn over the top ${i + 1}`);
        row.onclick = () => doFlip(i + 1);
        board.appendChild(row);
      }
      wrap.appendChild(board);

      const msg = el("p", "q-detail center flp-msg");
      msg.innerHTML = message
        || "Tap a piece to slide the spatula under it and turn that whole run over. "
           + "Finish with <b>1 on top</b> and <b>no burnt edge showing</b>.";
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      const h = el("button", "ghost compact", "Hint (costs you)");
      h.onclick = hint;
      const r = el("button", "ghost compact", "Restart this stack");
      r.disabled = flips === 0;
      r.onclick = () => { stack = round().start.slice(); message = "Back to the start."; render(); };
      bar.append(h, r);
      wrap.appendChild(bar);
    }

    function finish() {
      const totalPar = rounds.reduce((a, r) => a + r.par, 0);
      const spent = results.reduce((a, r) => a + r.flips, 0);
      const usedHints = results.reduce((a, r) => a + r.hints, 0);
      const over = spent - totalPar;

      const squares = results.map((r) =>
        r.flips === r.par ? "🟩" : r.flips <= r.par + 2 ? "🟨" : "🟧").join("")
        + (usedHints === 0 ? "🟩" : "🟨")
        + (over === 0 ? "🟩" : over <= 3 ? "🟨" : "🟧");

      api.finish({
        headline: over === 0
          ? `Both stacks at the minimum, ${spent} flips`
          : `${spent} flips against par ${totalPar}`,
        squares,
        stats: [
          ["Flips", String(spent)],
          ["Par", String(totalPar)],
          ["Hints", String(usedHints)],
        ],
        perfect: over === 0 && usedHints === 0,
        notes: results.map((r, i) =>
          `<b>Stack of ${r.n}</b><br>par ${r.par}, you took ${r.flips}`),
        extra: [
          over === 0 ? "🥞 the true minimum" : `➕ ${over} over par`,
          usedHints === 0 ? "🧠 unaided" : `💡 ${usedHints} hint${usedHints === 1 ? "" : "s"}`,
        ],
      });
    }

    render();
  },
};
