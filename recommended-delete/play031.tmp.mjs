import { JSDOM } from "jsdom";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = "/Users/hamish/Desktop/claudes-daily-puzzle";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
global.window = dom.window;
global.document = dom.window.document;

const { default: engine } = await import(pathToFileURL(path.join(ROOT, "engines/triples.js")).href);
const { default: content } = await import(pathToFileURL(path.join(ROOT, "tools/content/031.js")).href);
const { findAllTriples, isTriple } = await import(pathToFileURL(path.join(ROOT, "engines/triples-rules.js")).href);

const cards = content.data.cards;
const solution = findAllTriples(cards);
console.log("cards:", cards.length, "brute-force triples:", solution.length, "expected:", content.data.expectedTriples);
if (solution.length !== content.data.expectedTriples) throw new Error("mismatch");

const root = document.getElementById("root");
let finishResult = null;
const api = {
  timeText: () => "1:23",
  finish(r) { finishResult = r; },
};

engine.mount(root, { data: content.data }, api);

function tapCards(idxs) {
  const cardsEls = [...root.querySelectorAll(".triples-card")];
  idxs.forEach((i) => cardsEls[i].onclick());
}

// 1. Deliberately submit a wrong triple (first 3 cards, assumed not all valid — verify).
const wrongTriple = [0, 1, 2];
if (!isTriple(cards[0], cards[1], cards[2])) {
  tapCards(wrongTriple);
  console.log("after wrong triple, feedback:", root.querySelector(".order-feedback").textContent);
} else {
  console.log("cards 0,1,2 happen to be a valid set, skipping the deliberate-wrong step");
}

// 2. Submit every real triple.
for (const [i, j, k] of solution) {
  tapCards([i, j, k]);
}

await new Promise((r) => setTimeout(r, 700));

console.log("\n=== FINISH RESULT ===");
console.log(JSON.stringify(finishResult, null, 2));

if (!finishResult) throw new Error("finish never called");
if (finishResult.stats[0][1] !== `${solution.length}/${solution.length}`) throw new Error("sets found stat wrong");
if (finishResult.notes.length < solution.length) throw new Error("notes missing entries");
console.log("\nOK — playthrough completed, finish() called with sane payload.");
