import { el } from "./shared.js";
import { neighbours, countAt, fullySolvable, UNKNOWN, SAFE, MINE } from "./sweep-rules.js";

/* ============================================================================
   SWEEP — "safe squares"
   ----------------------------------------------------------------------------
   Minesweeper with the one thing minesweeper never promises: this board can be
   finished by reasoning alone. There is no point in it where the only way
   forward is a coin flip.

   That is a checked claim, not a hopeful one. On mount the engine replays the
   board using nothing but forced moves (sweep-rules.js: fullySolvable) and
   refuses to start if that isn't enough to clear it. The same check ran before
   the board was ever packed. Sixteen of the squares here cannot be got by the
   two rules everyone knows — "this number is satisfied, so the rest are safe"
   and "this number equals its unknowns, so they're all mines" — and need you
   to compare two numbers against each other instead.

   Digging a mine is not sudden death, because a puzzle you can only fail is a
   bad daily. The mine is flagged for you and the run continues; the mistakes
   are the score.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const { h, w, mines: mineList, opening } = puzzle.data;
    const mines = new Set(mineList);
    const total = mines.size;

    // The promise, re-checked here rather than trusted from the blob.
    const check = fullySolvable(mines, [opening], h, w);
    if (!check.solved) throw new Error("sweep: board needs a guess");
    const numbers = check.numbers;

    const state = new Array(h * w).fill(UNKNOWN);
    let flagMode = false, mistakes = 0, over = false;
    const flags = new Set();

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function reveal(r, c) {
      const i = r * w + c;
      if (state[i] !== UNKNOWN || flags.has(i)) return;
      state[i] = SAFE;
      if (numbers[i] === 0) neighbours(r, c, h, w).forEach(([a, b]) => reveal(a, b));
    }

    reveal(opening[0], opening[1]);

    const safeLeft = () => {
      let n = 0;
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        if (state[r * w + c] === UNKNOWN && !mines.has(`${r},${c}`)) n++;
      }
      return n;
    };

    function tap(r, c) {
      if (over) return;
      const i = r * w + c;
      if (state[i] === SAFE || state[i] === MINE) return;

      if (flagMode) {
        if (flags.has(i)) flags.delete(i); else flags.add(i);
        return render();
      }
      if (flags.has(i)) return;               // flagged squares are protected

      if (mines.has(`${r},${c}`)) {
        mistakes++;
        state[i] = MINE;                       // flagged for you; the run goes on
        flags.add(i);
      } else {
        reveal(r, c);
      }
      if (safeLeft() === 0) over = true;
      render();
    }

    function render() {
      wrap.innerHTML = "";

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Mines</small><b>${total - flags.size}</b>`),
        el("div", "grid-score-cell", `<small>Left to clear</small><b>${safeLeft()}</b>`),
        el("div", "grid-score-cell", `<small>Mistakes</small><b>${mistakes}</b>`),
      );
      wrap.appendChild(head);

      const board = el("div", "swp-board");
      board.style.setProperty("--cols", w);
      for (let r = 0; r < h; r++) {
        for (let c = 0; c < w; c++) {
          const i = r * w + c;
          const isMine = mines.has(`${r},${c}`);
          const shown = state[i] === SAFE;
          const b = el("button", "swp-cell"
            + (shown ? " open" : "")
            + (state[i] === MINE ? " boom" : "")
            + (flags.has(i) && state[i] !== MINE ? " flag" : "")
            + (over && !shown && isMine && state[i] !== MINE ? " revealed" : ""));
          if (shown) {
            b.textContent = numbers[i] ? String(numbers[i]) : "";
            if (numbers[i]) b.dataset.n = String(numbers[i]);
          } else if (state[i] === MINE) b.textContent = "💥";
          else if (flags.has(i)) b.textContent = "🚩";
          else if (over && isMine) b.textContent = "💣";
          b.setAttribute("aria-label", `row ${r + 1} column ${c + 1}`);
          b.onclick = () => tap(r, c);
          board.appendChild(b);
        }
      }
      wrap.appendChild(board);

      const msg = el("p", "q-detail center swp-msg");
      msg.innerHTML = over
        ? (mistakes === 0
            ? "Cleared without setting off a single mine."
            : `Cleared, with ${mistakes} mine${mistakes === 1 ? "" : "s"} dug along the way.`)
        : flagMode
          ? "<b>Flag mode</b> — tap a square to mark it as a mine."
          : "<b>Dig mode</b> — tap a square to open it. Nothing here needs a guess.";
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = done;
        bar.appendChild(b);
      } else {
        const t = el("button", (flagMode ? "primary" : "ghost") + " compact",
          flagMode ? "🚩 Flagging" : "⛏️ Digging");
        t.onclick = () => { flagMode = !flagMode; render(); };
        bar.appendChild(t);
      }
      wrap.appendChild(bar);
    }

    function done() {
      const squares = mistakes === 0 ? "🟩🟩🟩🟩🟩"
        : mistakes === 1 ? "🟩🟩🟩🟩🟥"
        : mistakes === 2 ? "🟩🟩🟩🟥🟥"
        : mistakes <= 4 ? "🟩🟩🟥🟥🟥" : "🟥🟥🟥🟥🟥";

      api.finish({
        headline: mistakes === 0
          ? "Swept clean — no mines, no guesses"
          : `Swept, with ${mistakes} mine${mistakes === 1 ? "" : "s"} dug`,
        squares,
        stats: [
          ["Mines", String(total)],
          ["Mistakes", String(mistakes)],
          ["Squares", `${h * w - total}`],
        ],
        perfect: mistakes === 0,
        extra: [
          mistakes === 0 ? "🎯 not one mine" : `💥 ${mistakes} dug`,
        ],
        notes: puzzle.data.notes || [],
      });
    }

    render();
  },
};
