import { JSDOM } from "jsdom";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = "/Users/hamish/Desktop/claudes-daily-puzzle";

const dom = new JSDOM("<!doctype html><body></body>", { url: "http://localhost/" });
global.window = dom.window;
global.document = dom.window.document;

const { default: content } = await import(pathToFileURL(path.join(ROOT, "tools/content/028.js")).href);
const { default: engine } = await import(pathToFileURL(path.join(ROOT, "engines/stones.js")).href);
const rules = await import(pathToFileURL(path.join(ROOT, "engines/stones-rules.js")).href);

const root = document.createElement("div");
document.body.appendChild(root);

let finished = null;
const api = {
  timeText: () => "0:00",
  onTeardown: () => {},
  finish: (r) => { finished = r; },
};

const puzzle = { ...content };

// ---- 1. verify every starting position is a first-player win, via the solver ----
for (const p of content.data.positions) {
  const win = rules.canWin(p.heaps, p.variant, p.maxTake);
  console.log(`solver: position "${p.label}" heaps=${JSON.stringify(p.heaps)} variant=${p.variant} maxTake=${p.maxTake} -> P1 win = ${win}`);
  if (!win) throw new Error(`position ${p.id} is NOT a first-player win!`);
}

// ---- 2. mount the engine and play it, deliberately winning every position on
//         the first try (so restarts should end at 0) ----
engine.mount(root, puzzle, api);

function findConfirm() {
  return [...root.querySelectorAll("button")].find((b) => b.textContent.startsWith("Take "));
}
function findStones() {
  return [...root.querySelectorAll(".stones-stone")].filter((b) => !b.disabled);
}
function findAdvance() {
  return [...root.querySelectorAll("button")].find((b) =>
    b.textContent === "Next position" || b.textContent === "See your score" || b.textContent === "Try this position again");
}

let guard = 0;
while (!finished && guard++ < 500) {
  const advance = findAdvance();
  if (advance && !findConfirm()) {
    if (advance.textContent === "Try this position again") throw new Error("engine forced a restart — opponent beat an optimal player!");
    advance.click();
    continue;
  }
  const selectable = findStones();
  if (!selectable.length) throw new Error("no move available and game not over");
  // Click the first (leftmost) selectable stone in the first heap that has one —
  // this is not necessarily optimal on its own, so instead compute the optimal
  // move via the solver and click the stone that produces it.
  // Recover current heaps from the rendered rows.
  const rows = [...root.querySelectorAll(".stones-row")];
  const heaps = rows.map((r) => r.querySelectorAll(".stones-stone").length);
  const posIdx = content.data.positions.findIndex((p) =>
    root.querySelector(".q-num").textContent.includes(p.label));
  const p = content.data.positions[posIdx];
  const mv = rules.bestMove(heaps, p.variant, p.maxTake);
  // Find the stone whose click yields exactly `mv.take` stones from heap mv.heap:
  // stone at index (size - take) in that row.
  const row = rows[mv.heap];
  const stones = [...row.querySelectorAll(".stones-stone")];
  const stone = stones[stones.length - mv.take];
  if (stone.disabled) throw new Error(`solver move take=${mv.take} from heap ${mv.heap} not selectable in UI`);
  stone.click();
  const confirm = findConfirm();
  if (!confirm) throw new Error("confirm button did not appear after selecting stones");
  if (!confirm.textContent.includes(`Take ${mv.take}`)) throw new Error(`confirm button text wrong: "${confirm.textContent}"`);
  confirm.click();
}

if (!finished) throw new Error("never reached api.finish");

console.log("\n--- optimal playthrough result ---");
console.log(JSON.stringify(finished, null, 2));

if (!finished.perfect) throw new Error("optimal play should have been perfect (0 restarts)");
if (finished.squares !== "🟩🟩🟩") throw new Error(`expected all-green squares, got ${finished.squares}`);
if (!finished.headline.includes("first try")) throw new Error(`headline didn't reflect a clean run: ${finished.headline}`);

console.log("\nOK: optimal playthrough asserted perfect=true, squares=🟩🟩🟩, headline mentions first try.");

// ---- 3. now play position 1 with a deliberate blunder and confirm the
//         opponent punishes it (forces a loss), then confirm restart works ----
{
  const root2 = document.createElement("div");
  document.body.appendChild(root2);
  let finished2 = null;
  const api2 = { timeText: () => "0:00", onTeardown: () => {}, finish: (r) => { finished2 = r; } };
  engine.mount(root2, puzzle, api2);

  // Position 1: heaps=[13], normal, maxTake 3. Correct move is take 1 (leave 12).
  // Blunder: take 3 (leave 10), which is NOT a multiple of 4 -> opponent should win.
  function stonesRow2() { return [...root2.querySelectorAll(".stones-stone")]; }
  const row = stonesRow2();
  const size = row.length; // 13
  const blunderStone = row[size - 3]; // selects last 3 -> take 3
  blunderStone.click();
  const confirm = [...root2.querySelectorAll("button")].find((b) => b.textContent.startsWith("Take "));
  if (confirm.textContent !== "Take 3 from the heap") throw new Error(`unexpected confirm label: ${confirm.textContent}`);
  confirm.click();

  console.log("\nafter blunder:", root2.querySelector(".fairy-status").innerHTML);

  // Keep playing (arbitrarily) until the position resolves naturally — the
  // opponent, now in a forced win, must never hand it back regardless of
  // what the player does from here.
  let guard2 = 0;
  let restartBtn = null;
  while (!restartBtn && guard2++ < 100) {
    restartBtn = [...root2.querySelectorAll("button")].find((b) => b.textContent === "Try this position again");
    if (restartBtn) break;
    const nextBtn = [...root2.querySelectorAll("button")].find((b) =>
      b.textContent === "Next position" || b.textContent === "See your score");
    if (nextBtn) throw new Error("position resolved as a WIN after a blunder — opponent handed the win back!");
    const stones = [...root2.querySelectorAll(".stones-stone")].filter((b) => !b.disabled);
    if (!stones.length) throw new Error("stuck: no move available and no resolution button shown");
    stones[0].click(); // take the largest legal amount from whichever heap that stone belongs to
    const confirm = [...root2.querySelectorAll("button")].find((b) => b.textContent.startsWith("Take "));
    confirm.click();
  }
  if (!restartBtn) throw new Error("expected a restart prompt after the blunder was punished, found none");
  console.log("after full play-out:", root2.querySelector(".fairy-status").innerHTML);
  console.log("OK: opponent punished the blunder and offered a restart, as required.");

  restartBtn.click();
  const freshRow = root2.querySelectorAll(".stones-row .stones-stone");
  if (freshRow.length !== 13) throw new Error("restart did not reset the heap to 13 stones");
  console.log("OK: restart reset position 1 back to 13 stones.");
}

console.log("\nALL CHECKS PASSED");
