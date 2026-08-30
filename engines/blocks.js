import { el } from "./shared.js";
import { par, greedy, faults, shadowsOf, cubesIn } from "./blocks-rules.js";

/* ============================================================================
   BLOCKS — "two shadows"
   ----------------------------------------------------------------------------
   A yard of cells, some paved over. Stack cubes on the rest so the yard casts
   the two shadows given — one down the rows, one across the columns — using
   as few cubes as you can. A shadow records the TALLEST stack it passes.

   Everything here turns on one observation. To cast a row's shadow you need a
   stack of exactly that height somewhere in the row; same for each column. One
   stack can do both jobs at once, but only if the row and the column want the
   same height, because a stack has one height. So you are pairing rows with
   columns, and each pair you find saves an entire stack.

   The paved cells are what stop that being a formula. Unpaved, any row wanting
   3 pairs with any column wanting 3 and the minimum can be written down
   without looking at the yard. Pave the square where a useful row and column
   cross and that saving is gone, so which savings can coexist becomes a real
   question. On this yard the paving costs five cubes over the unpaved answer.

   The engine caps each stack at what both its shadows allow, so no stack can
   ever be too tall and the only thing that can be wrong is a shadow that is
   too short. Par is the true minimum, found by searching every way of serving
   each row and seeing which columns come free with it.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const blocked = puzzle.data.blocked.map((row) => row.map((b) => !!b));
    const want = { side: puzzle.data.side, front: puzzle.data.front };
    const rows = want.side.length, cols = want.front.length;

    const best = par(blocked, want);
    if (!best) throw new Error("blocks: these shadows cannot be cast");
    const lazy = greedy(blocked, want);

    const cap = (r, c) => (blocked[r][c] ? 0 : Math.min(want.side[r], want.front[c]));
    const heights = Array.from({ length: rows }, () => new Array(cols).fill(0));
    let hints = 0, over = false, message = "";

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    const cubes = () => cubesIn(heights);
    const wrong = () => faults(heights, blocked, want);

    function tap(r, c) {
      if (over || blocked[r][c]) return;
      heights[r][c] = heights[r][c] >= cap(r, c) ? 0 : heights[r][c] + 1;
      message = "";
      render();
    }

    function hint() {
      // Put one of par's stacks where it belongs, choosing a cell the player
      // has not already got right.
      let target = null;
      for (let r = 0; r < rows && !target; r++) {
        for (let c = 0; c < cols; c++) {
          if (best.grid[r][c] && heights[r][c] !== best.grid[r][c]) { target = { r, c }; break; }
        }
      }
      if (!target) return;
      heights[target.r][target.c] = best.grid[target.r][target.c];
      hints++;
      message = `Hint: a stack of ${best.grid[target.r][target.c]} belongs on `
        + `row ${target.r + 1}, column ${target.c + 1}.`;
      render();
    }

    function render() {
      wrap.innerHTML = "";
      const { rowMax, colMax } = shadowsOf(heights, rows, cols);

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Cubes</small><b>${cubes()}</b>`),
        el("div", "grid-score-cell", `<small>Par</small><b>${best.cubes}</b>`),
        el("div", "grid-score-cell", `<small>Shadows cast</small><b>${
          rowMax.filter((h, r) => h === want.side[r]).length
          + colMax.filter((h, c) => h === want.front[c]).length}/${rows + cols}</b>`),
        el("div", "grid-score-cell", `<small>Hints</small><b>${hints}</b>`),
      );
      wrap.appendChild(head);

      /* One grid, with the two shadows written along the edges they fall on,
         so a row's target sits at the end of that row and nowhere else. */
      const board = el("div", "blk-board");
      board.style.setProperty("--cols", cols + 1);

      board.appendChild(el("div", "blk-corner", ""));
      want.front.forEach((h, c) => {
        const t = el("div", "blk-target" + (colMax[c] === h ? " met" : ""), String(h));
        t.title = `column ${c + 1} casts a shadow of ${h}`;
        board.appendChild(t);
      });

      for (let r = 0; r < rows; r++) {
        const t = el("div", "blk-target" + (rowMax[r] === want.side[r] ? " met" : ""),
          String(want.side[r]));
        t.title = `row ${r + 1} casts a shadow of ${want.side[r]}`;
        board.appendChild(t);
        for (let c = 0; c < cols; c++) {
          const h = heights[r][c];
          const cell = el("button", "blk-cell"
            + (blocked[r][c] ? " paved" : "")
            + (h ? ` h${h}` : ""));
          cell.textContent = blocked[r][c] ? "" : (h ? String(h) : "");
          cell.disabled = over || blocked[r][c];
          cell.setAttribute("aria-label", blocked[r][c]
            ? `row ${r + 1} column ${c + 1}, paved`
            : `row ${r + 1} column ${c + 1}, ${h} cubes, up to ${cap(r, c)}`);
          cell.onclick = () => tap(r, c);
          board.appendChild(cell);
        }
      }
      wrap.appendChild(board);

      const msg = el("p", "q-detail center blk-msg");
      msg.innerHTML = over
        ? (cubes() === best.cubes
            ? `Both shadows, in <b>${cubes()}</b> cubes — the fewest there are.`
            : `Both shadows cast, in <b>${cubes()}</b> cubes. It can be done in <b>${best.cubes}</b>.`)
        : message || (wrong().length
          ? "Tap to stack, tap again to build higher, once more to clear. "
            + "A shadow shows the <b>tallest</b> stack in its line."
          : `Both shadows cast, in <b>${cubes()}</b> cubes. `
            + "Finish here, or keep going and try to spend fewer.");
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = done;
        bar.appendChild(b);
      } else {
        /* No auto-win. A yard can be legal on the way to a better one, and
           ending the puzzle underneath the player at that moment would lock
           in a score they were still improving. */
        const f = el("button", "primary compact", "Cast them");
        f.disabled = wrong().length > 0;
        f.onclick = () => { over = true; render(); };
        const h = el("button", "ghost compact", "Hint (costs you)");
        h.onclick = hint;
        const c = el("button", "ghost compact", "Clear the yard");
        c.disabled = !cubes();
        c.onclick = () => { heights.forEach((row) => row.fill(0)); message = ""; render(); };
        bar.append(f, h, c);
      }
      wrap.appendChild(bar);
    }

    function done() {
      const n = cubes(), overPar = n - best.cubes;
      const squares = [
        overPar === 0 ? "🟩" : overPar <= 3 ? "🟨" : "🟧",
        hints === 0 ? "🟩" : hints <= 2 ? "🟨" : "🟧",
      ].join("") + (overPar === 0 && hints === 0 ? "🟩🟩🟩"
        : overPar <= 3 ? "🟩🟩🟨" : "🟩🟨🟧");

      api.finish({
        headline: overPar === 0
          ? `Both shadows in ${n} cubes — the minimum`
          : `Both shadows in ${n} cubes, against a par of ${best.cubes}`,
        squares,
        stats: [
          ["Cubes", String(n)],
          ["Par", String(best.cubes)],
          ["Hints", String(hints)],
        ],
        perfect: overPar === 0 && hints === 0,
        extra: [
          overPar === 0 ? "🎯 nothing wasted" : `🧱 ${overPar} cube${overPar === 1 ? "" : "s"} over par`,
          n < lazy.cubes ? `📉 ${lazy.cubes - n} better than filling it in`
            : "🧊 you filled the whole yard",
        ],
        notes: puzzle.data.notes || [],
      });
    }

    render();
  },
};
