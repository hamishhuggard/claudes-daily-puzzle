import { el } from "./shared.js";

/* Five cryptic crossword clues. Every fair cryptic clue is definition +
   wordplay: one contiguous run of words that means the answer in plain
   English, and a separate mechanism (anagram, hidden word, charade,
   homophone, double definition, ...) that builds the same letters some
   other way. Most people who "can't do cryptics" have never been shown
   that seam exists — so the player does two things per clue: type the
   answer, and tap out which run of words is the straight definition.
   The two are scored separately. Getting the word right without seeing
   why is a different, lesser skill than getting it right for the right
   reason, and the scoring UI says so out loud.

   Word-tapping is a two-click range select: first tap sets one end,
   second tap sets the other (order doesn't matter), a third tap starts a
   fresh selection. A clue can have more than one acceptable definition
   span (double definitions genuinely have two), so content authors a
   defSpans array and any exact match counts.

   At mount we assert every answer's letter-count matches its enumeration
   and every def span is in bounds for its clue — a mismatch here is
   broken content shipping, not a player error, so it throws instead of
   failing quietly. */

const DEVICES = [
  "double definition", "hidden word", "charade",
  "homophone", "anagram", "container", "reversal",
];

const SEL_BG = "rgba(255, 200, 60, 0.35)";
const CORRECT_BG = "rgba(60, 200, 120, 0.35)";

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const clues = puzzle.data.clues.map((c) => ({
      ...c,
      words: c.clue.trim().split(/\s+/),
    }));

    clues.forEach((c, i) => {
      const letters = c.answer.replace(/[^A-Za-z]/g, "").length;
      if (letters !== c.enumeration) {
        throw new Error(`clue: #${i + 1} answer "${c.answer}" has ${letters} letters, enumeration says (${c.enumeration})`);
      }
      if (!Array.isArray(c.defSpans) || !c.defSpans.length) {
        throw new Error(`clue: #${i + 1} has no defSpans`);
      }
      c.defSpans.forEach(([s, e]) => {
        if (s == null || e == null || s < 0 || e >= c.words.length || s > e) {
          throw new Error(`clue: #${i + 1} def span [${s},${e}] out of bounds for ${c.words.length} words`);
        }
      });
      if (!DEVICES.includes(c.device)) {
        throw new Error(`clue: #${i + 1} unknown device "${c.device}"`);
      }
    });
    if (new Set(clues.map((c) => c.device)).size !== clues.length) {
      throw new Error("clue: all five clues must use a different device");
    }

    let idx = 0;
    let hintsUsed = 0;
    const results = []; // { grade: 'full' | 'partial' | 'miss' }

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    renderClue();

    function renderClue() {
      const c = clues[idx];
      let selStart = null, selEnd = null;
      let hinted = false;
      let submitted = false;

      wrap.innerHTML = "";
      wrap.appendChild(el("p", "q-num", `Clue ${idx + 1} of ${clues.length}`));
      wrap.appendChild(el("p", "q-detail center",
        "Enter the answer, then tap the run of words that's the straight definition."));

      const clueLine = el("p", "q-text center");
      const wordEls = c.words.map((w, wi) => {
        const span = document.createElement("span");
        span.textContent = w;
        span.style.cursor = "pointer";
        span.style.padding = "2px 4px";
        span.style.borderRadius = "4px";
        span.style.marginRight = "2px";
        span.style.display = "inline-block";
        span.onclick = () => {
          if (submitted) return;
          if (selStart === null || selEnd !== null) {
            selStart = wi; selEnd = null;
          } else {
            selEnd = wi;
            if (selEnd < selStart) [selStart, selEnd] = [selEnd, selStart];
          }
          paint();
        };
        clueLine.appendChild(span);
        return span;
      });
      wrap.appendChild(clueLine);
      wrap.appendChild(el("p", "q-detail center", `(${c.enumeration})`));

      function paint() {
        const lo = selStart === null ? -1 : selStart;
        const hi = selEnd === null ? lo : selEnd;
        wordEls.forEach((w, wi) => {
          w.style.background = (wi >= lo && wi <= hi) ? SEL_BG : "";
        });
      }

      const hintBtn = el("button", "ghost compact", "Hint (names the device)");
      const hintWrap = el("div", "q-detail center");
      hintWrap.appendChild(hintBtn);
      wrap.appendChild(hintWrap);
      const hintText = el("p", "q-detail center", "&nbsp;");
      wrap.appendChild(hintText);
      hintBtn.onclick = () => {
        if (hinted || submitted) return;
        hinted = true;
        hintsUsed++;
        hintText.textContent = c.hint;
        hintBtn.disabled = true;
      };

      const inputRow = el("div", "q-detail center");
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = "Your answer";
      input.style.textAlign = "center";
      input.style.textTransform = "uppercase";
      inputRow.appendChild(input);
      wrap.appendChild(inputRow);

      const feedback = el("p", "order-feedback", "&nbsp;");
      wrap.appendChild(feedback);

      const submitBtn = el("button", "primary", "Submit");
      wrap.appendChild(submitBtn);

      submitBtn.onclick = () => {
        if (submitted) return;
        const guess = input.value.trim().toUpperCase().replace(/[^A-Z]/g, "");
        if (!guess) {
          feedback.className = "order-feedback show";
          feedback.textContent = "Enter an answer first.";
          return;
        }
        submitted = true;
        input.disabled = true;
        submitBtn.disabled = true;

        const answerRight = guess === c.answer.toUpperCase();
        const chosenEnd = selEnd === null ? selStart : selEnd;
        const spanRight = selStart !== null &&
          c.defSpans.some(([s, e]) => s === selStart && e === chosenEnd);

        const grade = answerRight && spanRight ? "full" : answerRight ? "partial" : "miss";
        results.push({ grade, hinted });

        wordEls.forEach((w) => { w.style.background = ""; });
        c.defSpans.forEach(([s, e]) => {
          for (let wi = s; wi <= e; wi++) wordEls[wi].style.background = CORRECT_BG;
        });

        const badgeText = grade === "full" ? "🟩 Full marks — answer and seam both right"
          : grade === "partial" ? "🟨 Right answer, wrong seam (the true definition is highlighted)"
          : "🟥 Not the answer";
        feedback.className = "order-feedback show";
        feedback.innerHTML = badgeText + (answerRight ? "" : ` — it was <b>${c.answer}</b>`);

        const nextBtn = el("button", "primary", idx === clues.length - 1 ? "See results" : "Next clue");
        nextBtn.onclick = () => {
          idx++;
          if (idx >= clues.length) done();
          else renderClue();
        };
        wrap.appendChild(nextBtn);
      };
    }

    function done() {
      root.innerHTML = "";
      const full = results.filter((r) => r.grade === "full").length;
      const partial = results.filter((r) => r.grade === "partial").length;
      const miss = results.filter((r) => r.grade === "miss").length;
      const perfect = full === clues.length && hintsUsed === 0;

      root.appendChild(el("div", "reveal-badge " + (perfect ? "good" : miss > partial ? "bad" : "ok"),
        `📖 ${full}/${clues.length} full marks`));

      root.appendChild(el("div", "reveal-nums", `
        <div><span>Full marks</span><b>${full}/${clues.length}</b></div>
        <div><span>Right word, wrong seam</span><b>${partial}</b></div>
        <div><span>Missed</span><b>${miss}</b></div>
        <div><span>Hints used</span><b>${hintsUsed}</b></div>`));

      const squares = results.map((r) =>
        r.grade === "full" ? "🟩" : r.grade === "partial" ? "🟨" : "🟥").join("");

      api.finish({
        headline: perfect ? "Every clue, cold — you're seeing the seam"
          : full === 0 ? "The wordplay won this round"
          : `${full} of ${clues.length} clean, ${partial} solved but mis-seamed`,
        squares,
        stats: [
          ["Full marks", `${full}/${clues.length}`],
          ["Right word, wrong seam", String(partial)],
          ["Missed", String(miss)],
          ["Hints used", String(hintsUsed)],
        ],
        perfect,
        extra: [
          hintsUsed === 0 ? "🎯 zero hints" : `💡 ${hintsUsed} hint${hintsUsed === 1 ? "" : "s"} used`,
          full > 0 && partial === 0 && miss === 0 ? "🧩 every seam spotted" : null,
        ].filter(Boolean),
        notes: clues.map((c, i) =>
          `<b>${i + 1}. ${c.answer}</b> — <i>${c.clue} (${c.enumeration})</i> — ${c.device.toUpperCase()}. ${c.parse}`),
      });
    }
  },
};
