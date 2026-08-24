import { JSDOM } from "jsdom";
import { EFFECT, N, minimalSolution, cellsOf } from "../engines/lightsout-rules.js";
import content from "../tools/content/032.js";

const dom = new JSDOM("<!doctype html><html><body><div id=root></div></body></html>");
global.window = dom.window;
global.document = dom.window.document;
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);

const engineMod = await import("../engines/lightsout.js");
const engine = engineMod.default;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function run(pressPlan, label) {
  const root = document.getElementById("root");
  root.innerHTML = "";
  let finished = null;
  const api = { finish: (payload) => { finished = payload; } };
  engine.mount(root, { data: content.data }, api);

  // Drive round by round using pressPlan[roundIdx] = array of cell indices to click
  for (const round of pressPlan) {
    for (const cellIdx of round) {
      const btn = root.querySelectorAll("button.lo-cell")[cellIdx];
      btn.onclick();
      await sleep(0);
    }
    await sleep(400); // let the round-transition/finish timeout fire
  }
  console.log(label, "finished:", !!finished, finished && { headline: finished.headline, squares: finished.squares, perfect: finished.perfect, stats: finished.stats });
  return finished;
}

// Compute true minimal presses per round from content.
const boards = content.data.rounds.map((r) => {
  let b = 0; for (const c of r.on) b |= 1 << c; return b;
});
const sols = boards.map((b) => minimalSolution(b));
console.log("pars:", sols.map((s) => s.taps));

// Perfect play: press exactly the minimal solution cells for each round.
const perfectPlan = sols.map((s) => cellsOf(s.pressMask));
const f1 = await run(perfectPlan, "PERFECT");
if (!f1 || !f1.perfect) throw new Error("expected perfect finish on minimal play");

// Imperfect play: press minimal solution cells for round 1, but round 2 press
// an extra pair of cells (adds 2 wasted taps, still solves since same cell
// pressed twice cancels... use two DIFFERENT cells that happen to cancel via
// null space, or just press one cell four times -> net 0 effect but +4 taps
// then still do minimal). Simplest imperfect: press minimal cells for round1,
// and for round2 press one extra cell, then press it again (cancels), plus
// minimal cells -> more taps than par, still solves.
const wastefulRound2 = [];
const extraCell = 0;
wastefulRound2.push(extraCell, extraCell); // no-op pair, wastes 2 taps
wastefulRound2.push(...cellsOf(sols[1].pressMask));
const imperfectPlan = [cellsOf(sols[0].pressMask), wastefulRound2];
const f2 = await run(imperfectPlan, "IMPERFECT");
if (!f2 || f2.perfect) throw new Error("expected imperfect finish (over par) on wasteful play");
if (!f2.squares.includes("🌙")) throw new Error("expected over-par marker in squares");

console.log("ALL OK");
