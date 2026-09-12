import { el } from "./shared.js";
import { countSolutions, check } from "./hitori-rules.js";

/* STRUCK OFF — Hitori with a per-row shade-count clue. Shade cells so no
   number survives twice, unshaded, in any row or column; no two shaded
   cells touch orthogonally; and the unshaded cells stay one connected
   piece. What's new is printed at the left of every row: exactly how many
   cells in that row must end up shaded. The duplicate-hunting is unchanged
   — the budget just tells you how much shading a row can afford, which
   turns "there are three repeats here" into "which one repeat can the row's
   one allowed shade actually kill."

   Grading reads the player's own shaded marks and re-derives every rule
   from the rules core — nothing is compared against a stored answer. */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const rounds = puzzle.data.rounds; // [{ spec }]

    const solved = rounds.map((rd) => {
      const res = countSolutions(rd.spec, 2);
      if (res.count !== 1) throw new Error(`hitori: round has ${res.count} solutions, must have exactly 1`);
      return res.solutions[0];
    });

    let idx = 0, hints = 0, wrong = 0;
    const perRound = [];
    let marks, n;

    root.appendChild(el("p", "q-detail center",
      "Tap a square to cycle empty &rarr; shaded &rarr; ruled-out. Shade cells so no number " +
      "survives twice, unshaded, in any row or column; shaded cells never touch, even edge-on; " +
      "and the unshaded cells stay one connected piece. Each row's number on the left is exactly " +
      "how many of its cells must end up shaded."));

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
      marks = Array.from({ length: n }, () => new Array(n).fill(0)); // 0 empty, 1 shaded, 2 ruled-out
      status.textContent = "";
      render();
    }

    function shadedNow() {
      const out = [];
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (marks[r][c] === 1) out.push([r, c]);
      return out;
    }

    function render() {
      const rd = rounds[idx];
      const { grid, rowCounts } = rd.spec;
      const total = rowCounts.reduce((a, x) => a + x, 0);
      header.innerHTML = `Grid ${idx + 1} of ${rounds.length} &middot; ${shadedNow().length}/${total} shaded${hints ? ` &middot; ${hints} hint${hints === 1 ? "" : "s"}` : ""}`;

      wrap.innerHTML = "";
      const outer = el("div");
      outer.style.display = "grid";
      outer.style.gridTemplateColumns = `28px repeat(${n}, 1fr)`;
      outer.style.gap = "0px";
      outer.style.width = "100%";
      wrap.appendChild(outer);

      const rowShadedNow = new Array(n).fill(0);
      for (const [r] of shadedNow()) rowShadedNow[r]++;

      for (let r = 0; r < n; r++) {
        const tag = el("div", null, String(rowCounts[r]));
        tag.style.display = "grid";
        tag.style.placeItems = "center";
        tag.style.fontSize = "clamp(12px, 3.5vw, 14px)";
        tag.style.fontWeight = "700";
        tag.style.fontVariantNumeric = "tabular-nums";
        tag.style.color = rowShadedNow[r] > rowCounts[r] ? "var(--bad, #d1655e)"
          : rowShadedNow[r] === rowCounts[r] ? "rgba(255,255,255,.35)" : "var(--accent-2, rgba(255,255,255,.78))";
        outer.appendChild(tag);
        for (let c = 0; c < n; c++) outer.appendChild(cellNode(r, c, grid));
      }

      const legend = el("div");
      legend.style.marginTop = "8px";
      legend.style.fontSize = "12px";
      legend.style.textAlign = "center";
      const overRow = rowShadedNow.some((v, i) => v > rowCounts[i]);
      legend.textContent = overRow ? "A row has too many shaded cells." : "";
      legend.style.color = "var(--bad, #d1655e)";
      wrap.appendChild(legend);
    }

    function cellNode(r, c, grid) {
      const m = marks[r][c];
      const btn = el("button", null, m === 1 ? "" : String(grid[r][c]));
      btn.style.aspectRatio = "1";
      btn.style.display = "grid";
      btn.style.placeItems = "center";
      btn.style.fontSize = "clamp(13px, 4.5vw, 18px)";
      btn.style.lineHeight = "1";
      btn.style.padding = "0";
      btn.style.margin = "0";
      btn.style.cursor = "pointer";
      btn.style.borderRadius = "0";
      btn.style.boxSizing = "border-box";
      btn.style.border = "1px solid rgba(255,255,255,.12)";
      if (m === 1) {
        btn.style.background = "rgba(255,255,255,.85)";
        btn.style.color = "#111";
      } else if (m === 2) {
        btn.style.background = "rgba(255,255,255,.02)";
        btn.style.color = "rgba(255,255,255,.35)";
        btn.style.textDecoration = "line-through";
      } else {
        btn.style.background = "rgba(255,255,255,.02)";
        btn.style.color = "inherit";
      }

      btn.onclick = () => { marks[r][c] = (marks[r][c] + 1) % 3; after(); };
      return btn;
    }

    function after() {
      render();
      const rd = rounds[idx];
      const total = rd.spec.rowCounts.reduce((a, x) => a + x, 0);
      const shaded = shadedNow();
      if (shaded.length !== total) { status.textContent = ""; return; }
      const res = check(rd.spec, shaded);
      if (res.ok) {
        status.textContent = "Every number, every column, every row checks out.";
        perRound.push({ hints });
        setTimeout(next, 400);
      } else {
        wrong++;
        status.textContent = `Right number shaded, wrong grid — ${res.why}.`;
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
        clean ? "✂️ Both grids struck clean" : `✂️ Both grids struck &middot; ${totalHints} hint${totalHints === 1 ? "" : "s"}`));

      const nums = el("div", "reveal-nums");
      nums.append(
        el("div", null, `<span>Grids</span><b>${rounds.length}</b>`),
        el("div", null, `<span>Hints</span><b>${totalHints}</b>`),
        el("div", null, `<span>Wrong grids</span><b>${wrong}</b>`),
      );
      root.appendChild(nums);

      const notes = solved.map((sol, i) => {
        const rd = rounds[i];
        const n2 = rd.spec.n;
        const set = new Set(sol.map(([r, c]) => r * n2 + c));
        const art = [];
        for (let r = 0; r < n2; r++) {
          let row = "";
          for (let c = 0; c < n2; c++) row += set.has(r * n2 + c) ? "#" : ".";
          art.push(row);
        }
        return `Grid ${i + 1} — the only legal shading:<br><span style="font-family:ui-monospace,monospace;white-space:pre;line-height:1.2">${art.join("\n")}</span>`;
      });
      notes.push(
        "Ordinary Hitori tells you nothing about how many cells a row will end up shading — that count only falls out once every duplicate is chased down. Printing it up front turns a scan for repeats into a budget problem: a row with one allowed shade and two duplicates has to leave one of them to be solved by a mark in a different row or column entirely. The solver proves uniqueness by exhaustive row-by-row placement, pruned on each row's own value-distinctness before any cross-row adjacency, column or connectivity check runs."
      );

      api.finish({
        headline: clean ? "Both grids, no hints" : `Both grids · ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
        squares: perRound.map((p) => (p.hints === 0 ? "⬛" : "◻️")).join(""),
        stats: [
          ["Grids", `${rounds.length}/${rounds.length}`],
          ["Hints", String(totalHints)],
          ["Wrong grids", String(wrong)],
        ],
        perfect: clean,
        extra: [
          totalHints === 0 ? "✂️ unaided" : `💡 ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
          wrong === 0 ? "🎯 no wrong grids" : `❌ ${wrong} wrong grid${wrong === 1 ? "" : "s"}`,
        ],
        notes,
      });
    }
  },
};
