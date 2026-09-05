import { el } from "./shared.js";
import { reportOf, countMatching, degreesOf } from "./party-rules.js";

/* ============================================================================
   PARTY — "second hand"
   ----------------------------------------------------------------------------
   Seven guests, some of whom shook hands. Nobody will tell you how many hands
   they shook. What each one tells you is the total shaken by the people they
   shook hands with — a number entirely about other people.

   That is the whole design. A report mixes together how many people you met
   with how sociable they were, so a large number might mean one very popular
   partner or four unpopular ones, and you cannot separate the two locally. It
   comes apart at the bottom: a guest who shook exactly one hand reports
   precisely their partner's count, so their report is not a quantity at all,
   it is a name. Everything else is built off that.

   The handshake counts are given as an unordered list, because without them
   this is a search rather than a deduction — you need something to match
   reports against. Whose is whose is not given, and working that out is most
   of the puzzle.

   Because the report pins down exactly one set of handshakes, a board where
   every guest's number is satisfied IS the answer. There is nothing to submit
   and no way to finish wrongly.

   Drawn with absolute positions on a circle and an SVG overlay rather than a
   CSS grid, deliberately — see the note on Gridlock about not trusting
   implicit grid placement in a container that also holds other things.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const { names, report, counts, shakes: answer } = puzzle.data;
    const n = names.length;

    if (reportOf(n, answer).join() !== report.join()) {
      throw new Error("party: the stored answer does not produce the stored report");
    }
    const check = countMatching(n, report, counts, 2);
    if (check.count !== 1) throw new Error(`party: ${check.count} solutions, want 1`);

    const key = (a, b) => (a < b ? `${a},${b}` : `${b},${a}`);
    let drawn = new Set();
    let sel = null, hints = 0, undrawn = 0, over = false, message = "";

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    const shakeList = () => [...drawn].map((k) => k.split(",").map(Number));
    const now = () => reportOf(n, shakeList());
    const degs = () => degreesOf(n, shakeList());
    const solved = () => now().every((x, i) => x === report[i]);

    function tap(i) {
      if (over) return;
      if (sel === null) { sel = i; message = ""; return render(); }
      if (sel === i) { sel = null; return render(); }
      const k = key(sel, i);
      if (drawn.has(k)) { drawn.delete(k); undrawn++; } else drawn.add(k);
      sel = null;
      message = "";
      if (solved()) over = true;
      render();
    }

    function hint() {
      const want = new Set(answer.map(([a, b]) => key(a, b)));
      const missing = [...want].find((k) => !drawn.has(k));
      const spurious = [...drawn].find((k) => !want.has(k));
      if (spurious) { drawn.delete(spurious); hints++; message = "Hint: that handshake never happened."; }
      else if (missing) {
        drawn.add(missing);
        hints++;
        const [a, b] = missing.split(",").map(Number);
        message = `Hint: ${names[a]} and ${names[b]} shook hands.`;
      } else return;
      if (solved()) over = true;
      render();
    }

    function render() {
      wrap.innerHTML = "";
      const cur = now(), d = degs();

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Handshakes</small><b>${drawn.size}</b>`),
        el("div", "grid-score-cell",
          `<small>Agreeing</small><b>${cur.filter((x, i) => x === report[i]).length}/${n}</b>`),
        el("div", "grid-score-cell", `<small>Hints</small><b>${hints}</b>`),
      );
      wrap.appendChild(head);

      wrap.appendChild(el("p", "q-detail center",
        `Between them they shook <b>${counts.join(", ")}</b> hands — but nobody will say which is theirs.`));

      /* Guests on a circle, lines behind them. Positions are computed, not
         laid out by the browser, so nothing can be sheared. */
      const board = el("div", "pty-board");
      const R = 38, CX = 50, CY = 50;
      const at = (i) => {
        const t = (i / n) * 2 * Math.PI - Math.PI / 2;
        return [CX + R * Math.cos(t), CY + R * Math.sin(t)];
      };

      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 100 100");
      svg.setAttribute("class", "pty-lines");
      shakeList().forEach(([a, b]) => {
        const [x1, y1] = at(a), [x2, y2] = at(b);
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.setAttribute("x1", x1); line.setAttribute("y1", y1);
        line.setAttribute("x2", x2); line.setAttribute("y2", y2);
        svg.appendChild(line);
      });
      board.appendChild(svg);

      names.forEach((name, i) => {
        const [x, y] = at(i);
        const ok = cur[i] === report[i];
        const b = el("button", "pty-guest"
          + (sel === i ? " sel" : "")
          + (ok ? " ok" : "")
          + (cur[i] > report[i] ? " over" : ""));
        b.style.left = `${x}%`;
        b.style.top = `${y}%`;
        b.innerHTML = `<b>${name}</b><span>${cur[i]} / ${report[i]}</span>`
          + `<em>${d[i]} shaken</em>`;
        b.disabled = over;
        b.setAttribute("aria-label",
          `${name}, says ${report[i]}, currently ${cur[i]}, has shaken ${d[i]} hands`);
        b.onclick = () => tap(i);
        board.appendChild(b);
      });
      wrap.appendChild(board);

      const msg = el("p", "q-detail center pty-msg");
      msg.innerHTML = over
        ? "Everyone's number agrees — and only one set of handshakes can do that, so that's the party."
        : message || (sel === null
          ? "Tap two guests to shake or unshake their hands. Each number is <b>what that guest says</b> against what they'd say now."
          : `<b>${names[sel]}</b> — tap whoever they shook hands with.`);
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = done;
        bar.appendChild(b);
      } else {
        const h = el("button", "ghost compact", "Hint (costs you)");
        h.onclick = hint;
        const c = el("button", "ghost compact", sel === null ? "Clear the room" : "Cancel");
        c.disabled = sel === null && !drawn.size;
        c.onclick = () => {
          if (sel !== null) { sel = null; return render(); }
          drawn = new Set(); undrawn++; message = ""; render();
        };
        bar.append(h, c);
      }
      wrap.appendChild(bar);
    }

    function done() {
      const squares = [
        hints === 0 ? "🟩" : hints <= 2 ? "🟨" : "🟧",
        undrawn <= 2 ? "🟩" : undrawn <= 6 ? "🟨" : "🟧",
      ].join("") + (hints === 0 ? "🟩🟩🟩" : hints <= 2 ? "🟩🟩🟨" : "🟩🟨🟧");

      api.finish({
        headline: hints === 0
          ? `All ${answer.length} handshakes, unaided`
          : `Solved with ${hints} hint${hints === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Handshakes", String(answer.length)],
          ["Hints", String(hints)],
          ["Rubbed out", String(undrawn)],
        ],
        perfect: hints === 0 && undrawn === 0,
        extra: [
          hints === 0 ? "🧠 unaided" : `💡 ${hints} hint${hints === 1 ? "" : "s"}`,
          undrawn === 0 ? "🤝 never rubbed one out" : `✏️ ${undrawn} rubbed out`,
        ],
        notes: answer.map(([a, b]) => `<b>${names[a]}</b> and <b>${names[b]}</b> shook hands.`),
      });
    }

    render();
  },
};
