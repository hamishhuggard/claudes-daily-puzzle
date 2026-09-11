import { el } from "./shared.js";
import {
  ITEMS, allWorlds, consistentWorlds, isPlayableSpec,
  greedyPar, answer,
} from "./verdict-rules.js";

/* ============================================================================
   VERDICT — "One Bad Answer"
   ----------------------------------------------------------------------------
   Six items, a hidden strict ranking, and an oracle you ask pairwise
   questions of: "is A above B?" Almost every answer is true. Exactly one
   ORDERED PAIR is fixed at authoring time as the lying pair — ask about it,
   either direction, any number of times, and the answer is always the
   reverse of the truth. Every other pair is always true. Because the oracle
   is a pure function of the pair (not of question order or repeats), asking
   the same pair twice teaches nothing: the fair version of "one liar" is a
   deterministic one, not a moody one.

   The player's job is bookkeeping, not guessing: two truthful answers that
   contradict each other localise the lie, and everything the oracle has
   said stays visible so that contradiction is something you can actually
   go looking for.

   PAR is computed on mount by running the same greedy splitting strategy
   the authoring tool used (verdict-rules.js: greedyPar) against the actual
   spec — never a guessed number. It is honestly a heuristic: bestQuestion
   is a one-step-lookahead splitter, not a full minimax search over the
   ~10800-world decision space, so par is labelled "what a splitting
   strategy needs", not "the true minimum". Submitting locks in both the
   full ranking and the pair you believe was the lie.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const d = puzzle.data;
    const items = d.items; // 6 names
    const spec = { ranking: d.ranking, lyingPair: d.lyingPair };

    if (items.length !== ITEMS || new Set(d.ranking).size !== ITEMS) {
      throw new Error("verdict: ranking must be a permutation of all items");
    }
    if (!isPlayableSpec(spec)) {
      throw new Error("verdict: lyingPair is too close in rank to ever be uniquely recoverable");
    }
    const par = greedyPar(spec);

    const worlds0 = allWorlds();
    let worlds = worlds0;
    const asked = []; // { a, b, said }
    let questions = 0;
    let hints = 0;
    let finished = false;

    root.appendChild(el("p", "q-detail center",
      `Ask "is A above B?" as many times as you like. Every answer is true except one fixed pair — asked ` +
      `either way round, any number of times, it always comes back reversed. Work out the finish order and ` +
      `which pair was lying.`));

    const head = el("div", "grid-score");
    root.appendChild(head);
    const qCell = el("div", "grid-score-cell", `<small>Questions</small><b>0</b>`);
    const parCell = el("div", "grid-score-cell", `<small>Par*</small><b>${par}</b>`);
    const narrowCell = el("div", "grid-score-cell", `<small>Narrowed to</small><b>${worlds.length}</b>`);
    head.append(qCell, parCell, narrowCell);

    root.appendChild(el("p", "q-detail center",
      `<small style="color:var(--faint);">*par is the number a splitting strategy needs — not a proven minimum.</small>`));

    // -------- Ask panel: pick two items, ask a yes/no question --------
    const askWrap = el("div");
    askWrap.style.cssText = "display:flex; gap:8px; justify-content:center; align-items:center; " +
      "flex-wrap:wrap; margin:14px 0;";
    root.appendChild(askWrap);

    const selA = el("select");
    const selB = el("select");
    [selA, selB].forEach((sel, si) => {
      items.forEach((name, i) => {
        const opt = document.createElement("option");
        opt.value = String(i);
        opt.textContent = name;
        sel.appendChild(opt);
      });
      sel.value = String(si === 0 ? 0 : 1);
      sel.style.cssText = "padding:8px; border-radius:8px; border:1px solid var(--line); background:var(--card);";
    });

    const askBtn = el("button", "primary", "Is A above B?");
    const hintBtn = el("button", "ghost compact", "Hint");
    askWrap.append(selA, el("span", null, "above"), selB, askBtn, hintBtn);

    const feedbackLine = el("div", "order-feedback show", "Pick two different items and ask.");
    root.appendChild(feedbackLine);

    // -------- Answer log --------
    const logWrap = el("div");
    logWrap.style.cssText = "margin:14px 0; max-height:220px; overflow-y:auto; display:flex; " +
      "flex-direction:column; gap:6px;";
    root.appendChild(logWrap);

    function renderLog() {
      logWrap.innerHTML = "";
      asked.slice().reverse().forEach(({ a, b, said }) => {
        const row = el("div");
        row.style.cssText = "background:var(--panel); border:1px solid var(--line); border-radius:10px; " +
          "padding:6px 10px; font-size:.85rem; display:flex; justify-content:space-between; gap:10px;";
        row.innerHTML = `<span>Is <b>${items[a]}</b> above <b>${items[b]}</b>?</span>` +
          `<span style="font-weight:700; color:${said ? "var(--good)" : "var(--bad)"};">${said ? "Yes" : "No"}</span>`;
        logWrap.appendChild(row);
      });
    }

    function updateHead() {
      qCell.innerHTML = `<small>Questions</small><b>${questions}</b>`;
      narrowCell.innerHTML = `<small>Narrowed to</small><b>${worlds.length}</b>`;
    }

    askBtn.onclick = () => {
      if (finished) return;
      const a = Number(selA.value), b = Number(selB.value);
      if (a === b) {
        feedbackLine.textContent = "Pick two different items.";
        return;
      }
      const key = (x, y) => (x < y ? `${x},${y}` : `${y},${x}`);
      const already = asked.find((q) => key(q.a, q.b) === key(a, b));
      if (already) {
        feedbackLine.textContent = `Already asked that pair — same answer every time: ${already.said ? "Yes" : "No"}.`;
        return;
      }
      const said = answer(spec, a, b);
      asked.push({ a, b, said });
      questions++;
      worlds = consistentWorlds(worlds, asked);
      renderLog();
      updateHead();
      feedbackLine.textContent = `${items[a]} above ${items[b]}? ${said ? "Yes" : "No"}.`;
    };

    hintBtn.onclick = () => {
      if (finished) return;
      hints++;
      // Reuse the same splitting logic the strategy uses: point at a pair
      // that's still informative given what's been asked.
      const askedKeys = new Set(asked.map((q) => (q.a < q.b ? `${q.a},${q.b}` : `${q.b},${q.a}`)));
      let best = null, bestWorst = Infinity;
      for (let x = 0; x < ITEMS; x++) for (let y = x + 1; y < ITEMS; y++) {
        const k = `${x},${y}`;
        if (askedKeys.has(k)) continue;
        let yes = 0, no = 0;
        for (const w of worlds) (answer(w, x, y) ? yes++ : no++);
        if (yes === 0 || no === 0) continue;
        const worst = Math.max(yes, no);
        if (worst < bestWorst) { bestWorst = worst; best = [x, y]; }
      }
      if (!best) {
        feedbackLine.textContent = "No question left would teach you anything new.";
        return;
      }
      feedbackLine.textContent = `Hint: try asking about ${items[best[0]]} and ${items[best[1]]}.`;
    };

    // -------- Submission: full ranking + lying pair --------
    root.appendChild(el("h3", "center", "Your verdict"));
    root.appendChild(el("p", "q-detail center", "Put them in finish order (1st at top), then name the lying pair."));

    let order = items.map((_, i) => i); // player's current guess order
    const list = el("div", "order-list");
    root.appendChild(list);

    function move(from, to) {
      if (to < 0 || to >= order.length) return;
      [order[from], order[to]] = [order[to], order[from]];
      renderList();
    }

    function renderList() {
      list.innerHTML = "";
      order.forEach((itemIdx, pos) => {
        const row = el("div", "order-row");
        row.appendChild(el("span", "order-num", String(pos + 1)));
        row.appendChild(el("span", "order-label", items[itemIdx]));
        const up = el("button", "nudge", "▲");
        up.disabled = pos === 0 || finished;
        up.setAttribute("aria-label", "Move up");
        up.onclick = () => move(pos, pos - 1);
        const dn = el("button", "nudge", "▼");
        dn.disabled = pos === order.length - 1 || finished;
        dn.setAttribute("aria-label", "Move down");
        dn.onclick = () => move(pos, pos + 1);
        const ctrl = el("div", "nudges");
        ctrl.append(up, dn);
        row.appendChild(ctrl);
        list.appendChild(row);
      });
    }
    renderList();

    const pairWrap = el("div");
    pairWrap.style.cssText = "display:flex; gap:8px; justify-content:center; align-items:center; margin:14px 0;";
    root.appendChild(pairWrap);
    const pairA = selA.cloneNode(true);
    const pairB = selB.cloneNode(true);
    pairA.value = "0"; pairB.value = "1";
    pairWrap.append(el("span", null, "Lying pair:"), pairA, pairB);

    const submitBtn = el("button", "primary", "Submit verdict");
    submitBtn.style.cssText = "display:block; margin:10px auto;";
    root.appendChild(submitBtn);

    submitBtn.onclick = () => {
      if (finished) return;
      finished = true;
      submitBtn.disabled = true;
      askBtn.disabled = true;
      hintBtn.disabled = true;

      const rankRight = order.every((v, i) => v === spec.ranking[i]);
      const guessPair = [Number(pairA.value), Number(pairB.value)];
      const key = (x, y) => (x < y ? `${x},${y}` : `${y},${x}`);
      const pairRight = key(guessPair[0], guessPair[1]) === key(spec.lyingPair[0], spec.lyingPair[1]);
      const bothRight = rankRight && pairRight;
      const onPar = questions <= par;
      const perfect = bothRight && onPar && hints === 0;

      root.querySelectorAll(".order-row").forEach((r, i) => {
        if (rankRight) r.classList.add("right");
        r.querySelector(".nudges")?.remove();
        r.appendChild(el("span", "order-when", items[spec.ranking[i]]));
      });

      root.appendChild(el("div", "reveal-badge " + (bothRight ? (onPar ? "good" : "ok") : "bad"),
        bothRight
          ? `Correct — ${questions} question${questions === 1 ? "" : "s"} (par ${par})`
          : `${rankRight ? "Order right" : "Order wrong"}, ${pairRight ? "pair right" : "pair wrong"}`));

      const grid = el("div", "reveal-nums");
      grid.append(
        el("div", null, `<span>Questions</span><b>${questions}/${par}</b>`),
        el("div", null, `<span>Hints</span><b>${hints}</b>`),
        el("div", null, `<span>Verdict</span><b>${bothRight ? (onPar ? "On par" : "Solved") : "Wrong"}</b>`),
      );
      root.appendChild(grid);

      const squares = (onPar ? "🟩" : questions <= par + 3 ? "🟨" : "🟥").repeat(1) +
        (bothRight ? "✅" : "❌");

      const notes = [
        `The true finish order was <b>${spec.ranking.map((i) => items[i]).join(" → ")}</b>.`,
        `The lying pair was <b>${items[spec.lyingPair[0]]} vs ${items[spec.lyingPair[1]]}</b> — every other pair ` +
          `answered truthfully all session.`,
        `The splitting strategy this puzzle was built against needed <b>${par}</b> question${par === 1 ? "" : "s"} ` +
          `in the worst case to nail down both the order and the lie.`,
      ];

      api.finish({
        headline: bothRight
          ? (onPar ? `Solved on par — ${questions} questions` : `Solved in ${questions} (par ${par})`)
          : `Missed it — ${rankRight ? "order right, pair wrong" : pairRight ? "pair right, order wrong" : "both wrong"}`,
        squares,
        stats: [
          ["Questions", `${questions}/${par}`],
          ["Hints", String(hints)],
          ["Verdict", bothRight ? (onPar ? "On par" : "Solved") : "Wrong"],
        ],
        perfect,
        extra: bothRight
          ? [onPar ? "🎯 matched the splitting strategy" : `✅ solved in ${questions}`]
          : ["❌ verdict wrong"],
        notes,
      });
    };
  },
};
