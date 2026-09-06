import { el } from "./shared.js";
import { minBlot, minHittingSet, groups, connected, faults, isSolved } from "./blot-rules.js";

/* ============================================================================
   BLOT — "spilled ink"
   ----------------------------------------------------------------------------
   Black out squares until no number repeats in any row or column. The original
   forbids the ink from touching itself and demands the surviving squares stay
   connected; this one inverts that — the ink must be ONE connected blot — and
   charges you for every square you use.

   The cost is not decoration. With both of the original's structural rules
   gone, inking the whole grid is legal, since a grid with nothing showing has
   no repeats to find. The minimum is what makes it a puzzle.

   Par is the true smallest legal blot, recomputed on mount.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const { rows, cols, grid } = puzzle.data;
    const N = rows * cols;
    const spec = { rows, cols, grid };

    const best = minBlot(spec, 20);
    if (!best) throw new Error("blot: no legal blot exists");
    const PAR = best.size;
    const LOOSE = minHittingSet(spec, 20);      // ignoring connectivity
    const gs = groups(spec);

    const inked = new Set();
    let hints = 0, over = false, message = "";

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function tap(i) {
      if (over) return;
      if (inked.has(i)) inked.delete(i); else inked.add(i);
      message = "";
      check();
      render();
    }

    function check() {
      if (inked.size && isSolved(spec, inked)) over = true;
    }

    function hint() {
      const missing = [...best.blot].find((i) => !inked.has(i));
      if (missing === undefined) {
        message = "Every square of one smallest blot is already inked.";
        render();
        return;
      }
      inked.add(missing);
      hints++;
      message = `Hint: row ${Math.floor(missing / cols) + 1}, column ${(missing % cols) + 1}`
        + " belongs to a smallest blot.";
      check();
      render();
    }

    /* Squares still showing that repeat a number along their row or column. */
    function repeats() {
      const bad = new Set();
      for (const g of gs) {
        const showing = g.filter((i) => !inked.has(i));
        if (showing.length > 1) for (const i of showing) bad.add(i);
      }
      return bad;
    }

    function render() {
      wrap.innerHTML = "";
      const bad = repeats();
      const joined = connected(inked, rows, cols);

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Ink</small><b>${inked.size}</b>`),
        el("div", "grid-score-cell", `<small>Par</small><b>${PAR}</b>`),
        el("div", "grid-score-cell", `<small>Repeats</small><b>${bad.size}</b>`),
      );
      wrap.appendChild(head);

      const board = el("div", "blt-board");
      board.style.setProperty("--cols", cols);
      for (let i = 0; i < N; i++) {
        const b = el("button", "blt-cell"
          + (inked.has(i) ? " inked" : "")
          + (!inked.has(i) && bad.has(i) ? " repeat" : ""));
        b.textContent = grid[i];
        b.disabled = over;
        b.setAttribute("aria-label",
          `row ${Math.floor(i / cols) + 1} column ${(i % cols) + 1}, ${grid[i]}, `
          + (inked.has(i) ? "inked" : "showing"));
        b.onclick = () => tap(i);
        board.appendChild(b);
      }
      wrap.appendChild(board);

      const msg = el("p", "q-detail center blt-msg");
      msg.innerHTML = over
        ? (inked.size === PAR
            ? `No repeats left, one connected blot, and <b>${PAR} squares</b> — the smallest possible.`
            : `No repeats left and the ink is joined, using ${inked.size} squares against a par of ${PAR}.`)
        : message || (bad.size && !joined && inked.size
            ? "<b>Repeats still showing, and the ink is in pieces.</b> It has to end up "
              + "as one connected blot."
            : bad.size
              ? "<b>Highlighted numbers still repeat</b> in their row or column."
              : "<b>No repeats left — but the ink is in separate pieces.</b> Join it up.");
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = finish;
        bar.appendChild(b);
      } else {
        const h = el("button", "ghost compact", "Hint (costs you)");
        h.onclick = hint;
        const c = el("button", "ghost compact", "Wipe it clean");
        c.disabled = !inked.size;
        c.onclick = () => { inked.clear(); message = ""; render(); };
        bar.append(h, c);
      }
      wrap.appendChild(bar);
    }

    function finish() {
      const spare = inked.size - PAR;
      const squares = [
        spare === 0 ? "🟩" : spare <= 2 ? "🟨" : "🟧",
        hints === 0 ? "🟩" : hints <= 2 ? "🟨" : "🟧",
      ].join("") + (spare === 0 && hints === 0 ? "🟩🟩🟩" : spare === 0 ? "🟩🟩🟨" : "🟩🟨🟧");

      api.finish({
        headline: spare === 0
          ? `The smallest blot, ${PAR} squares`
          : `${inked.size} squares against par ${PAR}`,
        squares,
        stats: [
          ["Ink used", String(inked.size)],
          ["Par", String(PAR)],
          ["Hints", String(hints)],
        ],
        perfect: spare === 0 && hints === 0,
        notes: [
          `<b>The smallest blot is ${PAR} squares</b><br>`
          + `Killing every repeat needs only ${LOOSE} squares if they are allowed to `
          + `sit apart — the other ${PAR - LOOSE} are paid purely to join the ink up.`,
        ],
        extra: [
          spare === 0 ? "🖋️ the true minimum" : `➕ ${spare} over par`,
          hints === 0 ? "🧠 unaided" : `💡 ${hints} hint${hints === 1 ? "" : "s"}`,
        ],
      });
    }

    render();
  },
};
