import { el } from "./shared.js";
import { solve, faults, forcedSizes, neighbours } from "./parcels-rules.js";

/* ============================================================================
   PARCELS — "no two alike"
   ----------------------------------------------------------------------------
   Cut the field into regions where every region is a different size. On a 6x6
   that forces the sizes outright: 1+2+...+8 = 36, so there is exactly one
   region of each size from 1 to 8 and no choice about it.

   Because sizes are unique, a region IS its number — so the player paints
   numbers rather than dragging borders. Pick a number from the palette, tap
   squares to give them to that region. Two squares showing the same number
   are in the same region by definition, which is the deduction the ordinary
   version cannot make.

   The board has one legal carving, so a fully painted grid that matches it IS
   the answer; nothing to submit.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const { rows, cols, givens } = puzzle.data;
    const N = rows * cols;
    const spec = { rows, cols, givens };
    const SIZES = forcedSizes(N);

    const sols = solve(spec, 2);
    if (sols.length !== 1) throw new Error(`parcels: ${sols.length} solutions, want 1`);

    /* Turn the solver's representative-cell answer into "what number belongs
       in this square", which is what the player actually paints. */
    const truth = new Int8Array(N);
    {
      const count = new Map();
      for (let i = 0; i < N; i++) count.set(sols[0][i], (count.get(sols[0][i]) || 0) + 1);
      for (let i = 0; i < N; i++) truth[i] = count.get(sols[0][i]);
    }

    const nb = neighbours(rows, cols);
    const NB = Array.from({ length: N }, (_, i) => nb(i));

    const paint = new Int8Array(N);
    const locked = new Uint8Array(N);
    for (const [c, v] of Object.entries(givens)) { paint[c] = v; locked[c] = 1; }

    let pick = SIZES[SIZES.length - 1];
    let hints = 0, takeBacks = 0, over = false, message = "";

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function tap(i) {
      if (over || locked[i]) return;
      const was = paint[i];
      if (was === pick) paint[i] = 0;
      else paint[i] = pick;
      if (was !== 0 && paint[i] !== was) takeBacks++;
      message = "";
      checkDone();
      render();
    }

    function checkDone() {
      for (let i = 0; i < N; i++) if (paint[i] !== truth[i]) return;
      over = true;
    }

    function hint() {
      let target = -1;
      for (let i = 0; i < N; i++) {           // a wrong square first
        if (!locked[i] && paint[i] !== 0 && paint[i] !== truth[i]) { target = i; break; }
      }
      if (target === -1) {
        for (let i = 0; i < N; i++) if (!locked[i] && paint[i] === 0) { target = i; break; }
      }
      if (target === -1) return;
      paint[target] = truth[target];
      hints++;
      message = `Hint: row ${Math.floor(target / cols) + 1}, column ${(target % cols) + 1}`
        + ` belongs to the ${truth[target]}.`;
      checkDone();
      render();
    }

    /* A region that is FINISHED — it has all its squares — but is sitting in
       two separate blobs. Only complete regions are checked: a half-painted
       one is legitimately in pieces while you work, and the two given 8s
       start life at opposite corners, so flagging those would mean opening
       the puzzle with an error already on screen. */
    function broken() {
      const bad = new Set();
      for (const s of SIZES) {
        const cells = [];
        for (let i = 0; i < N; i++) if (paint[i] === s) cells.push(i);
        if (cells.length !== s || cells.length < 2) continue;
        const set = new Set(cells);
        const seen = new Set([cells[0]]);
        const stack = [cells[0]];
        while (stack.length) {
          for (const j of NB[stack.pop()]) {
            if (set.has(j) && !seen.has(j)) { seen.add(j); stack.push(j); }
          }
        }
        if (seen.size !== cells.length) for (const c of cells) bad.add(c);
      }
      return bad;
    }

    function counts() {
      const m = new Map(SIZES.map((s) => [s, 0]));
      for (let i = 0; i < N; i++) if (paint[i]) m.set(paint[i], m.get(paint[i]) + 1);
      return m;
    }

    function render() {
      wrap.innerHTML = "";
      const cnt = counts();
      const bad = broken();
      let done = 0;
      for (let i = 0; i < N; i++) if (paint[i]) done++;

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Squares</small><b>${done}/${N}</b>`),
        el("div", "grid-score-cell", `<small>Split</small><b>${bad.size}</b>`),
        el("div", "grid-score-cell", `<small>Hints</small><b>${hints}</b>`),
      );
      wrap.appendChild(head);

      const board = el("div", "prc-board");
      board.style.setProperty("--cols", cols);
      for (let i = 0; i < N; i++) {
        const v = paint[i];
        const b = el("button", "prc-cell"
          + (v ? ` p${v}` : "")
          + (locked[i] ? " given" : "")
          + (bad.has(i) ? " split" : ""));
        b.textContent = v || "";
        b.disabled = over || !!locked[i];
        b.setAttribute("aria-label",
          `row ${Math.floor(i / cols) + 1} column ${(i % cols) + 1}, `
          + (v ? `region ${v}` : "unassigned"));
        b.onclick = () => tap(i);
        board.appendChild(b);
      }
      wrap.appendChild(board);

      /* The palette doubles as the budget: each chip says how much of that
         region you have placed out of how much it is allowed. */
      const pal = el("div", "prc-palette");
      for (const s of SIZES) {
        const got = cnt.get(s);
        const chip = el("button", `prc-chip p${s}`
          + (s === pick ? " on" : "")
          + (got === s ? " full" : "")
          + (got > s ? " over" : ""));
        chip.innerHTML = `<b>${s}</b><small>${got}/${s}</small>`;
        chip.disabled = over;
        chip.setAttribute("aria-label", `region ${s}, ${got} of ${s} squares placed`);
        chip.onclick = () => { pick = s; message = ""; render(); };
        pal.appendChild(chip);
      }
      if (!over) wrap.appendChild(pal);

      const msg = el("p", "q-detail center prc-msg");
      msg.innerHTML = over
        ? "Eight regions, eight different sizes — the only way this field divides."
        : message || (bad.size
          ? "<b>One of those numbers is in two pieces.</b> A region has to be a "
            + "single connected block."
          : `Painting the <b>${pick}</b>. Every size from 1 to ${SIZES.length} is used `
            + "exactly once, and they add up to the whole field.");
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = finish;
        bar.appendChild(b);
      } else {
        const h = el("button", "ghost compact", "Hint (costs you)");
        h.onclick = hint;
        const c = el("button", "ghost compact", "Clear the field");
        c.disabled = !paint.some((v, i) => !locked[i] && v !== 0);
        c.onclick = () => {
          let wiped = false;
          for (let i = 0; i < N; i++) {
            if (locked[i]) continue;
            if (paint[i]) wiped = true;
            paint[i] = 0;
          }
          if (wiped) takeBacks++;
          message = ""; render();
        };
        bar.append(h, c);
      }
      wrap.appendChild(bar);
    }

    function finish() {
      const squares = [
        hints === 0 ? "🟩" : hints <= 2 ? "🟨" : "🟧",
        takeBacks <= 4 ? "🟩" : takeBacks <= 12 ? "🟨" : "🟧",
      ].join("") + (hints === 0 ? "🟩🟩🟩" : hints <= 2 ? "🟩🟩🟨" : "🟩🟨🟧");

      api.finish({
        headline: hints === 0
          ? `All ${SIZES.length} parcels, unaided`
          : `Carved with ${hints} hint${hints === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Regions", String(SIZES.length)],
          ["Clues given", String(Object.keys(givens).length)],
          ["Hints", String(hints)],
          ["Take-backs", String(takeBacks)],
        ],
        perfect: hints === 0 && takeBacks === 0,
        extra: [
          hints === 0 ? "🧠 unaided" : `💡 ${hints} hint${hints === 1 ? "" : "s"}`,
          takeBacks === 0 ? "🎯 never repainted a square" : `↩️ ${takeBacks} repaint${takeBacks === 1 ? "" : "s"}`,
        ],
      });
    }

    render();
  },
};
