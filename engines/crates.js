import { el } from "./shared.js";
import { step, solved, solve, deadlocked, isWall } from "./crates-rules.js";

/* ============================================================================
   CRATES — "the warehouse"
   ----------------------------------------------------------------------------
   Sokoban. Walk the worker with the pad; walking into a crate pushes it, if
   there is room behind. Crates cannot be pulled, which is the whole difficulty:
   this is one of the few puzzles where you can destroy the position without
   noticing, and no amount of subsequent cleverness gets it back.

   The engine will tell you when the room is dead — a crate wedged in a corner
   off its goal can never move again — rather than let you wander a ruined
   warehouse hoping. It will not tell you when you have merely made things
   harder, because that's the game.

   Par is recomputed on mount by breadth-first search over every reachable
   state of the room (crates-rules.js: solve). For the second room that is
   about forty-five thousand distinct arrangements, and the answer is
   twenty-five steps — so twenty-four is not merely hard, it does not exist.
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
    const pars = rooms.map((rm) => {
      const s = solve(rm.room, rm.worker, rm.crates, rm.goals, rm.cols);
      if (!s) throw new Error("crates: room has no solution");
      return s.steps;
    });

    let ri = 0;
    const results = rooms.map(() => ({ steps: 0, resets: 0 }));
    let worker, crates, history, over;

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function setup() {
      const rm = rooms[ri];
      worker = rm.worker;
      crates = new Set(rm.crates);
      history = [];
      over = false;
    }

    function move(dir) {
      if (over) return;
      const rm = rooms[ri];
      const nx = step(rm.room, worker, crates, dir, rm.cols);
      if (!nx) return;
      history.push({ worker, crates: new Set(crates) });
      worker = nx.worker;
      crates = nx.crates;
      results[ri].steps++;
      if (solved(crates, rm.goals)) over = true;
      render();
    }

    function render() {
      wrap.innerHTML = "";
      const rm = rooms[ri];
      const r = results[ri];
      const dead = !over && deadlocked(rm.room, crates, rm.goals, rm.cols);

      wrap.appendChild(el("p", "q-num",
        `Room ${ri + 1} of ${rooms.length} — ${rm.label}`));
      wrap.appendChild(el("div", "pips", rooms.map((_, i) =>
        `<i class="${i < ri ? "done" : i === ri ? "now" : ""}"></i>`).join("")));

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Steps</small><b>${r.steps}</b>`),
        el("div", "grid-score-cell", `<small>Par</small><b>${pars[ri]}</b>`),
        el("div", "grid-score-cell",
          `<small>On goal</small><b>${rm.goals.filter((g) => crates.has(g)).length}/${rm.goals.length}</b>`),
      );
      wrap.appendChild(head);

      const board = el("div", "crt-board");
      board.style.setProperty("--cols", rm.cols);
      for (let i = 0; i < rm.rows.length * rm.cols; i++) {
        const rr = Math.floor(i / rm.cols), cc = i % rm.cols;
        const wall = isWall(rm.room, rr, cc);
        const goal = rm.goals.includes(i);
        const crate = crates.has(i);
        const cell = el("div", "crt-cell"
          + (wall ? " wall" : "")
          + (goal ? " goal" : "")
          + (crate ? (goal ? " crate done" : " crate") : "")
          + (worker === i ? " worker" : ""));
        if (crate) cell.textContent = "▣";
        else if (worker === i) cell.textContent = "☻";
        else if (goal) cell.textContent = "·";
        board.appendChild(cell);
      }
      wrap.appendChild(board);

      const msg = el("p", "q-detail center crt-msg");
      msg.innerHTML = over
        ? (r.steps === pars[ri]
            ? `Every crate home in <b>${r.steps}</b> steps — the shortest there is.`
            : `Every crate home in <b>${r.steps}</b> steps. Par is <b>${pars[ri]}</b>.`)
        : dead
          ? "<b>This room is dead.</b> A crate is wedged in a corner and can't be pulled back out. Reset it."
          : "Walk into a crate to push it. You can never pull one back.";
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
          worker = prev.worker; crates = prev.crates;
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
          resets ? `🔁 ${resets} reset${resets === 1 ? "" : "s"}` : "🧊 never wedged a crate",
        ],
        notes: puzzle.data.notes || [],
      });
    }

    setup();
    render();
  },
};

/* Standard Sokoban notation, so the rooms stay readable in the content file:
   # wall, space floor, $ crate, . goal, * crate on goal, @ worker,
   + worker on goal. */
function parse(rows, label) {
  const cols = Math.max(...rows.map((r) => r.length));
  const padded = rows.map((r) => r.padEnd(cols, " "));
  const room = padded.map((r) => r.split("").map((ch) => (ch === "#" ? "#" : " ")));
  let worker = -1;
  const crates = [], goals = [];
  padded.forEach((line, r) => line.split("").forEach((ch, c) => {
    const i = r * cols + c;
    if (ch === "$" || ch === "*") crates.push(i);
    if (ch === "." || ch === "*" || ch === "+") goals.push(i);
    if (ch === "@" || ch === "+") worker = i;
  }));
  if (crates.length !== goals.length) throw new Error("crates: crate/goal mismatch");
  return { room, worker, crates, goals, cols, rows: padded, label };
}
