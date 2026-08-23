import { el } from "./shared.js";
import { SIZE, N, EFFECT, applyPress, cellsOf, minimalSolution } from "./lightsout-rules.js";

/* LIGHTS OUT — a 5x5 grid where tapping a cell toggles it and its four
   orthogonal neighbours. Goal: every light off. Two rounds.

   The trap this puzzle sets on purpose: it *looks* like a sequencing
   puzzle — press this, then that, watch it cascade — so players hunt for
   an order that "works out". There isn't one to find, because there isn't
   one at all. XOR is commutative and self-inverse, so the end state
   depends only on the SET of cells pressed an odd number of times, never
   on the order, and pressing a cell twice is exactly a no-op. The whole
   game is choosing a subset of the 25 cells, which is why it's solved
   here (lightsout-rules.js) with Gaussian elimination over GF(2) rather
   than any kind of search over move sequences.

   Not every 25-bit pattern is reachable this way — the toggle matrix has a
   4-dimensional null space, so 1/32 of all boards are solvable and the
   rest never will be, no matter how you tap. Every authored board is
   checked solvable at mount, and its par is the true minimum found by
   enumerating the full solution coset, not just however many presses were
   used to build it. */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const d = puzzle.data;
    const rounds = d.rounds; // [{ on: [cell indices lit] }, ...]

    const solved = rounds.map((rd) => {
      let board = 0;
      for (const c of rd.on) board |= 1 << c;
      const sol = minimalSolution(board);
      if (!sol) throw new Error(`lightsout: round board is not solvable — 5x5 has a null space, this one fell in it`);
      return { board, par: sol.taps, pressMask: sol.pressMask };
    });

    let roundIdx = 0;
    let curBoard = solved[0].board;
    let taps = 0;
    let resets = 0;
    const perRound = []; // { taps, resets }

    root.appendChild(el("p", "q-detail center",
      "Tap a light to toggle it and its neighbours. Turn every light off. " +
      "Order never matters — only which cells end up pressed an odd number of times."));

    const header = el("div", "q-detail center");
    root.appendChild(header);

    const grid = el("div", "lo-grid");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = `repeat(${SIZE}, 1fr)`;
    grid.style.gap = "8px";
    grid.style.maxWidth = "320px";
    grid.style.margin = "0 auto";
    root.appendChild(grid);

    const status = el("div", "order-feedback show");
    root.appendChild(status);

    const btnRow = el("div", "stack");
    btnRow.style.flexDirection = "row";
    btnRow.style.justifyContent = "center";
    btnRow.style.gap = "10px";
    const resetBtn = el("button", "ghost compact", "Reset round");
    btnRow.appendChild(resetBtn);
    root.appendChild(btnRow);

    function renderHeader() {
      header.innerHTML = `Round ${roundIdx + 1} of ${rounds.length} &middot; ${taps} tap${taps === 1 ? "" : "s"} &middot; par ${solved[roundIdx].par}${resets ? ` &middot; ${resets} reset${resets === 1 ? "" : "s"}` : ""}`;
    }

    function renderGrid(flashCells) {
      grid.innerHTML = "";
      for (let i = 0; i < N; i++) {
        const on = !!(curBoard & (1 << i));
        const cell = el("button", "lo-cell");
        cell.style.aspectRatio = "1";
        cell.style.border = "1px solid rgba(255,255,255,.15)";
        cell.style.borderRadius = "6px";
        cell.style.cursor = "pointer";
        cell.style.transition = "background .12s ease, transform .12s ease";
        cell.style.background = on ? "var(--ok, #e0be5c)" : "rgba(255,255,255,.06)";
        cell.setAttribute("aria-label", on ? "light on" : "light off");
        if (flashCells && flashCells.has(i)) {
          cell.style.transform = "scale(0.88)";
          requestAnimationFrame(() => { cell.style.transform = "scale(1)"; });
        }
        cell.onclick = () => tap(i);
        grid.appendChild(cell);
      }
    }

    function tap(i) {
      curBoard = applyPress(curBoard, i);
      taps++;
      renderHeader();
      renderGrid(new Set(cellsOf(EFFECT[i])));
      if (curBoard === 0) {
        status.textContent = "All lights off.";
        perRound.push({ taps, resets });
        setTimeout(nextRoundOrFinish, 350);
      }
    }

    function nextRoundOrFinish() {
      if (roundIdx < rounds.length - 1) {
        roundIdx++;
        curBoard = solved[roundIdx].board;
        taps = 0;
        resets = 0;
        status.textContent = "";
        renderHeader();
        renderGrid();
      } else {
        finish();
      }
    }

    resetBtn.onclick = () => {
      resets++;
      curBoard = solved[roundIdx].board;
      taps = 0;
      status.textContent = "";
      renderHeader();
      renderGrid();
    };

    renderHeader();
    renderGrid();

    function finish() {
      root.innerHTML = "";

      const overPar = perRound.map((p, i) => p.taps - solved[i].par);
      const allPerfect = overPar.every((v) => v === 0);
      const totalTaps = perRound.reduce((a, p) => a + p.taps, 0);
      const totalPar = solved.reduce((a, s) => a + s.par, 0);
      const totalResets = perRound.reduce((a, p) => a + p.resets, 0);

      root.appendChild(el("div", "reveal-badge " + (allPerfect ? "good" : "ok"),
        `💡 ${totalTaps} tap${totalTaps === 1 ? "" : "s"} across ${rounds.length} rounds &middot; par ${totalPar}`));

      const numsGrid = el("div", "reveal-nums");
      numsGrid.append(
        el("div", null, `<span>Taps used</span><b>${totalTaps}</b>`),
        el("div", null, `<span>True minimum</span><b>${totalPar}</b>`),
        el("div", null, `<span>Resets</span><b>${totalResets}</b>`),
      );
      root.appendChild(numsGrid);

      const notes = solved.map((s, i) => {
        const cells = cellsOf(s.pressMask);
        const gridStr = Array.from({ length: SIZE }, (_, r) =>
          Array.from({ length: SIZE }, (_, c) => cells.includes(r * SIZE + c) ? "🟨" : "⬛").join("")
        ).join("<br>");
        return `Round ${i + 1} — one minimal solution (${s.par} tap${s.par === 1 ? "" : "s"}), pressed in ANY order:<br>${gridStr}`;
      });
      notes.push(
        "Pressing order never mattered because each tap is its own inverse — pressing a cell twice cancels exactly, so only the set of cells pressed an odd number of times decides the final board. That turns the puzzle into choosing a subset of 25 cells (solved here by Gaussian elimination over GF(2)), not into finding a sequence."
      );

      const squares = perRound.map((p, i) => overPar[i] === 0 ? "💡" : "🌙").join("");

      api.finish({
        headline: allPerfect
          ? "Both rounds at the true minimum"
          : `Solved both — ${totalTaps - totalPar} tap${totalTaps - totalPar === 1 ? "" : "s"} over the minimum`,
        squares,
        stats: [
          ["Taps used", `${totalTaps}/${totalPar}`],
          ["Rounds at par", `${overPar.filter((v) => v === 0).length}/${rounds.length}`],
          ["Resets", String(totalResets)],
        ],
        perfect: allPerfect,
        extra: [
          allPerfect ? "💡 minimum both rounds" : `🌙 ${overPar.reduce((a, v) => a + Math.max(v, 0), 0)} taps over minimum`,
          totalResets === 0 ? "🔁 no resets" : `🔁 ${totalResets} reset${totalResets === 1 ? "" : "s"}`,
        ],
        notes,
      });
    }
  },
};
