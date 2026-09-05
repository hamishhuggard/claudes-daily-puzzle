import { el } from "./shared.js";
import { check } from "./tally-rules.js";

/* ============================================================================
   TALLY — "how many left"
   ----------------------------------------------------------------------------
   Two people are each told half the answer. Then they talk, and you listen —
   but every line is a COUNT. Not "I don't know", which is what the famous
   version of this puzzle runs on, but "I have it down to four."

   Still nobody states their own value, so the sleight of hand survives. What
   changes is the direction the eliminations run. "I don't know" means the
   speaker's group has at least two members, so it can only ever kill groups
   that are too small — hunt for the values appearing once, strike them, that
   is the whole reflex. An exact count kills every group that is not exactly
   that size, so a candidate can now die for being in too much company. In the
   third round here, eighteen candidates die that way, and the original version
   of this puzzle has no sentence that can kill them.

   The conversations are also shorter, and that is not a choice. An exact count
   carries so much more than an admission of ignorance that these dialogues
   run out of things to say: across fifteen thousand random candidate lists,
   not one conversation reached a fourth line.

   You solve it by elimination, literally: strike out candidates until one is
   left. The engine won't strike anything for you and won't say when a strike
   is wrong — but locking in the wrong one costs you.

   Each round is verified on mount (tally-rules.js: check): it must end on
   exactly one candidate, and every line must remove at least one.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const { rounds, people, axes } = puzzle.data;

    rounds.forEach((rd, i) => {
      const r = check(rd.candidates, rd.script);
      if (!r.ok) throw new Error(`tally: round ${i + 1} — ${r.why}`);
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

    /* Every line is the same sentence with a different number in it, which is
       the point: the count is the only thing that varies, and the only thing
       that carries information. */
    function line(stmt, i) {
      const me = people[stmt.who];
      if (stmt.k === 1) {
        return i === 0
          ? `<b>${me}:</b> I know ${axes.thing}.`
          : `<b>${me}:</b> Then I know ${axes.thing}.`;
      }
      return i === 0
        ? `<b>${me}:</b> I have it down to <b>${stmt.k}</b> possibilities.`
        : `<b>${me}:</b> Then I'm down to <b>${stmt.k}</b>.`;
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
      rd.script.forEach((stmt, i) => {
        convo.appendChild(el("p", "knw-line", line(stmt, i)));
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
