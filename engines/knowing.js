import { el } from "./shared.js";
import { check } from "./knowing-rules.js";

/* ============================================================================
   KNOWING — "common knowledge"
   ----------------------------------------------------------------------------
   Two people are each told half the answer. Then they talk, and you listen.

   Nobody in these conversations ever states their own value. Every line is
   about what they can or can't work out — and that is the information. "I
   don't know" eliminates every date under which the speaker *would* have
   known. Said out loud, in front of someone who is also reasoning, it moves
   the puzzle forward for both of them, and for you.

   You solve it by elimination, literally: strike out candidates until one is
   left. The engine won't strike anything for you and won't tell you when a
   strike is wrong — but locking in the wrong date costs you, so an eliminated
   candidate should be one you can justify.

   Each round's conversation was verified before shipping and again on mount
   (knowing-rules.js: check): it must end on exactly one candidate, and every
   line must remove at least one, so no statement in it is decoration.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const { rounds, people, axes } = puzzle.data;

    rounds.forEach((rd, i) => {
      const r = check(rd.candidates, rd.script);
      if (!r.ok) throw new Error(`knowing: round ${i + 1} — ${r.why}`);
      rd.answer = r.answer;
      rd.steps = r.steps;
    });

    let ri = 0;
    const results = rounds.map(() => ({ wrong: 0 }));
    let struck, over;

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    const setup = () => { struck = new Set(); over = false; };

    const keyOf = (c) => `${c[0]},${c[1]}`;
    const alive = () => rounds[ri].candidates.filter((c) => !struck.has(keyOf(c)));

    function line(stmt) {
      const me = people[stmt.who], you = people[1 - stmt.who];
      switch (stmt.kind) {
        case "dontKnow":
          return `<b>${me}:</b> I don't know ${axes.thing}.`;
        case "know":
          return `<b>${me}:</b> Then I know ${axes.thing}.`;
        case "neitherOfUs":
          return `<b>${me}:</b> I don't know ${axes.thing} — and I know that ${you} doesn't know either.`;
        case "knewYouDidnt":
          return `<b>${me}:</b> I already knew that ${you} couldn't know ${axes.thing}.`;
        default: return "";
      }
    }

    function commit() {
      const left = alive();
      if (left.length !== 1) return;
      if (keyOf(left[0]) === keyOf(rounds[ri].answer)) {
        over = true;
      } else {
        results[ri].wrong++;
        struck.delete(keyOf(left[0]));   // hand it back; they need to think again
      }
      render();
    }

    function render() {
      wrap.innerHTML = "";
      const rd = rounds[ri];

      wrap.appendChild(el("p", "q-num", `Round ${ri + 1} of ${rounds.length} — ${rd.label}`));
      wrap.appendChild(el("div", "pips", rounds.map((_, i) =>
        `<i class="${i < ri ? "done" : i === ri ? "now" : ""}"></i>`).join("")));

      wrap.appendChild(el("p", "q-detail center",
        `${people[0]} is told only <b>${axes.a.name}</b>. `
        + `${people[1]} is told only <b>${axes.b.name}</b>. `
        + `Both of them can see this list, and both know the other reasons perfectly.`));

      // The candidate board, grouped by the first axis so the rows mean
      // something to the person who was told it.
      const board = el("div", "knw-board");
      axes.a.items.forEach((aLabel, ai) => {
        const row = rd.candidates.filter((c) => c[0] === ai);
        if (!row.length) return;
        const rowEl = el("div", "knw-row");
        rowEl.appendChild(el("span", "knw-rowlabel", aLabel));
        const cells = el("div", "knw-cells");
        row.sort((x, y) => x[1] - y[1]).forEach((c) => {
          const k = keyOf(c);
          const b = el("button", "knw-cand"
            + (struck.has(k) ? " out" : "")
            + (over && k === keyOf(rd.answer) ? " answer" : ""));
          b.textContent = axes.b.items[c[1]];
          b.disabled = over;
          b.onclick = () => {
            if (struck.has(k)) struck.delete(k); else struck.add(k);
            render();
          };
          cells.appendChild(b);
        });
        rowEl.appendChild(cells);
        board.appendChild(rowEl);
      });
      wrap.appendChild(board);

      const convo = el("div", "knw-convo");
      convo.appendChild(el("div", "section-label", "The conversation"));
      rd.script.forEach((stmt) => {
        convo.appendChild(el("p", "knw-line", line(stmt)));
      });
      wrap.appendChild(convo);

      const left = alive();
      const msg = el("p", "q-detail center knw-msg");
      msg.innerHTML = over
        ? `It was <b>${axes.a.items[rd.answer[0]]} ${axes.b.items[rd.answer[1]]}</b>.`
        : results[ri].wrong && left.length === 1
          ? "That one's not it. Something in the conversation rules it out — work out which line."
          : `Strike out everything the conversation eliminates. <b>${left.length}</b> still standing.`;
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact",
          ri === rounds.length - 1 ? "See your score" : "Next round");
        b.onclick = () => {
          ri++;
          if (ri === rounds.length) return done();
          setup(); render();
        };
        bar.appendChild(b);
      } else {
        const lock = el("button", "primary compact", "Lock in the last one");
        lock.disabled = left.length !== 1;
        lock.onclick = commit;
        const clear = el("button", "ghost compact", "Un-strike all");
        clear.disabled = !struck.size;
        clear.onclick = () => { struck = new Set(); render(); };
        bar.append(lock, clear);
      }
      wrap.appendChild(bar);
    }

    function done() {
      const wrong = results.reduce((a, r) => a + r.wrong, 0);
      const squares = results.map((r) => r.wrong === 0 ? "🟩" : r.wrong === 1 ? "🟨" : "🟧").join("");

      api.finish({
        headline: wrong === 0
          ? "All three, first time"
          : `All three, with ${wrong} wrong lock-in${wrong === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Rounds", `${rounds.length}/${rounds.length}`],
          ["Wrong lock-ins", String(wrong)],
          ["Clean rounds", `${results.filter((r) => !r.wrong).length}/${rounds.length}`],
        ],
        perfect: wrong === 0,
        extra: [
          wrong === 0 ? "🧠 never locked in a wrong one" : `❌ ${wrong} wrong`,
        ],
      });
    }

    setup();
    render();
  },
};
