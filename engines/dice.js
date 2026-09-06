import { el } from "./shared.js";
import { solve, faceBlindPar, DIRS } from "./dice-rules.js";

/* ============================================================================
   DICE — "six sides"
   ----------------------------------------------------------------------------
   Roll the die around the yard. A marked square only counts when the die is
   standing on it showing that number on top, and the marks may be taken in any
   order.

   A plain rolling-die maze treats the faces as scenery — you just have to
   arrive. Making the face the condition means the shortest walk is usually
   wrong, detours become useful (rolling out and back leaves you where you
   were showing something else), and the order you take the marks in is chosen
   for what the die will be showing when it passes.

   Par is the true minimum, from a breadth-first sweep of every
   (square, orientation, marks-collected) state.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const { rows, cols, start, marks } = puzzle.data;
    const walls = new Set(puzzle.data.walls || []);
    const N = rows * cols;
    const spec = { rows, cols, walls: puzzle.data.walls || [], start, marks };

    const best = solve(spec);
    if (!best) throw new Error("dice: no route collects every mark");
    const PAR = best.par;
    const BLIND = faceBlindPar(spec);

    let die = { pos: start.cell, t: start.top, n: start.north, e: start.east };
    let got = new Set();
    let rolls = 0, hints = 0, over = false, message = "";

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function pickUp() {
      marks.forEach((m, k) => {
        if (m.cell === die.pos && m.face === die.t) got.add(k);
      });
      if (got.size === marks.length) over = true;
    }
    pickUp();

    function rollTo(dir) {
      if (over) return;
      const r = Math.floor(die.pos / cols), c = die.pos % cols;
      const rr = r + dir.dr, cc = c + dir.dc;
      if (rr < 0 || cc < 0 || rr >= rows || cc >= cols) return;
      const np = rr * cols + cc;
      if (walls.has(np)) return;
      const [t, n, e] = dir.roll(die.t, die.n, die.e);
      die = { pos: np, t, n, e };
      rolls++;
      message = "";
      pickUp();
      render();
    }

    function hint() {
      const rest = solve(spec, {
        cell: die.pos, top: die.t, north: die.n, east: die.e,
        mask: [...got].reduce((a, k) => a | (1 << k), 0),
      });
      if (!rest || !rest.route.length) return;
      hints++;
      const name = rest.route[0];
      message = `Hint: roll ${name}.`;
      rollTo(DIRS.find((d) => d.name === name));
    }

    function render() {
      wrap.innerHTML = "";

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Rolls</small><b>${rolls}</b>`),
        el("div", "grid-score-cell", `<small>Par</small><b>${PAR}</b>`),
        el("div", "grid-score-cell", `<small>Marks</small><b>${got.size}/${marks.length}</b>`),
      );
      wrap.appendChild(head);

      const markAt = new Map(marks.map((m, k) => [m.cell, { ...m, k }]));
      const r0 = Math.floor(die.pos / cols), c0 = die.pos % cols;

      const board = el("div", "dic-board");
      board.style.setProperty("--cols", cols);
      for (let i = 0; i < N; i++) {
        const r = Math.floor(i / cols), c = i % cols;
        const isWall = walls.has(i);
        const m = markAt.get(i);
        const adjacent = Math.abs(r - r0) + Math.abs(c - c0) === 1;

        const cell = el("button", "dic-cell"
          + (isWall ? " wall" : "")
          + (m ? (got.has(m.k) ? " mark done" : " mark") : "")
          + (i === die.pos ? " here" : "")
          + (adjacent && !isWall && !over ? " reach" : ""));

        if (i === die.pos) {
          cell.innerHTML = `<span class="dic-die">${die.t}`
            + `<i class="dic-n">${die.n}</i><i class="dic-e">${die.e}</i></span>`;
        } else if (m) {
          cell.textContent = m.face;
        }
        cell.disabled = over || isWall || !adjacent;
        cell.setAttribute("aria-label", isWall ? `row ${r + 1} column ${c + 1}, blocked`
          : i === die.pos ? `die here showing ${die.t}`
          : m ? `row ${r + 1} column ${c + 1}, mark needing ${m.face}`
          : `row ${r + 1} column ${c + 1}`);
        if (adjacent && !isWall) {
          const dir = DIRS.find((d) => r0 + d.dr === r && c0 + d.dc === c);
          cell.onclick = () => rollTo(dir);
        }
        board.appendChild(cell);
      }
      wrap.appendChild(board);

      const msg = el("p", "q-detail center dic-msg");
      msg.innerHTML = over
        ? (rolls === PAR
            ? `Every mark stamped in <b>${PAR} rolls</b> — the true minimum.`
            : `Every mark stamped in ${rolls} rolls, against a par of ${PAR}.`)
        : message
          || `Showing <b>${die.t}</b>. Tap a neighbouring square to roll onto it — `
             + "a mark only counts if the right number is face up when you land.";
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = finish;
        bar.appendChild(b);
      } else {
        const h = el("button", "ghost compact", "Hint (costs you)");
        h.onclick = hint;
        const rs = el("button", "ghost compact", "Start again");
        rs.disabled = rolls === 0;
        rs.onclick = () => {
          die = { pos: start.cell, t: start.top, n: start.north, e: start.east };
          got = new Set(); rolls = 0; message = "Back to the start.";
          pickUp(); render();
        };
        bar.append(h, rs);
      }
      wrap.appendChild(bar);
    }

    function finish() {
      const spare = rolls - PAR;
      const squares = [
        spare === 0 ? "🟩" : spare <= 4 ? "🟨" : "🟧",
        hints === 0 ? "🟩" : hints <= 3 ? "🟨" : "🟧",
      ].join("") + (spare === 0 && hints === 0 ? "🟩🟩🟩" : spare === 0 ? "🟩🟩🟨" : "🟩🟨🟧");

      api.finish({
        headline: spare === 0
          ? `Every mark in ${PAR} rolls, the minimum`
          : `${rolls} rolls against par ${PAR}`,
        squares,
        stats: [
          ["Rolls", String(rolls)],
          ["Par", String(PAR)],
          ["Hints", String(hints)],
        ],
        perfect: spare === 0 && hints === 0,
        notes: [
          `<b>Par is ${PAR} rolls</b><br>`
          + `Walking to all three marks and ignoring which face is up takes only `
          + `${BLIND}. The other ${PAR - BLIND} rolls are spent turning the die.`,
        ],
        extra: [
          spare === 0 ? "🎲 the true minimum" : `➕ ${spare} over par`,
          hints === 0 ? "🧠 unaided" : `💡 ${hints} hint${hints === 1 ? "" : "s"}`,
        ],
      });
    }

    render();
  },
};
