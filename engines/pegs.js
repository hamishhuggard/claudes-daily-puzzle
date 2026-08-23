import { el } from "./shared.js";
import {
  HOLE_COUNT, COORD, fullState, hasPeg, legalMoves, applyMove, popcount,
  bestOutcome, solutionFrom, canReachOne,
} from "./pegs-rules.js";

/* ============================================================================
   JUMPING THE PEGS
   ----------------------------------------------------------------------------
   Triangular 15-hole peg solitaire — the "Cracker Barrel" board, not the
   English cross, because it fits a phone screen and its solution structure
   is richer for a 13-move game. Tap a peg, tap a highlighted hole to jump it.

   par is a single peg remaining, proven reachable from the authored empty
   hole by bestOutcome() at mount time (pegs-rules.js, which is also how the
   full solution in the notes gets built).

   The interesting failure mode isn't losing — it's the player quietly
   painting themselves into a corner with four unreachable pegs. We never
   warn about that live; undo and reset both exist and are both counted, and
   the retrospective ("here's the move that ended it") only appears in the
   notes after the board is stuck, computed by walking the player's own move
   history through canReachOne — the same function that graded the opening.
   ========================================================================== */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const d = puzzle.data;
    const startEmpty = d.startEmpty ?? 4; // 0-indexed hole, centre-ish by default
    if (startEmpty < 0 || startEmpty >= HOLE_COUNT) {
      throw new Error(`pegs: startEmpty ${startEmpty} out of range`);
    }
    const start = fullState(startEmpty);

    // Dev-time integrity check: this content must actually be solvable to a
    // single peg, or the puzzle is unshippable — see BRIEF's hard rule.
    const memo = new Map();
    const outcome = bestOutcome(start, memo);
    if (outcome.pegs !== 1) {
      throw new Error(`pegs: start hole ${startEmpty} only reaches ${outcome.pegs} pegs, not 1`);
    }
    const solutionMoves = solutionFrom(start, memo);

    root.appendChild(el("p", "q-detail center",
      "Tap a peg, then tap a highlighted hole to jump it over a neighbour and remove that neighbour. " +
      "Get down to one peg."));

    const statusBar = el("div", "q-detail center", "");
    root.appendChild(statusBar);

    const boardWrap = el("div");
    boardWrap.style.display = "flex";
    boardWrap.style.flexDirection = "column";
    boardWrap.style.alignItems = "center";
    boardWrap.style.gap = "8px";
    boardWrap.style.margin = "14px 0";
    root.appendChild(boardWrap);

    const HOLE = 46; // px, comfortably tappable

    const rowEls = [];
    for (let r = 0; r < 5; r++) {
      const rowEl = el("div");
      rowEl.style.display = "flex";
      rowEl.style.gap = "8px";
      boardWrap.appendChild(rowEl);
      rowEls.push(rowEl);
    }

    const holeEls = [];
    for (let idx = 0; idx < HOLE_COUNT; idx++) {
      const [r] = COORD[idx];
      const b = document.createElement("button");
      b.type = "button";
      b.style.width = b.style.height = HOLE + "px";
      b.style.borderRadius = "50%";
      b.style.fontSize = "22px";
      b.style.lineHeight = HOLE + "px";
      b.style.padding = "0";
      b.style.border = "2px solid var(--faint, #888)";
      b.style.background = "transparent";
      b.style.cursor = "pointer";
      b.style.transition = "transform .1s, background .15s, border-color .15s";
      b.onclick = () => onTap(idx);
      rowEls[r].appendChild(b);
      holeEls.push(b);
    }

    const barRow = el("div");
    barRow.style.display = "flex";
    barRow.style.gap = "10px";
    barRow.style.justifyContent = "center";
    barRow.style.marginTop = "6px";
    const undoBtn = el("button", "ghost compact", "Undo");
    const resetBtn = el("button", "ghost compact", "Reset");
    barRow.append(undoBtn, resetBtn);
    root.appendChild(barRow);

    const feedback = el("div", "order-feedback", "&nbsp;");
    root.appendChild(feedback);

    let state = start;
    let selected = null;
    const history = [start]; // states visited on the *current* run (undo pops, reset clears)
    let undoCount = 0;
    let resetCount = 0;

    function paint() {
      const moves = legalMoves(state);
      const legalTargets = selected == null ? [] :
        moves.filter((m) => m.from === selected).map((m) => m.to);

      holeEls.forEach((b, idx) => {
        const peg = hasPeg(state, idx);
        b.textContent = peg ? "⚫" : "";
        b.disabled = false;
        if (idx === selected) {
          b.style.background = "#f4c542";
          b.style.borderColor = "#f4c542";
          b.style.transform = "scale(1.08)";
        } else if (legalTargets.includes(idx)) {
          b.style.background = "rgba(76,175,80,.25)";
          b.style.borderColor = "#4caf50";
          b.style.transform = "scale(1)";
        } else {
          b.style.background = "transparent";
          b.style.borderColor = peg ? "var(--faint, #888)" : "rgba(255,255,255,.15)";
          b.style.transform = "scale(1)";
        }
      });

      const pegs = popcount(state);
      statusBar.innerHTML = `<b>${pegs}</b> peg${pegs === 1 ? "" : "s"} left` +
        (undoCount ? ` · ${undoCount} undo${undoCount === 1 ? "" : "s"}` : "") +
        (resetCount ? ` · ${resetCount} reset${resetCount === 1 ? "" : "s"}` : "");

      undoBtn.disabled = history.length < 2;
    }

    function onTap(idx) {
      if (selected == null) {
        if (hasPeg(state, idx)) {
          const hasMove = legalMoves(state).some((m) => m.from === idx);
          if (!hasMove) {
            feedback.className = "order-feedback show";
            feedback.textContent = "That peg has no legal jump right now.";
            return;
          }
          selected = idx;
          feedback.innerHTML = "&nbsp;";
          paint();
        }
        return;
      }
      if (idx === selected) { selected = null; paint(); return; } // deselect
      if (hasPeg(state, idx)) { // reselect a different peg
        selected = idx;
        paint();
        return;
      }
      const mv = legalMoves(state).find((m) => m.from === selected && m.to === idx);
      if (!mv) {
        feedback.className = "order-feedback show";
        feedback.textContent = "Not a legal jump from there.";
        return;
      }
      state = applyMove(state, mv);
      history.push(state);
      selected = null;
      feedback.innerHTML = "&nbsp;";
      paint();
      if (legalMoves(state).length === 0) done();
    }

    undoBtn.onclick = () => {
      if (history.length < 2) return;
      history.pop();
      state = history[history.length - 1];
      selected = null;
      undoCount++;
      feedback.innerHTML = "&nbsp;";
      paint();
    };

    resetBtn.onclick = () => {
      state = start;
      history.length = 0;
      history.push(start);
      selected = null;
      resetCount++;
      feedback.innerHTML = "&nbsp;";
      paint();
    };

    paint();

    function done() {
      const finalState = state;
      const pegs = popcount(finalState);
      const perfect = pegs === 1;

      // Walk the run's own history through canReachOne to find the exact
      // move after which a 1-peg finish stopped being possible.
      let brokenAt = null;
      for (let i = 0; i < history.length - 1; i++) {
        if (canReachOne(history[i], memo) && !canReachOne(history[i + 1], memo)) { brokenAt = i + 1; break; }
      }

      root.innerHTML = "";
      root.appendChild(el("div", "reveal-badge " + (perfect ? "good" : pegs <= 2 ? "ok" : "bad"),
        `${perfect ? "🏆" : "⚫"} ${pegs} peg${pegs === 1 ? "" : "s"} left`));

      const grid = el("div", "reveal-nums");
      grid.append(
        el("div", null, `<span>Pegs left</span><b>${pegs}</b>`),
        el("div", null, `<span>Undos</span><b>${undoCount}</b>`),
        el("div", null, `<span>Resets</span><b>${resetCount}</b>`),
      );
      root.appendChild(grid);

      const rowsOf = (st) => {
        const lines = [];
        let idx = 0;
        for (let r = 0; r < 5; r++) {
          let line = "";
          for (let c = 0; c <= r; c++) { line += hasPeg(st, idx) ? "⚫" : "⚪"; idx++; }
          lines.push(line);
        }
        return lines.join("\n");
      };
      const squares = rowsOf(finalState);
      root.appendChild(el("pre", "q-detail center", squares));

      const notes = [];
      notes.push(perfect
        ? "Down to one peg — that's the best this board gives up."
        : `Finished with ${pegs} pegs. Par is 1.`);

      if (!perfect) {
        notes.push(brokenAt != null
          ? `A one-peg finish was still on the table through move ${brokenAt} — it was move ${brokenAt} that closed it off for good. Every move after that could only end with pegs stranded.`
          : "This run never had a one-peg finish available at all — the check at mount time confirmed the board does support one from the start, so the very first move already left it behind.");
      }

      const holeLabel = (i) => i + 1;
      const solText = solutionMoves.map((m) =>
        `${holeLabel(m.from)}→${holeLabel(m.to)} (over ${holeLabel(m.mid)})`).join(", ");
      notes.push(`One full 13-move solution to a single peg, from hole ${holeLabel(startEmpty)} empty: ${solText}.`);

      api.finish({
        headline: perfect ? "Down to one peg — clean sweep" : `Finished with ${pegs} pegs left`,
        squares,
        stats: [
          ["Pegs left", `${pegs} (par 1)`],
          ["Undos", String(undoCount)],
          ["Resets", String(resetCount)],
        ],
        perfect,
        extra: [
          perfect ? "🏆 solved to one peg" : `⚫ ${pegs} pegs stranded`,
          undoCount === 0 && resetCount === 0 ? "🚫 no undos, no resets" : `↩️ ${undoCount + resetCount} take-back${undoCount + resetCount === 1 ? "" : "s"}`,
        ],
        notes,
      });
    }
  },
};
