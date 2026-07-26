import { el } from "./shared.js";

/* Wason-style hypothesis testing. Score: probes used, plus wrong guesses. */
export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const d = puzzle.data;
    let probes = 0, wrong = 0;
    const log = [];

    root.appendChild(el("p", "q-detail center",
      `I'm thinking of a rule that some triples of numbers obey and others don't. ` +
      `<b>${d.seed.join(", ")}</b> obeys it. Test as many triples as you like, then name the rule.`));

    const form = el("div", "triple-form");
    const inputs = [0, 1, 2].map((i) => {
      const inp = el("input", "num");
      inp.type = "number";
      inp.setAttribute("aria-label", `Number ${i + 1}`);
      inp.placeholder = "—";
      return inp;
    });
    const testBtn = el("button", "primary compact", "Test");
    form.append(...inputs, testBtn);
    root.appendChild(form);

    const logBox = el("div", "log");
    root.appendChild(logBox);

    const guessBtn = el("button", "ghost wide-btn", "I know the rule");
    root.appendChild(guessBtn);

    testBtn.onclick = () => {
      const v = inputs.map((i) => Number(i.value));
      if (inputs.some((i) => i.value === "") || v.some((n) => !Number.isFinite(n))) return;
      probes++;
      const ok = d.test(v[0], v[1], v[2]);
      log.unshift({ v, ok });
      renderLog();
      inputs[0].focus();
      inputs.forEach((i) => (i.value = ""));
    };

    inputs.forEach((inp, i) => {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { (i < 2 ? inputs[i + 1] : testBtn).focus(); if (i === 2) testBtn.click(); }
      });
    });

    function renderLog() {
      logBox.innerHTML = "";
      logBox.appendChild(el("div", "log-count",
        `${probes} test${probes === 1 ? "" : "s"} so far`));
      for (const r of log) {
        logBox.appendChild(el("div", "log-row " + (r.ok ? "yes" : "no"),
          `<span>${r.v.join(", ")}</span><b>${r.ok ? "✓ obeys" : "✗ breaks"}</b>`));
      }
      logBox.appendChild(el("div", "log-row yes seed",
        `<span>${d.seed.join(", ")}</span><b>✓ obeys</b>`));
    }
    renderLog();

    guessBtn.onclick = () => {
      const sheet = el("div", "sheet");
      sheet.appendChild(el("h3", null, "Which rule am I using?"));
      d.options.forEach((opt, i) => {
        const b = el("button", "option", opt);
        b.onclick = () => {
          if (i === d.answer) {
            sheet.remove();
            api.finish({
              headline: `${probes} test${probes === 1 ? "" : "s"}`,
              // One flask per test, one cross per wrong guess, tick when it clicked.
              squares: "🔬".repeat(Math.min(probes, 15)) + "❌".repeat(Math.min(wrong, 5)) + "✅",
              stats: [
                ["Tests run", String(probes)],
                ["Wrong guesses", String(wrong)],
                ["Verdict", probes <= 3 ? "Bold" : probes <= 8 ? "Thorough" : "Exhaustive"],
              ],
              perfect: wrong === 0,
              extra: [wrong === 0 ? "✅ first guess" : `❌ ${wrong} wrong guess${wrong === 1 ? "" : "es"}`],
            });
          } else {
            wrong++;
            b.classList.add("wrong");
            b.disabled = true;
            sheet.querySelector(".sheet-msg").textContent =
              "Not that one. Close it and run more tests, or try again.";
          }
        };
        sheet.appendChild(b);
      });
      sheet.appendChild(el("p", "sheet-msg", ""));
      const close = el("button", "ghost", "Keep testing");
      close.onclick = () => sheet.remove();
      sheet.appendChild(close);
      root.appendChild(sheet);
    };
  },
};
