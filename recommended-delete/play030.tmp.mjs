import { JSDOM } from "jsdom";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = "/Users/hamish/Desktop/claudes-daily-puzzle";

const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
global.window = dom.window;
global.document = dom.window.document;

const { default: engine } = await import(pathToFileURL(path.join(ROOT, "engines/nonogram.js")).href);
const { default: content } = await import(pathToFileURL(path.join(ROOT, "tools/content/030.js")).href);

const bitmap = content.data.bitmap.map((r) => r.split("").map(Number));
const n = bitmap.length;

function freshRoot() {
  document.getElementById("root").remove();
  const r = document.createElement("div");
  r.id = "root";
  document.body.appendChild(r);
  return r;
}

// --- Run 1: perfect solve, first try ---
{
  const root = freshRoot();
  let finishResult = null;
  const api = { finish(r) { finishResult = r; } };
  engine.mount(root, { data: content.data }, api);

  const cells = root.querySelectorAll("[data-r]");
  const at = (r, c) => [...cells].find((el) => Number(el.dataset.r) === r && Number(el.dataset.c) === c);

  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (bitmap[r][c]) {
        at(r, c).dispatchEvent(new dom.window.PointerEvent("pointerdown", { bubbles: true }));
      }
    }
  }

  const finishBtn = [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === "Finish");
  finishBtn.click();

  if (!finishResult) throw new Error("Run 1: api.finish never fired");
  console.log("Run 1 (perfect):", JSON.stringify({ headline: finishResult.headline, perfect: finishResult.perfect, stats: finishResult.stats, squares: finishResult.squares }));
  if (!finishResult.perfect) throw new Error("Run 1 expected perfect=true");
}

// --- Run 2: one wrong fill + one incomplete Finish attempt ---
{
  const root = freshRoot();
  let finishResult = null;
  const api = { finish(r) { finishResult = r; } };
  engine.mount(root, { data: content.data }, api);

  const cells = root.querySelectorAll("[data-r]");
  const at = (r, c) => [...cells].find((el) => Number(el.dataset.r) === r && Number(el.dataset.c) === c);

  // Fill only half the true cells first, hit Finish (should refuse: not finished).
  let filledSoFar = 0;
  outer:
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (bitmap[r][c]) {
        at(r, c).dispatchEvent(new dom.window.PointerEvent("pointerdown", { bubbles: true }));
        filledSoFar++;
        if (filledSoFar > 5) break outer;
      }
    }
  }
  let finishBtn = [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === "Finish");
  finishBtn.click();
  if (finishResult) throw new Error("Run 2: finish fired early on an incomplete board");
  const feedbackText = root.querySelector(".order-feedback").textContent;
  console.log("Run 2 incomplete feedback:", feedbackText);

  // Now fill the rest correctly, plus one wrong cell, then finish for real.
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (bitmap[r][c] && at(r, c).textContent === "" && !at(r, c).classList.contains("nono-filled")) {
        at(r, c).dispatchEvent(new dom.window.PointerEvent("pointerdown", { bubbles: true }));
      }
    }
  }
  // one wrong fill: find a false cell and click it twice back to FILLED (empty->filled)
  outerWrong:
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (!bitmap[r][c]) {
        at(r, c).dispatchEvent(new dom.window.PointerEvent("pointerdown", { bubbles: true }));
        break outerWrong;
      }
    }
  }

  finishBtn = [...root.querySelectorAll("button")].find((b) => b.textContent.trim() === "Finish");
  finishBtn.click();
  if (!finishResult) throw new Error("Run 2: api.finish never fired on the real attempt");
  console.log("Run 2 (imperfect):", JSON.stringify({ headline: finishResult.headline, perfect: finishResult.perfect, stats: finishResult.stats, squares: finishResult.squares }));
  if (finishResult.perfect) throw new Error("Run 2 expected perfect=false (one wrong fill)");
  if (Number(finishResult.stats.find((s) => s[0] === "Wrong fills")[1]) !== 1) throw new Error("Run 2 expected exactly 1 wrong fill counted");
  if (!finishResult.notes || finishResult.notes.length === 0) throw new Error("Run 2: expected teaching notes");
}

console.log("ALL PASS");
