import { el } from "./shared.js";
import { solve, faults, litCounts, isWall, isNumber } from "./lamps-rules.js";

/* ============================================================================
   LAMPS — "no square twice"
   ----------------------------------------------------------------------------
   Light every square of the room, and light every square EXACTLY ONCE.

   The familiar version of this puzzle asks for two things: every square lit,
   and no two lamps able to see each other down a clear line. This variant
   replaces both with the single stricter rule, which quietly does more:

     - It implies the old one, since two lamps in sight of each other light
       one another's squares twice over.
     - It forbids something the old one permitted. Ordinarily a square may be
       lit from its row and its column at the same time, by two lamps that
       cannot see each other, and nobody minds. Here that square is lit twice
       and the position is dead.

   So overlap stops being a non-event and becomes a deduction. Every lamp
   fences off a cross of squares that no other lamp may reach, which means the
   lit crosses have to tile the floor exactly — and that is a much heavier
   constraint than "cover it". On this board it does nearly all the work: the
   same five numbers admit 63 different answers under the ordinary rules and
   exactly one under this one.

   Because of that, a room where every square is lit exactly once and every
   number is satisfied IS the answer. Nothing to submit.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const grid = puzzle.data.rows.map((r) => r.split(""));
    const rows = grid.length, cols = grid[0].length;

    const sols = solve(grid, rows, cols, 2);
    if (sols.length !== 1) throw new Error(`lamps: ${sols.length} solutions, want 1`);
    const answer = new Set(sols[0]);

    const lamps = new Set();
    const crossed = new Set();          // squares the player has ruled out
    let hints = 0, removed = 0, over = false, message = "";

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function tap(r, c) {
      if (over || isWall(grid[r][c])) return;
      const i = r * cols + c;
      if (lamps.has(i)) { lamps.delete(i); crossed.add(i); removed++; }
      else if (crossed.has(i)) crossed.delete(i);
      else lamps.add(i);
      message = "";
      const f = faults(grid, [...lamps], rows, cols);
      if (!f.dark.length && !f.twice.length && !f.wrongWalls.length) over = true;
      render();
    }

    function hint() {
      const spurious = [...lamps].find((i) => !answer.has(i));
      const missing = [...answer].find((i) => !lamps.has(i));
      if (spurious !== undefined) {
        lamps.delete(spurious);
        hints++;
        message = "Hint: no lamp goes there.";
      } else if (missing !== undefined) {
        lamps.add(missing);
        crossed.delete(missing);
        hints++;
        message = `Hint: a lamp belongs on row ${Math.floor(missing / cols) + 1}, `
          + `column ${(missing % cols) + 1}.`;
      } else return;
      const f = faults(grid, [...lamps], rows, cols);
      if (!f.dark.length && !f.twice.length && !f.wrongWalls.length) over = true;
      render();
    }

    function render() {
      wrap.innerHTML = "";
      const list = [...lamps];
      const count = litCounts(grid, list, rows, cols);
      const f = faults(grid, list, rows, cols);

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Lamps</small><b>${lamps.size}</b>`),
        el("div", "grid-score-cell", `<small>Dark</small><b>${f.dark.length}</b>`),
        el("div", "grid-score-cell", `<small>Lit twice</small><b>${f.twice.length}</b>`),
        el("div", "grid-score-cell", `<small>Hints</small><b>${hints}</b>`),
      );
      wrap.appendChild(head);

      const board = el("div", "lmp-board");
      board.style.setProperty("--cols", cols);
      const badWalls = new Set(f.wrongWalls.map((w) => w.i));
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c, ch = grid[r][c];
          if (isWall(ch)) {
            const w = el("div", "lmp-cell wall"
              + (isNumber(ch) ? " numbered" : "")
              + (isNumber(ch) && !badWalls.has(i) ? " met" : ""));
            if (isNumber(ch)) w.textContent = ch;
            board.appendChild(w);
            continue;
          }
          const b = el("button", "lmp-cell"
            + (count[i] === 1 ? " lit" : "")
            + (count[i] > 1 ? " twice" : "")
            + (lamps.has(i) ? " lamp" : "")
            + (crossed.has(i) && !lamps.has(i) ? " crossed" : ""));
          b.textContent = lamps.has(i) ? "💡" : (crossed.has(i) ? "·" : "");
          b.disabled = over;
          b.setAttribute("aria-label", `row ${r + 1} column ${c + 1}, lit ${count[i]} times`);
          b.onclick = () => tap(r, c);
          board.appendChild(b);
        }
      }
      wrap.appendChild(board);

      const msg = el("p", "q-detail center lmp-msg");
      msg.innerHTML = over
        ? "Every square lit, and none of them twice — which only one arrangement manages."
        : message || (f.twice.length
          ? `<b>${f.twice.length} square${f.twice.length === 1 ? " is" : "s are"} lit twice.</b> `
            + "Once is the rule, not at least once."
          : "Tap to place a lamp, again to rule the square out, again to clear it. "
            + "A lamp lights its own square and along the row and column until a wall.");
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = done;
        bar.appendChild(b);
      } else {
        const h = el("button", "ghost compact", "Hint (costs you)");
        h.onclick = hint;
        const c = el("button", "ghost compact", "Clear the room");
        c.disabled = !lamps.size && !crossed.size;
        c.onclick = () => {
          lamps.clear(); crossed.clear(); removed++; message = ""; render();
        };
        bar.append(h, c);
      }
      wrap.appendChild(bar);
    }

    function done() {
      const squares = [
        hints === 0 ? "🟩" : hints <= 2 ? "🟨" : "🟧",
        removed <= 3 ? "🟩" : removed <= 8 ? "🟨" : "🟧",
      ].join("") + (hints === 0 ? "🟩🟩🟩" : hints <= 2 ? "🟩🟩🟨" : "🟩🟨🟧");

      api.finish({
        headline: hints === 0
          ? `All ${answer.size} lamps, unaided`
          : `Lit with ${hints} hint${hints === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Lamps", String(answer.size)],
          ["Hints", String(hints)],
          ["Take-backs", String(removed)],
        ],
        perfect: hints === 0 && removed === 0,
        extra: [
          hints === 0 ? "🧠 unaided" : `💡 ${hints} hint${hints === 1 ? "" : "s"}`,
          removed === 0 ? "🎯 never moved a lamp" : `↩️ ${removed} take-back${removed === 1 ? "" : "s"}`,
        ],
      });
    }

    render();
  },
};
