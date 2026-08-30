import { el } from "./shared.js";
import { solve, optionsFor, perimeter } from "./frames-rules.js";

/* ============================================================================
   FRAMES — "the fence bill"
   ----------------------------------------------------------------------------
   Cut the whole grid into rectangles, one numbered cell in each, and the
   number is that rectangle's PERIMETER rather than its area.

   The familiar version of this shape gives the area, and the swap changes what
   a clue does for you. An area factorises: 12 is 1x12, 2x6 or 3x4, and a prime
   area is a single strip — the strongest clue in the game. A perimeter
   partitions: 12 means width plus height is 6, so 1x5, 2x4 or 3x3 and their
   transposes. There are no primes to lean on and odd numbers cannot occur at
   all. On this board each clue admits 8.4 rectangles on average; the same
   partition labelled with areas admits 4.0.

   The larger loss is global. In the area version the clues must sum to the
   area of the grid, and that check is available on every partial solution.
   Perimeters do not determine the areas at all, so that check does not exist.
   What you get instead is that the widths and heights sum to half the clue
   total, which constrains shapes rather than coverage.

   The engine enforces every local rule — right perimeter, exactly one clue
   inside, no overlaps — so every rectangle on the board is always legal. That
   has a pleasant consequence: because the board has exactly one solution
   (rechecked on mount), a legally covered grid IS the solution, and there is
   nothing to submit. Filling it is winning.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const { rows, cols, clues } = puzzle.data;

    const sols = solve(clues, rows, cols, 2);
    if (sols.length !== 1) throw new Error(`frames: ${sols.length} solutions, want 1`);
    const answer = sols[0];                    // answer[i] = rectangle for clue i

    const placed = new Array(clues.length).fill(null);
    let corner = null;                         // first corner of a pending rectangle
    let hints = 0, removals = 0, over = false, message = "";

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    const clueAt = (r, c) => clues.findIndex((k) => k.r === r && k.c === c);
    const owner = (r, c) => placed.findIndex((rect) => rect
      && r >= rect.r0 && r < rect.r0 + rect.h && c >= rect.c0 && c < rect.c0 + rect.w);
    const covered = () => {
      let n = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (owner(r, c) !== -1) n++;
      return n;
    };

    /* Two taps make a rectangle: opposite corners, in either order. The clue
       is NOT the anchor — it is often in the middle of its own rectangle, and
       an interaction that made you start from it could not draw those at all. */
    function tap(r, c) {
      if (over) return;

      if (corner === null) {
        const here = owner(r, c);
        if (here !== -1) {                     // tap a finished rectangle to lift it
          placed[here] = null;
          removals++;
          message = "";
          return render();
        }
        corner = { r, c };
        message = "Now tap the opposite corner.";
        return render();
      }

      if (corner.r === r && corner.c === c) {  // tapped it again: cancel
        corner = null;
        message = "";
        return render();
      }

      const r0 = Math.min(r, corner.r), c0 = Math.min(c, corner.c);
      const h = Math.abs(r - corner.r) + 1, w = Math.abs(c - corner.c) + 1;
      corner = null;

      const inside = [];
      clues.forEach((o, i) => {
        if (o.r >= r0 && o.r < r0 + h && o.c >= c0 && o.c < c0 + w) inside.push(i);
      });
      if (inside.length !== 1) {
        message = inside.length
          ? "A rectangle can only contain one number."
          : "Every rectangle needs a number in it.";
        return render();
      }
      const k = inside[0];
      if (perimeter(w, h) !== clues[k].p) {
        message = `That's a ${w} by ${h} — perimeter ${perimeter(w, h)}, and the number in it says ${clues[k].p}.`;
        return render();
      }
      for (let rr = r0; rr < r0 + h; rr++) {
        for (let cc = c0; cc < c0 + w; cc++) {
          const o = owner(rr, cc);
          if (o !== -1 && o !== k) {
            message = "That overlaps a rectangle you've already drawn.";
            return render();
          }
        }
      }

      placed[k] = { r0, c0, w, h };
      message = "";
      if (covered() === rows * cols) over = true;
      render();
    }

    function hint() {
      const missing = placed.findIndex((rect, i) => !rect
        || rect.r0 !== answer[i].r0 || rect.c0 !== answer[i].c0
        || rect.w !== answer[i].w || rect.h !== answer[i].h);
      if (missing === -1) return;
      // Lift anything in the way, then drop the true rectangle in.
      const want = answer[missing];
      for (let rr = want.r0; rr < want.r0 + want.h; rr++) {
        for (let cc = want.c0; cc < want.c0 + want.w; cc++) {
          const o = owner(rr, cc);
          if (o !== -1) placed[o] = null;
        }
      }
      placed[missing] = { ...want };
      hints++;
      corner = null;
      message = `Hint: the ${clues[missing].p} is a ${want.w} by ${want.h}.`;
      if (covered() === rows * cols) over = true;
      render();
    }

    function render() {
      wrap.innerHTML = "";

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Covered</small><b>${covered()}/${rows * cols}</b>`),
        el("div", "grid-score-cell", `<small>Rectangles</small><b>${placed.filter(Boolean).length}/${clues.length}</b>`),
        el("div", "grid-score-cell", `<small>Hints</small><b>${hints}</b>`),
      );
      wrap.appendChild(head);

      const board = el("div", "frm-board");
      board.style.setProperty("--cols", cols);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const o = owner(r, c);
          const k = clueAt(r, c);
          const rect = o === -1 ? null : placed[o];
          const cell = el("button", "frm-cell"
            + (o !== -1 ? ` filled g${o % 8}` : "")
            + (k !== -1 ? " clue" : "")
            + (corner && corner.r === r && corner.c === c ? " sel" : "")
            // Only the outer edges of a rectangle get drawn, so the shapes read
            // as single blocks rather than a mess of boxes.
            + (rect && r === rect.r0 ? " top" : "")
            + (rect && r === rect.r0 + rect.h - 1 ? " bottom" : "")
            + (rect && c === rect.c0 ? " left" : "")
            + (rect && c === rect.c0 + rect.w - 1 ? " right" : ""));
          if (k !== -1) cell.textContent = String(clues[k].p);
          cell.disabled = over;
          cell.setAttribute("aria-label", `row ${r + 1} column ${c + 1}`
            + (k !== -1 ? `, perimeter ${clues[k].p}` : ""));
          cell.onclick = () => tap(r, c);
          board.appendChild(cell);
        }
      }
      wrap.appendChild(board);

      const msg = el("p", "q-detail center frm-msg");
      msg.innerHTML = over
        ? "Every square accounted for — and since each rectangle was legal on the way in, that's the answer."
        : message || (corner === null
          ? "Tap two opposite corners to draw a rectangle. Tap a finished one to take it back."
          : "Now tap the opposite corner.");
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = done;
        bar.appendChild(b);
      } else {
        const h = el("button", "ghost compact", "Hint (costs you)");
        h.onclick = hint;
        const c = el("button", "ghost compact", corner === null ? "Clear the board" : "Cancel");
        c.disabled = corner === null && !placed.some(Boolean);
        c.onclick = () => {
          if (corner !== null) { corner = null; message = ""; return render(); }
          placed.fill(null); removals++; message = ""; render();
        };
        bar.append(h, c);
      }
      wrap.appendChild(bar);
    }

    function done() {
      const squares = [
        hints === 0 ? "🟩" : hints <= 2 ? "🟨" : "🟧",
        removals === 0 ? "🟩" : removals <= 4 ? "🟨" : "🟧",
      ].join("") + (hints === 0 ? "🟩🟩🟩" : hints <= 2 ? "🟩🟩🟨" : "🟩🟨🟧");

      api.finish({
        headline: hints === 0
          ? `All ${clues.length} rectangles, unaided`
          : `Solved with ${hints} hint${hints === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Rectangles", String(clues.length)],
          ["Hints", String(hints)],
          ["Take-backs", String(removals)],
        ],
        perfect: hints === 0 && removals === 0,
        extra: [
          hints === 0 ? "🧠 unaided" : `💡 ${hints} hint${hints === 1 ? "" : "s"}`,
          removals === 0 ? "📐 never redrew one" : `↩️ ${removals} take-back${removals === 1 ? "" : "s"}`,
        ],
        notes: puzzle.data.notes || [],
      });
    }

    render();
  },
};
