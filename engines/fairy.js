import { el } from "./shared.js";
import {
  PIECES, FILES, position, apply, movesFrom, legalMoves,
  isMate, inCheck, mateInN, name, xy, light,
} from "./fairy-rules.js";

/* ============================================================================
   FAIRY CHESS
   ----------------------------------------------------------------------------
   Two shapes of puzzle share this engine, because they share a board:

     mode "reach" — no opponent. Walk a piece through a list of squares in as
                    few moves as you can. Scored against a par the authoring
                    tool computed by breadth-first search, so par is provably
                    the shortest route and not my guess at one.

     mode "mate"  — an opponent. Force mate in n. Black defends with a move
                    that survives longest, so a line that only works against
                    a cooperative king will not pass.

   The rules themselves live in fairy-rules.js.
   ========================================================================== */

const SIDE_NAME = { w: "White", b: "Black" };

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const d = puzzle.data;
    const start = position(d.size || 8, d.pieces);
    const par = d.par;

    let pos = start;
    let selected = null;
    let moves = 0;          // reach: your moves. mate: your moves this attempt.
    let attempts = 0;       // mate only: resets that didn't work out
    let legFrom = null;     // reach: which piece is the one being timed
    let targetIdx = 0;
    let over = false;

    /* ---------- the pieces on show ------------------------------------- */

    const seen = [...new Set(d.pieces.map(([, t]) => t))];
    const key = el("div", "fairy-key");
    for (const t of seen) {
      const spec = PIECES[t];
      if (!spec.fairy && !d.explainAll) continue;
      key.appendChild(el("div", "fairy-key-row",
        `<span class="fairy-chip ${spec.fairy ? "fairy" : ""}">${spec.glyph}</span>
         <span><b>${spec.name}</b>${d.glossary && d.glossary[t] ? " — " + d.glossary[t] : ""}</span>`));
    }
    if (key.children.length) root.appendChild(key);

    root.appendChild(el("p", "q-detail center", d.prompt));

    const board = el("div", "fairy-board");
    board.style.setProperty("--n", String(start.size));
    root.appendChild(board);

    const status = el("div", "fairy-status", "&nbsp;");
    root.appendChild(status);

    const bar = el("div", "fairy-bar");
    const resetBtn = el("button", "ghost compact", d.mode === "mate" ? "Start over" : "Reset");
    bar.appendChild(resetBtn);
    root.appendChild(bar);

    resetBtn.onclick = () => {
      if (over) return;
      if (d.mode === "mate" && moves > 0) attempts++;
      pos = start;
      selected = null;
      moves = 0;
      targetIdx = 0;
      legFrom = null;
      say(d.mode === "mate" && attempts
        ? `Attempt ${attempts + 1}. Black is to move second — assume it defends.`
        : "&nbsp;");
      render();
    };

    const say = (html) => { status.innerHTML = html; };

    /* ---------- the board ------------------------------------------------ */

    function targets() { return d.targets || []; }

    function render() {
      board.innerHTML = "";
      const hints = selected ? legalDests(selected) : [];
      for (let y = start.size - 1; y >= 0; y--) {
        for (let x = 0; x < start.size; x++) {
          const sq = name(x, y);
          const cell = el("button", "fairy-sq " + (light(x, y) ? "lt" : "dk"));
          cell.setAttribute("aria-label", sq);
          const piece = pos.at.get(sq);
          if (piece) {
            const spec = PIECES[piece.t];
            cell.appendChild(el("span",
              `fairy-pc ${piece.s === "w" ? "white" : "black"} ${spec.fairy ? "fairy" : ""}` +
              (spec.glyph.length > 1 ? " small" : ""),
              spec.glyph));
          }
          const ti = targets().indexOf(sq);
          if (ti >= 0) cell.classList.add(ti < targetIdx ? "done" : ti === targetIdx ? "target" : "later");
          if (sq === selected) cell.classList.add("sel");
          if (hints.includes(sq)) cell.classList.add(piece ? "take" : "hint");
          cell.onclick = () => click(sq);
          board.appendChild(cell);
        }
      }
      const label = d.mode === "mate"
        ? `Move ${Math.floor(moves / 1) + 1} of ${d.mateIn}`
        : `${moves} move${moves === 1 ? "" : "s"}${par ? ` · par ${par}` : ""}`;
      board.setAttribute("data-count", label);
      counter.textContent = label;
    }

    const counter = el("div", "fairy-count");
    root.insertBefore(counter, status);

    function legalDests(from) {
      if (d.mode === "mate") {
        return legalMoves(pos, "w").filter((m) => m.from === from).map((m) => m.to);
      }
      return movesFrom(pos, from);
    }

    function click(sq) {
      if (over) return;
      const piece = pos.at.get(sq);
      if (selected && legalDests(selected).includes(sq)) return play({ from: selected, to: sq });
      if (piece && piece.s === "w" && (d.mode === "mate" || movable(sq))) {
        selected = selected === sq ? null : sq;
        /* A piece with nowhere to go is a real state in this game rather than a
           broken button — the grasshopper starts that way — so say so. */
        if (selected && legalDests(selected).length === 0) {
          say(`<b>${PIECES[piece.t].name} on ${sq}</b> has no legal moves at all.`);
        }
        render();
        return;
      }
      selected = null;
      render();
    }

    /* In reach mode every white piece is yours to move, but only one of them
       is the one that has to finish on the targets. */
    const movable = (sq) => !d.movable || d.movable.includes(pos.at.get(sq).t);

    function play(mv) {
      pos = apply(pos, mv);
      selected = null;
      moves++;
      if (d.mode === "mate") return afterWhite();
      /* reach: did the goal piece land on the square it owed us? */
      const landed = pos.at.get(mv.to);
      if (landed.t === d.goal && mv.to === targets()[targetIdx]) {
        targetIdx++;
        if (targetIdx === targets().length) return render(), finishReach();
        say(`Square ${targetIdx} of ${targets().length}. Now <b>${targets()[targetIdx]}</b>.`);
      }
      render();
    }

    /* ---------- mate mode ------------------------------------------------ */

    function afterWhite() {
      if (isMate(pos, "b")) { render(); return finishMate(); }
      const replies = legalMoves(pos, "b");
      if (!replies.length) {           // stalemate — legal, but not a win
        render();
        say(`Stalemate. Black isn't in check and can't move — that's a draw, not a mate. ` +
            `<b>Start over.</b>`);
        return;
      }
      if (moves >= d.mateIn) {
        render();
        say(`That's ${d.mateIn} moves and Black is still standing. <b>Start over</b> and try another key.`);
        return;
      }
      /* Black picks the defence that holds out longest; among equals, the
         first in a fixed order, so the puzzle plays the same for everybody. */
      const survives = replies.filter((r) => mateInN(apply(pos, r), "w", d.mateIn - moves - 1).length === 0);
      const choice = (survives.length ? survives : replies)[0];
      pos = apply(pos, choice);
      render();
      say(`Black plays <b>${choice.from}–${choice.to}</b>.` +
          (inCheck(pos, "w") ? " And that's check to you." : ""));
    }

    function finishMate() {
      over = true;
      api.finish({
        headline: attempts === 0 ? "Mate, first try" : `Mate after ${attempts + 1} attempts`,
        squares: "❌".repeat(Math.min(attempts, 20)) + "✅",
        stats: [
          ["Attempts", String(attempts + 1)],
          ["Verdict", attempts === 0 ? "Saw it" : attempts <= 2 ? "Found it" : "Wore it down"],
        ],
        perfect: attempts === 0,
        notes: d.notes || [],
      });
    }

    function finishReach() {
      over = true;
      const over_ = moves - par;
      api.finish({
        headline: over_ <= 0 ? `${moves} moves — par` : `${moves} moves, par ${par}`,
        squares: "🟩".repeat(Math.min(par, 20)) + "🟨".repeat(Math.min(Math.max(over_, 0), 20)),
        stats: [
          ["Your moves", String(moves)],
          ["Par", String(par)],
          ["Verdict", over_ <= 0 ? "Optimal" : over_ <= 2 ? "Close" : "The scenic route"],
        ],
        perfect: over_ <= 0,
        notes: d.notes || [],
      });
    }

    say(d.opening || "&nbsp;");
    render();
  },
};
