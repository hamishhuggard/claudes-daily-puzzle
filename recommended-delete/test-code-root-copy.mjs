import { JSDOM } from "jsdom";
import engine from "/Users/hamish/Desktop/claudes-daily-puzzle/engines/code.js";
import content from "/Users/hamish/Desktop/claudes-daily-puzzle/tools/content/029.js";
import { allCodes, feedback, solve } from "/Users/hamish/Desktop/claudes-daily-puzzle/engines/code-rules.js";

const dom = new JSDOM("<!doctype html><body></body>");
global.document = dom.window.document;

function mountFresh() {
  const root = document.createElement("div");
  let result = null;
  const api = { finish: (r) => { result = r; } };
  engine.mount(root, content, api);
  return { root, api, getResult: () => result };
}

// --- Playthrough 1: perfect, follow the par solver's own guesses ---
{
  const { root, getResult } = mountFresh();
  const codes = allCodes(6, 4);
  const solved = solve(content.data.code, codes, 10);
  for (const step of solved.history) {
    step.guess.forEach((symIdx) => {
      const btn = [...root.querySelectorAll("button")].find((b) => b.textContent === content.data.symbols[symIdx] && !b.disabled);
      btn.click();
    });
    const submit = [...root.querySelectorAll("button")].find((b) => b.textContent === "Submit guess");
    submit.click();
  }
  const r = getResult();
  if (!r) throw new Error("finish never fired (par playthrough)");
  console.log("PAR PLAYTHROUGH:", JSON.stringify({ headline: r.headline, perfect: r.perfect, squares: r.squares, stats: r.stats }, null, 1));
  if (!r.perfect) throw new Error("expected perfect run following the solver's own guesses");
}

// --- Playthrough 2: exhaust attempts without ever getting it right ---
{
  const { root, getResult } = mountFresh();
  const secret = content.data.code;
  // build 10 distinct wrong guesses (permutations not equal to secret)
  const codes = allCodes(6, 4).filter((c) => c.join(",") !== secret.join(","));
  const wrongGuesses = codes.slice(0, 10);
  for (const guess of wrongGuesses) {
    guess.forEach((symIdx) => {
      const btn = [...root.querySelectorAll("button")].find((b) => b.textContent === content.data.symbols[symIdx] && !b.disabled);
      if (!btn) throw new Error("no enabled button for symbol " + symIdx);
      btn.click();
    });
    const submit = [...root.querySelectorAll("button")].find((b) => b.textContent === "Submit guess");
    submit.click();
  }
  const r = getResult();
  if (!r) throw new Error("finish never fired (exhausted-attempts playthrough)");
  console.log("EXHAUSTED PLAYTHROUGH:", JSON.stringify({ headline: r.headline, perfect: r.perfect, squares: r.squares, stats: r.stats }, null, 1));
  if (r.perfect) throw new Error("did not expect perfect on the exhausted-attempts path");
}

console.log("ALL OK");
