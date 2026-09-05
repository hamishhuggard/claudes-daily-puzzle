import { el, rng } from "./shared.js";

/* ============================================================================
   GROUPS — "common ground"
   ----------------------------------------------------------------------------
   Sixteen items, four secret categories of four. Pick four, submit, find out.

   The whole design of a puzzle like this lives in the overlaps: every category
   has at least one member that looks like it belongs to a different one, so
   the group you are surest about is usually the one you should submit last.
   The engine helps exactly as much as the format traditionally does — it tells
   you when you had three of four right, and nothing else.

   The board is shuffled by a seeded PRNG (shared.js: rng), so every player on
   a given day sees the same arrangement and the group chat can argue about the
   same grid.

   Scoring: wrong submissions, out of four allowed. Solve it clean and the
   order you cracked them in is the only thing left to brag about.
   ========================================================================== */

const LIVES = 4;

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const groups = puzzle.data.groups; // [{ name, why, items: [4] }]

    const tiles = [];
    groups.forEach((g, gi) => g.items.forEach((it) => tiles.push({ text: it, g: gi })));

    const rand = rng(puzzle.data.seed || 20260901);
    for (let i = tiles.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
    }

    let live = tiles.slice();          // still on the board
    const solved = [];                 // group indices, in the order cracked
    let sel = [];
    let mistakes = 0;
    let message = "";
    let over = false;
    const guessLog = [];               // for the share squares

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function submit() {
      if (sel.length !== 4) return;
      const picked = sel.map((t) => t.g);
      const counts = {};
      picked.forEach((g) => { counts[g] = (counts[g] || 0) + 1; });
      const best = Math.max(...Object.values(counts));
      guessLog.push(best);

      if (best === 4) {
        const gi = picked[0];
        solved.push(gi);
        live = live.filter((t) => t.g !== gi);
        sel = [];
        message = "";
        if (!live.length) over = true;
        return render();
      }

      mistakes++;
      message = best === 3
        ? "One away. Three of those four share something — the fourth doesn't."
        : "Not a group.";
      if (mistakes >= LIVES) {
        // Out of guesses: the rest of the board is revealed rather than left
        // hanging, because the point of the puzzle is seeing the categories.
        groups.forEach((_, gi) => { if (!solved.includes(gi)) solved.push(gi); });
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

      // Cracked categories, stacked above the remaining board.
      solved.forEach((gi) => {
        const g = groups[gi];
        const band = el("div", `grp-band g${gi}`);
        band.innerHTML = `<b>${g.name}</b><span>${g.items.join(" · ")}</span>`;
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
            else if (sel.length < 4) sel.push(t);
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
        : message || "Find four that belong together. Every category has a decoy in it.";
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = done;
        bar.appendChild(b);
      } else {
        const s = el("button", "primary compact", "Submit");
        s.disabled = sel.length !== 4;
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
      const squares = guessLog.map((b) =>
        b === 4 ? "🟩" : b === 3 ? "🟨" : "🟥").join("");

      api.finish({
        headline: won
          ? (mistakes === 0
              ? "All four, no mistakes"
              : `All four with ${mistakes} mistake${mistakes === 1 ? "" : "s"}`)
          : `Ran out of guesses — ${solvedCount()} of 4 found`,
        squares,
        stats: [
          ["Categories", `${solvedCount()}/4`],
          ["Mistakes", `${mistakes}/${LIVES}`],
          ["Guesses", String(guessLog.length)],
        ],
        perfect: won && mistakes === 0,
        extra: [
          mistakes === 0 ? "🎯 clean sweep" : `❌ ${mistakes} wrong group${mistakes === 1 ? "" : "s"}`,
          guessLog.includes(3) ? "😬 at least one one-away" : "",
        ].filter(Boolean),
      });
    }

    // Categories the player actually cracked, as opposed to ones revealed at
    // the end when the guesses ran out.
    function solvedCount() {
      return guessLog.filter((b) => b === 4).length;
    }

    render();
  },
};
