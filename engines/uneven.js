import { el, rng } from "./shared.js";

/* ============================================================================
   UNEVEN — "the groups are not all the same size"
   ----------------------------------------------------------------------------
   A variant of the sixteen-words-four-categories format. The familiar game
   fixes every category at exactly four members, and that constant is doing
   far more work than it looks: it is the disambiguator. It tells you when to
   stop looking, and it converts "I can see five candidates" into the useful
   deduction "so one of these five is a decoy".

   Here the sizes are uneven and you are told only the multiset — 3, 4, 4 and
   5, in some order. Two things change about how it is played:

     1. Over-inclusion is no longer the only way to be wrong. Submitting four
        words that genuinely do belong together fails if the group has five,
        so a category is not finished when it looks finished. You have to
        sweep all sixteen for stragglers before you commit.

     2. Working out which size belongs to which category becomes a deduction
        in its own right, and it is what resolves the words that honestly fit
        two categories. Placing them by meaning alone is impossible — the
        puzzle is only unique once the sizes are counted.

   Because a wrong submission can now be wrong in two opposite directions, the
   feedback distinguishes them: a selection contained in a real group is told
   it is short, and one that contains a real group is told it is long. That
   costs a life either way. It replaces the usual "one away", which no longer
   means anything when the target size is unknown.

   Scoring: wrong submissions, out of four allowed.
   ========================================================================== */

const LIVES = 4;

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const groups = puzzle.data.groups;   // [{ name, why, items: [...] }]
    const sizes = groups.map((g) => g.items.length).sort((a, b) => a - b);

    const tiles = [];
    groups.forEach((g, gi) => g.items.forEach((it) => tiles.push({ text: it, g: gi })));

    const rand = rng(puzzle.data.seed || 20260903);
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    let live = tiles.slice();
    const solved = [];                   // group indices, in the order cracked
    let sel = [];
    let mistakes = 0;
    let message = "";
    let over = false;
    const guessLog = [];                 // "hit" | "near" | "miss", for the squares

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function submit() {
      if (sel.length < 2) return;
      const picked = sel.map((t) => t.g);
      const gi = picked[0];
      const allSame = picked.every((g) => g === gi);
      const target = groups[gi].items.length;

      if (allSame && sel.length === target) {
        guessLog.push("hit");
        solved.push(gi);
        live = live.filter((t) => t.g !== gi);
        sel = [];
        message = "";
        if (!live.length) over = true;
        return render();
      }

      mistakes++;
      if (allSame) {
        // Every word is from one real group, but the group is bigger.
        guessLog.push("near");
        message = `All of those do belong together — but that group has more than ${sel.length}.`;
      } else {
        // Does the selection swallow a whole group and then some?
        const counts = {};
        picked.forEach((g) => { counts[g] = (counts[g] || 0) + 1; });
        const swallowed = Object.keys(counts)
          .find((g) => counts[g] === groups[g].items.length);
        if (swallowed !== undefined) {
          guessLog.push("near");
          message = "A whole group is in there — along with at least one word that isn't.";
        } else {
          guessLog.push("miss");
          message = "Not a group.";
        }
      }

      if (mistakes >= LIVES) {
        groups.forEach((_, i) => { if (!solved.includes(i)) solved.push(i); });
        live = [];
        over = true;
      }
      sel = [];
      render();
    }

    function render() {
      wrap.innerHTML = "";

      const head = el("div", "grp-lives");
      head.innerHTML = `<small>Mistakes remaining</small>` +
        Array.from({ length: LIVES }, (_, i) =>
          `<i class="${i < LIVES - mistakes ? "" : "gone"}"></i>`).join("");
      wrap.appendChild(head);

      const sz = el("p", "q-detail center");
      sz.innerHTML = `The four groups are of sizes <b>${sizes.join(" · ")}</b> — but not in that order, and you're not told which is which.`;
      wrap.appendChild(sz);

      solved.forEach((gi) => {
        const g = groups[gi];
        const band = el("div", `grp-band g${gi}`);
        band.innerHTML = `<b>${g.name} <small>(${g.items.length})</small></b><span>${g.items.join(" · ")}</span>`;
        wrap.appendChild(band);
      });

      if (live.length) {
        const grid = el("div", "grp-grid");
        live.forEach((t) => {
          const b = el("button", "grp-tile" + (sel.includes(t) ? " sel" : ""));
          b.textContent = t.text;
          b.disabled = over;
          b.onclick = () => {
            if (sel.includes(t)) sel = sel.filter((x) => x !== t);
            else sel.push(t);
            message = "";
            render();
          };
          grid.appendChild(b);
        });
        wrap.appendChild(grid);
      }

      const msg = el("p", "q-detail center grp-msg");
      msg.innerHTML = over
        ? (mistakes >= LIVES
            ? "Out of guesses — here are the four categories."
            : "All four categories found.")
        : message || "Select a whole category — however many that turns out to be — and submit.";
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = done;
        bar.appendChild(b);
      } else {
        const s = el("button", "primary compact",
          sel.length ? `Submit ${sel.length}` : "Submit");
        s.disabled = sel.length < 2;
        s.onclick = submit;
        const c = el("button", "ghost compact", "Deselect");
        c.disabled = !sel.length;
        c.onclick = () => { sel = []; render(); };
        const sh = el("button", "ghost compact", "Shuffle");
        sh.onclick = () => {
          for (let i = live.length - 1; i > 0; i--) {
            const j = Math.floor(rand() * (i + 1));
            [live[i], live[j]] = [live[j], live[i]];
          }
          render();
        };
        bar.append(s, c, sh);
      }
      wrap.appendChild(bar);
    }

    function done() {
      const won = mistakes < LIVES;
      const found = guessLog.filter((g) => g === "hit").length;
      const squares = guessLog
        .map((g) => (g === "hit" ? "🟩" : g === "near" ? "🟨" : "🟥")).join("");

      api.finish({
        headline: won
          ? (mistakes === 0
              ? "All four, no mistakes"
              : `All four with ${mistakes} mistake${mistakes === 1 ? "" : "s"}`)
          : `Ran out of guesses — ${found} of 4 found`,
        squares,
        stats: [
          ["Categories", `${found}/4`],
          ["Mistakes", `${mistakes}/${LIVES}`],
          ["Guesses", String(guessLog.length)],
        ],
        perfect: won && mistakes === 0,
        extra: [
          mistakes === 0 ? "🎯 clean sweep" : `❌ ${mistakes} wrong`,
          guessLog.includes("near") ? "😬 right words, wrong count" : "",
        ].filter(Boolean),
        notes: puzzle.data.notes || [],
      });
    }

    render();
  },
};
