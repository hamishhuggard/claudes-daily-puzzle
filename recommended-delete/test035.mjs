import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body></body></html>");
global.window = dom.window;
global.document = dom.window.document;

const engineMod = await import("/Users/hamish/Desktop/claudes-daily-puzzle/engines/futoshiki.js");
const engine = engineMod.default;
const contentMod = await import("/Users/hamish/Desktop/claudes-daily-puzzle/tools/content/035.js");
const content = contentMod.default;

// revive fn: strings (none expected here, but mirror the real pipeline)
function revive(v) {
  if (typeof v === "string" && v.startsWith("fn:")) return new Function(`return (${v.slice(3)})`)();
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === "object") { const o = {}; for (const [k, val] of Object.entries(v)) o[k] = revive(val); return o; }
  return v;
}
const puzzle = { data: revive(content.data) };

function run(label, driver) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  let finished = null;
  const api = { finish: (payload) => { finished = payload; } };
  engine.mount(root, puzzle, api);
  driver(root);
  if (!finished) throw new Error(`${label}: api.finish never fired`);
  console.log(`${label}: OK`, JSON.stringify({ headline: finished.headline, squares: finished.squares, perfect: finished.perfect, stats: finished.stats, notesCount: finished.notes.length }));
  return finished;
}

// Recompute the solution the same way the engine does, so the test driver
// can play a legit unaided solve.
const { countSolutions } = await import("/Users/hamish/Desktop/claudes-daily-puzzle/engines/futoshiki-rules.js");
const sol = countSolutions(puzzle.data.n, puzzle.data.constraints, puzzle.data.givens, 2);
if (sol.length !== 1) throw new Error("not unique: " + sol.length);
const solution = sol[0];
console.log("solution:", JSON.stringify(solution));

function clickCell(root, r, c) {
  root.querySelectorAll(".futo-grid > div").forEach(() => {}); // no-op, just ensure grid exists
}

function selectAndFill(root, r, c, v) {
  // find the cell div: it's a .futo-cell positioned at gridColumn=2c+1, gridRow=2r+1
  const cells = [...root.querySelectorAll(".futo-cell")];
  const target = cells.find((el) => Number(el.style.gridColumn) === 2 * c + 1 && Number(el.style.gridRow) === 2 * r + 1);
  if (!target) throw new Error(`cell R${r}C${c} not found`);
  target.click();
  const digitBtns = [...root.querySelectorAll(".futo-pad button")];
  digitBtns[v - 1].click();
}

// --- Perfect unaided playthrough ---
run("perfect solve", (root) => {
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) selectAndFill(root, r, c, solution[r][c]);
});

// --- Imperfect: one mistake then a hint, then finish correctly ---
run("mistake + hint", (root) => {
  // deliberately place a row duplicate: put solution[0][0]'s value into (0,1) too if that violates
  const wrongVal = solution[0][0]; // definitely a row dup at (0,0) vs (0,1)
  selectAndFill(root, 0, 0, wrongVal);
  selectAndFill(root, 0, 1, wrongVal); // triggers mistake (row dup)
  selectAndFill(root, 0, 1, solution[0][1]); // fix it

  // use a hint
  const hintBtn = [...root.querySelectorAll("button")].find((b) => b.textContent.includes("Hint"));
  hintBtn.click();

  // fill everything else with the true solution (hint already placed one cell)
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const cells = [...root.querySelectorAll(".futo-cell")];
    const target = cells.find((el) => Number(el.style.gridColumn) === 2 * c + 1 && Number(el.style.gridRow) === 2 * r + 1);
    if (target.classList.contains("given")) continue; // hinted/given already correct
    selectAndFill(root, r, c, solution[r][c]);
  }
});

console.log("ALL TESTS PASSED");
