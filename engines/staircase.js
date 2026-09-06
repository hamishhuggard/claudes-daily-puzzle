import { el } from "./shared.js";
import { reject, nextWords, liveWords, vec, contains } from "./staircase-rules.js";

/* ============================================================================
   STAIRCASE — "one more letter"
   ----------------------------------------------------------------------------
   Grow a short word into a long one. Every step keeps all the letters you have,
   adds exactly one, and lets you rearrange the lot.

   The word ladder this descends from swaps a letter and freezes the rest in
   place. Here nothing is frozen, so the reasoning is anagram-sight rather than
   column-watching. Every legal route is the same length, so there is no
   shortest path to hunt: the score is wrong guesses and hints.

   Two rounds. Each carries its own finite word list — the multiset interval
   between its start and target — so the accepted vocabulary is known,
   everyday, and small enough to ship.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const rounds = puzzle.data.rounds.map((r) => ({
      ...r,
      set: new Set(r.words),
      live: liveWords(r),
    }));

    let ri = 0;
    let path = [rounds[0].start];
    let wrong = 0, hints = 0, backs = 0;
    let message = "", messageBad = false;
    const done = [];                       // finished paths, for the answers panel

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    const cur = () => path[path.length - 1];
    const round = () => rounds[ri];

    function submit(raw) {
      const word = String(raw || "").trim().toLowerCase();
      const r = round();
      const why = reject(cur(), word, r.set);
      if (why) {
        wrong++;
        message = why; messageBad = true;
        render();
        return;
      }
      path.push(word);
      message = ""; messageBad = false;
      if (word === r.target) finishRound();
      else render();
    }

    function finishRound() {
      done.push({ start: round().start, target: round().target, path: path.slice() });
      if (ri === rounds.length - 1) { render(); return; }
      ri++;
      path = [rounds[ri].start];
      message = "";
      render();
    }

    function back() {
      if (path.length < 2) return;
      path.pop();
      backs++;
      message = ""; messageBad = false;
      render();
    }

    function hint() {
      const r = round();
      // Only ever suggest a word the target is still reachable from.
      const options = nextWords(cur(), r.words).filter((w) => r.live.has(w));
      if (!options.length) {
        message = "This word is a dead end — step back and try another.";
        messageBad = true;
        render();
        return;
      }
      hints++;
      const w = options[0];
      path.push(w);
      message = `Hint: ${w.toUpperCase()}.`;
      messageBad = false;
      if (w === r.target) finishRound();
      else render();
    }

    const allDone = () => done.length === rounds.length;

    function render() {
      wrap.innerHTML = "";
      const r = round();

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Round</small><b>${Math.min(done.length + 1, rounds.length)}/${rounds.length}</b>`),
        el("div", "grid-score-cell", `<small>Wrong tries</small><b>${wrong}</b>`),
        el("div", "grid-score-cell", `<small>Hints</small><b>${hints}</b>`),
      );
      wrap.appendChild(head);

      if (allDone()) {
        for (const d of done) {
          const box = el("div", "stc-done");
          box.appendChild(el("div", "stc-done-head",
            `${d.start.toUpperCase()} → ${d.target.toUpperCase()}`));
          box.appendChild(el("div", "stc-done-path",
            d.path.map((w) => w.toUpperCase()).join(" · ")));
          wrap.appendChild(box);
        }
        const msg = el("p", "q-detail center stc-msg",
          "Both staircases climbed — one letter at a time, and never in the same order twice.");
        wrap.appendChild(msg);
        const bar = el("div", "fairy-bar grid-bar");
        const b = el("button", "primary compact", "See your score");
        b.onclick = finish;
        bar.appendChild(b);
        wrap.appendChild(bar);
        return;
      }

      const goal = el("div", "stc-goal");
      goal.innerHTML = `<span>${r.start.toUpperCase()}</span>`
        + `<small>grow into</small>`
        + `<span>${r.target.toUpperCase()}</span>`;
      wrap.appendChild(goal);

      /* The staircase itself: each rung one letter wider than the last. */
      const steps = el("div", "stc-steps");
      for (let k = 0; k < path.length; k++) {
        const w = path[k];
        const row = el("div", "stc-step" + (k === path.length - 1 ? " now" : ""));
        row.appendChild(el("span", "stc-word", w.toUpperCase()));
        row.appendChild(el("span", "stc-len", String(w.length)));
        steps.appendChild(row);
      }
      for (let n = cur().length + 1; n <= r.target.length; n++) {
        const row = el("div", "stc-step blank");
        row.appendChild(el("span", "stc-word", "?".repeat(n)));
        row.appendChild(el("span", "stc-len", String(n)));
        steps.appendChild(row);
      }
      wrap.appendChild(steps);

      const form = el("form", "stc-form");
      const input = el("input", "stc-input");
      input.type = "text";
      input.autocomplete = "off";
      input.autocapitalize = "off";
      input.spellcheck = false;
      input.placeholder = `${cur().length + 1} letters`;
      input.setAttribute("aria-label",
        `next word, ${cur().length + 1} letters, using every letter of ${cur()}`);
      const go = el("button", "primary compact", "Add");
      go.type = "submit";
      form.append(input, go);
      form.onsubmit = (e) => { e.preventDefault(); submit(input.value); };
      wrap.appendChild(form);

      const msg = el("p", "q-detail center stc-msg" + (messageBad ? " bad" : ""));
      msg.innerHTML = message
        || `Keep every letter of <b>${cur().toUpperCase()}</b>, add one more, and `
           + "rearrange them however you like.";
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      const h = el("button", "ghost compact", "Hint (costs you)");
      h.onclick = hint;
      const u = el("button", "ghost compact", "Step back");
      u.disabled = path.length < 2;
      u.onclick = back;
      bar.append(h, u);
      wrap.appendChild(bar);

      if (input.focus) { try { input.focus(); } catch { /* jsdom */ } }
    }

    function finish() {
      const clean = wrong === 0 && hints === 0;
      const squares = [
        hints === 0 ? "🟩" : hints <= 2 ? "🟨" : "🟧",
        wrong === 0 ? "🟩" : wrong <= 4 ? "🟨" : "🟧",
      ].join("") + (clean ? "🟩🟩🟩" : hints === 0 ? "🟩🟩🟨" : "🟩🟨🟧");

      api.finish({
        headline: clean
          ? "Both staircases, no false steps"
          : hints === 0
            ? `Both staircases, ${wrong} wrong turn${wrong === 1 ? "" : "s"}`
            : `Climbed with ${hints} hint${hints === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Rounds", String(rounds.length)],
          ["Wrong tries", String(wrong)],
          ["Hints", String(hints)],
          ["Steps back", String(backs)],
        ],
        perfect: clean && backs === 0,
        notes: done.map((d) =>
          `<b>${d.start.toUpperCase()} → ${d.target.toUpperCase()}</b><br>`
          + d.path.map((w) => w.toUpperCase()).join(" · ")),
        extra: [
          hints === 0 ? "🧠 unaided" : `💡 ${hints} hint${hints === 1 ? "" : "s"}`,
          wrong === 0 ? "🎯 never guessed wrong" : `❌ ${wrong} wrong tr${wrong === 1 ? "y" : "ies"}`,
        ],
      });
    }

    render();
  },
};
