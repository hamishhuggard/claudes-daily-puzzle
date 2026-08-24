import { JSDOM } from "jsdom";
const dom = new JSDOM("<!doctype html><html><body><div id=root></div></body></html>");
global.window = dom.window;
global.document = dom.window.document;
global.requestAnimationFrame = (fn) => setTimeout(fn, 0);
const engine = (await import("../engines/lightsout.js")).default;

// An unsolvable board: single lit cell in the interior is actually solvable
// for 5x5 (known). Use a board known outside the image of the toggle matrix:
// all 25 lit except one corner tends to be unsolvable for standard 5x5 lights out.
const badData = { rounds: [{ on: Array.from({length:25},(_,i)=>i).filter(i=>i!==0) }] };
let threw = false;
try {
  engine.mount(document.getElementById("root"), { data: badData }, { finish: () => {} });
} catch (e) {
  threw = true;
  console.log("threw as expected:", e.message);
}
if (!threw) throw new Error("expected mount to throw on unsolvable board");

// reset counting
const content = (await import("../tools/content/032.js")).default;
const root = document.getElementById("root");
root.innerHTML = "";
let finished = null;
engine.mount(root, { data: content.data }, { finish: (p) => { finished = p; } });
console.log("mounted content 032 ok");
