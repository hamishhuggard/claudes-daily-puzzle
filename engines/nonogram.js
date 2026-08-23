import { el } from "./shared.js";
import { lineClue, deriveClues, countSolutions } from "./nonogram-rules.js";

/* Paint by numbers. A 10x10 picture is authored as a bitmap in the content
   file; the row/column run-length clues shown to the player are DERIVED from
   it here, never hand-authored, so they can never drift out of sync.

   Each cell cycles empty -> filled -> flagged-blank -> empty on tap, and a
   press-drag paints a run of cells to whatever the first cell became (with
   touch-action locked down so dragging across the board doesn't scroll the
   page). Rows and columns light up the moment their *filled* cells match
   their clue's run-lengths — real nonogram-solving feedback — but which
   individual cells are right or wrong is never shown.

   At mount time we brute-force/constraint-propagate the derived clue set and
   throw unless it has exactly one solution: a nonogram with more than one
   valid picture is a broken puzzle, not a hard one. */

const EMPTY = 0, FILLED = 1, FLAGGED = 2;

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const d = puzzle.data;
    const bitmap = d.bitmap.map((row) =>
      (Array.isArray(row) ? row : row.split("")).map((v) => !!Number(v)));
    const n = bitmap.length;
    if (!bitmap.every((row) => row.length === n)) {
      throw new Error("nonogram: bitmap must be square");
    }

    const solCount = countSolutions(bitmap, 2);
    if (solCount !== 1) {
      throw new Error(`nonogram: expected exactly one solution, found ${solCount === 0 ? 0 : "2+"}`);
    }
    const { rows: rowClues, cols: colClues } = deriveClues(bitmap);

    const state = Array.from({ length: n }, () => new Array(n).fill(EMPTY));

    root.appendChild(el("p", "q-detail center",
      "Tap a cell to fill it, tap again to flag it as definitely blank, tap once more to clear it. " +
      "A row or column glows once its filled cells match its clue."));

    const wrap = el("div", "stack");
    wrap.style.cssText = "align-items:center; gap:0;";
    root.appendChild(wrap);

    const cellPx = "min(7.6vw, 30px)";
    const clueColW = "clamp(28px, 9vw, 40px)";

    // Column-clue header row, offset by the row-clue gutter.
    const colHead = el("div");
    colHead.style.cssText =
      `display:grid; grid-template-columns:${clueColW} repeat(${n}, ${cellPx}); gap:2px;`;
    colHead.appendChild(el("div"));
    const colClueCells = colClues.map((clue) => {
      const c = el("div", null, clue.length ? clue.join("<br>") : "0");
      c.style.cssText =
        "font-size:.62rem; font-weight:700; text-align:center; line-height:1.15; " +
        "color:var(--faint); align-self:end; padding-bottom:3px;";
      colHead.appendChild(c);
      return c;
    });
    wrap.appendChild(colHead);

    // Body: row-clue gutter + the grid itself, one CSS-grid row per picture row.
    const body = el("div");
    body.style.cssText = "display:flex; flex-direction:column; gap:2px;";
    wrap.appendChild(body);

    const cellEls = Array.from({ length: n }, () => new Array(n));
    const rowClueCells = [];

    let dragging = false;
    let paintValue = FILLED;

    function nextState(v) {
      return v === EMPTY ? FILLED : v === FILLED ? FLAGGED : EMPTY;
    }

    function paint(r, c, value) {
      state[r][c] = value;
      const cellEl = cellEls[r][c];
      cellEl.classList.toggle("nono-filled", value === FILLED);
      cellEl.classList.toggle("nono-flagged", value === FLAGGED);
      cellEl.textContent = value === FLAGGED ? "×" : "";
      refreshLine(r, true);
      refreshLine(c, false);
    }

    function refreshLine(i, isRow) {
      const line = isRow ? state[i] : state.map((row) => row[i]);
      const clue = isRow ? rowClues[i] : colClues[i];
      const filled = line.map((v) => v === FILLED);
      const ok = JSON.stringify(lineClue(filled)) === JSON.stringify(clue);
      (isRow ? rowClueCells[i] : colClueCells[i]).classList.toggle("nono-satisfied", ok);
    }

    for (let r = 0; r < n; r++) {
      const rowEl = el("div");
      rowEl.style.cssText =
        `display:grid; grid-template-columns:${clueColW} repeat(${n}, ${cellPx}); gap:2px;`;

      const clueEl = el("div", null, rowClues[r].length ? rowClues[r].join(" ") : "0");
      clueEl.style.cssText =
        "font-size:.62rem; font-weight:700; text-align:right; padding-right:5px; " +
        "align-self:center; color:var(--faint); white-space:nowrap;";
      rowEl.appendChild(clueEl);
      rowClueCells.push(clueEl);

      for (let c = 0; c < n; c++) {
        const cellEl = el("div");
        cellEl.style.cssText =
          `width:${cellPx}; height:${cellPx}; border-radius:3px; border:1px solid var(--line, rgba(255,255,255,.14)); ` +
          "background:var(--panel-2, rgba(255,255,255,.04)); display:flex; align-items:center; justify-content:center; " +
          "font-size:.7rem; font-weight:800; color:var(--faint); touch-action:none; user-select:none; cursor:pointer;";
        cellEl.dataset.r = r;
        cellEl.dataset.c = c;

        cellEl.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          dragging = true;
          paintValue = nextState(state[r][c]);
          paint(r, c, paintValue);
          cellEl.setPointerCapture?.(e.pointerId);
        });
        cellEl.addEventListener("pointerenter", () => {
          if (dragging && state[r][c] !== paintValue) paint(r, c, paintValue);
        });
        rowEl.appendChild(cellEl);
        cellEls[r][c] = cellEl;
      }
      body.appendChild(rowEl);
    }

    // pointerenter alone misses fast drags on touch (capture stays on the
    // origin cell), so also hit-test under the pointer on move.
    body.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const target = document.elementFromPoint(e.clientX, e.clientY);
      if (target && target.dataset && target.dataset.r != null) {
        const r = Number(target.dataset.r), c = Number(target.dataset.c);
        if (state[r][c] !== paintValue) paint(r, c, paintValue);
      }
    });
    const stopDrag = () => { dragging = false; };
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);

    for (let i = 0; i < n; i++) { refreshLine(i, true); refreshLine(i, false); }

    const feedback = el("div", "order-feedback", "&nbsp;");
    root.appendChild(feedback);

    const finishBtn = el("button", "primary", "Finish");
    root.appendChild(finishBtn);

    let attempts = 0;

    finishBtn.onclick = () => {
      let wrongFills = 0, missing = 0;
      for (let r = 0; r < n; r++) {
        for (let c = 0; c < n; c++) {
          const isFilled = state[r][c] === FILLED;
          if (isFilled && !bitmap[r][c]) wrongFills++;
          if (!isFilled && bitmap[r][c]) missing++;
        }
      }
      const finished = missing === 0;
      if (!finished) {
        attempts++;
        feedback.className = "order-feedback show";
        feedback.textContent = `Not finished yet — ${missing} cell${missing === 1 ? "" : "s"} of the picture still unfilled.`;
        return;
      }
      done(wrongFills, attempts);
    };

    function done(wrongFills, attempts) {
      root.innerHTML = "";
      const perfect = wrongFills === 0;

      root.appendChild(el("div", "reveal-badge " + (perfect ? "good" : wrongFills <= 3 ? "ok" : "bad"),
        `🖼️ ${perfect ? "Clean solve" : `${wrongFills} wrong fill${wrongFills === 1 ? "" : "s"}`}`));

      const grid = el("div", "reveal-nums");
      grid.append(
        el("div", null, `<span>Wrong fills</span><b>${wrongFills}</b>`),
        el("div", null, `<span>Finish attempts</span><b>${attempts + 1}</b>`),
      );
      root.appendChild(grid);

      // The only place the picture is shown — after the player has already
      // solved it, as a small congratulatory reveal, not a spoiler.
      const pic = el("div", "center q-detail");
      pic.style.cssText = "font-family:monospace; line-height:1.05; letter-spacing:2px;";
      pic.innerHTML = bitmap.map((row) => row.map((v) => (v ? "⬛" : "⬜")).join("")).join("<br>");
      root.appendChild(pic);

      // Spoiler-free for the share card: a performance row, never the picture.
      const squares = (perfect ? "🖼️✨" : "🖼️") + "🟥".repeat(Math.min(wrongFills, 5)) +
        (attempts > 0 ? "🔁".repeat(Math.min(attempts, 3)) : "");

      api.finish({
        headline: perfect
          ? "Painted it clean — zero wrong fills"
          : `Finished with ${wrongFills} wrong fill${wrongFills === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Wrong fills", String(wrongFills)],
          ["Finish attempts", String(attempts + 1)],
          ["Verdict", perfect ? "Par" : wrongFills <= 3 ? "Close" : "Rough"],
        ],
        perfect,
        extra: [
          wrongFills === 0 ? "🎯 zero wrong fills" : `🟥 ${wrongFills} wrong fill${wrongFills === 1 ? "" : "s"}`,
          attempts === 0 ? "✅ finished on the first try" : `🔁 ${attempts} incomplete attempt${attempts === 1 ? "" : "s"}`,
        ],
        notes: buildNotes(),
      });
    }

    // A little teaching pass over the actual clue set, not generic filler.
    function buildNotes() {
      const emptyLines = [];
      rowClues.forEach((c, i) => { if (c.length === 0) emptyLines.push(`row ${i + 1}`); });
      colClues.forEach((c, i) => { if (c.length === 0) emptyLines.push(`column ${i + 1}`); });
      let widest = { i: -1, isRow: true, sum: -1 };
      [rowClues, colClues].forEach((clues, side) => {
        clues.forEach((c, i) => {
          const sum = c.reduce((a, b) => a + b, 0);
          if (sum > widest.sum) widest = { i, isRow: side === 0, sum };
        });
      });
      const notes = [
        `A clue of “0” — no numbers at all — is the fastest cell you'll ever fix: the whole line is blank on sight, ` +
        `no cross-referencing needed. This picture had ${emptyLines.length ? emptyLines.join(", ") : "no fully-blank lines"} going in for free.`,
        `The most-constrained line here was ${widest.isRow ? "row" : "column"} ${widest.i + 1}, with clue ` +
        `[${(widest.isRow ? rowClues[widest.i] : colClues[widest.i]).join(", ")}] against ${n} cells — the less slack a line has, ` +
        `the more of it you can fix before touching anything perpendicular to it.`,
        `The clue set was checked by brute force at load time to admit exactly one 10×10 solution — a nonogram with two valid ` +
        `pictures for the same clues isn't a harder puzzle, it's a broken one, so that check is non-negotiable before this ships.`,
      ];
      return notes;
    }
  },
};
