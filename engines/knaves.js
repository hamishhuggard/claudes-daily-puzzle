import { el } from "./shared.js";

/* Knights and knaves, six islanders. Every statement a truth-teller makes is
   true; every statement a liar makes is false. The player toggles each
   islander TRUTH/LIAR and submits — told only whether the whole labelling is
   consistent, never which islanders are wrong, which is what keeps this a
   deduction rather than a search. Up to 3 confessions may be spent to reveal
   one islander's real nature outright.

   Statements are authored as "fn:(a) => …" predicates over the assignment
   array (true = truth-teller); puzzle.js/codec.js revive the fn: strings on
   decode. At mount time we brute-force all 64 assignments and assert there
   is exactly one consistent labelling — a thrown error here means the
   content file shipped a broken puzzle, not a player-facing failure. */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const d = puzzle.data;
    const people = d.people; // [{ name, statements: [{ text, fn }] }]
    const n = people.length;

    function consistent(a) {
      return people.every((p, i) =>
        p.statements.every((s) => s.fn(a) === a[i]));
    }

    // Dev-time integrity check: exactly one satisfying assignment.
    const solutions = [];
    for (let mask = 0; mask < 1 << n; mask++) {
      const a = Array.from({ length: n }, (_, i) => !!(mask & (1 << i)));
      if (consistent(a)) solutions.push(a);
    }
    if (solutions.length !== 1) {
      throw new Error(`knaves: expected exactly one consistent assignment, found ${solutions.length}`);
    }
    const solution = solutions[0];

    const maxConfessions = d.maxConfessions ?? 3;
    let confessions = 0;
    let wrongGuesses = 0;
    const confessed = new Set();
    const labels = new Array(n).fill(null); // null | true (truth) | false (liar)

    root.appendChild(el("p", "q-detail center",
      "Every truth-teller's statements are all true; every liar's are all false. " +
      "Label each islander, then submit. I'll only tell you whether the whole labelling holds together."));

    const list = el("div", "stack knaves-list");
    root.appendChild(list);

    const confessBar = el("div", "q-detail center knaves-confess-bar");
    root.appendChild(confessBar);

    const feedback = el("div", "order-feedback", "&nbsp;");
    root.appendChild(feedback);

    const submitBtn = el("button", "primary", "Submit labelling");
    root.appendChild(submitBtn);

    function renderConfessBar() {
      confessBar.textContent = confessions === 0
        ? `${maxConfessions} confessions available`
        : `${maxConfessions - confessions} confession${maxConfessions - confessions === 1 ? "" : "s"} left`;
    }

    function renderRows() {
      list.innerHTML = "";
      people.forEach((p, i) => {
        const row = el("div", "knaves-row");
        const head = el("div", "knaves-head");
        head.appendChild(el("b", null, p.name));

        const toggle = el("div", "knaves-toggle" + (confessed.has(i) ? " locked" : ""));
        const truthBtn = el("button", "knaves-opt truth", "Truth-teller");
        const liarBtn = el("button", "knaves-opt liar", "Liar");
        function paint() {
          truthBtn.classList.toggle("on", labels[i] === true);
          liarBtn.classList.toggle("on", labels[i] === false);
        }
        if (confessed.has(i)) {
          truthBtn.disabled = true;
          liarBtn.disabled = true;
        } else {
          truthBtn.onclick = () => { labels[i] = true; paint(); };
          liarBtn.onclick = () => { labels[i] = false; paint(); };
        }
        paint();
        toggle.append(truthBtn, liarBtn);
        head.appendChild(toggle);
        row.appendChild(head);

        p.statements.forEach((s) => {
          row.appendChild(el("p", "q-detail knaves-statement", `“${s.text}”`));
        });

        if (confessed.has(i)) {
          row.appendChild(el("p", "knaves-confessed",
            solution[i] ? "🕊️ confessed: truth-teller" : "🕊️ confessed: liar"));
        } else if (confessions < maxConfessions) {
          const confessBtn = el("button", "ghost compact knaves-confess-btn", "Spend a confession");
          confessBtn.onclick = () => {
            confessions++;
            confessed.add(i);
            labels[i] = solution[i];
            renderConfessBar();
            renderRows();
          };
          row.appendChild(confessBtn);
        }

        list.appendChild(row);
      });
    }

    submitBtn.onclick = () => {
      if (labels.some((l) => l === null)) {
        feedback.className = "order-feedback show";
        feedback.textContent = "Label everyone before you submit.";
        return;
      }
      const guess = labels.slice();
      if (guess.every((v, i) => v === solution[i])) {
        done();
        return;
      }
      wrongGuesses++;
      feedback.className = "order-feedback show";
      feedback.textContent = `Not consistent. Something in that labelling breaks a statement. Submission ${wrongGuesses}.`;
    };

    renderConfessBar();
    renderRows();

    function done() {
      root.innerHTML = "";
      const perfect = confessions === 0 && wrongGuesses === 0;

      root.appendChild(el("div", "reveal-badge " + (perfect ? "good" : confessions ? "ok" : "bad"),
        `🕊️ ${confessions} confession${confessions === 1 ? "" : "s"} · ${wrongGuesses} wrong submission${wrongGuesses === 1 ? "" : "s"}`));

      const grid = el("div", "reveal-nums");
      grid.append(
        el("div", null, `<span>Confessions</span><b>${confessions}/${maxConfessions}</b>`),
        el("div", null, `<span>Wrong tries</span><b>${wrongGuesses}</b>`),
        el("div", null, `<span>Liars</span><b>${solution.filter((v) => !v).length}/${n}</b>`),
      );
      root.appendChild(grid);

      const roster = el("div", "stack knaves-roster");
      people.forEach((p, i) => {
        roster.appendChild(el("p", "q-detail", `<b>${solution[i] ? "🟩" : "🟥"} ${p.name}</b> — ${solution[i] ? "truth-teller" : "liar"}`));
      });
      root.appendChild(roster);

      const squares = "🕊️".repeat(confessions) + "❌".repeat(Math.min(wrongGuesses, 5)) + "✅";

      api.finish({
        headline: confessions === 0
          ? "Solved cold — no confessions needed"
          : `Solved with ${confessions} confession${confessions === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Confessions used", `${confessions}/${maxConfessions}`],
          ["Wrong submissions", String(wrongGuesses)],
          ["Verdict", perfect ? "Cold read" : confessions ? "Talked their way out" : "Brute force"],
        ],
        perfect,
        extra: [
          confessions === 0 ? "🕊️ zero confessions" : `🕊️ ${confessions} confession${confessions === 1 ? "" : "s"} spent`,
          wrongGuesses === 0 ? "✅ first submission" : `❌ ${wrongGuesses} wrong submission${wrongGuesses === 1 ? "" : "es"}`,
        ],
        notes: people.map((p, i) =>
          `${solution[i] ? "🟩" : "🟥"} <b>${p.name}</b> (${solution[i] ? "truth-teller" : "liar"}) — ${
            p.statements.map((s) => `“${s.text}”`).join(" ")}`),
      });
    }
  },
};
