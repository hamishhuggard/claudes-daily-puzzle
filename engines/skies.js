import { el } from "./shared.js";
import { countSolutions, check } from "./skies-rules.js";

/* UNEVEN SKIES — Star Battle's skeleton with the uniform count removed. Every
   row and column holds exactly two stars, no two stars touch even
   diagonally, same as always. What's gone is the rule that made ordinary
   Star Battle solvable by pattern: every region there carries the same
   count as every line, so a region and a line are interchangeable currency.
   Here each region is printed with its OWN count — 0, 1, 2 or 3, no two
   regions forced to match — and there are more regions than lines, so region
   budgets and line budgets have to be worked separately rather than traded
   for each other.

   Grading reads the player's own star marks and re-derives row, column,
   region and adjacency straight from the rules core — nothing is compared
   against a stored answer. */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const rounds = puzzle.data.rounds; // [{ spec }]

    const solved = rounds.map((rd) => {
      const res = countSolutions(rd.spec, 2);
      if (res.count !== 1) throw new Error(`skies: round has ${res.count} solutions, must have exactly 1`);
      return res.solutions[0];
    });

    let idx = 0, hints = 0, wrong = 0;
    const perRound = [];
    let marks, n;

    root.appendChild(el("p", "q-detail center",
      "Two stars in every row and every column, never touching even at a corner. Each " +
      "region's printed number is exactly how many stars it holds — the numbers are not " +
      "all the same. Tap a square to cycle star &rarr; mark &rarr; empty."));

    const header = el("div", "q-detail center");
    root.appendChild(header);

    const wrap = el("div");
    wrap.style.width = "100%";
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
      const rd = rounds[idx];
      n = rd.spec.n;
      marks = Array.from({ length: n }, () => new Array(n).fill(0)); // 0 empty, 1 star, 2 no-star
      status.textContent = "";
      render();
    }

    function starsNow() {
      const out = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (marks[r][c] === 1) out.push([r, c]);
      return out;
    }

    // Region top-left-most cell (row-major first occurrence) gets the label.
    function labelCells(regions, R) {
      const cells = new Array(R).fill(null);
      for (let r = 0; r < regions.length; r++) for (let c = 0; c < regions[r].length; c++) {
        const g = regions[r][c];
        if (cells[g] == null) cells[g] = [r, c];
      }
      return cells;
    }

    function render() {
      const rd = rounds[idx];
      const { regions, regionCounts } = rd.spec;
      const total = n * 2;
      header.innerHTML = `Sky ${idx + 1} of ${rounds.length} &middot; ${starsNow().length}/${total} stars${hints ? ` &middot; ${hints} hint${hints === 1 ? "" : "s"}` : ""}`;

      wrap.innerHTML = "";
      const g = el("div");
      g.style.display = "grid";
      g.style.gridTemplateColumns = `repeat(${n}, 1fr)`;
      g.style.gridTemplateRows = `repeat(${n}, 1fr)`;
      g.style.gap = "0px";
      g.style.width = "100%";
      g.style.aspectRatio = "1";
      g.style.border = "3px solid rgba(255,255,255,.7)";
      g.style.boxSizing = "border-box";
      wrap.appendChild(g);

      const placed = { rows: new Array(n).fill(0), cols: new Array(n).fill(0) };
      const regionHave = new Array(regionCounts.length).fill(0);
      for (const [r, c] of starsNow()) { placed.rows[r]++; placed.cols[c]++; regionHave[regions[r][c]]++; }

      const labels = labelCells(regions, regionCounts.length);

      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
        g.appendChild(cellNode(r, c, regions, regionCounts, regionHave, labels, placed));
      }

      const legend = el("div");
      legend.style.marginTop = "8px";
      legend.style.fontSize = "12px";
      legend.style.textAlign = "center";
      legend.style.color = "rgba(255,255,255,.5)";
      const overRow = placed.rows.some((v) => v > 2) || placed.cols.some((v) => v > 2);
      const overReg = regionHave.some((v, i) => v > regionCounts[i]);
      legend.textContent = overRow || overReg ? "Something is over-filled." : "";
      legend.style.color = "var(--bad, #d1655e)";
      wrap.appendChild(legend);
    }

    function cellNode(r, c, regions, regionCounts, regionHave, labels, placed) {
      const reg = regions[r][c];
      const m = marks[r][c];
      // Only a placed star or a ruled-out mark ever draws a glyph — an empty
      // cell is genuinely empty, not a faint placeholder.
      let glyph = "";
      if (m === 1) glyph = "⭐";
      else if (m === 2) glyph = "·";
      const btn = el("button", null, glyph);
      btn.style.aspectRatio = "1";
      btn.style.display = "grid";
      btn.style.placeItems = "center";
      btn.style.position = "relative";
      btn.style.fontSize = "clamp(15px, 5.5vw, 22px)";
      btn.style.lineHeight = "1";
      btn.style.padding = "0";
      btn.style.margin = "0";
      btn.style.cursor = "pointer";
      btn.style.borderRadius = "0";
      btn.style.color = m === 2 ? "rgba(255,255,255,.4)" : "inherit";
      // Region fill stays near-invisible — shape is carried by the borders
      // below, not by colour, so it reads clearly on the dark background.
      btn.style.background = "rgba(255,255,255,.02)";
      btn.style.boxSizing = "border-box";

      // Region border: a thick bright edge wherever the neighbour is a
      // different region (or the grid ends), a thin faint one inside a
      // region. Region shape is the whole puzzle, so this has to be loud.
      const thin = "1px solid rgba(255,255,255,.08)";
      const thick = "3px solid rgba(255,255,255,.85)";
      const up = regions[r - 1]?.[c];
      const down = regions[r + 1]?.[c];
      const left = regions[r]?.[c - 1];
      const right = regions[r]?.[c + 1];
      btn.style.borderTop = (up === undefined || up !== reg) ? thick : thin;
      btn.style.borderBottom = (down === undefined || down !== reg) ? thick : thin;
      btn.style.borderLeft = (left === undefined || left !== reg) ? thick : thin;
      btn.style.borderRight = (right === undefined || right !== reg) ? thick : thin;

      if (labels[reg] && labels[reg][0] === r && labels[reg][1] === c) {
        const tag = el("div", null, String(regionCounts[reg]));
        tag.style.position = "absolute";
        tag.style.top = "3px";
        tag.style.left = "4px";
        tag.style.fontSize = "clamp(11px, 3vw, 13px)";
        tag.style.fontWeight = "700";
        tag.style.lineHeight = "1";
        tag.style.fontVariantNumeric = "tabular-nums";
        tag.style.color = regionHave[reg] > regionCounts[reg] ? "var(--bad, #d1655e)"
          : regionHave[reg] === regionCounts[reg] ? "rgba(255,255,255,.35)" : "var(--accent-2, rgba(255,255,255,.78))";
        btn.appendChild(tag);
      }

      btn.onclick = () => { marks[r][c] = (marks[r][c] + 1) % 3; after(); };
      return btn;
    }

    function after() {
      render();
      const total = n * 2;
      const stars = starsNow();
      if (stars.length !== total) { status.textContent = ""; return; }
      const res = check(rounds[idx].spec, stars);
      if (res.ok) {
        status.textContent = "Every line and every region checks out.";
        perRound.push({ hints });
        setTimeout(next, 400);
      } else {
        wrong++;
        status.textContent = `Right number of stars, wrong sky — ${res.why}.`;
      }
    }

    function next() {
      if (idx < rounds.length - 1) { idx++; hints = 0; start(); }
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
      const totalHints = perRound.reduce((a, p) => a + p.hints, 0);
      const clean = totalHints === 0 && wrong === 0;

      root.appendChild(el("div", "reveal-badge " + (clean ? "good" : "ok"),
        clean ? "⭐ Both skies charted clean" : `⭐ Both skies charted &middot; ${totalHints} hint${totalHints === 1 ? "" : "s"}`));

      const nums = el("div", "reveal-nums");
      nums.append(
        el("div", null, `<span>Skies</span><b>${rounds.length}</b>`),
        el("div", null, `<span>Hints</span><b>${totalHints}</b>`),
        el("div", null, `<span>Wrong skies</span><b>${wrong}</b>`),
      );
      root.appendChild(nums);

      const notes = solved.map((sol, i) => {
        const rd = rounds[i];
        const n2 = rd.spec.n;
        const set = new Set(sol.map(([r, c]) => r * n2 + c));
        const art = [];
        for (let r = 0; r < n2; r++) {
          let row = "";
          for (let c = 0; c < n2; c++) row += set.has(r * n2 + c) ? "*" : ".";
          art.push(row);
        }
        return `Sky ${i + 1} — the only legal arrangement:<br><span style="font-family:ui-monospace,monospace;white-space:pre;line-height:1.2">${art.join("\n")}</span>`;
      });
      notes.push(
        "Ordinary Star Battle gives every region the same count as every row, so a region and a line are the same fact stated twice, and most of its solving technique is that trade made explicit. Printing a different count on every region breaks the trade — a region can no longer stand in for the rows it touches, so the no-touching rule and each region's own budget have to close the puzzle on their own. The solver proves uniqueness by exhaustive row-by-row placement pruned on column and region counts, checked once at authoring time and again here at load."
      );

      api.finish({
        headline: clean ? "Both skies, no hints" : `Both skies · ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
        squares: perRound.map((p) => (p.hints === 0 ? "⭐" : "✨")).join(""),
        stats: [
          ["Skies", `${rounds.length}/${rounds.length}`],
          ["Hints", String(totalHints)],
          ["Wrong skies", String(wrong)],
        ],
        perfect: clean,
        extra: [
          totalHints === 0 ? "⭐ unaided" : `💡 ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
          wrong === 0 ? "🎯 no wrong skies" : `❌ ${wrong} wrong sk${wrong === 1 ? "y" : "ies"}`,
        ],
        notes,
      });
    }
  },
};
