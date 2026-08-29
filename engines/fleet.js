import { el } from "./shared.js";
import { FLEET, countSolutions, check, readingAt } from "./fleet-rules.js";

/* FLEET — find the hidden fleet from the row and column counts and a handful
   of SONAR BUOYS. A buoy floats on water and reports how many ship squares lie
   in the 3x3 block around it; it never tells you which ones.

   That is the whole variant. Ordinary Battleships opens by handing you a
   revealed square or two — certainties to build outward from. A reading of 3
   is not a certainty: it might be a 3-ship alongside, or a 2 and a single, or
   three separate ships clipping the corners. You get a quantity to squeeze
   rather than a fact to extend, and what makes squeezing work is the
   no-touching rule, which caps how much fleet can crowd around one buoy.

   The no-touching rule is still the engine of the whole thing: a ship's
   outline forces water around it, so every square you fill in hands you up to
   twelve squares you can rule out. Players who only chase the numbers stall;
   players who draw the water finish.

   Grading reads your own grid and re-derives the fleet from scratch, so a
   different arrangement satisfying everything would be accepted. There isn't
   one — uniqueness was checked exhaustively at authoring time and is checked
   again at mount. */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const seas = puzzle.data.seas; // [{ rowCounts, colCounts, hints }]

    const solved = seas.map((s) => {
      const res = countSolutions(s.rowCounts, s.colCounts, s.hints, 2);
      if (res.count !== 1) throw new Error(`fleet: sea has ${res.count} solutions, must have exactly 1`);
      return res.solutions[0];
    });

    let idx = 0, hints = 0, wrong = 0;
    const perSea = [];
    let marks, rows, cols, given;

    const fleetLabel = (() => {
      const by = new Map();
      for (const s of FLEET) by.set(s, (by.get(s) || 0) + 1);
      return [...by.entries()].sort((a, b) => b[0] - a[0])
        .map(([size, n]) => `${n}×${size}`).join(", ");
    })();

    root.appendChild(el("p", "q-detail center",
      `Hidden fleet: ${fleetLabel}. Ships lie straight and never touch, not even at a corner. ` +
      "Edge numbers count ship squares per row and column. A sonar buoy sits on water and " +
      "reports how many ship squares are in the 3x3 around it. Tap to cycle ship → water → empty."));

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

    const TOTAL = FLEET.reduce((a, n) => a + n, 0);

    function start() {
      const s = seas[idx];
      rows = s.rowCounts.length; cols = s.colCounts.length;
      marks = Array.from({ length: rows }, () => new Array(cols).fill(0)); // 0 empty, 1 ship, 2 water
      given = new Map();
      for (const h of s.hints) {
        given.set(h.r * cols + h.c, h.n);   // a buoy: always water, plus its reading
        marks[h.r][h.c] = 2;
      }
      status.textContent = "";
      render();
    }

    const shipCells = () => {
      const out = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) if (marks[r][c] === 1) out.push([r, c]);
      return out;
    };

    function render() {
      const s = seas[idx];
      header.innerHTML = `Sea ${idx + 1} of ${seas.length} &middot; ${shipCells().length}/${TOTAL} ship squares${hints ? ` &middot; ${hints} hint${hints === 1 ? "" : "s"}` : ""}`;

      wrap.innerHTML = "";
      const g = el("div");
      g.style.display = "grid";
      g.style.gridTemplateColumns = `repeat(${cols + 1}, 1fr)`;
      g.style.gap = "2px";
      wrap.appendChild(g);

      const rc = new Array(rows).fill(0), cc = new Array(cols).fill(0);
      for (const [r, c] of shipCells()) { rc[r]++; cc[c]++; }

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) g.appendChild(cellNode(r, c));
        g.appendChild(countNode(s.rowCounts[r], rc[r]));
      }
      for (let c = 0; c < cols; c++) g.appendChild(countNode(s.colCounts[c], cc[c]));
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
      const m = marks[r][c];
      const buoy = given.get(r * cols + c);
      const locked = buoy !== undefined;
      // A buoy shows its reading, and turns amber the moment the squares
      // around it hold more ships than it says they can.
      const occNow = Array.from({ length: rows }, (_, rr) => Array.from({ length: cols }, (_, cc) => marks[rr][cc] === 1));
      const btn = el("button", null,
        locked ? String(buoy) : m === 1 ? "" : m === 2 ? "·" : "");
      btn.style.aspectRatio = "1";
      btn.style.display = "grid";
      btn.style.placeItems = "center";
      btn.style.fontSize = "clamp(11px, 3.2vw, 15px)";
      btn.style.border = "1px solid rgba(255,255,255,.12)";
      btn.style.borderRadius = "3px";
      btn.style.padding = "0";
      btn.style.color = "rgba(255,255,255,.35)";
      btn.style.background = m === 1 ? "rgba(200,164,92,.75)" : "rgba(255,255,255,.03)";
      btn.style.cursor = locked ? "default" : "pointer";
      if (locked) {
        const over = readingAt(occNow, r, c) > buoy;
        btn.style.outline = "1px solid rgba(255,255,255,.3)";
        btn.style.color = over ? "var(--bad, #d1655e)" : "var(--fg, #e8e6e1)";
        btn.style.fontWeight = "700";
      }
      if (!locked) btn.onclick = () => { marks[r][c] = (marks[r][c] + 1) % 3; after(); };
      return btn;
    }

    function after() {
      render();
      const s = seas[idx];
      const cells = shipCells();
      if (cells.length !== TOTAL) { status.textContent = ""; return; }
      const occ = Array.from({ length: rows }, (_, r) => Array.from({ length: cols }, (_, c) => marks[r][c] === 1));
      const res = check(s.rowCounts, s.colCounts, s.hints, occ);
      if (res.ok) {
        status.textContent = "Whole fleet found.";
        perSea.push({ hints });
        setTimeout(next, 400);
      } else {
        wrong++;
        status.textContent = `Right number of squares, wrong fleet — ${res.why}.`;
      }
    }

    function next() {
      if (idx < seas.length - 1) { idx++; hints = 0; start(); }
      else finish();
    }

    hintBtn.onclick = () => {
      const sol = solved[idx];
      const missing = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (sol[r][c] && marks[r][c] !== 1) missing.push([r, c]);
      }
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
      const totalHints = perSea.reduce((a, p) => a + p.hints, 0);
      const clean = totalHints === 0 && wrong === 0;

      root.appendChild(el("div", "reveal-badge " + (clean ? "good" : "ok"),
        clean ? "🚢 Fleet found clean" : `🚢 Fleet found &middot; ${totalHints} hint${totalHints === 1 ? "" : "s"}`));

      const nums = el("div", "reveal-nums");
      nums.append(
        el("div", null, `<span>Seas</span><b>${seas.length}</b>`),
        el("div", null, `<span>Hints</span><b>${totalHints}</b>`),
        el("div", null, `<span>Wrong fleets</span><b>${wrong}</b>`),
      );
      root.appendChild(nums);

      const notes = solved.map((sol, i) =>
        `Sea ${i + 1} — where the fleet was:<br>${sol.map((row) => row.map((v) => v ? "🟧" : "🟦").join("")).join("<br>")}`);
      notes.push(
        "Sonar gives you a quantity to squeeze rather than a fact to extend: a reading of 3 might be a 3-ship alongside, a 2 and a single, or three ships clipping the corners. What makes it squeezable is the no-touching rule, which caps how much fleet fits around one buoy — and which is doing the real work everywhere else too, since every ship square forces water into up to eight neighbours. Draw the water, not just the ships. Counting solutions took one piece of care: same-length ships are interchangeable, so swapping the two 3s is the same sea. The solver places equal ships in increasing order, or every unique puzzle would look ambiguous and get discarded."
      );

      api.finish({
        headline: clean ? "Whole fleet, no hints" : `Whole fleet · ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
        squares: perSea.map((p) => (p.hints === 0 ? "🟧" : "🟦")).join(""),
        stats: [
          ["Seas", `${seas.length}/${seas.length}`],
          ["Hints", String(totalHints)],
          ["Wrong fleets", String(wrong)],
        ],
        perfect: clean,
        extra: [
          totalHints === 0 ? "🚢 unaided" : `💡 ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
          wrong === 0 ? "🎯 no misfires" : `❌ ${wrong} wrong fleet${wrong === 1 ? "" : "s"}`,
        ],
        notes,
      });
    }
  },
};
