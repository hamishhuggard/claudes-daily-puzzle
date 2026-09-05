import { el } from "./shared.js";
import { canWin, bestMove, applyMove, isAllZero } from "./stones-rules.js";

/* ============================================================================
   STONES — "Last Stone"
   ----------------------------------------------------------------------------
   Three take-away games against a perfect opponent, each escalating what the
   last one taught:

     1. one heap, take 1-3, take the last stone and you win.
     2. the same shape, misère: take the last stone and you lose.
     3. several heaps, take any number from one, last stone wins again.

   The opponent is not scripted — it calls the same solver
   (stones-rules.js: canWin / bestMove) that the authoring tool used to
   check every starting heap is a first-player win, so it never hands a
   win back once it has one.

   Scoring: positions won on the first try, then total restarts (a restart
   is charged whenever the player's own move let the opponent force a loss
   and they play the position out to see it happen).
   ========================================================================== */

const HEAP_NAMES = ["A", "B", "C", "D"];

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const positions = puzzle.data.positions;
    let pi = 0;
    const results = positions.map(() => ({ restarts: 0, won: false }));

    let heaps, turn, over, selHeap, selCount, lost;

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    const pips = el("div", "pips");
    const rule = el("p", "q-detail center");
    const status = el("div", "fairy-status", "&nbsp;");
    const board = el("div", "stones-board");
    const bar = el("div", "fairy-bar stones-bar");

    function setup() {
      const p = positions[pi];
      heaps = p.heaps.slice();
      turn = "p";
      over = false;
      lost = false;
      selHeap = null;
      selCount = 0;
      say(p.opening || "Your move.");
    }

    const say = (html) => { status.innerHTML = html; };

    function heapLabel(h) {
      return heaps.length === 1 ? "the heap" : `heap ${HEAP_NAMES[h]}`;
    }

    function render() {
      wrap.innerHTML = "";
      const p = positions[pi];

      wrap.appendChild(el("p", "q-num", `Position ${pi + 1} of ${positions.length} — ${p.label}`));
      wrap.appendChild(el("div", "pips", positions.map((_, i) =>
        `<i class="${i < pi ? "done" : i === pi ? "now" : ""}"></i>`).join("")));
      wrap.appendChild(el("p", "q-detail center", p.rule));

      board.innerHTML = "";
      board.className = "stones-board";
      heaps.forEach((size, h) => {
        const row = el("div", "stones-row");
        if (heaps.length > 1) row.appendChild(el("span", "stones-heap-label", `Heap ${HEAP_NAMES[h]}`));
        const stones = el("div", "stones-stones");
        const cap = p.maxTake == null ? size : Math.min(p.maxTake, size);
        for (let j = 0; j < size; j++) {
          const count = size - j;
          const selectable = turn === "p" && !over && count <= cap;
          const isSel = selHeap === h && j >= size - selCount;
          const s = el("button", "stones-stone" +
            (isSel ? " sel" : "") + (!selectable ? " locked" : ""));
          s.disabled = !selectable;
          s.textContent = "●";
          s.onclick = () => pick(h, count);
          stones.appendChild(s);
        }
        row.appendChild(stones);
        row.appendChild(el("span", "stones-count", `${size}`));
        board.appendChild(row);
      });
      wrap.appendChild(board);
      wrap.appendChild(status);

      bar.innerHTML = "";
      if (turn === "p" && !over && selHeap != null) {
        const confirm = el("button", "primary compact",
          `Take ${selCount} from ${heapLabel(selHeap)}`);
        confirm.onclick = () => commit();
        const cancel = el("button", "ghost compact", "Cancel");
        cancel.onclick = () => { selHeap = null; selCount = 0; render(); };
        bar.append(confirm, cancel);
      } else if (over) {
        const btn = el("button", "primary",
          lost ? "Try this position again" : (pi === positions.length - 1 ? "See your score" : "Next position"));
        btn.onclick = () => {
          if (lost) { setup(); render(); return; }
          pi++;
          if (pi === positions.length) return done();
          setup(); render();
        };
        bar.appendChild(btn);
      }
      wrap.appendChild(bar);
    }

    function pick(h, count) {
      if (turn !== "p" || over) return;
      selHeap = selHeap === h && selCount === count ? null : h;
      selCount = selHeap === null ? 0 : count;
      render();
    }

    function commit() {
      const p = positions[pi];
      heaps = applyMove(heaps, { heap: selHeap, take: selCount });
      const took = selCount;
      selHeap = null; selCount = 0;
      if (isAllZero(heaps)) return resolve("p", p, took);
      turn = "o";
      render();
      // Opponent replies immediately — narrated, not animated, but always
      // the solver's own best move, so it is never a move it will regret.
      const mv = bestMove(heaps, p.variant, p.maxTake);
      const before = heaps[mv.heap];
      heaps = applyMove(heaps, mv);
      const oppLine = `The opponent takes ${mv.take} from ${heapLabel(mv.heap)} (${before} → ${heaps[mv.heap]}).`;
      if (isAllZero(heaps)) { resolve("o", p, mv.take, oppLine); return; }
      turn = "p";
      say(oppLine + " Your move.");
      render();
    }

    function resolve(takenBy, p, took, oppLine) {
      over = true;
      const playerWins = (takenBy === "p") === (p.variant === "normal");
      lost = !playerWins;
      if (lost) results[pi].restarts++;
      else if (results[pi].restarts === 0) results[pi].won = true;
      else results[pi].won = false; // won, but not on the first try — still counted below

      const who = takenBy === "p" ? "You take" : "The opponent takes";
      const consequence = playerWins
        ? "That's the last stone, and by this rule that's a win."
        : "That's the last stone, and by this rule that's a loss.";
      say((oppLine ? oppLine + " " : "") + `${who} the last stone${took > 1 ? ` (${took})` : ""}. ${consequence}`);
      render();
    }

    function done() {
      const won = results.filter((r) => r.restarts === 0).length;
      const restarts = results.reduce((a, r) => a + r.restarts, 0);
      const squares = results.map((r) => r.restarts === 0 ? "🟩" : "🟧").join("");

      api.finish({
        headline: restarts === 0
          ? "Three for three, first try"
          : `Three won, ${restarts} restart${restarts === 1 ? "" : "s"} along the way`,
        squares,
        stats: [
          ["Positions won", `${positions.length}/${positions.length}`],
          ["Won first try", `${won}/${positions.length}`],
          ["Restarts", String(restarts)],
        ],
        perfect: restarts === 0,
        extra: [
          restarts === 0 ? "🎯 never handed the opponent a win" : "🔁 the opponent punished at least one slip",
        ],
      });
    }

    setup();
    render();
  },
};
