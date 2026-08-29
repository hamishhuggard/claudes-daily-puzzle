import { el } from "./shared.js";
import { TREE, countSolutions, check } from "./campsite-rules.js";

/* CAMPSITE — pitch one tent for every tree. Both adjacency rules run on the
   diagonal, which is the inversion the puzzle is built on: a tent sits
   DIAGONALLY from its tree, and tents may not meet CORNER TO CORNER, though
   they may stand shoulder to shoulder in an unbroken row.

   Committing to a tent therefore forces an X of grass around it rather than a
   cross, so constraint travels along diagonals, and rows of touching tents —
   illegal in the ordinary game — are where most deductions come from.

   The rule everyone under-reads is the pairing: it is a one-to-one matching
   between trees and tents, not "every tent has a tree near it". One tent
   serving two trees looks locally fine and is illegal, because some third tree
   is then unserved. That constraint is what stops this collapsing into a
   nonogram — the counts alone never determine the board.

   Grading reads the player's own marks and re-derives everything, including a
   real bipartite matching, rather than comparing against a stored answer. */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const boards = puzzle.data.boards; // [{ board, rowCounts, colCounts }]

    const solved = boards.map((b) => {
      const res = countSolutions(b.board, b.rowCounts, b.colCounts, 2);
      if (res.count !== 1) throw new Error(`campsite: board has ${res.count} solutions, must have exactly 1`);
      return res.solutions[0];
    });

    let idx = 0, hints = 0, wrong = 0;
    const perBoard = [];
    let marks, rows, cols;

    root.appendChild(el("p", "q-detail center",
      "One tent per tree, sitting diagonally from it, paired one-to-one. Tents may sit " +
      "side by side, but never corner to corner. The numbers count tents in each row and " +
      "column. Tap a square to cycle tent → grass → empty."));

    const header = el("div", "q-detail center");
    root.appendChild(header);

    const wrap = el("div");
    wrap.style.maxWidth = "360px";
    wrap.style.margin = "0 auto";
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

    function start() {
      const b = boards[idx];
      rows = b.board.length; cols = b.board[0].length;
      marks = Array.from({ length: rows }, () => new Array(cols).fill(0)); // 0 empty, 1 tent, 2 grass
      status.textContent = "";
      render();
    }

    function tentsNow() {
      const out = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (marks[r][c] === 1) out.push([r, c]);
      return out;
    }

    function render() {
      const b = boards[idx];
      const total = b.rowCounts.reduce((a, n) => a + n, 0);
      header.innerHTML = `Camp ${idx + 1} of ${boards.length} &middot; ${tentsNow().length}/${total} tents${hints ? ` &middot; ${hints} hint${hints === 1 ? "" : "s"}` : ""}`;

      wrap.innerHTML = "";
      const g = el("div");
      g.style.display = "grid";
      g.style.gridTemplateColumns = `repeat(${cols + 1}, 1fr)`;
      g.style.gap = "2px";
      wrap.appendChild(g);

      const placed = { rows: new Array(rows).fill(0), cols: new Array(cols).fill(0) };
      for (const [r, c] of tentsNow()) { placed.rows[r]++; placed.cols[c]++; }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) g.appendChild(cellNode(r, c));
        g.appendChild(countNode(b.rowCounts[r], placed.rows[r]));
      }
      for (let c = 0; c < cols; c++) g.appendChild(countNode(b.colCounts[c], placed.cols[c]));
      g.appendChild(el("div"));
    }

    function countNode(want, have) {
      const n = el("div", null, String(want));
      n.style.display = "grid";
      n.style.placeItems = "center";
      n.style.aspectRatio = "1";
      n.style.fontVariantNumeric = "tabular-nums";
      n.style.fontSize = "clamp(11px, 3.2vw, 14px)";
      n.style.color = have > want ? "var(--bad, #d1655e)"
        : have === want ? "rgba(255,255,255,.3)" : "var(--fg, #e8e6e1)";
      return n;
    }

    function cellNode(r, c) {
      const b = boards[idx];
      const isTree = b.board[r][c] === TREE;
      const m = marks[r][c];
      const btn = el("button", null, isTree ? "🌲" : m === 1 ? "⛺" : m === 2 ? "·" : "");
      btn.style.aspectRatio = "1";
      btn.style.display = "grid";
      btn.style.placeItems = "center";
      btn.style.fontSize = "clamp(12px, 3.6vw, 18px)";
      btn.style.lineHeight = "1";
      btn.style.border = "1px solid rgba(255,255,255,.12)";
      btn.style.borderRadius = "4px";
      btn.style.background = isTree ? "rgba(255,255,255,.10)" : "rgba(255,255,255,.03)";
      btn.style.color = m === 2 ? "rgba(255,255,255,.35)" : "inherit";
      btn.style.cursor = isTree ? "default" : "pointer";
      btn.style.padding = "0";
      if (!isTree) btn.onclick = () => { marks[r][c] = (marks[r][c] + 1) % 3; after(); };
      return btn;
    }

    function after() {
      render();
      const b = boards[idx];
      const total = b.rowCounts.reduce((a, n) => a + n, 0);
      const tents = tentsNow();
      if (tents.length !== total) { status.textContent = ""; return; }
      const res = check(b.board, b.rowCounts, b.colCounts, tents);
      if (res.ok) {
        status.textContent = "Every tree has its tent.";
        perBoard.push({ hints });
        setTimeout(next, 400);
      } else {
        wrong++;
        status.textContent = `Right number of tents, wrong camp — ${res.why}.`;
      }
    }

    function next() {
      if (idx < boards.length - 1) { idx++; hints = 0; start(); }
      else finish();
    }

    hintBtn.onclick = () => {
      const sol = solved[idx];
      const missing = sol.filter(([r, c]) => marks[r][c] !== 1);
      if (!missing.length) return;
      const [r, c] = missing[Math.floor(Math.random() * missing.length)];
      marks[r][c] = 1;
      hints++;
      after();
    };

    clearBtn.onclick = start;
    start();

    function finish() {
      root.innerHTML = "";
      const totalHints = perBoard.reduce((a, p) => a + p.hints, 0);
      const clean = totalHints === 0 && wrong === 0;

      root.appendChild(el("div", "reveal-badge " + (clean ? "good" : "ok"),
        clean ? "⛺ Both camps pitched clean" : `⛺ Both camps pitched &middot; ${totalHints} hint${totalHints === 1 ? "" : "s"}`));

      const nums = el("div", "reveal-nums");
      nums.append(
        el("div", null, `<span>Camps</span><b>${boards.length}</b>`),
        el("div", null, `<span>Hints</span><b>${totalHints}</b>`),
        el("div", null, `<span>Wrong pitches</span><b>${wrong}</b>`),
      );
      root.appendChild(nums);

      const notes = solved.map((sol, i) => {
        const b = boards[i];
        const set = new Set(sol.map(([r, c]) => r * b.board[0].length + c));
        const art = b.board.map((row, r) =>
          row.map((v, c) => v === TREE ? "🌲" : set.has(r * row.length + c) ? "⛺" : "⬛").join("")).join("<br>");
        return `Camp ${i + 1} — the only legal pitch:<br>${art}`;
      });
      notes.push(
        "Turning both adjacency rules diagonal changes how the board is solved, not how it looks. A committed tent forces an X of grass instead of a cross, so pressure runs along diagonals, and tents may now sit in an unbroken row — the thing the ordinary game forbids outright, and the source of most of the deductions here. The constraint doing the quiet work is still the pairing: trees and tents match one-to-one, so one tent serving two trees is illegal however innocent it looks. The solver ends every candidate with a real bipartite matching; a per-tent adjacency check accepts boards that leave a tree homeless."
      );

      api.finish({
        headline: clean ? "Both camps, no hints" : `Both camps · ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
        squares: perBoard.map((p) => (p.hints === 0 ? "⛺" : "🌲")).join(""),
        stats: [
          ["Camps", `${boards.length}/${boards.length}`],
          ["Hints", String(totalHints)],
          ["Wrong pitches", String(wrong)],
        ],
        perfect: clean,
        extra: [
          totalHints === 0 ? "⛺ unaided" : `💡 ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
          wrong === 0 ? "🎯 no wrong pitches" : `❌ ${wrong} wrong pitch${wrong === 1 ? "" : "es"}`,
        ],
        notes,
      });
    }
  },
};
