import { JSDOM } from "jsdom";
import content from "/Users/hamish/Desktop/claudes-daily-puzzle/tools/content/033.js";
import engine from "/Users/hamish/Desktop/claudes-daily-puzzle/engines/clue.js";

const dom = new JSDOM("<!doctype html><body></body>");
global.document = dom.window.document;
global.HTMLElement = dom.window.HTMLElement;

function run(label, driver) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  let finished = null;
  const api = { finish: (payload) => { finished = payload; } };
  engine.mount(root, content, api);
  driver(root, () => finished);
  if (!finished) throw new Error(`${label}: api.finish never fired`);
  console.log(`--- ${label} ---`);
  console.log("headline:", finished.headline);
  console.log("squares:", finished.squares);
  console.log("stats:", finished.stats);
  console.log("perfect:", finished.perfect);
  console.log("extra:", finished.extra);
  console.log("notes[0]:", finished.notes[0]);
  console.log("notes count:", finished.notes.length);
}

function clickWordRange(root, start, end) {
  const words = Array.from(root.querySelectorAll("p")[2].children); // clue line is 3rd <p>? we'll find by style
}

// Helper: find the clue-line <p> (has span children), input, submit button, hint button, next button
function getParts(root) {
  const ps = Array.from(root.querySelectorAll("p"));
  const clueLine = ps.find((p) => p.children.length > 0 && p.children[0].tagName === "SPAN");
  const input = root.querySelector("input");
  const buttons = Array.from(root.querySelectorAll("button"));
  const hintBtn = buttons.find((b) => b.textContent.startsWith("Hint"));
  const submitBtn = buttons.find((b) => b.textContent === "Submit");
  return { clueLine, input, hintBtn, submitBtn };
}

function nextButton(root) {
  const buttons = Array.from(root.querySelectorAll("button"));
  return buttons.find((b) => b.textContent === "Next clue" || b.textContent === "See results");
}

// Playthrough 1: all correct, correct spans, no hints -> perfect
run("perfect run", (root, getFinished) => {
  const answers = ["PORT", "RAT", "CARPET", "SEAM", "NASTIER"];
  const spans = [[0, 1], [0, 0], [4, 5], [4, 5], [2, 4]];
  for (let i = 0; i < 5; i++) {
    const { clueLine, input, submitBtn } = getParts(root);
    const [s, e] = spans[i];
    clueLine.children[s].onclick();
    if (e !== s) clueLine.children[e].onclick();
    input.value = answers[i];
    submitBtn.onclick();
    const nb = nextButton(root);
    if (nb) nb.onclick();
  }
});

// Playthrough 2: correct answers but wrong span on clue 1, wrong answer on clue 2, use a hint on clue 3
run("imperfect run", (root) => {
  const answers = ["PORT", "WRONG", "CARPET", "SEAM", "NASTIER"];
  const spans = [[2, 2], [0, 0], [4, 5], [4, 5], [2, 4]]; // clue1 span wrong on purpose
  for (let i = 0; i < 5; i++) {
    const { clueLine, input, hintBtn, submitBtn } = getParts(root);
    if (i === 2 && hintBtn) hintBtn.onclick();
    const [s, e] = spans[i];
    clueLine.children[s].onclick();
    if (e !== s) clueLine.children[e].onclick();
    input.value = answers[i];
    submitBtn.onclick();
    const nb = nextButton(root);
    if (nb) nb.onclick();
  }
});

console.log("\nALL TESTS PASSED");
