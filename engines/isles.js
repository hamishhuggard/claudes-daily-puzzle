import { el } from "./shared.js";
import { solve, faults, isSolved, squareBlocks, neighbours } from "./isles-rules.js";

/* ============================================================================
   ISLES — "no four square"
   ----------------------------------------------------------------------------
   Every number is an island of that many squares. Islands never touch
   edge-to-edge and the water is all one piece. The original bans 2x2 blocks of
   water; this bans 2x2 blocks of ANYTHING, so islands have to snake too.

   Squares cycle unknown -> water -> land -> unknown. Only squares you have
   explicitly decided are used for the 2x2 check, so a half-finished map is
   never accused of a block it does not have yet.

   One legal map exists, so a finished grid IS the answer.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const { rows, cols, clues } = puzzle.data;
    const N = rows * cols;
    const spec = { rows, cols, clues };

    const sols = solve(spec, 2);
    if (sols.length !== 1) throw new Error(`isles: ${sols.length} solutions, want 1`);
    const truth = sols[0];                       // Set of land cells

    const UNKNOWN = 0, LAND = 1, WATER = 2;
    const mark = new Int8Array(N);
    const locked = new Uint8Array(N);
    for (const c of Object.keys(clues).map(Number)) { mark[c] = LAND; locked[c] = 1; }

    const totalLand = Object.values(clues).reduce((a, b) => a + b, 0);
    let hints = 0, takeBacks = 0, over = false, message = "";

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    /* Water first: there is more water than land on the map, so it is the
       commoner action and gets the single tap. It also keeps the take-back
       count honest — with land first, every water square had to pass through
       land on the way and a perfect game scored sixteen take-backs. */
    function tap(i) {
      if (over || locked[i]) return;
      const was = mark[i];
      mark[i] = was === UNKNOWN ? WATER : was === WATER ? LAND : UNKNOWN;
      if (was === LAND && mark[i] !== LAND) takeBacks++;
      message = "";
      check();
      render();
    }

    function landSet() {
      const s = new Set();
      for (let i = 0; i < N; i++) if (mark[i] === LAND) s.add(i);
      return s;
    }

    function check() {
      const s = landSet();
      if (s.size !== truth.size) return;
      for (const i of s) if (!truth.has(i)) return;
      over = true;
    }

    function hint() {
      let target = -1;
      for (let i = 0; i < N; i++) {           // something marked wrongly first
        if (locked[i]) continue;
        if (mark[i] === LAND && !truth.has(i)) { target = i; break; }
        if (mark[i] === WATER && truth.has(i)) { target = i; break; }
      }
      if (target === -1) {
        for (let i = 0; i < N; i++) if (!locked[i] && mark[i] === UNKNOWN && truth.has(i)) { target = i; break; }
      }
      if (target === -1) {
        for (let i = 0; i < N; i++) if (!locked[i] && mark[i] === UNKNOWN) { target = i; break; }
      }
      if (target === -1) return;
      mark[target] = truth.has(target) ? LAND : WATER;
      hints++;
      message = `Hint: row ${Math.floor(target / cols) + 1}, column ${(target % cols) + 1}`
        + ` is ${truth.has(target) ? "land" : "water"}.`;
      check();
      render();
    }

    /* 2x2 blocks where all four squares have been explicitly decided the same
       way. Unknown squares are never counted — a map still being worked out is
       full of 2x2 patches of nothing, and flagging those would be noise. */
    function blocks() {
      const bad = new Set();
      for (let r = 0; r + 1 < rows; r++) {
        for (let c = 0; c + 1 < cols; c++) {
          const q = [r * cols + c, r * cols + c + 1, (r + 1) * cols + c, (r + 1) * cols + c + 1];
          const kinds = q.map((i) => mark[i]);
          if (kinds.some((k) => k === UNKNOWN)) continue;
          if (kinds.every((k) => k === kinds[0])) for (const i of q) bad.add(i);
        }
      }
      return bad;
    }

    function render() {
      wrap.innerHTML = "";
      const bad = blocks();
      const placed = landSet().size;

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Land</small><b>${placed}/${totalLand}</b>`),
        el("div", "grid-score-cell", `<small>2x2 blocks</small><b>${bad.size ? bad.size / 4 : 0}</b>`),
        el("div", "grid-score-cell", `<small>Hints</small><b>${hints}</b>`),
      );
      wrap.appendChild(head);

      const board = el("div", "isl-board");
      board.style.setProperty("--cols", cols);
      for (let i = 0; i < N; i++) {
        const b = el("button", "isl-cell"
          + (mark[i] === LAND ? " land" : "")
          + (mark[i] === WATER ? " water" : "")
          + (locked[i] ? " clue" : "")
          + (bad.has(i) ? " block" : ""));
        b.textContent = locked[i] ? String(clues[i]) : (mark[i] === WATER ? "·" : "");
        b.disabled = over || !!locked[i];
        b.setAttribute("aria-label",
          `row ${Math.floor(i / cols) + 1} column ${(i % cols) + 1}, `
          + (locked[i] ? `island of ${clues[i]}`
             : mark[i] === LAND ? "land" : mark[i] === WATER ? "water" : "undecided"));
        b.onclick = () => tap(i);
        board.appendChild(b);
      }
      wrap.appendChild(board);

      const msg = el("p", "q-detail center isl-msg");
      msg.innerHTML = over
        ? "Every island the right size, the water in one piece, and not a single 2x2 anywhere."
        : message || (bad.size
          ? "<b>There's a 2x2 block of one kind.</b> That's banned for land as well "
            + "as water — islands have to snake."
          : "Tap once for water, again for land, again to clear. Islands never touch "
            + "edge-to-edge, and the water is all one piece.");
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = finish;
        bar.appendChild(b);
      } else {
        const h = el("button", "ghost compact", "Hint (costs you)");
        h.onclick = hint;
        const c = el("button", "ghost compact", "Clear the map");
        c.disabled = !mark.some((v, i) => !locked[i] && v !== UNKNOWN);
        c.onclick = () => {
          let wiped = false;
          for (let i = 0; i < N; i++) {
            if (locked[i]) continue;
            if (mark[i] === LAND) wiped = true;
            mark[i] = UNKNOWN;
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
        headline: hints === 0
          ? `Every island found, unaided`
          : `Charted with ${hints} hint${hints === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Islands", String(Object.keys(clues).length)],
          ["Land squares", String(totalLand)],
          ["Hints", String(hints)],
          ["Take-backs", String(takeBacks)],
        ],
        perfect: hints === 0 && takeBacks === 0,
        extra: [
          hints === 0 ? "🧠 unaided" : `💡 ${hints} hint${hints === 1 ? "" : "s"}`,
          takeBacks === 0 ? "🎯 never unmade an island" : `↩️ ${takeBacks} take-back${takeBacks === 1 ? "" : "s"}`,
        ],
      });
    }

    render();
  },
};
