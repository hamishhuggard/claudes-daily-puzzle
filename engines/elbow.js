import { el } from "./shared.js";
import { solve, faults, regionCells, edgeNeighbours } from "./elbow-rules.js";

/* ============================================================================
   ELBOW — "elbow room"
   ----------------------------------------------------------------------------
   Every region holds 1..n once each. The original also forbids equal digits
   from touching, corners included. This one drops the corner rule entirely and
   replaces the edge rule with something stronger: cells sharing an edge must
   differ by at least two.

   So a digit no longer just excludes itself from its neighbours, it excludes a
   band — a 3 keeps 2, 3 and 4 off all four sides. Middle digits are expensive
   and the extremes are what fit into tight spots, which is an asymmetry the
   original cannot have.

   One legal filling exists, so a completed grid IS the answer.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const { rows, cols, regions, givens } = puzzle.data;
    const N = rows * cols;
    const spec = { rows, cols, regions, givens };

    const sols = solve(spec, 2);
    if (sols.length !== 1) throw new Error(`elbow: ${sols.length} solutions, want 1`);
    const truth = sols[0];

    const cells = regionCells(spec);
    const maxOf = (i) => cells.get(regions[i]).length;
    const DIGITS = Math.max(...[...cells.values()].map((c) => c.length));
    const edge = edgeNeighbours(rows, cols);
    const EDGE = Array.from({ length: N }, (_, i) => edge(i));

    const grid = new Int8Array(N);
    const locked = new Uint8Array(N);
    for (const [i, v] of Object.entries(givens)) { grid[Number(i)] = v; locked[Number(i)] = 1; }

    let pick = 1;
    let hints = 0, takeBacks = 0, over = false, message = "";

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function tap(i) {
      if (over || locked[i]) return;
      const was = grid[i];
      grid[i] = was === pick ? 0 : pick;
      if (was !== 0 && grid[i] !== was) takeBacks++;
      message = "";
      if (grid.every((v, k) => v === truth[k])) over = true;
      render();
    }

    function hint() {
      let target = -1;
      for (let i = 0; i < N; i++) {
        if (!locked[i] && grid[i] !== 0 && grid[i] !== truth[i]) { target = i; break; }
      }
      if (target === -1) for (let i = 0; i < N; i++) if (!grid[i]) { target = i; break; }
      if (target === -1) return;
      grid[target] = truth[target];
      hints++;
      message = `Hint: row ${Math.floor(target / cols) + 1}, column ${(target % cols) + 1}`
        + ` is a ${truth[target]}.`;
      if (grid.every((v, k) => v === truth[k])) over = true;
      render();
    }

    /* Cells breaking a rule right now: a repeat inside its region, or an edge
       neighbour within one. Reported live so the grid argues back. */
    function clashes() {
      const bad = new Set();
      for (const [, group] of cells) {
        const seen = new Map();
        for (const i of group) {
          if (!grid[i]) continue;
          if (seen.has(grid[i])) { bad.add(i); bad.add(seen.get(grid[i])); }
          seen.set(grid[i], i);
        }
      }
      for (let i = 0; i < N; i++) {
        if (!grid[i]) continue;
        for (const j of EDGE[i]) {
          if (grid[j] && Math.abs(grid[i] - grid[j]) < 2) { bad.add(i); bad.add(j); }
        }
      }
      return bad;
    }

    function render() {
      wrap.innerHTML = "";
      const bad = clashes();
      let done = 0;
      for (let i = 0; i < N; i++) if (grid[i]) done++;

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Filled</small><b>${done}/${N}</b>`),
        el("div", "grid-score-cell", `<small>Clashes</small><b>${bad.size}</b>`),
        el("div", "grid-score-cell", `<small>Hints</small><b>${hints}</b>`),
      );
      wrap.appendChild(head);

      const board = el("div", "elb-board");
      board.style.setProperty("--cols", cols);
      for (let i = 0; i < N; i++) {
        const r = Math.floor(i / cols), c = i % cols;
        const b = el("button", "elb-cell"
          + (locked[i] ? " given" : "")
          + (bad.has(i) ? " clash" : "")
          + (!grid[i] ? " empty" : ""));
        b.textContent = grid[i] || "";
        b.disabled = over || !!locked[i];
        /* Thick edges wherever the region changes, so the shapes read without
           needing a separate colour per region. */
        const wall = (rr, cc) =>
          rr < 0 || cc < 0 || rr >= rows || cc >= cols
            || regions[rr * cols + cc] !== regions[i];
        const WALL = "#939dbd", INNER = "#262c3c";
        for (const [side, isWall] of [
          ["Top", wall(r - 1, c)], ["Bottom", wall(r + 1, c)],
          ["Left", wall(r, c - 1)], ["Right", wall(r, c + 1)],
        ]) {
          b.style[`border${side}Width`] = isWall ? "2px" : "1px";
          b.style[`border${side}Color`] = isWall ? WALL : INNER;
        }
        b.setAttribute("aria-label",
          `row ${r + 1} column ${c + 1}, ${grid[i] || "empty"}, region of ${maxOf(i)}`);
        b.onclick = () => tap(i);
        board.appendChild(b);
      }
      wrap.appendChild(board);

      const pal = el("div", "elb-palette");
      for (let v = 1; v <= DIGITS; v++) {
        const chip = el("button", "elb-chip" + (v === pick ? " on" : ""));
        chip.textContent = String(v);
        chip.disabled = over;
        chip.setAttribute("aria-label", `write ${v}`);
        chip.onclick = () => { pick = v; message = ""; render(); };
        pal.appendChild(chip);
      }
      if (!over) wrap.appendChild(pal);

      const msg = el("p", "q-detail center elb-msg");
      msg.innerHTML = over
        ? "Every region 1 to 6, and no two neighbours within one of each other."
        : message || (bad.size
          ? "<b>Two squares are too close in value.</b> Sharing an edge means "
            + "differing by at least two — corners don't matter."
          : `Writing <b>${pick}</b>. Each region takes 1 to its own size, once each; `
            + "side-by-side squares must differ by two or more.");
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = finish;
        bar.appendChild(b);
      } else {
        const h = el("button", "ghost compact", "Hint (costs you)");
        h.onclick = hint;
        const c = el("button", "ghost compact", "Clear the grid");
        c.disabled = !grid.some((v, i) => !locked[i] && v !== 0);
        c.onclick = () => {
          let wiped = false;
          for (let i = 0; i < N; i++) {
            if (locked[i]) continue;
            if (grid[i]) wiped = true;
            grid[i] = 0;
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
        headline: hints === 0 ? "Filled unaided" : `Filled with ${hints} hint${hints === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Given numbers", String(Object.keys(givens).length)],
          ["Hints", String(hints)],
          ["Rubbings-out", String(takeBacks)],
        ],
        perfect: hints === 0 && takeBacks === 0,
        extra: [
          hints === 0 ? "🧠 unaided" : `💡 ${hints} hint${hints === 1 ? "" : "s"}`,
          takeBacks === 0 ? "🎯 never rubbed anything out" : `↩️ ${takeBacks} rubbing${takeBacks === 1 ? "" : "s"}-out`,
        ],
      });
    }

    render();
  },
};
