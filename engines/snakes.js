import { el } from "./shared.js";
import { solve, faults, neighbours4, neighbours8 } from "./snakes-rules.js";

/* ============================================================================
   SNAKES — "company"
   ----------------------------------------------------------------------------
   Two snakes hide in the grid. The row and column numbers count filled squares
   for BOTH of them together, which is the whole variant: in the one-snake
   original, working out that a square is filled and working out whose it is
   are the same deduction. Here they come apart, and the second half is done
   with the touching rules rather than the numbers.

   Squares cycle empty -> ruled out -> first snake -> second snake -> empty.
   The four marked ends are given and cannot be changed.

   The board has exactly one legal pair of snakes, so a grid that matches the
   answer IS the answer — there is nothing to submit.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const { rows, cols, rowCounts, colCounts, ends } = puzzle.data;
    const N = rows * cols;
    const spec = { rows, cols, rowCounts, colCounts, ends };

    const sols = solve(spec, 2);
    if (sols.length !== 1) throw new Error(`snakes: ${sols.length} solutions, want 1`);
    const answer = sols[0];                       // [pathA, pathB]
    const truth = new Int8Array(N).fill(-1);
    answer[0].forEach((i) => { truth[i] = 0; });
    answer[1].forEach((i) => { truth[i] = 1; });

    const n4 = neighbours4(rows, cols), n8 = neighbours8(rows, cols);
    const NB4 = Array.from({ length: N }, (_, i) => n4(i));
    const NB8 = Array.from({ length: N }, (_, i) => n8(i));

    const EMPTY = -1, OUT = 2;
    const mark = new Int8Array(N).fill(EMPTY);
    const locked = new Uint8Array(N);
    for (let s = 0; s < 2; s++) {
      for (const i of ends[s]) { mark[i] = s; locked[i] = 1; }
    }

    let hints = 0, takeBacks = 0, over = false, message = "";

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    const NAMES = ["the first snake", "the second snake"];

    /* Cycle order matters for the score. Ruling a square out is the commonest
       action, so it comes first and costs one tap; the two snakes follow. A
       take-back is only counted when a square actually LEAVES a snake, never
       for passing through one on the way — an earlier order made reaching the
       second snake cost a take-back every single time, which made the number
       meaningless. */
    function tap(i) {
      if (over || locked[i]) return;
      const was = mark[i];
      mark[i] = was === EMPTY ? OUT : was === OUT ? 0 : was === 0 ? 1 : EMPTY;
      if (was === 1 && mark[i] === EMPTY) takeBacks++;
      message = "";
      checkDone();
      render();
    }

    function checkDone() {
      for (let i = 0; i < N; i++) {
        const want = truth[i];
        const got = mark[i] === OUT ? -1 : mark[i];
        if (want !== got) return;
      }
      over = true;
    }

    function hint() {
      // Prefer removing something wrong; otherwise reveal a missing square.
      let target = -1;
      for (let i = 0; i < N; i++) {
        if (locked[i]) continue;
        const got = mark[i] === OUT ? -1 : mark[i];
        if (got !== -1 && got !== truth[i]) { target = i; break; }
      }
      if (target === -1) {
        for (let i = 0; i < N; i++) {
          if (locked[i] || truth[i] === -1) continue;
          if (mark[i] !== truth[i]) { target = i; break; }
        }
      }
      if (target === -1) return;
      mark[target] = truth[target] === -1 ? OUT : truth[target];
      hints++;
      const r = Math.floor(target / cols) + 1, c = (target % cols) + 1;
      message = truth[target] === -1
        ? `Hint: row ${r}, column ${c} is empty.`
        : `Hint: row ${r}, column ${c} belongs to ${NAMES[truth[target]]}.`;
      checkDone();
      render();
    }

    /* Live complaints about what is drawn, so the grid argues back while you
       work. These are about the touching rules only — the counts get their
       own colouring on the clue labels. */
    function contacts() {
      const bad = new Set();
      for (let i = 0; i < N; i++) {
        if (mark[i] !== 0 && mark[i] !== 1) continue;
        for (const j of NB8[i]) {
          if (mark[j] !== 0 && mark[j] !== 1) continue;
          if (mark[j] !== mark[i]) { bad.add(i); bad.add(j); }      // rule 2
        }
        // Rule 1: at most two orthogonal neighbours of the same snake, and an
        // end may have at most one.
        let same = 0;
        for (const j of NB4[i]) if (mark[j] === mark[i]) same++;
        const isEnd = ends[mark[i]].includes(i);
        if (same > (isEnd ? 1 : 2)) bad.add(i);
      }
      return bad;
    }

    function lineTotals() {
      const rowGot = new Array(rows).fill(0), colGot = new Array(cols).fill(0);
      for (let i = 0; i < N; i++) {
        if (mark[i] !== 0 && mark[i] !== 1) continue;
        rowGot[Math.floor(i / cols)]++; colGot[i % cols]++;
      }
      return { rowGot, colGot };
    }

    function render() {
      wrap.innerHTML = "";
      const { rowGot, colGot } = lineTotals();
      const bad = contacts();
      let filled = 0;
      for (let i = 0; i < N; i++) if (mark[i] === 0 || mark[i] === 1) filled++;
      const target = rowCounts.reduce((a, b) => a + b, 0);

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Filled</small><b>${filled}/${target}</b>`),
        el("div", "grid-score-cell", `<small>Clashes</small><b>${bad.size}</b>`),
        el("div", "grid-score-cell", `<small>Hints</small><b>${hints}</b>`),
      );
      wrap.appendChild(head);

      const board = el("div", "snk-board");
      board.style.setProperty("--cols", cols + 1);

      board.appendChild(el("div", "snk-corner"));
      for (let c = 0; c < cols; c++) {
        const done = colGot[c] === colCounts[c], over_ = colGot[c] > colCounts[c];
        board.appendChild(el("div",
          `snk-clue${done ? " met" : ""}${over_ ? " busted" : ""}`, String(colCounts[c])));
      }

      for (let r = 0; r < rows; r++) {
        const done = rowGot[r] === rowCounts[r], over_ = rowGot[r] > rowCounts[r];
        board.appendChild(el("div",
          `snk-clue${done ? " met" : ""}${over_ ? " busted" : ""}`, String(rowCounts[r])));
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          const b = el("button", "snk-cell"
            + (mark[i] === 0 ? " s0" : "")
            + (mark[i] === 1 ? " s1" : "")
            + (mark[i] === OUT ? " out" : "")
            + (locked[i] ? " end" : "")
            + (bad.has(i) ? " clash" : ""));
          b.textContent = mark[i] === OUT ? "·" : "";
          b.disabled = over || !!locked[i];
          const what = mark[i] === OUT ? "ruled out"
            : mark[i] === 0 ? "first snake" : mark[i] === 1 ? "second snake" : "empty";
          b.setAttribute("aria-label", `row ${r + 1} column ${c + 1}, ${what}`);
          b.onclick = () => tap(i);
          board.appendChild(b);
        }
      }
      wrap.appendChild(board);

      const msg = el("p", "q-detail center snk-msg");
      msg.innerHTML = over
        ? "Both snakes found — and only one pair fits those totals."
        : message || (bad.size
          ? "<b>Two squares are touching that shouldn't.</b> Different snakes never "
            + "touch at all; a snake meets itself only along its own body."
          : "Tap once to rule a square out, again for the first snake, again for "
            + "the second. The numbers count both snakes together.");
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = done;
        bar.appendChild(b);
      } else {
        const h = el("button", "ghost compact", "Hint (costs you)");
        h.onclick = hint;
        const c = el("button", "ghost compact", "Clear the grid");
        c.disabled = !mark.some((v, i) => !locked[i] && v !== EMPTY);
        c.onclick = () => {
          let wiped = false;
          for (let i = 0; i < N; i++) {
            if (locked[i]) continue;
            if (mark[i] === 0 || mark[i] === 1) wiped = true;
            mark[i] = EMPTY;
          }
          if (wiped) takeBacks++;
          message = ""; render();
        };
        bar.append(h, c);
      }
      wrap.appendChild(bar);
    }

    function done() {
      const squares = [
        hints === 0 ? "🟩" : hints <= 2 ? "🟨" : "🟧",
        takeBacks <= 4 ? "🟩" : takeBacks <= 12 ? "🟨" : "🟧",
      ].join("") + (hints === 0 ? "🟩🟩🟩" : hints <= 2 ? "🟩🟩🟨" : "🟩🟨🟧");

      api.finish({
        headline: hints === 0
          ? `Both snakes, unaided`
          : `Both snakes with ${hints} hint${hints === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Snake lengths", `${answer[0].length} and ${answer[1].length}`],
          ["Hints", String(hints)],
          ["Take-backs", String(takeBacks)],
        ],
        perfect: hints === 0 && takeBacks === 0,
        extra: [
          hints === 0 ? "🧠 unaided" : `💡 ${hints} hint${hints === 1 ? "" : "s"}`,
          takeBacks === 0 ? "🎯 never rubbed anything out" : `↩️ ${takeBacks} take-back${takeBacks === 1 ? "" : "s"}`,
        ],
      });
    }

    render();
  },
};
