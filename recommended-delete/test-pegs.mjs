import { JSDOM } from "jsdom";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = "/Users/hamish/Desktop/claudes-daily-puzzle";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
global.window = dom.window;
global.document = dom.window.document;

const engineMod = await import(pathToFileURL(path.join(ROOT, "engines/pegs.js")).href);
const engine = engineMod.default;
const contentMod = await import(pathToFileURL(path.join(ROOT, "tools/content/034.js")).href);
const content = contentMod.default;

function makeApi() {
  let result = null;
  return { api: { finish: (r) => { result = r; } }, get result() { return result; } };
}

// ---- Test 1: drive to a full solution (perfect run) ----
{
  const { legalMoves, applyMove, fullState, HOLE_COUNT } = await import(pathToFileURL(path.join(ROOT, "engines/pegs-rules.js")).href);
  const { bestOutcome, solutionFrom } = await import(pathToFileURL(path.join(ROOT, "engines/pegs-rules.js")).href);

  const root = document.createElement("div");
  const { api, result } = makeApi();
  document.body.appendChild(root);
  engine.mount(root, { data: content.data }, api);

  // find the buttons in row order (15 of them)
  const buttons = Array.from(root.querySelectorAll("button")).filter(b => b.style.borderRadius === "50%");
  if (buttons.length !== 15) throw new Error(`expected 15 hole buttons, got ${buttons.length}`);

  const start = fullState(content.data.startEmpty);
  const memo = new Map();
  const sol = solutionFrom(start, memo);
  if (sol.length !== 13) throw new Error(`expected 13-move solution, got ${sol.length}`);

  for (const mv of sol) {
    buttons[mv.from].onclick();
    buttons[mv.to].onclick();
  }

  const finishArg = api.finish; // check via wrapper below instead
}

// redo with proper result capture
{
  const { fullState, solutionFrom, bestOutcome } = await import(pathToFileURL(path.join(ROOT, "engines/pegs-rules.js")).href);
  const root = document.createElement("div");
  let finishResult = null;
  const api = { finish: (r) => { finishResult = r; } };
  engine.mount(root, { data: content.data }, api);

  const buttons = Array.from(root.querySelectorAll("button")).filter(b => b.style.borderRadius === "50%");
  const start = fullState(content.data.startEmpty);
  const sol = solutionFrom(start, new Map());

  for (const mv of sol) {
    buttons[mv.from].onclick();
    buttons[mv.to].onclick();
  }

  if (!finishResult) throw new Error("api.finish did not fire on perfect run");
  if (!finishResult.perfect) throw new Error("expected perfect run to be marked perfect: " + JSON.stringify(finishResult));
  console.log("PERFECT RUN OK:", finishResult.headline, finishResult.stats);
  console.log("squares:\n" + finishResult.squares);
  console.log("notes:", finishResult.notes);
}

// ---- Test 2: deliberately bad run (imperfect, exercise undo + reset) ----
{
  const { fullState, legalMoves, applyMove } = await import(pathToFileURL(path.join(ROOT, "engines/pegs-rules.js")).href);
  const root = document.createElement("div");
  let finishResult = null;
  const api = { finish: (r) => { finishResult = r; } };
  engine.mount(root, { data: content.data }, api);

  const getButtons = () => Array.from(root.querySelectorAll("button")).filter(b => b.style.borderRadius === "50%");
  const undoBtn = Array.from(root.querySelectorAll("button")).find(b => b.textContent === "Undo");
  const resetBtn = Array.from(root.querySelectorAll("button")).find(b => b.textContent === "Reset");

  let state = fullState(content.data.startEmpty);
  let buttons = getButtons();

  // Make a couple of moves, then undo one, then reset, then greedily play
  // *worst*-ish moves (first legal move each time) to try to end up stuck
  // with more than one peg, to exercise the imperfect path.
  function move(from, to) {
    buttons[from].onclick();
    buttons[to].onclick();
  }

  const m1 = legalMoves(state)[0];
  move(m1.from, m1.to);
  state = applyMove(state, m1);

  undoBtn.onclick(); // undo back to start
  state = fullState(content.data.startEmpty);

  resetBtn.onclick(); // reset (no-op on state, but counted)

  // Now just always take the first legal move until stuck.
  let guard = 0;
  while (true) {
    const moves = legalMoves(state);
    if (moves.length === 0) break;
    const mv = moves[0];
    move(mv.from, mv.to);
    state = applyMove(state, mv);
    guard++;
    if (guard > 30) throw new Error("runaway loop, something's wrong");
  }

  if (!finishResult) throw new Error("api.finish did not fire on greedy run");
  console.log("GREEDY RUN OK:", finishResult.headline, finishResult.stats, "perfect=", finishResult.perfect);
  console.log("notes:", finishResult.notes);
}

console.log("ALL TESTS PASSED");
