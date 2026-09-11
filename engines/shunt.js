import { el } from "./shared.js";
import { legalMoves, apply, solve, parIfAllDeadEnds } from "./shunt-rules.js";

/* ============================================================================
   SHUNT — "The Loop Line"
   ----------------------------------------------------------------------------
   Send a train out in a different order than it came in, using three sidings:
   two dead ends (LIFO) and one loop line (FIFO). Par comes from an exhaustive
   BFS in shunt-rules.js — see that file's header for why the loop is what
   makes this a search instead of an unstacking exercise.
   ========================================================================== */

const SIDING_LABEL = (s) => (s.kind === "loop" ? "Loop" : "Siding");

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const rounds = puzzle.data.rounds;
    let ri = 0;
    const roundResults = [];

    if (!document.getElementById("shunt-style")) {
      const style = document.createElement("style");
      style.id = "shunt-style";
      style.textContent = `
        .shunt-track { border: 1px solid var(--line, #2b3342); border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; }
        .shunt-label { font-size: .68rem; text-transform: uppercase; letter-spacing: 1px; color: var(--faint, #8892a4); margin-bottom: 6px; font-weight: 700; }
        .shunt-wagons { display: flex; flex-wrap: wrap; gap: 5px; min-height: 30px; align-items: center; }
        .shunt-wagon { display: inline-flex; align-items: center; justify-content: center; min-width: 30px; height: 30px; padding: 0 8px; border-radius: 7px; background: #1c2532; border: 1px solid #333d4f; font-weight: 700; font-variant-numeric: tabular-nums; }
        .shunt-wagon.front { border-color: #5b7fd9; box-shadow: 0 0 0 1px #5b7fd9 inset; }
        .shunt-wagon.done { background: #14351f; border-color: #2c5f3d; }
        .shunt-wagon.ghost { background: transparent; border-style: dashed; color: var(--faint, #8892a4); }
        .shunt-empty { color: var(--faint, #8892a4); font-size: .85rem; }
        .shunt-sidings { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 8px; }
        .shunt-siding { border: 1px solid var(--line, #2b3342); border-radius: 10px; padding: 8px; display: flex; flex-direction: column; gap: 6px; }
        .shunt-siding.loop { border-color: #6b5b3d; background: #1c1a12; }
        .shunt-siding-btns { display: flex; gap: 6px; margin-top: auto; }
        .shunt-siding-btns button { flex: 1; }
        @media (max-width: 480px) {
          .shunt-sidings { grid-template-columns: 1fr; }
        }
      `;
      document.head.appendChild(style);
    }

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function newRoundState(r) {
      const spec = { inbound: r.inbound.slice(), target: r.target.slice(), sidings: r.sidings };
      const best = solve(spec);
      if (!best) throw new Error("shunt: round has no solution");
      return {
        spec,
        PAR: best.par,
        ALLDEAD: parIfAllDeadEnds(spec),
        state: { inbound: spec.inbound.slice(), sidings: spec.sidings.map((s) => ({ ...s, items: [] })), outCount: 0 },
        moves: 0, hints: 0, message: "", over: false,
      };
    }

    function doMove(rs, move) {
      rs.state = apply(rs.spec, rs.state, move);
      rs.moves++;
      rs.message = "";
      if (rs.state.outCount === rs.spec.target.length) rs.over = true;
      render(rs);
    }

    function hint(rs) {
      const rest = solve(rs.spec, rs.state);
      if (!rest || !rest.route.length) { rs.message = "No move helps from here."; render(rs); return; }
      rs.hints++;
      const move = rest.route[0];
      const label = move.type === "through" ? "send the front wagon straight out"
        : move.type === "push" ? `push into ${SIDING_LABEL(rs.spec.sidings[move.siding])} ${move.siding + 1}`
        : `release ${SIDING_LABEL(rs.spec.sidings[move.siding])} ${move.siding + 1}`;
      rs.message = `Hint: ${label}.`;
      doMove(rs, move);
    }

    function render(rs) {
      wrap.innerHTML = "";
      const n = rs.spec.target.length;

      wrap.appendChild(el("p", "q-num", `Round ${ri + 1} of ${rounds.length}`));

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Moves</small><b>${rs.moves}</b>`),
        el("div", "grid-score-cell", `<small>Par</small><b>${rs.PAR}</b>`),
        el("div", "grid-score-cell", `<small>Out</small><b>${rs.state.outCount}/${n}</b>`),
      );
      wrap.appendChild(head);

      const moves = legalMoves(rs.spec, rs.state);
      const canThrough = moves.some((m) => m.type === "through");
      const pushable = new Set(moves.filter((m) => m.type === "push").map((m) => m.siding));
      const releasable = new Set(moves.filter((m) => m.type === "release").map((m) => m.siding));

      // Inbound track
      const inboundBox = el("div", "shunt-track");
      inboundBox.appendChild(el("div", "shunt-label", "Inbound"));
      const inRow = el("div", "shunt-wagons");
      rs.state.inbound.forEach((w, i) => {
        const b = el("span", "shunt-wagon" + (i === 0 ? " front" : ""));
        b.textContent = w;
        inRow.appendChild(b);
      });
      if (!rs.state.inbound.length) inRow.appendChild(el("span", "shunt-empty", "—"));
      inboundBox.appendChild(inRow);
      if (!rs.over) {
        const btn = el("button", "primary compact", "Send out ▶");
        btn.disabled = !canThrough;
        btn.onclick = () => doMove(rs, { type: "through" });
        inboundBox.appendChild(btn);
      }
      wrap.appendChild(inboundBox);

      // Sidings
      const sideGrid = el("div", "shunt-sidings");
      rs.spec.sidings.forEach((s, i) => {
        const box = el("div", "shunt-siding" + (s.kind === "loop" ? " loop" : ""));
        box.appendChild(el("div", "shunt-label",
          `${SIDING_LABEL(s)} ${i + 1} · ${s.kind === "loop" ? "FIFO" : "LIFO"} · ${rs.state.sidings[i].items.length}/${s.cap}`));
        const row = el("div", "shunt-wagons");
        rs.state.sidings[i].items.forEach((w) => row.appendChild(el("span", "shunt-wagon", w)));
        if (!rs.state.sidings[i].items.length) row.appendChild(el("span", "shunt-empty", "empty"));
        box.appendChild(row);

        const btns = el("div", "shunt-siding-btns");
        if (!rs.over) {
          const pushBtn = el("button", "ghost compact", "Push in");
          pushBtn.disabled = !pushable.has(i);
          pushBtn.onclick = () => doMove(rs, { type: "push", siding: i });
          const relBtn = el("button", "ghost compact", "Release ▶");
          relBtn.disabled = !releasable.has(i);
          relBtn.onclick = () => doMove(rs, { type: "release", siding: i });
          btns.append(pushBtn, relBtn);
        }
        box.appendChild(btns);
        sideGrid.appendChild(box);
      });
      wrap.appendChild(sideGrid);

      // Outbound track
      const outBox = el("div", "shunt-track");
      outBox.appendChild(el("div", "shunt-label", "Outbound (locked in)"));
      const outRow = el("div", "shunt-wagons");
      for (let i = 0; i < rs.state.outCount; i++) outRow.appendChild(el("span", "shunt-wagon done", rs.spec.target[i]));
      for (let i = rs.state.outCount; i < n; i++) outRow.appendChild(el("span", "shunt-wagon ghost", rs.spec.target[i]));
      outBox.appendChild(outRow);
      wrap.appendChild(outBox);

      const msg = el("p", "q-detail center shunt-msg");
      msg.innerHTML = rs.over
        ? (rs.moves === rs.PAR
            ? `Out in <b>${rs.PAR} moves</b> — the true minimum.`
            : `Out in ${rs.moves} moves, against a par of ${rs.PAR}.`)
        : (rs.message || `Next out must be <b>${rs.spec.target[rs.state.outCount]}</b>.`);
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (rs.over) {
        const b = el("button", "primary compact", ri === rounds.length - 1 ? "See your score" : "Next round");
        b.onclick = () => {
          roundResults.push(rs);
          ri++;
          if (ri < rounds.length) render(newRoundState(rounds[ri]));
          else finish();
        };
        bar.appendChild(b);
      } else {
        const h = el("button", "ghost compact", "Hint (costs you)");
        h.onclick = () => hint(rs);
        const rst = el("button", "ghost compact", "Start again");
        rst.disabled = rs.moves === 0;
        rst.onclick = () => {
          rs.state = { inbound: rs.spec.inbound.slice(), sidings: rs.spec.sidings.map((s) => ({ ...s, items: [] })), outCount: 0 };
          rs.moves = 0; rs.message = "Back to the start."; render(rs);
        };
        bar.append(h, rst);
      }
      wrap.appendChild(bar);
    }

    function finish() {
      const totalMoves = roundResults.reduce((a, r) => a + r.moves, 0);
      const totalPar = roundResults.reduce((a, r) => a + r.PAR, 0);
      const totalHints = roundResults.reduce((a, r) => a + r.hints, 0);
      const spare = totalMoves - totalPar;

      const squares = roundResults.map((r) => {
        const s = r.moves - r.PAR;
        return s === 0 ? "🟩" : s <= 2 ? "🟨" : "🟧";
      }).join("") + (totalHints === 0 ? "🟩" : "🟨");

      api.finish({
        headline: spare === 0
          ? `Every wagon out in ${totalPar}, the minimum`
          : `${totalMoves} moves against par ${totalPar}`,
        squares,
        stats: [
          ["Moves", String(totalMoves)],
          ["Par", String(totalPar)],
          ["Hints", String(totalHints)],
        ],
        perfect: spare === 0 && totalHints === 0,
        notes: roundResults.map((r, i) =>
          `<b>Round ${i + 1}:</b> par ${r.PAR}` + (r.ALLDEAD == null
            ? " — impossible at all if the loop were a third dead end."
            : ` (would take ${r.ALLDEAD} if the loop line were a dead end instead).`)),
        extra: [
          spare === 0 ? "🚂 the true minimum" : `➕ ${spare} over par`,
          totalHints === 0 ? "🧠 unaided" : `💡 ${totalHints} hint${totalHints === 1 ? "" : "s"}`,
        ],
      });
    }

    render(newRoundState(rounds[ri]));
  },
};
