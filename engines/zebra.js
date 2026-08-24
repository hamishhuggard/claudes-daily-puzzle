import { el } from "./shared.js";
import { solve, clueText } from "./zebra-rules.js";

/* ============================================================================
   ZEBRA — the logic grid
   ----------------------------------------------------------------------------
   Five flats, four things to know about each, and a list of clues that between
   them allow exactly one arrangement. Tap a cell, pick a value; picking a value
   already used elsewhere in that column moves it, because each thing belongs to
   exactly one flat and enforcing that by hand is bookkeeping, not deduction.

   Two properties of the clue list were checked before it shipped, and are
   rechecked here on every mount:

     - it has exactly one solution, so nothing rests on a guess, and
     - no clue in it is redundant. Drop any one and the answer stops being
       unique. Nothing here is padding, which means every clue you haven't used
       yet is telling you something you don't know.

   Submitting is the cost. The grid tells you whether you are right, never
   which cells are wrong — a checker that marks individual cells turns a
   deduction puzzle into a search.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const { n, categories, clues, lex } = puzzle.data;

    const found = solve(n, categories, clues, 2);
    if (found.length !== 1) throw new Error(`zebra: ${found.length} solutions, want 1`);
    const answer = found[0];                       // answer[cat][pos] = item

    // grid[cat][pos] = item index or null
    const grid = categories.map(() => new Array(n).fill(null));
    let submits = 0, hints = 0, over = false, message = "";
    let picking = null;                            // { cat, pos }

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    const filled = () => grid.every((col) => col.every((v) => v !== null));
    const correct = () => grid.every((col, c) => col.every((v, p) => v === answer[c][p]));

    function place(cat, pos, item) {
      if (item === null) { grid[cat][pos] = null; return; }
      // one item per column: if it's already somewhere, swap the two cells
      const existing = grid[cat].indexOf(item);
      if (existing !== -1 && existing !== pos) grid[cat][existing] = grid[cat][pos];
      grid[cat][pos] = item;
    }

    function submit() {
      submits++;
      if (correct()) { over = true; message = ""; }
      else message = "Not this one. Something in the grid contradicts a clue.";
      render();
    }

    function hint() {
      const wrong = [];
      categories.forEach((_, c) => {
        for (let p = 0; p < n; p++) if (grid[c][p] !== answer[c][p]) wrong.push([c, p]);
      });
      if (!wrong.length) return;
      const [c, p] = wrong[0];
      place(c, p, answer[c][p]);
      hints++;
      message = `Hint: ${categories[c].label.toLowerCase()} on ${lex.short[p]} is now correct.`;
      if (filled() && correct()) over = true;
      render();
    }

    function render() {
      wrap.innerHTML = "";

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Submissions</small><b>${submits}</b>`),
        el("div", "grid-score-cell", `<small>Hints</small><b>${hints}</b>`),
        el("div", "grid-score-cell", `<small>Filled</small><b>${grid.flat().filter((v) => v !== null).length}/${n * categories.length}</b>`),
      );
      wrap.appendChild(head);

      /* The grid. Top row of the display is the top floor, because that is
         where it is — a logic grid that reads upside down is a cruelty. */
      const table = el("div", "zeb-grid");
      table.style.setProperty("--cols", categories.length + 1);

      table.appendChild(el("div", "zeb-head", ""));
      categories.forEach((c) => table.appendChild(el("div", "zeb-head", c.label)));

      for (let p = n - 1; p >= 0; p--) {
        table.appendChild(el("div", "zeb-floor", lex.short[p]));
        categories.forEach((c, ci) => {
          const v = grid[ci][p];
          const cell = el("button", "zeb-cell"
            + (v === null ? " empty" : "")
            + (over && v === answer[ci][p] ? " right" : ""));
          cell.textContent = v === null ? "—" : c.items[v];
          cell.disabled = over;
          cell.onclick = () => { picking = { cat: ci, pos: p }; render(); };
          table.appendChild(cell);
        });
      }
      wrap.appendChild(table);

      if (picking && !over) {
        const c = categories[picking.cat];
        const sheet = el("div", "sheet zeb-sheet");
        sheet.appendChild(el("h3", null, `${c.label} — ${lex.short[picking.pos]}`));
        const body = el("div", "sheet-body");
        c.items.forEach((label, item) => {
          const at = grid[picking.cat].indexOf(item);
          const b = el("button", "option" + (at === picking.pos ? " chosen" : ""));
          b.innerHTML = at !== -1 && at !== picking.pos
            ? `${label} <small>(currently ${lex.short[at]})</small>`
            : label;
          b.onclick = () => { place(picking.cat, picking.pos, item); picking = null; message = ""; render(); };
          body.appendChild(b);
        });
        const clear = el("button", "ghost compact", "Leave it blank");
        clear.onclick = () => { place(picking.cat, picking.pos, null); picking = null; render(); };
        const close = el("button", "ghost compact", "Cancel");
        close.onclick = () => { picking = null; render(); };
        sheet.append(body, clear, close);
        wrap.appendChild(sheet);
      }

      const list = el("div", "zeb-clues");
      list.appendChild(el("div", "section-label", `The clues — all ${clues.length} of them matter`));
      clues.forEach((clue, i) => {
        const row = el("div", "zeb-clue");
        row.innerHTML = `<b>${i + 1}</b><span>${clueText(clue, categories, lex)}</span>`;
        list.appendChild(row);
      });
      wrap.appendChild(list);

      const msg = el("p", "q-detail center zeb-msg");
      msg.innerHTML = over
        ? "That's the arrangement — every clue satisfied."
        : message || "Fill the grid, then submit. You're told whether it's right, never which cells are wrong.";
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = done;
        bar.appendChild(b);
      } else {
        const s = el("button", "primary compact", "Submit");
        s.disabled = !filled();
        s.onclick = submit;
        const h = el("button", "ghost compact", "Hint (costs you)");
        h.onclick = hint;
        bar.append(s, h);
      }
      wrap.appendChild(bar);
    }

    function done() {
      const clean = submits === 1 && hints === 0;
      const squares = [
        submits === 1 ? "🟩" : submits <= 3 ? "🟨" : "🟧",
        hints === 0 ? "🟩" : hints <= 2 ? "🟨" : "🟧",
      ].join("") + (clean ? "🟩🟩🟩" : hints === 0 ? "🟩🟩🟨" : "🟩🟨🟧");

      api.finish({
        headline: clean
          ? "Right first time, no hints"
          : `Solved — ${submits} submission${submits === 1 ? "" : "s"}, ${hints} hint${hints === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Submissions", String(submits)],
          ["Hints", String(hints)],
          ["Clues", String(clues.length)],
        ],
        perfect: clean,
        extra: [
          submits === 1 ? "🎯 first submission" : `📝 ${submits} tries`,
          hints === 0 ? "🧠 unaided" : `💡 ${hints} hint${hints === 1 ? "" : "s"}`,
        ],
        notes: puzzle.data.notes || [],
      });
    }

    render();
  },
};
