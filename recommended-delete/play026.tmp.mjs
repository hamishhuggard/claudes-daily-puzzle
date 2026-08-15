import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = "/Users/hamish/Desktop/claudes-daily-puzzle";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
global.window = dom.window;
global.document = dom.window.document;

const { default: engine } = await import(pathToFileURL(path.join(ROOT, "engines/ladder.js")).href);
const { default: content } = await import(pathToFileURL(path.join(ROOT, "tools/content/026.js")).href);
const rulesMod = await import(pathToFileURL(path.join(ROOT, "engines/ladder-rules.js")).href);

const root = document.getElementById("root");

// sanity: every round's target reachable, and par matches BFS distance
for (const r of content.data.rounds) {
  const len = String(r.start.length);
  const words = content.data.words[len];
  if (!words.includes(r.start)) throw new Error(`start ${r.start} not in word list`);
  if (!words.includes(r.target)) throw new Error(`target ${r.target} not in word list`);
  const adj = rulesMod.buildGraph(words);
  const d = rulesMod.shortestDistance(adj, r.start, r.target);
  console.log(`${r.start} -> ${r.target}: par(BFS)=${d}`);
  if (d == null) throw new Error(`${r.start} -> ${r.target} unreachable!`);
  if (d < 4 || d > 6) console.warn(`WARNING: par ${d} outside 4-6 for ${r.start}->${r.target}`);
}

let finishResult = null;
const api = {
  finish(r) { finishResult = r; },
};

engine.mount(root, { data: content.data }, api);

// Drive round 1: cold -> warm via a known shortest path. Let's discover one using nextStep repeatedly (auto-solve).
function typeAndSubmit(word) {
  const input = root.querySelector(".ladder-input");
  const btn = [...root.querySelectorAll("button")].find((b) => b.textContent === "Climb");
  input.value = word;
  btn.click();
}
function clickByText(txt) {
  const btn = [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === txt);
  if (!btn) throw new Error("no button: " + txt);
  btn.click();
}

async function playRoundAuto(expectStart, expectTarget, useHintOnce) {
  // recompute graph to auto-solve
  const len = String(expectStart.length);
  const words = content.data.words[len];
  const adj = rulesMod.buildGraph(words);
  let current = expectStart;
  let usedHint = false;
  while (current !== expectTarget) {
    if (useHintOnce && !usedHint) {
      clickByText("Stuck? Show one step");
      usedHint = true;
      const chips = [...root.querySelectorAll(".ladder-chip")].filter((c) => !c.classList.contains("target"));
      current = chips[chips.length - 1].textContent.toLowerCase();
      continue;
    }
    const step = rulesMod.nextStep(adj, current, expectTarget);
    typeAndSubmit(step);
    current = step;
  }
}

await playRoundAuto("cold", "warm", false);
// after reaching target, reveal screen shown; check reveal content then click Next round
console.log("Round1 reveal text:", root.querySelector(".reveal-badge").textContent);
clickByText("Next round");

await playRoundAuto("head", "tail", true); // use stuck once
console.log("Round2 reveal text:", root.querySelector(".reveal-badge").textContent);
clickByText("Next round");

// Round 3: deliberately try an illegal move first to check rejection message
{
  const input = root.querySelector(".ladder-input");
  const btn = [...root.querySelectorAll("button")].find((b) => b.textContent === "Climb");
  input.value = "shocked"; // wrong length
  btn.click();
  console.log("Reject wrong length:", root.querySelector(".ladder-msg").textContent);
  input.value = "stoke"; // same word
  btn.click();
  console.log("Reject same word:", root.querySelector(".ladder-msg").textContent);
  input.value = "zzzzz"; // not a word
  btn.click();
  console.log("Reject unknown word:", root.querySelector(".ladder-msg").textContent);
}
await playRoundAuto("stoke", "shock", false);
console.log("Round3 reveal text:", root.querySelector(".reveal-badge").textContent);
clickByText("See your score");

console.log("\n=== FINISH RESULT ===");
console.log(JSON.stringify(finishResult, null, 2));

if (!finishResult) throw new Error("finish never called");
if (finishResult.squares.length !== 3) throw new Error("expected 3 squares, got " + finishResult.squares);
console.log("\nOK — playthrough completed and finish() called with valid share card.");
