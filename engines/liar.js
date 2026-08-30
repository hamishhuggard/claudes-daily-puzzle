import { el } from "./shared.js";
import { clueText } from "./zebra-rules.js";
import { solveWithLiar } from "./liar-rules.js";

/* ============================================================================
   LIAR — the logic grid with one bad clue
   ----------------------------------------------------------------------------
   Five flats, three things to know about each, nine clues — and exactly one of
   the nine is false. Fill the grid, and name the liar. Both, or neither.

   An ordinary logic grid is solved by propagation. Every clue is a fact, facts
   compose, and a contradiction means you slipped. One lie on the list breaks
   that outright: a contradiction is no longer a mistake, it is evidence, and
   nothing can be safely built on any single clue. You end up reasoning about
   the clue list itself rather than only about the flats.

   Two things are rechecked on mount rather than trusted from the blob:

     - exactly one (arrangement, liar) PAIR fits. Not one arrangement — one
       pair, which is the property that makes the question well posed, and
     - no clue is redundant.

   Submitting is the cost: right or wrong, never which part was wrong. Being
   told "the grid is right but the accusation isn't" would hand over the
   deduction the puzzle is about.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const { n, categories, clues, lex } = puzzle.data;

    const pairs = solveWithLiar(n, categories, clues, 40);
    if (pairs.length !== 1) throw new Error(`liar: ${pairs.length} pairs, want 1`);
    const answer = pairs[0].sol;                   // answer[cat][pos] = item
    const liar = pairs[0].liar;

    const grid = categories.map(() => new Array(n).fill(null));
    let accused = null;
    let submits = 0, hints = 0, over = false, message = "";
    let picking = null;

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    const filled = () => grid.every((col) => col.every((v) => v !== null));
    const gridRight = () => grid.every((col, c) => col.every((v, p) => v === answer[c][p]));
    const correct = () => gridRight() && accused === liar;

    function place(cat, pos, item) {
      if (item === null) { grid[cat][pos] = null; return; }
      const existing = grid[cat].indexOf(item);
      if (existing !== -1 && existing !== pos) grid[cat][existing] = grid[cat][pos];
      grid[cat][pos] = item;
    }

    function submit() {
      submits++;
      if (correct()) { over = true; message = ""; }
      else message = "Not this one. Either the grid is wrong or you've accused the wrong clue.";
      render();
    }

    function hint() {
      const wrong = [];
      categories.forEach((_, c) => {
        for (let p = 0; p < n; p++) if (grid[c][p] !== answer[c][p]) wrong.push([c, p]);
      });
      if (wrong.length) {
        const [c, p] = wrong[0];
        place(c, p, answer[c][p]);
        hints++;
        message = `Hint: ${categories[c].label.toLowerCase()} on ${lex.short[p]} is now correct.`;
      } else if (accused !== liar) {
        // The grid is right and only the accusation is left; the only hint
        // left to give is the one that ends the puzzle, so it costs the same.
        accused = liar;
        hints++;
        message = `Hint: clue ${liar + 1} is the false one.`;
      } else return;
      if (filled() && correct()) over = true;
      render();
    }

    function render() {
      wrap.innerHTML = "";

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Submissions</small><b>${submits}</b>`),
        el("div", "grid-score-cell", `<small>Hints</small><b>${hints}</b>`),
        el("div", "grid-score-cell",
          `<small>Accused</small><b>${accused === null ? "—" : `#${accused + 1}`}</b>`),
      );
      wrap.appendChild(head);

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
      list.appendChild(el("div", "section-label",
        `The clues — ${clues.length - 1} of these ${clues.length} are true. Tap the one that isn't.`));
      clues.forEach((clue, i) => {
        const row = el("button", "zeb-clue accusable"
          + (accused === i ? " accused" : "")
          + (over && i === liar ? " liar" : ""));
        row.innerHTML = `<b>${i + 1}</b><span>${clueText(clue, categories, lex)}</span>`
          + (accused === i ? `<em>${over ? "the lie" : "accused"}</em>` : "");
        row.disabled = over;
        row.onclick = () => {
          accused = accused === i ? null : i;
          message = "";
          render();
        };
        list.appendChild(row);
      });
      wrap.appendChild(list);

      const msg = el("p", "q-detail center zeb-msg");
      msg.innerHTML = over
        ? `That's the arrangement — and clue <b>${liar + 1}</b> was the lie.`
        : message || "Fill the grid and accuse a clue, then submit. You're told whether it's right, never which part is wrong.";
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = done;
        bar.appendChild(b);
      } else {
        const s = el("button", "primary compact", "Submit");
        s.disabled = !filled() || accused === null;
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
          ? "Grid and liar, right first time"
          : `Solved — ${submits} submission${submits === 1 ? "" : "s"}, ${hints} hint${hints === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Submissions", String(submits)],
          ["Hints", String(hints)],
          ["The lie", `clue ${liar + 1}`],
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
