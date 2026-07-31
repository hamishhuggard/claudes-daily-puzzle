import { el } from "./shared.js";

/* Balance-scale deduction. The scale is honest: every outcome is derived from
   data.fake and data.heavier, so nothing the log says can be walked back.

   Score: weighings used, plus wrong accusations. A wrong accusation costs the
   attempt but not the game — you keep the scale and carry on. */

export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const d = puzzle.data;
    const N = d.coins;
    const place = new Array(N).fill(0);   // 0 = off the scale, 1 = left, 2 = right
    let weighings = 0, wrong = 0;
    const log = [];

    root.appendChild(el("p", "q-detail center",
      `Tap a coin to move it to the <b>left</b> pan, again for the <b>right</b>, ` +
      `again to take it off. The pans must hold the same number of coins.`));

    const grid = el("div", "coin-grid");
    const coins = [];
    for (let i = 0; i < N; i++) {
      const b = el("button", "coin", `<span>${i + 1}</span><i></i>`);
      b.setAttribute("aria-label", `Coin ${i + 1}`);
      b.onclick = () => { place[i] = (place[i] + 1) % 3; render(); };
      coins.push(b);
      grid.appendChild(b);
    }
    root.appendChild(grid);

    const pans = el("div", "pans");
    const panL = el("div", "pan l", `<h4>Left</h4><div class="pan-coins">—</div>`);
    const panR = el("div", "pan r", `<h4>Right</h4><div class="pan-coins">—</div>`);
    pans.append(panL, panR);
    root.appendChild(pans);

    const msg = el("div", "weigh-msg", "");
    root.appendChild(msg);

    const weighBtn = el("button", "primary", "Weigh");
    root.appendChild(weighBtn);

    const logBox = el("div", "log");
    root.appendChild(logBox);

    const accuseBtn = el("button", "ghost wide-btn", "I know the fake");
    root.appendChild(accuseBtn);

    const side = (s) => place.map((p, i) => (p === s ? i + 1 : 0)).filter(Boolean);

    function render() {
      const L = side(1), R = side(2);
      coins.forEach((b, i) => {
        b.className = "coin" + (place[i] === 1 ? " left" : place[i] === 2 ? " right" : "");
        b.querySelector("i").textContent = place[i] === 1 ? "L" : place[i] === 2 ? "R" : "";
      });
      panL.querySelector(".pan-coins").textContent = L.length ? L.join(" ") : "—";
      panR.querySelector(".pan-coins").textContent = R.length ? R.join(" ") : "—";

      const ready = L.length > 0 && L.length === R.length;
      weighBtn.disabled = !ready;
      msg.textContent = ready ? ""
        : !L.length && !R.length ? "Put some coins on the scale."
        : "Uneven pans tell you nothing — the fuller side sinks whatever happens.";
    }

    function renderLog() {
      logBox.innerHTML = "";
      logBox.appendChild(el("div", "log-count",
        `${weighings} weighing${weighings === 1 ? "" : "s"} so far`));
      for (const r of log) {
        logBox.appendChild(el("div", "log-row " + (r.outcome === "level" ? "level" : "sank"),
          `<span class="weigh-sides">${r.left.join(" ")} <em>vs</em> ${r.right.join(" ")}</span>
           <b>${r.text}</b>`));
      }
    }

    weighBtn.onclick = () => {
      const L = side(1), R = side(2);
      if (!L.length || L.length !== R.length) return;
      weighings++;
      const f = place[d.fake];
      const outcome = f === 0 ? "level"
        : f === 1 ? (d.heavier ? "left" : "right")
                  : (d.heavier ? "right" : "left");
      const text = outcome === "level" ? "balanced"
        : outcome === "left" ? "left side sank" : "right side sank";
      log.unshift({ left: L, right: R, outcome, text });
      place.fill(0);
      render();
      renderLog();
    };

    accuseBtn.onclick = () => {
      const sheet = el("div", "sheet");
      const body = el("div", "sheet-body");
      const note = el("p", "sheet-msg", "");
      const close = el("button", "ghost", "Keep weighing");
      close.onclick = () => sheet.remove();

      let picked = null;

      function pickCoin() {
        body.innerHTML = "";
        body.appendChild(el("h3", null, "Which coin is the fake?"));
        const g = el("div", "coin-grid pick");
        for (let i = 0; i < N; i++) {
          const b = el("button", "coin", `<span>${i + 1}</span>`);
          b.onclick = () => { picked = i; pickWay(); };
          g.appendChild(b);
        }
        body.appendChild(g);
      }

      function pickWay() {
        body.innerHTML = "";
        body.appendChild(el("h3", null, `Coin ${picked + 1} — is it heavier or lighter?`));
        [["Heavier than the rest", true], ["Lighter than the rest", false]].forEach(([label, hv]) => {
          const b = el("button", "option", label);
          b.onclick = () => settle(hv);
          body.appendChild(b);
        });
        const back = el("button", "option", "← pick a different coin");
        back.onclick = pickCoin;
        body.appendChild(back);
      }

      function settle(hv) {
        if (picked === d.fake && hv === d.heavier) {
          sheet.remove();
          finish();
          return;
        }
        wrong++;
        // Which half of the accusation was wrong is itself information, so the
        // message stays deliberately vague.
        note.textContent = `No. Coin ${picked + 1}, ${hv ? "heavier" : "lighter"} — ` +
          `something in that is wrong. Weigh again.`;
        pickCoin();
      }

      pickCoin();
      sheet.append(body, note, close);
      root.appendChild(sheet);
    };

    function finish() {
      const verdict = weighings <= 3 ? "Optimal" : weighings === 4 ? "Sharp"
        : weighings <= 6 ? "Solid" : "Got there";
      api.finish({
        headline: `Found it in ${weighings} weighing${weighings === 1 ? "" : "s"}`,
        squares: "⚖️".repeat(Math.min(weighings, 12)) +
                 "❌".repeat(Math.min(wrong, 5)) + "✅",
        stats: [
          ["Weighings", String(weighings)],
          ["Wrong calls", String(wrong)],
          ["Verdict", verdict],
        ],
        perfect: weighings <= 3 && wrong === 0,
        extra: [
          `⚖️ ${weighings} weighing${weighings === 1 ? "" : "s"} — ${verdict.toLowerCase()}`,
          wrong === 0 ? "✅ named it first time"
                      : `❌ ${wrong} wrong call${wrong === 1 ? "" : "s"}`,
        ],
        notes: log.slice().reverse().map((r, i) =>
          `<b>Weighing ${i + 1}</b> — ${r.left.join(", ")} against ${r.right.join(", ")}: ${r.text}.`),
      });
    }

    render();
    renderLog();
  },
};
