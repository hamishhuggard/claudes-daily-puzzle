import { el } from "./shared.js";
import { spansOf, crossingPairs, connected, solutions } from "./bridges-rules.js";

/* ============================================================================
   BRIDGES — "island hopping"
   ----------------------------------------------------------------------------
   Hashiwokakero. Each island wants exactly as many bridge-ends as its number.
   Bridges run straight, never cross, and no pair of islands may be joined by
   more than two. Tap one island then another to cycle the link between them:
   none, one, two, none again.

   Two things the engine refuses to let you do, because they are bookkeeping
   rather than thinking: exceed an island's number, and cross an existing
   bridge. What it does not do is tell you whether a legal bridge is the right
   bridge — that is the puzzle.

   Finishing is detected, not claimed: the moment every island is satisfied and
   the archipelago is one connected piece, you are done. The layout is packed
   with a proof of uniqueness (bridges-rules.js: solutions, stopping at two),
   so there is only one way for that to happen.

   Scoring: bridge-ends laid against the minimum the solution needs — every
   bridge you lay and later take back is a tap you didn't have to spend — plus
   any hints.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const islands = puzzle.data.islands;
    const rows = Math.max(...islands.map((v) => v.r)) + 1;
    const cols = Math.max(...islands.map((v) => v.c)) + 1;

    const spans = spansOf(islands);
    const cross = crossingPairs(islands, spans);
    // The answer, recomputed here rather than trusted from the blob, so an
    // edited layout can never ship with a stale solution or a stale par.
    const { found } = solutions(islands, 2);
    if (found.length !== 1) throw new Error(`bridges: ${found.length} solutions, want 1`);
    const answer = found[0];
    const parTaps = answer.reduce((a, b) => a + b, 0);

    const counts = spans.map(() => 0);
    let sel = null, taps = 0, hints = 0, over = false;
    const hinted = new Set();

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    const spanIndex = new Map();
    spans.forEach((s, i) => {
      spanIndex.set(`${Math.min(s.a, s.b)}-${Math.max(s.a, s.b)}`, i);
    });

    const degreeOf = (v) =>
      spans.reduce((a, s, i) => a + (s.a === v || s.b === v ? counts[i] : 0), 0);

    function cycle(i) {
      const s = spans[i];
      const next = (counts[i] + 1) % 3;
      if (next > counts[i]) {
        // adding a bridge-end: must not overfill either island, must not cross
        if (degreeOf(s.a) >= islands[s.a].need || degreeOf(s.b) >= islands[s.b].need) {
          return "That would give an island more bridges than its number allows.";
        }
        if (cross[i].some((j) => counts[j] > 0)) return "Bridges can't cross.";
      }
      counts[i] = next;
      taps++;
      return null;
    }

    let message = "";

    function tapIsland(v) {
      if (over) return;
      if (sel === null) { sel = v; message = ""; return render(); }
      if (sel === v) { sel = null; message = ""; return render(); }
      const key = `${Math.min(sel, v)}-${Math.max(sel, v)}`;
      const i = spanIndex.get(key);
      if (i === undefined) {
        message = "Those two aren't in line with clear water between them.";
        sel = v;
        return render();
      }
      message = cycle(i) || "";
      sel = null;
      checkDone();
      render();
    }

    function checkDone() {
      const satisfied = islands.every((v, i) => degreeOf(i) === v.need);
      if (satisfied && connected(islands, spans, counts)) over = true;
    }

    function hint() {
      // Reveal one span the player has wrong, cheapest first: an island whose
      // number is already correct is left alone.
      const wrong = spans
        .map((_, i) => i)
        .filter((i) => counts[i] !== answer[i] && !hinted.has(i));
      if (!wrong.length) return;
      const i = wrong[0];
      counts[i] = answer[i];
      hinted.add(i);
      hints++;
      sel = null;
      message = "Hint: that link is now set correctly.";
      checkDone();
      render();
    }

    /* ---- drawing ---- */

    function render() {
      wrap.innerHTML = "";

      const status = el("div", "grid-score");
      status.append(
        el("div", "grid-score-cell", `<small>Bridge-ends</small><b>${taps}</b>`),
        el("div", "grid-score-cell", `<small>Minimum</small><b>${parTaps}</b>`),
        el("div", "grid-score-cell", `<small>Hints</small><b>${hints}</b>`),
      );
      wrap.appendChild(status);

      const board = el("div", "brg-board");
      board.style.setProperty("--cols", cols);
      board.style.setProperty("--rows", rows);

      // Bridges first, so islands sit on top of the line ends.
      spans.forEach((s, i) => {
        if (!counts[i]) return;
        const a = islands[s.a], b = islands[s.b];
        const line = el("div", "brg-link"
          + (s.horiz ? " h" : " v")
          + (counts[i] === 2 ? " dbl" : "")
          + (hinted.has(i) ? " hinted" : ""));
        // The line spans both end cells, not just the ones between, so it runs
        // island centre to island centre; the opaque discs cover the overhang.
        line.style.gridRow = s.horiz
          ? `${a.r + 1}` : `${Math.min(a.r, b.r) + 1} / ${Math.max(a.r, b.r) + 2}`;
        line.style.gridColumn = s.horiz
          ? `${Math.min(a.c, b.c) + 1} / ${Math.max(a.c, b.c) + 2}` : `${a.c + 1}`;
        line.innerHTML = "<i></i><i></i>";
        board.appendChild(line);
      });

      islands.forEach((v, i) => {
        const d = degreeOf(i);
        const b = el("button", "brg-isle"
          + (sel === i ? " sel" : "")
          + (d === v.need ? " full" : "")
          + (d > v.need ? " over" : ""));
        b.style.gridRow = `${v.r + 1}`;
        b.style.gridColumn = `${v.c + 1}`;
        b.textContent = String(v.need);
        b.setAttribute("aria-label", `island needing ${v.need}, has ${d}`);
        b.disabled = over;
        b.onclick = () => tapIsland(i);
        board.appendChild(b);
      });

      wrap.appendChild(board);

      const msg = el("p", "q-detail center brg-msg");
      msg.innerHTML = over
        ? "Every island satisfied, and the whole archipelago in one piece."
        : message || (sel === null
            ? "Tap two islands to link them. Tap the same pair again for a double bridge, once more to remove it."
            : "Now tap the island you want to reach.");
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = done;
        bar.appendChild(b);
      } else {
        const h = el("button", "ghost compact", "Hint (costs you)");
        h.onclick = hint;
        const clear = el("button", "ghost compact", "Clear all");
        clear.disabled = !counts.some((c) => c > 0);
        clear.onclick = () => {
          counts.forEach((_, i) => { counts[i] = 0; });
          hinted.clear();
          sel = null; message = "";
          render();
        };
        bar.append(h, clear);
      }
      wrap.appendChild(bar);
    }

    function done() {
      const wasted = taps - parTaps - answer.reduce((a, b, i) => a + (hinted.has(i) ? b : 0), 0);
      const clean = wasted <= 0 && hints === 0;
      const squares = islands.map((v, i) => (hinted.size ? "🟨" : "🟩")).slice(0, 5).join("");

      api.finish({
        headline: clean
          ? "Solved with nothing wasted, and no hints"
          : hints
            ? `Solved with ${hints} hint${hints === 1 ? "" : "s"}`
            : `Solved — ${wasted} bridge-end${wasted === 1 ? "" : "s"} laid and taken back`,
        squares: hints === 0 && wasted <= 0 ? "🟩🟩🟩🟩🟩"
          : hints === 0 ? "🟩🟩🟩🟨🟨" : hints <= 2 ? "🟩🟩🟨🟨🟧" : "🟩🟨🟧🟧🟧",
        stats: [
          ["Bridge-ends laid", String(taps)],
          ["Minimum", String(parTaps)],
          ["Hints", String(hints)],
        ],
        perfect: clean,
        extra: [
          hints === 0 ? "🧭 no hints" : `💡 ${hints} hint${hints === 1 ? "" : "s"}`,
          wasted <= 0 ? "🎯 never laid a bridge twice" : `🔁 ${wasted} wasted`,
        ],
        notes: puzzle.data.notes || [],
      });
    }

    render();
  },
};
