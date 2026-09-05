import { el } from "./shared.js";
import { step, allSigned, solve, deadlocked, isWall } from "./dispatch-rules.js";

/* ============================================================================
   DISPATCH — "signed for"
   ----------------------------------------------------------------------------
   Sokoban where delivery is final. Push a crate onto a mark and it is signed
   for: it stops being a crate, becomes part of the building, and the square it
   sits on is a wall from then on.

   The ordinary game lets a crate on a goal stay furniture — park it, use it,
   shove it off, come back. Because nothing is final until the last push, the
   order you fill the marks in barely matters. Here it is the whole puzzle, and
   it is yours to choose: in the second room, three quarters of the ways to
   make your FIRST delivery leave the room unfinishable.

   It also makes the marks hazards. You cannot push a crate through one on the
   way to somewhere better, so routes that are obvious in the ordinary game
   have to detour around the exact squares you are aiming at.

   Par is recomputed on mount by breadth-first search over every reachable
   state (dispatch-rules.js: solve), and the state now carries which marks are
   signed for as well as where the crates are.

   The engine says when the room is provably dead — a crate cornered, or fewer
   crates left than marks left. It does not say when a delivery has merely
   ruined your schedule, because that is the game.
   ========================================================================== */

const ARROWS = [
  { dir: 0, label: "↑", cls: "up" },
  { dir: 2, label: "←", cls: "left" },
  { dir: 3, label: "→", cls: "right" },
  { dir: 1, label: "↓", cls: "down" },
];

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const rooms = puzzle.data.rooms.map((spec) => parse(spec.rows, spec.label));
    const pars = rooms.map((room) => {
      const s = solve(room.room, room.worker, room.crates, room.goals, room.cols);
      if (!s) throw new Error("dispatch: room has no solution");
      return s.steps;
    });

    let ri = 0;
    const results = rooms.map(() => ({ steps: 0, resets: 0 }));
    let worker, crates, sealed, history, over;

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function setup() {
      const cur = rooms[ri];
      worker = cur.worker;
      crates = new Set(cur.crates);
      sealed = new Set();
      history = [];
      over = false;
    }

    function move(dir) {
      if (over) return;
      const cur = rooms[ri];
      const nx = step(cur.room, worker, crates, sealed, cur.goals, dir, cur.cols);
      if (!nx) return;
      history.push({ worker, crates: new Set(crates), sealed: new Set(sealed) });
      worker = nx.worker;
      crates = nx.crates;
      sealed = nx.sealed;
      results[ri].steps++;
      if (allSigned(sealed, cur.goals)) over = true;
      render();
    }

    function render() {
      wrap.innerHTML = "";
      const cur = rooms[ri];
      const r = results[ri];
      const dead = !over && deadlocked(cur.room, crates, sealed, cur.goals, cur.cols);

      wrap.appendChild(el("p", "q-num",
        `Room ${ri + 1} of ${rooms.length} — ${cur.label}`));
      wrap.appendChild(el("div", "pips", rooms.map((_, i) =>
        `<i class="${i < ri ? "done" : i === ri ? "now" : ""}"></i>`).join("")));

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Steps</small><b>${r.steps}</b>`),
        el("div", "grid-score-cell", `<small>Par</small><b>${pars[ri]}</b>`),
        el("div", "grid-score-cell",
          `<small>Signed for</small><b>${sealed.size}/${cur.goals.length}</b>`),
      );
      wrap.appendChild(head);

      const board = el("div", "crt-board");
      board.style.setProperty("--cols", cur.cols);
      for (let i = 0; i < cur.rows.length * cur.cols; i++) {
        const rr = Math.floor(i / cur.cols), cc = i % cur.cols;
        const wall = isWall(cur.room, rr, cc);
        const goal = cur.goals.includes(i);
        const cell = el("div", "crt-cell"
          + (wall ? " wall" : "")
          + (goal && !sealed.has(i) ? " goal" : "")
          + (sealed.has(i) ? " crate done sealed" : "")
          + (crates.has(i) ? " crate" : "")
          + (worker === i ? " worker" : ""));
        if (sealed.has(i) || crates.has(i)) cell.textContent = "▣";
        else if (worker === i) cell.textContent = "☻";
        else if (goal) cell.textContent = "·";
        board.appendChild(cell);
      }
      wrap.appendChild(board);

      const msg = el("p", "q-detail center crt-msg");
      msg.innerHTML = over
        ? (r.steps === pars[ri]
            ? `All signed for in <b>${r.steps}</b> steps — the shortest there is.`
            : `All signed for in <b>${r.steps}</b> steps. Par is <b>${pars[ri]}</b>.`)
        : dead
          ? "<b>This room is dead.</b> What's left can't reach what's still open. Reset it."
          : "Walk into a crate to push it. A crate that reaches a mark is signed for — and becomes a wall.";
      wrap.appendChild(msg);

      if (!over) {
        const pad = el("div", "crt-pad");
        ARROWS.forEach((a) => {
          const b = el("button", "crt-key " + a.cls, a.label);
          b.setAttribute("aria-label", { 0: "up", 1: "down", 2: "left", 3: "right" }[a.dir]);
          b.onclick = () => move(a.dir);
          pad.appendChild(b);
        });
        wrap.appendChild(pad);
      }

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact",
          ri === rooms.length - 1 ? "See your score" : "Next room");
        b.onclick = () => {
          ri++;
          if (ri === rooms.length) return done();
          setup(); render();
        };
        bar.appendChild(b);
      } else {
        const undo = el("button", "ghost compact", "Undo");
        undo.disabled = !history.length;
        undo.onclick = () => {
          const prev = history.pop();
          worker = prev.worker; crates = prev.crates; sealed = prev.sealed;
          results[ri].steps--;
          render();
        };
        const reset = el("button", (dead ? "primary" : "ghost") + " compact", "Reset room");
        reset.disabled = !history.length;
        reset.onclick = () => {
          results[ri].resets++;
          results[ri].steps = 0;
          setup(); render();
        };
        bar.append(undo, reset);
      }
      wrap.appendChild(bar);
    }

    /* Keyboard, for anyone playing on a desktop. Registered against the
       document, so the teardown hook matters. */
    const onKey = (e) => {
      const map = { ArrowUp: 0, ArrowDown: 1, ArrowLeft: 2, ArrowRight: 3,
                    w: 0, s: 1, a: 2, d: 3 };
      const dir = map[e.key];
      if (dir === undefined) return;
      e.preventDefault();
      move(dir);
    };
    document.addEventListener("keydown", onKey);
    api.onTeardown(() => document.removeEventListener("keydown", onKey));

    function done() {
      const steps = results.reduce((a, r) => a + r.steps, 0);
      const par = pars.reduce((a, b) => a + b, 0);
      const resets = results.reduce((a, r) => a + r.resets, 0);
      const overPar = steps - par;
      const squares = results.map((r, i) =>
        r.steps === pars[i] ? "🟩" : r.steps <= pars[i] + 4 ? "🟨" : "🟧").join("");

      api.finish({
        headline: overPar === 0
          ? `Both rooms at par — ${steps} steps, none wasted`
          : `${steps} steps against a par of ${par}`,
        squares,
        stats: [
          ["Steps", String(steps)],
          ["Par", String(par)],
          ["Resets", String(resets)],
        ],
        perfect: overPar === 0 && resets === 0,
        extra: [
          overPar === 0 ? "🎯 shortest route both rooms" : `📦 +${overPar} over par`,
          resets ? `🔁 ${resets} reset${resets === 1 ? "" : "s"}` : "🧊 never killed a room",
        ],
      });
    }

    setup();
    render();
  },
};

/* Standard Sokoban notation, so the rooms stay readable in the content file:
   # wall, space floor, $ crate, . mark, @ worker. A crate cannot start on a
   mark here — it would already be signed for. */
function parse(rows, label) {
  const cols = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((r) => r.padEnd(cols, " "));
  const room = padded.map((r) => r.split("").map((ch) => (ch === "#" ? "#" : " ")));
  let worker = -1;
  const crates = [], goals = [];
  padded.forEach((line, r) => line.split("").forEach((ch, c) => {
    const i = r * cols + c;
    if (ch === "$") crates.push(i);
    if (ch === ".") goals.push(i);
    if (ch === "@") worker = i;
  }));
  if (crates.length !== goals.length) throw new Error("dispatch: crate/mark mismatch");
  return { room, worker, crates, goals, cols, rows: padded, label };
}
