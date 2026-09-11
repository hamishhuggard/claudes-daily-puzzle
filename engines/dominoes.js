import { el } from "./shared.js";
import { allPieces, pieceKey, countSolutions, readDissection } from "./dominoes-rules.js";

/* THE DOUBLE BLANK — cut a rectangle of digits into a full domino set. The
   twist: the set laid on the grid isn't clean. One piece was placed TWICE and
   one piece is MISSING, so the usual "cross a piece off the list as you place
   it, done when the list is empty" bookkeeping still empties out at the right
   count — it's just lying about one of those crossings-off. Dissecting the
   grid isn't the whole puzzle; naming which piece doubled and which vanished
   is.

   Grading never touches a stored answer. Any complete dissection (every
   digit paired with exactly one neighbour) produces a piece tally straight
   off the drawn joins, and the win condition is a property of that tally —
   exactly one piece at count 2, exactly one at count 0, everything else
   exactly 1 — not a comparison to a solution the engine already knows. There
   is exactly one dissection per grid satisfying that property, checked
   exhaustively at authoring time and again here at mount. */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const rounds = puzzle.data.rounds; // [{ grid: number[][], maxPips }]

    const solved = rounds.map((rd) => {
      const res = countSolutions(rd.grid, rd.maxPips, 2);
      if (res.count !== 1) throw new Error(`dominoes: grid has ${res.count} solutions, must have exactly 1`);
      return res.solutions[0];
    });

    let idx = 0;
    let hints = 0, misfires = 0;
    const perRound = [];
    let grid, rows, cols, maxPips, hJoin, vJoin, pickDup, pickMiss;

    const intro = el("p", "q-detail center");
    root.appendChild(intro);

    const header = el("div", "q-detail center");
    root.appendChild(header);

    const wrap = el("div");
    wrap.style.margin = "0 auto";
    wrap.style.maxWidth = "420px";
    root.appendChild(wrap);

    const status = el("div", "order-feedback show");
    root.appendChild(status);

    const pickWrap = el("div");
    pickWrap.style.margin = "12px auto 0";
    pickWrap.style.maxWidth = "420px";
    root.appendChild(pickWrap);

    const btnRow = el("div", "stack");
    btnRow.style.flexDirection = "row";
    btnRow.style.justifyContent = "center";
    btnRow.style.gap = "10px";
    const hintBtn = el("button", "ghost compact", "Hint");
    const clearBtn = el("button", "ghost compact", "Clear");
    const submitBtn = el("button", "ghost compact", "Submit");
    btnRow.append(hintBtn, clearBtn, submitBtn);
    root.appendChild(btnRow);

    function startRound() {
      intro.textContent =
        "Tap a gap between two digits to join them into a domino, again to unjoin. Every digit joins exactly one " +
        "neighbour. When the grid is fully dissected, pick the piece that's doubled and the piece that's missing.";
      grid = rounds[idx].grid;
      maxPips = rounds[idx].maxPips;
      rows = grid.length; cols = grid[0].length;
      hJoin = Array.from({ length: rows }, () => new Array(cols - 1).fill(0));
      vJoin = Array.from({ length: rows - 1 }, () => new Array(cols).fill(0));
      pickDup = null; pickMiss = null;
      status.textContent = "";
      render();
    }

    function renderHeader(state) {
      const n = allPieces(maxPips).length;
      header.innerHTML = `Grid ${idx + 1} of ${rounds.length} &middot; double-${maxPips} set (${n} pieces)` +
        (hints ? ` &middot; ${hints} hint${hints === 1 ? "" : "s"}` : "");
    }

    function render() {
      const state = readDissection(grid, hJoin, vJoin, maxPips);
      renderHeader(state);
      wrap.innerHTML = "";

      const g = el("div");
      g.style.display = "grid";
      // digit, gap, digit, gap ... — thin tracks for seams, fat for cells
      g.style.gridTemplateColumns = `repeat(${cols}, 1fr 8px) 0`;
      g.style.gridTemplateRows = `repeat(${rows}, 1fr 8px) 0`;
      g.style.aspectRatio = `${cols} / ${rows}`;
      g.style.width = "100%";
      wrap.appendChild(g);

      const place = (node, r, c, rs = 1, cs = 1) => {
        node.style.gridRow = `${r + 1} / span ${rs}`;
        node.style.gridColumn = `${c + 1} / span ${cs}`;
        g.appendChild(node);
      };

      const overlapSet = new Set(state.overlaps.map(([r, c]) => `${r},${c}`));

      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const cell = el("div", null, String(grid[r][c]));
        cell.style.display = "grid";
        cell.style.placeItems = "center";
        cell.style.fontVariantNumeric = "tabular-nums";
        cell.style.fontSize = "clamp(14px, 4.5vw, 19px)";
        cell.style.userSelect = "none";
        cell.style.background = "rgba(255,255,255,.06)";
        cell.style.color = overlapSet.has(`${r},${c}`) ? "var(--bad, #d1655e)" : "var(--fg, #e8e6e1)";
        place(cell, r * 2, c * 2);
      }

      for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 1; c++) {
        place(seam(hJoin[r][c], () => { hJoin[r][c] = hJoin[r][c] ? 0 : 1; after(); }, true), r * 2, c * 2 + 1);
      }
      for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) {
        place(seam(vJoin[r][c], () => { vJoin[r][c] = vJoin[r][c] ? 0 : 1; after(); }, false), r * 2 + 1, c * 2);
      }

      renderPicker(state);
    }

    function seam(joined, onTap, horizontal) {
      const b = el("button");
      b.style.border = "none";
      b.style.background = "transparent";
      b.style.padding = "0";
      b.style.cursor = "pointer";
      b.style.display = "grid";
      b.style.placeItems = "center";
      const mark = el("div");
      if (joined) {
        mark.style.background = "var(--accent, #c8a45c)";
        if (horizontal) { mark.style.height = "60%"; mark.style.width = "100%"; }
        else { mark.style.width = "60%"; mark.style.height = "100%"; }
        mark.style.borderRadius = "2px";
      }
      b.appendChild(mark);
      b.onclick = onTap;
      return b;
    }

    function renderPicker(state) {
      pickWrap.innerHTML = "";
      const pieces = allPieces(maxPips);

      const label = (title) => {
        const d = el("div", null, title);
        d.style.fontSize = "12px";
        d.style.opacity = "0.65";
        d.style.margin = "10px 0 4px";
        d.style.textAlign = "center";
        return d;
      };

      const list = (which, current, set) => {
        const row = el("div");
        row.style.display = "flex";
        row.style.flexWrap = "wrap";
        row.style.justifyContent = "center";
        row.style.gap = "5px";
        for (const [a, b] of pieces) {
          const key = pieceKey(a, b);
          const btn = el("button", "ghost compact", `${a}-${b}`);
          btn.style.fontVariantNumeric = "tabular-nums";
          btn.style.opacity = current && pieceKey(...current) === key ? "1" : "0.55";
          btn.style.borderColor = current && pieceKey(...current) === key ? "var(--accent, #c8a45c)" : "";
          btn.onclick = () => { set([a, b]); after(); };
          row.appendChild(btn);
        }
        return row;
      };

      pickWrap.appendChild(label("Which piece is doubled?"));
      pickWrap.appendChild(list("dup", pickDup, (v) => { pickDup = v; }));
      pickWrap.appendChild(label("Which piece is missing?"));
      pickWrap.appendChild(list("miss", pickMiss, (v) => { pickMiss = v; }));

      if (!state.complete) {
        status.textContent = state.overlaps.length ? "A digit can only join one neighbour." : "";
      } else if (!state.valid) {
        status.textContent = "Every digit is paired, but that tally isn't a legal double-blank set — one piece more than doubled, or more than one missing.";
      } else {
        status.textContent = "Dissection complete. Confirm the duplicate and the missing piece, then Submit.";
      }
    }

    function after() { render(); }

    submitBtn.onclick = () => {
      const state = readDissection(grid, hJoin, vJoin, maxPips);
      if (!state.valid) {
        misfires++;
        status.textContent = "Not finished, or the tally doesn't work out yet.";
        return;
      }
      if (!pickDup || !pickMiss || pieceKey(...pickDup) !== pieceKey(...state.duplicate) || pieceKey(...pickMiss) !== pieceKey(...state.missing)) {
        misfires++;
        status.textContent = "The dissection is right, but that's not the duplicate/missing pair.";
        return;
      }
      status.textContent = "Correct — that dissection, and that duplicate and missing piece.";
      perRound.push({ hints });
      setTimeout(next, 500);
    };

    function next() {
      if (idx < rounds.length - 1) { idx++; hints = 0; startRound(); }
      else finish();
    }

    hintBtn.onclick = () => {
      const sol = solved[idx];
      // Build the target join grids from the unique solution.
      const th = Array.from({ length: rows }, () => new Array(cols - 1).fill(0));
      const tv = Array.from({ length: rows - 1 }, () => new Array(cols).fill(0));
      for (const d of sol.dominoes) {
        const [[r1, c1], [r2, c2]] = d.cells;
        if (r1 === r2) th[r1][Math.min(c1, c2)] = 1;
        else tv[Math.min(r1, r2)][c1] = 1;
      }
      const wrong = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols - 1; c++) if (hJoin[r][c] !== th[r][c]) wrong.push(["h", r, c]);
      for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols; c++) if (vJoin[r][c] !== tv[r][c]) wrong.push(["v", r, c]);

      if (wrong.length) {
        const [kind, r, c] = wrong[Math.floor(Math.random() * wrong.length)];
        if (kind === "h") hJoin[r][c] = th[r][c]; else vJoin[r][c] = tv[r][c];
        hints++;
        after();
        return;
      }
      // Dissection already matches the solution — reveal duplicate or missing next.
      if (!pickDup || pieceKey(...pickDup) !== pieceKey(...sol.duplicate)) { pickDup = sol.duplicate.slice(); hints++; after(); return; }
      if (!pickMiss || pieceKey(...pickMiss) !== pieceKey(...sol.missing)) { pickMiss = sol.missing.slice(); hints++; after(); return; }
    };

    clearBtn.onclick = () => { startRound(); };

    startRound();

    function finish() {
      root.innerHTML = "";
      const totalHints = perRound.reduce((a, p) => a + p.hints, 0);
      const clean = totalHints === 0 && misfires === 0;

      root.appendChild(el("div", "reveal-badge " + (clean ? "good" : "ok"),
        clean ? "🁢 Both sets untangled unaided"
              : `🁢 Solved &middot; ${totalHints} hint${totalHints === 1 ? "" : "s"}`));

      const nums = el("div", "reveal-nums");
      nums.append(
        el("div", null, `<span>Grids solved</span><b>${rounds.length}</b>`),
        el("div", null, `<span>Hints</span><b>${totalHints}</b>`),
        el("div", null, `<span>Wrong submissions</span><b>${misfires}</b>`),
      );
      root.appendChild(nums);

      const notes = solved.map((sol, i) => {
        const [da, db] = sol.duplicate, [ma, mb] = sol.missing;
        return `Grid ${i + 1} — the double-${rounds[i].maxPips} set laid out with ${da}-${db} doubled and ${ma}-${mb} missing.`;
      });
      notes.push(
        "Every dissection puzzle's endgame is the same tally: cross off each piece as it's placed, and an empty list means you're finished. Breaking the tally itself — letting one crossing-off happen twice and one never happen, while the count of tiles still comes out right — means you can't trust the list until the grid is fully cut and you read back what actually got placed."
      );

      api.finish({
        headline: clean ? "Both sets, no hints" : `Both sets · ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
        squares: perRound.map((p) => (p.hints === 0 ? "🟩" : "🟨")).join(""),
        stats: [
          ["Grids", `${rounds.length}/${rounds.length}`],
          ["Hints", String(totalHints)],
          ["Wrong submissions", String(misfires)],
        ],
        perfect: clean,
        extra: [
          totalHints === 0 ? "🁢 unaided" : `💡 ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
          misfires === 0 ? "✅ clean tally" : `❗ ${misfires} wrong submission${misfires === 1 ? "" : "s"}`,
        ],
        notes,
      });
    }
  },
};
