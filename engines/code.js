import { el } from "./shared.js";
import { allCodes, feedback, solve, remainingCandidates, SLOTS } from "./code-rules.js";

/* Cracking the Safe — Bulls & Cows / Mastermind with 6 distinct symbols in 4
   slots (no repeats), 360 possible codes. Every guess gets back exactly two
   numbers: how many symbols are in the right position ("locked"), and how
   many are the right symbol but the wrong position ("loose"). Never which
   ones — that opacity is the whole puzzle, and it's why the guess history
   has to be read as a table rather than glanced at.

   Par is not a round number picked by feel: at mount we run the same
   Knuth-style minimax solver (code-rules.js) that the authoring tool uses,
   against the actual authored code, and assert it terminates. If it doesn't,
   the puzzle shipped broken and we throw rather than let a player discover
   that the hard way. */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const d = puzzle.data;
    const symbols = d.symbols; // 6 emoji, unambiguous at a glance on mobile
    const secret = d.code; // 4 distinct indices into `symbols`
    const maxAttempts = d.maxAttempts ?? 10;

    if (secret.length !== SLOTS || new Set(secret).size !== SLOTS) {
      throw new Error("code: secret must be 4 distinct symbol indices");
    }
    const codes = allCodes(symbols.length, SLOTS);
    if (!codes.some((c) => c.join(",") === secret.join(","))) {
      throw new Error("code: secret is not a valid code for this symbol set");
    }

    // Dev-time integrity check: the honest minimax par, computed by actually
    // solving the authored code, not guessed at.
    const solved = solve(secret, codes, maxAttempts);
    if (solved.guesses == null) {
      throw new Error(`code: minimax solver failed to close within ${maxAttempts} guesses — puzzle is broken`);
    }
    const par = solved.guesses;

    let attempts = 0;
    const history = []; // [{ guess: [idx..], fb: {bulls, cows} }]
    let current = []; // symbol indices picked for the guess in progress
    let finished = false;

    root.appendChild(el("p", "q-detail center",
      `Crack a ${SLOTS}-symbol code from ${symbols.length}, no repeats. Each guess gets back two numbers only — ` +
      `how many are locked in the right spot, and how many are loose (right symbol, wrong spot). Never which.`));

    const slotsRow = el("div");
    slotsRow.style.cssText = "display:flex; gap:10px; justify-content:center; margin:14px 0;";
    root.appendChild(slotsRow);

    const symRow = el("div");
    symRow.style.cssText = "display:flex; gap:10px; justify-content:center; flex-wrap:wrap; margin-bottom:14px;";
    root.appendChild(symRow);

    const controls = el("div");
    controls.style.cssText = "display:flex; gap:10px; justify-content:center; margin-bottom:8px;";
    root.appendChild(controls);
    const backBtn = el("button", "ghost compact", "⌫ back");
    const submitBtn = el("button", "primary", "Submit guess");
    submitBtn.style.cssText = "flex:1; max-width:220px;";
    controls.append(backBtn, submitBtn);

    const feedbackLine = el("div", "order-feedback", "&nbsp;");
    root.appendChild(feedbackLine);

    const historyWrap = el("div");
    historyWrap.style.cssText = "margin-top:18px;";
    root.appendChild(historyWrap);

    function slotCell(sym, filled) {
      const c = el("div", null, sym == null ? "" : sym);
      c.style.cssText = `width:52px; height:52px; border-radius:12px; display:flex; align-items:center;
        justify-content:center; font-size:1.6rem; border:2px ${filled ? "solid var(--accent)" : "dashed var(--line)"};
        background:var(--panel);`;
      return c;
    }

    function renderSlots() {
      slotsRow.innerHTML = "";
      for (let i = 0; i < SLOTS; i++) {
        slotsRow.appendChild(slotCell(current[i] != null ? symbols[current[i]] : null, current[i] != null));
      }
    }

    function renderSyms() {
      symRow.innerHTML = "";
      symbols.forEach((sym, i) => {
        const used = current.includes(i);
        const btn = el("button", null, sym);
        btn.style.cssText = `width:48px; height:48px; border-radius:50%; font-size:1.5rem; display:flex;
          align-items:center; justify-content:center; border:1px solid var(--line);
          background:${used ? "var(--panel)" : "var(--card)"}; opacity:${used ? "0.35" : "1"};`;
        btn.disabled = used || current.length >= SLOTS || finished;
        btn.onclick = () => { current.push(i); renderSlots(); renderSyms(); };
        symRow.appendChild(btn);
      });
    }

    backBtn.onclick = () => { current.pop(); renderSlots(); renderSyms(); };

    function informativeness(guessCandidatesBefore, guessCandidatesAfter) {
      // How much a guess narrowed the field, relative to what was left.
      const ratio = guessCandidatesAfter / Math.max(1, guessCandidatesBefore);
      if (guessCandidatesAfter <= 1) return "🟩";
      if (ratio <= 0.25) return "🟩";
      if (ratio <= 0.6) return "🟨";
      return "🟥";
    }

    function renderHistory() {
      historyWrap.innerHTML = "";
      if (!history.length) return;
      const table = el("div");
      table.style.cssText = "display:flex; flex-direction:column; gap:6px;";
      const header = el("div");
      header.style.cssText = "display:grid; grid-template-columns:1.6fr 1fr 1fr; gap:6px; font-size:.68rem; " +
        "text-transform:uppercase; letter-spacing:1px; color:var(--faint); font-weight:700; padding:0 4px;";
      header.innerHTML = "<span>Guess</span><span>🔒 Locked</span><span>🔁 Loose</span>";
      table.appendChild(header);
      history.forEach((h) => {
        const row = el("div");
        row.style.cssText = "display:grid; grid-template-columns:1.6fr 1fr 1fr; gap:6px; align-items:center; " +
          "background:var(--panel); border:1px solid var(--line); border-radius:10px; padding:8px 10px;";
        const guessStr = h.guess.map((i) => symbols[i]).join(" ");
        row.innerHTML = `<span style="font-size:1.15rem;">${guessStr}</span>` +
          `<span style="font-weight:700; color:var(--good);">${h.fb.bulls}</span>` +
          `<span style="font-weight:700; color:var(--ok);">${h.fb.cows}</span>`;
        table.appendChild(row);
      });
      historyWrap.appendChild(table);
    }

    const squares = [];

    submitBtn.onclick = () => {
      if (finished) return;
      if (current.length !== SLOTS) {
        feedbackLine.className = "order-feedback show";
        feedbackLine.textContent = `Pick all ${SLOTS} symbols first.`;
        return;
      }
      const before = remainingCandidates(codes, history).length;
      const guess = current.slice();
      const fb = feedback(guess, secret);
      history.push({ guess, fb });
      attempts++;
      const after = remainingCandidates(codes, history).length;
      squares.push(informativeness(before, after));
      current = [];
      renderSlots(); renderSyms(); renderHistory();

      if (fb.bulls === SLOTS) { finish(true); return; }
      if (attempts >= maxAttempts) { finish(false); return; }
      feedbackLine.className = "order-feedback show";
      feedbackLine.textContent = `${fb.bulls} locked, ${fb.cows} loose · attempt ${attempts}/${maxAttempts}`;
    };

    renderSlots();
    renderSyms();

    function finish(cracked) {
      finished = true;
      submitBtn.disabled = true;
      backBtn.disabled = true;
      symRow.querySelectorAll("button").forEach((b) => (b.disabled = true));

      const perfect = cracked && attempts === par;
      const codeStr = secret.map((i) => symbols[i]).join(" ");

      root.appendChild(el("div", "reveal-badge " + (perfect ? "good" : cracked ? "ok" : "bad"),
        cracked ? `${codeStr} — cracked in ${attempts} (par ${par})` : `${codeStr} — safe held, out of attempts`));

      const grid = el("div", "reveal-nums");
      grid.append(
        el("div", null, `<span>Attempts</span><b>${attempts}/${maxAttempts}</b>`),
        el("div", null, `<span>Par</span><b>${par}</b>`),
        el("div", null, `<span>Verdict</span><b>${cracked ? (perfect ? "On par" : attempts < par + 2 ? "Close" : "Roundabout") : "Not cracked"}</b>`),
      );
      root.appendChild(grid);

      const shareSquares = squares.join("") + (cracked ? "✅" : "❌");

      // Walk the deductive chain a solver would take from the player's own
      // first guess, so a wide opener is visible for what it cost them.
      const notes = [];
      if (history.length) {
        const first = history[0];
        const afterFirst = remainingCandidates(codes, [first]).length;
        notes.push(`Your opening guess was <b>${first.guess.map((i) => symbols[i]).join(" ")}</b>, which came back ` +
          `${first.fb.bulls} locked / ${first.fb.cows} loose. That alone narrows 360 possible codes down to ` +
          `<b>${afterFirst}</b> still consistent with it.`);
        let running = [first];
        for (let i = 1; i < history.length; i++) {
          running.push(history[i]);
          const remain = remainingCandidates(codes, running).length;
          notes.push(`Guess ${i + 1}, <b>${history[i].guess.map((idx) => symbols[idx]).join(" ")}</b> ` +
            `(${history[i].fb.bulls} locked / ${history[i].fb.cows} loose), cuts it to <b>${remain}</b> candidate${remain === 1 ? "" : "s"}.`);
        }
      }
      notes.push(`The par solver needed <b>${par}</b> guess${par === 1 ? "" : "es"} against this code, always picking ` +
        `the guess that minimises the worst-case remaining field — the classic minimax approach. Its own opening ` +
        `guess here was <b>${solved.history[0].guess.map((i) => symbols[i]).join(" ")}</b>.`);
      notes.push(`The code was <b>${codeStr}</b>.`);

      api.finish({
        headline: cracked
          ? (perfect ? `Cracked it on par — ${attempts} guesses` : `Cracked it in ${attempts} (par ${par})`)
          : `Safe held after ${maxAttempts} attempts (par was ${par})`,
        squares: shareSquares,
        stats: [
          ["Attempts", `${attempts}/${maxAttempts}`],
          ["Par", String(par)],
          ["Verdict", cracked ? (perfect ? "On par" : "Cracked") : "Not cracked"],
        ],
        perfect,
        extra: cracked
          ? [perfect ? "🎯 matched the minimax solver" : `🔓 cracked in ${attempts}`]
          : ["🔒 safe held"],
        notes,
      });
    }
  },
};
