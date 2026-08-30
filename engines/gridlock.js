import { el } from "./shared.js";
import { occupancy, movesFrom, onewayMoves, applyMove, isSolved, solve } from "./gridlock-rules.js";

/* ============================================================================
   GRIDLOCK — "the car park"
   ----------------------------------------------------------------------------
   Sliding-block escape on ONE-WAY STREETS. Every vehicle carries an arrow and
   may only ever slide the way it points — never back. Tap a vehicle to pick it
   up, tap a highlighted square to slide it there.

   That single rule is what makes this its own puzzle rather than a car-park
   shuffle. The lot is monotone: nothing can be undone by the rules, so the
   order you move things in is the whole problem, and a lot can be ruined
   outright rather than merely tangled. A vehicle that has slid past the square
   you needed is gone. Undo and Reset exist as a kindness to the player, not as
   part of the puzzle — par counts moves, not regrets.

   Par is not an opinion. On mount, the engine runs the same breadth-first
   search the authoring tool ran (gridlock-rules.js: solve) over every
   reachable arrangement of the lot, so the number the player is compared
   against is the genuine shortest escape. Recomputing it here rather than
   trusting a packed number means a lot that got edited can never end up with
   a stale par.

   Scoring: total moves against total par across both lots, with resets
   counted separately — a reset costs nothing but honesty.
   ========================================================================== */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const lots = puzzle.data.lots;
    // A lot whose vehicles carry arrows is played one-way; one without them is
    // the unrestricted game, so old lots keep working unchanged.
    const genFor = (lot) => (lot.vehicles.some((v) => v.dir != null) ? onewayMoves : movesFrom);
    const pars = lots.map((lot) => {
      const s = solve(lot.vehicles, lot.size, genFor(lot));
      if (!s) throw new Error("gridlock: lot has no solution");
      return s.moves;
    });

    let li = 0;
    const results = lots.map(() => ({ moves: 0, resets: 0, done: false }));

    let vs, sel, history, over;

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function setup() {
      vs = lots[li].vehicles.map((v) => ({ ...v }));
      sel = null;
      history = [];
      over = false;
    }

    /* Where can the selected vehicle actually go? Keyed by the square the
       player taps — its own leading square after the slide, which is the one
       square that unambiguously names the destination. */
    function targets() {
      if (sel == null) return new Map();
      const out = new Map();
      for (const m of genFor(lots[li])(vs, lots[li].size)) {
        if (m.car !== sel) continue;
        const v = vs[sel];
        const [r, c] = v.horiz
          ? [v.r, m.delta > 0 ? v.c + v.len - 1 + m.delta : v.c + m.delta]
          : [m.delta > 0 ? v.r + v.len - 1 + m.delta : v.r + m.delta, v.c];
        out.set(`${r},${c}`, m);
      }
      return out;
    }

    function render() {
      wrap.innerHTML = "";
      const lot = lots[li];
      const size = lot.size;
      const r = results[li];

      wrap.appendChild(el("p", "q-num",
        `Lot ${li + 1} of ${lots.length} — ${lot.label}`));
      wrap.appendChild(el("div", "pips", lots.map((_, i) =>
        `<i class="${i < li ? "done" : i === li ? "now" : ""}"></i>`).join("")));

      const scoreRow = el("div", "grid-score");
      scoreRow.append(
        el("div", "grid-score-cell", `<small>Moves</small><b>${r.moves}</b>`),
        el("div", "grid-score-cell", `<small>Par</small><b>${pars[li]}</b>`),
      );
      wrap.appendChild(scoreRow);

      const tgt = targets();
      const board = el("div", "grid-board");
      board.style.setProperty("--n", size);

      // The floor: one tappable square per cell, so a slide is "tap where you
      // want the nose to end up".
      //
      // Every square is placed by explicit grid line rather than left to
      // auto-placement, and it has to be. The board carries an extra 16px
      // column for the exit arrow, so auto-flow would wrap `size` squares into
      // a `size + 1` wide grid and shear every row after the first; and since
      // the vehicles below are explicitly placed, the grid algorithm positions
      // them first and flows the leftover squares around them, shifting things
      // again. Either way the square that lights up stops being the square the
      // move actually leads to.
      for (let rr = 0; rr < size; rr++) {
        for (let cc = 0; cc < size; cc++) {
          const key = `${rr},${cc}`;
          const cell = el("button", "grid-cell" + (tgt.has(key) ? " open" : ""));
          cell.style.gridRow = `${rr + 1}`;
          cell.style.gridColumn = `${cc + 1}`;
          cell.disabled = !tgt.has(key) || over;
          cell.onclick = () => { doMove(tgt.get(key)); };
          board.appendChild(cell);
        }
      }

      // Vehicles sit on top, positioned by CSS grid lines.
      vs.forEach((v, i) => {
        const car = el("button", "grid-car"
          + (i === 0 ? " target" : "")
          + (i === sel ? " sel" : "")
          + (v.horiz ? " h" : " v"));
        car.style.gridColumn = `${v.c + 1} / span ${v.horiz ? v.len : 1}`;
        car.style.gridRow = `${v.r + 1} / span ${v.horiz ? 1 : v.len}`;
        car.disabled = over;
        // The arrow is the rule, so it has to be on the vehicle itself.
        const arrow = v.dir == null ? "" : v.horiz ? (v.dir > 0 ? "→" : "←") : (v.dir > 0 ? "↓" : "↑");
        if (arrow) {
          const a = el("span", "grid-arrow", arrow);
          a.style.opacity = ".75";
          a.style.fontSize = "13px";
          car.appendChild(a);
        }
        car.setAttribute("aria-label",
          (i === 0 ? "the vehicle you're freeing" : `vehicle ${i}, length ${v.len}`)
          + (arrow ? `, one-way ${v.horiz ? (v.dir > 0 ? "right" : "left") : (v.dir > 0 ? "down" : "up")}` : ""));
        car.onclick = () => { sel = sel === i ? null : i; render(); };
        board.appendChild(car);
      });

      // The gap in the wall, drawn on the outside of the exit row.
      const exit = el("div", "grid-exit", "→");
      exit.style.gridRow = `${lot.vehicles[0].r + 1}`;
      exit.style.gridColumn = `${size + 1}`;
      board.appendChild(exit);

      wrap.appendChild(board);

      const msg = el("p", "q-detail center grid-msg");
      msg.innerHTML = over
        ? (r.moves === pars[li]
            ? `Out in <b>${r.moves}</b> — that is the shortest escape there is.`
            : `Out in <b>${r.moves}</b>. The shortest route is <b>${pars[li]}</b>.`)
        : sel == null
          ? "Tap a vehicle, then tap where you want it to end up."
          : "Tap a highlighted square — or tap the vehicle again to let it go.";
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const next = el("button", "primary compact",
          li === lots.length - 1 ? "See your score" : "Next lot");
        next.onclick = () => {
          li++;
          if (li === lots.length) return done();
          setup(); render();
        };
        bar.appendChild(next);
      } else {
        const undo = el("button", "ghost compact", "Undo");
        undo.disabled = !history.length;
        undo.onclick = () => {
          const prev = history.pop();
          vs = prev; sel = null; results[li].moves--; render();
        };
        const reset = el("button", "ghost compact", "Reset lot");
        reset.disabled = !history.length;
        reset.onclick = () => {
          results[li].resets++;
          results[li].moves = 0;
          setup(); render();
        };
        bar.append(undo, reset);
      }
      wrap.appendChild(bar);
    }

    function doMove(m) {
      history.push(vs.map((v) => ({ ...v })));
      vs = applyMove(vs, m);
      results[li].moves++;
      sel = null;
      if (isSolved(vs, lots[li].size)) {
        // Slide the freed vehicle out through the gap, so the win is visible
        // rather than merely announced.
        vs[0] = { ...vs[0], c: lots[li].size };
        over = true;
        results[li].done = true;
      }
      render();
    }

    function done() {
      const moves = results.reduce((a, r) => a + r.moves, 0);
      const par = pars.reduce((a, b) => a + b, 0);
      const resets = results.reduce((a, r) => a + r.resets, 0);
      const overPar = moves - par;
      const squares = results.map((r, i) => r.moves === pars[i] ? "🟩" : r.moves <= pars[i] + 3 ? "🟨" : "🟧").join("");

      api.finish({
        headline: overPar === 0
          ? `${moves} moves, par ${par} — not one wasted`
          : `${moves} moves, par ${par}`,
        squares,
        stats: [
          ["Moves", String(moves)],
          ["Par", String(par)],
          ["Over par", overPar === 0 ? "—" : `+${overPar}`],
        ],
        perfect: overPar === 0 && resets === 0,
        extra: [
          overPar === 0 ? "🎯 shortest escape both times" : `🚗 +${overPar} over the shortest route`,
          resets ? `🔁 ${resets} reset${resets === 1 ? "" : "s"}` : "",
        ].filter(Boolean),
        notes: puzzle.data.notes || [],
      });
    }

    setup();
    render();
  },
};
