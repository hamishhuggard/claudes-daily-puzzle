import { el } from "./shared.js";
import { neighbours, fullySolvable, weightsOf, chargesOf, UNKNOWN, SAFE, MINE }
  from "./charge-rules.js";

/* ============================================================================
   CHARGE — "dead weight"
   ----------------------------------------------------------------------------
   Minesweeper where a number is not a count. Some of the mines are heavy, and
   a heavy mine adds two to every number that can see it. You are told how many
   mines there are and how many of those are heavy; you are never told which.

   That single change retires both of the rules the game is normally played
   with. A 3 with three unknowns left is no longer three mines — it might be a
   heavy, a light, and a clean square. A 1 that already touches a flagged mine
   is not satisfied until you know that mine is light.

   What replaces them is a second thing to deduce. Weight is information, it is
   deducible, and it travels: a 1 beside a mine proves that mine light, and
   that fact resolves a clue on the far side of it that never touched the 1.
   So the board carries two flag states — mine, and heavy mine — because
   holding which is which in your head is the actual work.

   The no-guessing promise is kept from the count version and re-checked on
   mount (charge-rules.js: fullySolvable). Digging a mine is not sudden death;
   it is flagged for you, at its true weight, and the mistakes are the score.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const { h, w, mines: mineList, heavy: heavyList, opening } = puzzle.data;
    const mines = new Set(mineList);
    const heavy = new Set(heavyList);
    const total = mines.size, totalHeavy = heavy.size;

    // The promise, re-checked here rather than trusted from the blob.
    const check = fullySolvable(mines, heavy, [opening], h, w);
    if (!check.solved) throw new Error("charge: board needs a guess");
    const weights = weightsOf(mines, heavy, h, w);
    const charges = chargesOf(weights, h, w);

    const state = new Array(h * w).fill(UNKNOWN);
    let flagMode = false, mistakes = 0, over = false;
    const flags = new Map();                 // index -> 1 (mine) | 2 (heavy)

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function reveal(r, c) {
      const i = r * w + c;
      if (state[i] !== UNKNOWN || flags.has(i)) return;
      state[i] = SAFE;
      if (charges[i] === 0) neighbours(r, c, h, w).forEach(([a, b]) => reveal(a, b));
    }

    reveal(opening[0], opening[1]);

    const safeLeft = () => {
      let n = 0;
      for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
        if (state[r * w + c] === UNKNOWN && !mines.has(`${r},${c}`)) n++;
      }
      return n;
    };
    const heavyFlags = () => [...flags.values()].filter((v) => v === 2).length;

    function tap(r, c) {
      if (over) return;
      const i = r * w + c;
      if (state[i] === SAFE || state[i] === MINE) return;

      if (flagMode) {
        // none -> mine -> heavy mine -> none
        const v = flags.get(i) || 0;
        if (v === 2) flags.delete(i); else flags.set(i, v + 1);
        return render();
      }
      if (flags.has(i)) return;              // flagged squares are protected

      if (mines.has(`${r},${c}`)) {
        mistakes++;
        state[i] = MINE;                     // flagged for you, at its real weight
        flags.set(i, weights[i]);
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
        el("div", "grid-score-cell", `<small>Heavy</small><b>${totalHeavy - heavyFlags()}</b>`),
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
            b.textContent = charges[i] ? String(charges[i]) : "";
            if (charges[i]) b.dataset.n = String(Math.min(charges[i], 8));
          } else if (state[i] === MINE) {
            b.textContent = weights[i] === 2 ? "🧨" : "💥";
          } else if (flags.has(i)) {
            b.textContent = flags.get(i) === 2 ? "🚩²" : "🚩";
          } else if (over && isMine) {
            b.textContent = weights[i] === 2 ? "🧨" : "💣";
          }
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
          ? "<b>Flag mode</b> — tap once for a mine, twice for a <b>heavy</b> mine (🚩²), three times to clear."
          : `<b>Dig mode</b> — a number is the total weight around it, and ${totalHeavy} of the ${total} mines weigh two. Nothing here needs a guess.`;
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
          ["Mines", `${total} (${totalHeavy} heavy)`],
          ["Mistakes", String(mistakes)],
          ["Squares", `${h * w - total}`],
        ],
        perfect: mistakes === 0,
        extra: [mistakes === 0 ? "🎯 not one mine" : `💥 ${mistakes} dug`],
      });
    }

    render();
  },
};
