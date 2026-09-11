import { el } from "./shared.js";
import { solve, readDrawing, pathEdges, pearlAt } from "./pearls-rules.js";

/* PEARLS — "open water"

   Masyu's two pearl rules, on a line that is not a loop. A white pearl is run
   straight through and has a turn immediately beside it; a black pearl is
   turned on and the line runs straight for two cells out of both of its ends.
   The line has to call at every pearl, never cross itself, and — the change —
   start at one anchor and stop at the other instead of closing.

   Loop solvers lean on parity and on "a cell with one line and nowhere to go
   is a contradiction". Neither survives here: the two anchors are exactly
   where the line is allowed to dead-end, and any cut through the grid is now
   crossed an odd number of times if it separates the anchors. What is left is
   pearl logic and reachability, which is the whole point of the day.

   The engine never grades against a stored answer — it reads the segments the
   player drew and checks the rules. Each grid is proved to have exactly one
   answer at authoring time and again here at mount. */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const rounds = puzzle.data.rounds;

    const answers = rounds.map((rd, i) => {
      const sols = solve(spec(rd), 2);
      if (sols.length !== 1) throw new Error(`pearls: grid ${i + 1} has ${sols.length} answers, must have 1`);
      return sols[0];
    });

    function spec(rd) {
      return { rows: rd.rows, cols: rd.cols, start: rd.start, end: rd.end, pearls: rd.pearls };
    }

    let idx = 0, hints = 0, misfires = 0;
    const perRound = [];
    let h, v, sp;

    const intro = el("p", "q-detail center");
    const header = el("div", "q-detail center");
    const wrap = el("div");
    wrap.style.margin = "0 auto";
    wrap.style.maxWidth = "360px";
    const status = el("div", "order-feedback show");
    root.append(intro, header, wrap, status);

    const btnRow = el("div", "stack");
    btnRow.style.flexDirection = "row";
    btnRow.style.justifyContent = "center";
    btnRow.style.gap = "10px";
    const hintBtn = el("button", "ghost compact", "Hint");
    const clearBtn = el("button", "ghost compact", "Clear");
    btnRow.append(hintBtn, clearBtn);
    root.appendChild(btnRow);

    function startRound() {
      sp = spec(rounds[idx]);
      h = Array.from({ length: sp.rows }, () => new Array(sp.cols - 1).fill(0));
      v = Array.from({ length: sp.rows - 1 }, () => new Array(sp.cols).fill(0));
      intro.textContent =
        "Draw one line from anchor to anchor. It never crosses itself and it calls at every pearl. "
        + "White: run straight through, with a turn in one of the cells beside it. "
        + "Black: turn here, then two straight cells out of both ends. Tap a gap to draw, again to rule out, again to clear.";
      status.textContent = "";
      render();
    }

    const cycle = (x) => (x + 1) % 3;

    function render() {
      const read = readDrawing(sp, h, v);
      header.innerHTML = `Grid ${idx + 1} of ${rounds.length}`
        + `${hints ? ` &middot; ${hints} hint${hints === 1 ? "" : "s"}` : ""}`;

      wrap.innerHTML = "";
      const g = el("div");
      g.style.display = "grid";
      g.style.gridTemplateColumns = `repeat(${sp.cols - 1}, 1fr 12px) 1fr`;
      g.style.gridTemplateRows = `repeat(${sp.rows - 1}, 1fr 12px) 1fr`;
      g.style.aspectRatio = "1";
      g.style.width = "100%";
      wrap.appendChild(g);

      const place = (node, r, c) => {
        node.style.gridRow = `${r + 1}`;
        node.style.gridColumn = `${c + 1}`;
        g.appendChild(node);
      };

      for (let r = 0; r < sp.rows; r++) for (let c = 0; c < sp.cols; c++) {
        place(cellNode(r, c, read), r * 2, c * 2);
      }
      for (let r = 0; r < sp.rows; r++) for (let c = 0; c < sp.cols - 1; c++) {
        place(seg(h[r][c], () => { h[r][c] = cycle(h[r][c]); after(); }, true), r * 2, c * 2 + 1);
      }
      for (let r = 0; r < sp.rows - 1; r++) for (let c = 0; c < sp.cols; c++) {
        place(seg(v[r][c], () => { v[r][c] = cycle(v[r][c]); after(); }, false), r * 2 + 1, c * 2);
      }
    }

    function cellNode(r, c, read) {
      const isStart = r === sp.start[0] && c === sp.start[1];
      const isEnd = r === sp.end[0] && c === sp.end[1];
      const kind = pearlAt(sp, r, c);
      const d = el("div");
      d.style.display = "grid";
      d.style.placeItems = "center";
      d.style.aspectRatio = "1";
      /* The line has to read as one line, so each cell draws stubs from its
         centre out to whichever of its four edges are drawn. */
      d.style.position = "relative";
      const e = { up: r > 0 && v[r - 1][c] === 1, down: r < sp.rows - 1 && v[r][c] === 1,
                  left: c > 0 && h[r][c - 1] === 1, right: c < sp.cols - 1 && h[r][c] === 1 };
      for (const [side, on] of Object.entries(e)) {
        if (!on) continue;
        const s = el("div");
        s.style.position = "absolute";
        s.style.background = "var(--accent, #e8825a)";
        if (side === "up" || side === "down") {
          s.style.width = "4px"; s.style.height = "52%"; s.style.left = "calc(50% - 2px)";
          s.style[side === "up" ? "top" : "bottom"] = "0";
        } else {
          s.style.height = "4px"; s.style.width = "52%"; s.style.top = "calc(50% - 2px)";
          s.style[side === "left" ? "left" : "right"] = "0";
        }
        d.appendChild(s);
      }

      const dot = el("div");
      dot.style.position = "relative";
      dot.style.borderRadius = "50%";
      dot.style.width = "68%"; dot.style.height = "68%";
      if (isStart || isEnd) {
        dot.style.background = "var(--accent, #e8825a)";
        dot.style.display = "grid";
        dot.style.placeItems = "center";
        dot.style.fontSize = "14px";
        dot.style.fontWeight = "800";
        dot.style.color = "var(--accent-ink, #2a1006)";
        dot.textContent = "⚓";
      } else if (kind === "W") {
        /* Named for the pearl, not for the ink: a white pearl is the solid
           pale one, a black pearl the dark one with a pale rim. */
        dot.style.background = "rgba(236,234,243,.92)";
      } else if (kind === "B") {
        dot.style.background = "#0b0d12";
        dot.style.boxShadow = "inset 0 0 0 2.5px rgba(236,234,243,.9)";
      } else {
        dot.style.width = "5px"; dot.style.height = "5px";
        dot.style.background = read.deg && read.deg[r][c] ? "var(--accent, #e8825a)" : "rgba(255,255,255,.22)";
      }
      d.appendChild(dot);
      return d;
    }

    function seg(state, onTap, horizontal) {
      const b = el("button");
      b.style.border = "none";
      b.style.background = "transparent";
      b.style.padding = "0";
      b.style.display = "grid";
      b.style.placeItems = "center";
      const mark = el("div");
      if (state === 1) {
        mark.style.background = "var(--accent, #e8825a)";
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
      const read = readDrawing(sp, h, v);
      render();
      if (read.state === "solved") {
        status.textContent = "Anchor to anchor, every pearl obeyed.";
        perRound.push({ hints });
        setTimeout(next, 500);
        return;
      }
      /* A finished-looking line that breaks a pearl is the near miss worth
         naming; an unfinished one is just work in progress. */
      if (read.state === "wrong" || read.state === "bad") misfires++;
      status.textContent = read.state === "empty" ? "" : (read.msg || "");
    }

    function next() {
      if (idx < rounds.length - 1) { idx++; hints = 0; startRound(); }
      else finish();
    }

    hintBtn.onclick = () => {
      const sol = pathEdges(sp, answers[idx]);
      const wrong = [];
      for (let r = 0; r < sp.rows; r++) for (let c = 0; c < sp.cols - 1; c++) {
        if ((h[r][c] === 1 ? 1 : 0) !== sol.h[r][c]) wrong.push(["h", r, c]);
      }
      for (let r = 0; r < sp.rows - 1; r++) for (let c = 0; c < sp.cols; c++) {
        if ((v[r][c] === 1 ? 1 : 0) !== sol.v[r][c]) wrong.push(["v", r, c]);
      }
      if (!wrong.length) return;
      const [kind, r, c] = wrong[Math.floor(Math.random() * wrong.length)];
      if (kind === "h") h[r][c] = sol.h[r][c] ? 1 : 2; else v[r][c] = sol.v[r][c] ? 1 : 2;
      hints++;
      after();
    };

    clearBtn.onclick = startRound;
    startRound();

    function finish() {
      root.innerHTML = "";
      const totalHints = perRound.reduce((a, p) => a + p.hints, 0);
      const clean = totalHints === 0 && misfires === 0;

      root.appendChild(el("div", "reveal-badge " + (clean ? "good" : "ok"),
        clean ? "🫧 Both lines drawn unaided"
              : `🫧 Solved &middot; ${totalHints} hint${totalHints === 1 ? "" : "s"}`));

      const nums = el("div", "reveal-nums");
      nums.append(
        el("div", null, `<span>Grids solved</span><b>${rounds.length}</b>`),
        el("div", null, `<span>Hints</span><b>${totalHints}</b>`),
        el("div", null, `<span>Wrong lines</span><b>${misfires}</b>`),
      );
      root.appendChild(nums);

      const notes = answers.map((path, i) => {
        const rd = rounds[i];
        const on = new Map(path.map(([r, c], j) => [`${r},${c}`, j]));
        const lines = [];
        for (let r = 0; r < rd.rows; r++) {
          let row = "";
          for (let c = 0; c < rd.cols; c++) {
            const j = on.get(`${r},${c}`);
            const kind = rd.pearls[`${r},${c}`];
            row += j == null ? " ·" : kind === "W" ? " ○" : kind === "B" ? " ●" : (j === 0 || j === path.length - 1) ? " ⚓" : " ▪";
          }
          lines.push(row);
        }
        return `Grid ${i + 1} — the only line that fits (${path.length} cells):<br>`
          + `<span style="font-family:ui-monospace,monospace;white-space:pre;line-height:1.15">${lines.join("<br>")}</span>`;
      });

      api.finish({
        headline: clean ? "Both grids, no hints" : `Both grids · ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
        squares: perRound.map((p) => (p.hints === 0 ? "🟩" : "🟨")).join(""),
        stats: [
          ["Grids", `${rounds.length}/${rounds.length}`],
          ["Hints", String(totalHints)],
          ["Wrong lines", String(misfires)],
        ],
        perfect: clean,
        extra: [
          totalHints === 0 ? "🫧 unaided" : `💡 ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
          misfires === 0 ? "🪢 no false finishes" : `✂️ ${misfires} false finish${misfires === 1 ? "" : "es"}`,
        ],
        notes,
      });
    }
  },
};
