import { el } from "./shared.js";
import { countSolutions, loopEdges, drawnLoopCount, drawnClueCounts } from "./fences-rules.js";

/* FENCES — draw closed loops through the dots so every numbered cell has
   exactly that many of its four sides used. The twist: each grid needs a
   stated number of SEPARATE loops, not one.

   That is the whole reason this exists as its own day. Loop puzzles train one
   reflex above all others — never close a loop early, since a closure that
   doesn't account for every clue must be wrong. Requiring two closures inverts
   it. Closing is now the goal, "is this ring finished or is it a mistake"
   stops being answerable from the ring alone, and the real work becomes
   partitioning the clues between two loops that never touch.

   The local deductions carry over unchanged — a 0 kills four segments, a 3
   beside a 3 forces the segment between them, a corner 1 kills two sides — so
   the opening is familiar and the endgame is not.

   The engine never compares your drawing to a stored answer. It counts the
   clue satisfaction and the number of closed components straight off the
   segments you drew, so any arrangement satisfying everything is accepted.
   There is exactly one per grid, checked exhaustively at authoring time and
   again here at mount. */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const rounds = puzzle.data.rounds; // [{ clues: [[n|null,...],...], loops }]
    const loopsFor = (rd) => rd.loops ?? 1;

    const solved = rounds.map((rd) => {
      const res = countSolutions(rd.clues, loopsFor(rd), 2);
      if (res.count !== 1) throw new Error(`fences: grid has ${res.count} solutions, must have exactly 1`);
      return loopEdges(res.solutions[0]);
    });

    let idx = 0;
    let hints = 0, misfires = 0;
    const perRound = [];
    let h, v, rows, cols;

    const intro = el("p", "q-detail center");
    root.appendChild(intro);

    const header = el("div", "q-detail center");
    root.appendChild(header);

    const wrap = el("div");
    wrap.style.margin = "0 auto";
    wrap.style.maxWidth = "340px";
    root.appendChild(wrap);

    const status = el("div", "order-feedback show");
    root.appendChild(status);

    const btnRow = el("div", "stack");
    btnRow.style.flexDirection = "row";
    btnRow.style.justifyContent = "center";
    btnRow.style.gap = "10px";
    const hintBtn = el("button", "ghost compact", "Hint");
    const clearBtn = el("button", "ghost compact", "Clear");
    btnRow.append(hintBtn, clearBtn);
    root.appendChild(btnRow);

    function startRound() {
      const want = loopsFor(rounds[idx]);
      intro.textContent =
        `Draw exactly ${want} separate closed loops. They may not touch or cross. Each number says ` +
        "how many of that cell's four sides get used. Tap a gap to draw a segment, again to rule it out, again to clear.";
      const clues = rounds[idx].clues;
      rows = clues.length; cols = clues[0].length;
      h = Array.from({ length: rows + 1 }, () => new Array(cols).fill(0));
      v = Array.from({ length: rows }, () => new Array(cols + 1).fill(0));
      status.textContent = "";
      render();
    }

    // 0 = empty, 1 = segment drawn, 2 = ruled out
    const cycle = (x) => (x + 1) % 3;

    function renderHeader() {
      const want = loopsFor(rounds[idx]);
      const have = drawnLoopCount(h, v, rows, cols);
      const closed = have == null ? "—" : have;
      header.innerHTML = `Grid ${idx + 1} of ${rounds.length} &middot; ${closed}/${want} loops closed${hints ? ` &middot; ${hints} hint${hints === 1 ? "" : "s"}` : ""}`;
    }

    function render() {
      renderHeader();
      const clues = rounds[idx].clues;
      wrap.innerHTML = "";
      const g = el("div");
      g.style.display = "grid";
      // dot, gap, dot, gap ... — thin tracks for the segments, fat for cells
      g.style.gridTemplateColumns = `repeat(${cols}, 10px 1fr) 10px`;
      g.style.gridTemplateRows = `repeat(${rows}, 10px 1fr) 10px`;
      g.style.aspectRatio = "1";
      g.style.width = "100%";
      wrap.appendChild(g);

      const place = (node, r, c, rs = 1, cs = 1) => {
        node.style.gridRow = `${r + 1} / span ${rs}`;
        node.style.gridColumn = `${c + 1} / span ${cs}`;
        g.appendChild(node);
      };

      for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) {
        const d = el("div");
        d.style.background = "rgba(255,255,255,.45)";
        d.style.borderRadius = "50%";
        d.style.width = "5px"; d.style.height = "5px";
        d.style.margin = "auto";
        place(d, r * 2, c * 2);
      }

      for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) {
        place(seg(h[r][c], () => { h[r][c] = cycle(h[r][c]); after(); }, true), r * 2, c * 2 + 1);
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
        place(seg(v[r][c], () => { v[r][c] = cycle(v[r][c]); after(); }, false), r * 2 + 1, c * 2);
      }

      const counts = drawnClueCounts(h, v, rows, cols);
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const n = clues[r][c];
        const cell = el("div", null, n == null ? "" : String(n));
        cell.style.display = "grid";
        cell.style.placeItems = "center";
        cell.style.fontVariantNumeric = "tabular-nums";
        cell.style.fontSize = "clamp(13px, 4vw, 17px)";
        cell.style.userSelect = "none";
        // Over-drawn is always a mistake; exactly-met is quietly dimmed, which
        // is the one bit of bookkeeping worth doing for the player.
        cell.style.color = n == null ? "transparent"
          : counts[r][c] > n ? "var(--bad, #d1655e)"
          : counts[r][c] === n ? "rgba(255,255,255,.3)" : "var(--fg, #e8e6e1)";
        place(cell, r * 2 + 1, c * 2 + 1);
      }
    }

    function seg(state, onTap, horizontal) {
      const b = el("button");
      b.style.border = "none";
      b.style.background = "transparent";
      b.style.padding = "0";
      b.style.cursor = "pointer";
      b.style.display = "grid";
      b.style.placeItems = "center";
      const mark = el("div");
      if (state === 1) {
        mark.style.background = "var(--accent, #c8a45c)";
        mark.style.borderRadius = "2px";
        if (horizontal) { mark.style.height = "4px"; mark.style.width = "100%"; }
        else { mark.style.width = "4px"; mark.style.height = "100%"; }
      } else if (state === 2) {
        mark.textContent = "×";
        mark.style.color = "rgba(255,255,255,.3)";
        mark.style.fontSize = "11px";
        mark.style.lineHeight = "1";
      }
      b.appendChild(mark);
      b.onclick = onTap;
      return b;
    }

    function after() {
      render();
      const clues = rounds[idx].clues;
      const counts = drawnClueCounts(h, v, rows, cols);
      const cluesOk = clues.every((row, r) => row.every((n, c) => n == null || counts[r][c] === n));
      const want = loopsFor(rounds[idx]);
      const have = drawnLoopCount(h, v, rows, cols);
      if (have == null) { status.textContent = "That leaves a loose end or a crossing."; return; }
      if (have !== want) return;
      if (cluesOk) {
        status.textContent = `${want} loops closed, every clue satisfied.`;
        perRound.push({ hints });
        setTimeout(next, 400);
      } else {
        // The right number of loops but a broken clue: the near-miss worth naming.
        misfires++;
        status.textContent = `That's ${want} closed loops, but they don't match every number.`;
      }
    }

    function next() {
      if (idx < rounds.length - 1) { idx++; hints = 0; startRound(); }
      else finish();
    }

    hintBtn.onclick = () => {
      const sol = solved[idx];
      const wrong = [];
      for (let r = 0; r <= rows; r++) for (let c = 0; c < cols; c++) {
        if ((h[r][c] === 1 ? 1 : 0) !== sol.h[r][c]) wrong.push(["h", r, c]);
      }
      for (let r = 0; r < rows; r++) for (let c = 0; c <= cols; c++) {
        if ((v[r][c] === 1 ? 1 : 0) !== sol.v[r][c]) wrong.push(["v", r, c]);
      }
      if (!wrong.length) return;
      const [kind, r, c] = wrong[Math.floor(Math.random() * wrong.length)];
      if (kind === "h") h[r][c] = sol.h[r][c] ? 1 : 2; else v[r][c] = sol.v[r][c] ? 1 : 2;
      hints++;
      after();
    };

    clearBtn.onclick = () => { startRound(); };

    startRound();

    function finish() {
      root.innerHTML = "";
      const totalHints = perRound.reduce((a, p) => a + p.hints, 0);
      const clean = totalHints === 0 && misfires === 0;

      root.appendChild(el("div", "reveal-badge " + (clean ? "good" : "ok"),
        clean ? "🚧 Both loops closed unaided"
              : `🚧 Solved &middot; ${totalHints} hint${totalHints === 1 ? "" : "s"}`));

      const nums = el("div", "reveal-nums");
      nums.append(
        el("div", null, `<span>Grids solved</span><b>${rounds.length}</b>`),
        el("div", null, `<span>Hints</span><b>${totalHints}</b>`),
        el("div", null, `<span>Wrong loops closed</span><b>${misfires}</b>`),
      );
      root.appendChild(nums);

      const notes = solved.map((sol, i) => {
        const rws = rounds[i].clues.length, cls = rounds[i].clues[0].length;
        const lines = [];
        for (let r = 0; r <= rws; r++) {
          let top = "", mid = "";
          for (let c = 0; c < cls; c++) top += "·" + (sol.h[r][c] ? "──" : "  ");
          top += "·";
          if (r < rws) for (let c = 0; c <= cls; c++) mid += (sol.v[r][c] ? "│" : " ") + (c < cls ? "  " : "");
          lines.push(top);
          if (r < rws) lines.push(mid);
        }
        return `Grid ${i + 1} — the only pair of loops that fits:<br><span style="font-family:ui-monospace,monospace;white-space:pre;line-height:1.05">${lines.join("<br>")}</span>`;
      });
      notes.push(
        "Ordinary loop puzzles teach you never to close early — any closure that ignores a clue must be wrong. Asking for two closures inverts that, and the endgame becomes deciding which clues belong to which loop. The solver never searches over segments: it two-colours the cells inside/outside, since disjoint loops are exactly a colouring whose outside stays connected around the border and whose inside splits into that many components. Both grids were checked for a unique answer before shipping, and again at load."
      );

      api.finish({
        headline: clean ? "Both grids, no hints" : `Both grids · ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
        squares: perRound.map((p) => (p.hints === 0 ? "🟩" : "🟨")).join(""),
        stats: [
          ["Grids", `${rounds.length}/${rounds.length}`],
          ["Hints", String(totalHints)],
          ["Wrong loops closed", String(misfires)],
        ],
        perfect: clean,
        extra: [
          totalHints === 0 ? "🚧 unaided" : `💡 ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
          misfires === 0 ? "🔒 no false closes" : `🔓 ${misfires} false close${misfires === 1 ? "" : "s"}`,
        ],
        notes,
      });
    }
  },
};
