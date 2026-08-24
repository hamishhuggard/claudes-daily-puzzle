import { JSDOM } from "/Users/hamish/Desktop/claudes-daily-puzzle/node_modules/jsdom/lib/api.js";

const dom = new JSDOM("<!doctype html><html><body></body></html>");
global.window = dom.window;
global.document = dom.window.document;

const ROOT = "/Users/hamish/Desktop/claudes-daily-puzzle";

function revive(v) {
  if (typeof v === "string" && v.startsWith("fn:")) return new Function(`return (${v.slice(3)})`)();
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === "object") { const o = {}; for (const [k, val] of Object.entries(v)) o[k] = revive(val); return o; }
  return v;
}

async function load(n, type) {
  const content = (await import(`${ROOT}/tools/content/0${n}.js`)).default;
  const engine = (await import(`${ROOT}/engines/${type}.js`)).default;
  return { engine, puzzle: { n, ...content, data: revive(content.data) } };
}

const teardowns = [];
function mount(engine, puzzle) {
  const root = document.createElement("div");
  document.body.appendChild(root);
  let finished = null;
  engine.mount(root, puzzle, {
    timeText: () => "0:00",
    onTeardown: (fn) => teardowns.push(fn),
    finish: (r) => { finished = r; },
  });
  return { root, done: () => finished };
}

const q = (root, sel) => [...root.querySelectorAll(sel)];
const byText = (root, sel, text) =>
  q(root, sel).find((e) => e.textContent.trim().toLowerCase().includes(text.toLowerCase()));
function click(root, sel, text) {
  const b = byText(root, sel, text);
  if (!b) throw new Error(`no ${sel} matching "${text}"; saw: ` + q(root, sel).map((x) => x.textContent.trim()).join(" | "));
  if (b.disabled) throw new Error(`"${text}" is disabled`);
  b.click();
  return b;
}

const report = (label, r) => {
  if (!r) throw new Error(`${label}: finish never fired`);
  console.log(`  ${label}: ${r.headline} | ${r.squares} | perfect=${r.perfect}`);
  if (!r.headline || !r.stats) throw new Error(`${label}: malformed result`);
  return r;
};

/* ---------------- #36 gridlock ---------------- */
{
  const { engine, puzzle } = await load(36, "gridlock");
  const { solve } = await import(`${ROOT}/engines/gridlock-rules.js`);

  // Play both lots along the optimal path the solver returns.
  const m = mount(engine, puzzle);
  for (const lot of puzzle.data.lots) {
    const sol = solve(lot.vehicles, lot.size);
    let vs = lot.vehicles.map((v) => ({ ...v }));
    for (const mv of sol.path) {
      const v = vs[mv.car];
      const [r, c] = v.horiz
        ? [v.r, mv.delta > 0 ? v.c + v.len - 1 + mv.delta : v.c + mv.delta]
        : [mv.delta > 0 ? v.r + v.len - 1 + mv.delta : v.r + mv.delta, v.c];
      // select the car, then tap the destination square
      const cars = q(m.root, ".grid-car");
      cars[mv.car].click();
      const size = lot.size;
      const cells = q(m.root, ".grid-cell");
      const cell = cells[r * size + c];
      if (!cell || cell.disabled) throw new Error(`#36: destination ${r},${c} not offered`);
      cell.click();
      vs = vs.map((x, i) => i !== mv.car ? x : (x.horiz ? { ...x, c: x.c + mv.delta } : { ...x, r: x.r + mv.delta }));
    }
    click(m.root, "button", lot === puzzle.data.lots.at(-1) ? "See your score" : "Next lot");
  }
  const r = report("#36 gridlock (par play)", m.done());
  if (!r.perfect) throw new Error("#36: optimal play should be perfect");
}

/* ---------------- #37 bridges ---------------- */
{
  const { engine, puzzle } = await load(37, "bridges");
  const { solutions } = await import(`${ROOT}/engines/bridges-rules.js`);
  const { spans, found } = solutions(puzzle.data.islands, 2);
  const answer = found[0];

  const m = mount(engine, puzzle);
  // Tap each span to its answer count, in an order that never overfills.
  for (let pass = 1; pass <= 2; pass++) {
    spans.forEach((s, i) => {
      if (answer[i] < pass) return;
      const isles = q(m.root, ".brg-isle");
      isles[s.a].click();
      q(m.root, ".brg-isle")[s.b].click();
    });
  }
  click(m.root, "button", "See your score");
  const r = report("#37 bridges (exact solve)", m.done());
  if (!r.perfect) throw new Error("#37: exact solve should be perfect, got " + JSON.stringify(r.stats));
}

/* ---------------- #38 groups ---------------- */
{
  const { engine, puzzle } = await load(38, "groups");
  const m = mount(engine, puzzle);
  for (const g of puzzle.data.groups) {
    for (const item of g.items) {
      const t = q(m.root, ".grp-tile").find((b) => b.textContent.trim() === item);
      if (!t) throw new Error(`#38: tile "${item}" missing`);
      t.click();
    }
    click(m.root, "button", "Submit");
  }
  click(m.root, "button", "See your score");
  const r = report("#38 groups (clean)", m.done());
  if (!r.perfect) throw new Error("#38: clean solve should be perfect");

  // And a run that burns all four lives.
  const m2 = mount(engine, puzzle);
  for (let k = 0; k < 4; k++) {
    const tiles = q(m2.root, ".grp-tile");
    // deliberately mix groups
    [0, 1, 2, 3].forEach((i) => tiles[(i * 5 + k) % tiles.length].click());
    const sub = byText(m2.root, "button", "Submit");
    if (sub && !sub.disabled) sub.click();
    else q(m2.root, ".grp-tile").slice(0, 4).forEach((t) => t.click()),
         byText(m2.root, "button", "Submit")?.click();
  }
  click(m2.root, "button", "See your score");
  report("#38 groups (lives burned)", m2.done());
}

/* ---------------- #39 sweep ---------------- */
{
  const { engine, puzzle } = await load(39, "sweep");
  const { fullySolvable } = await import(`${ROOT}/engines/sweep-rules.js`);
  const mines = new Set(puzzle.data.mines);
  const { h, w } = puzzle.data;

  const m = mount(engine, puzzle);
  // Dig every safe square. (The engine floods, so most clicks are no-ops.)
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    if (mines.has(`${r},${c}`)) continue;
    const cells = q(m.root, ".swp-cell");
    const cell = cells[r * w + c];
    if (cell && !cell.classList.contains("open")) cell.click();
  }
  click(m.root, "button", "See your score");
  const r = report("#39 sweep (clean)", m.done());
  if (!r.perfect) throw new Error("#39: clean sweep should be perfect");

  // A run that digs a mine first.
  const m2 = mount(engine, puzzle);
  const [mr, mc] = puzzle.data.mines[0].split(",").map(Number);
  q(m2.root, ".swp-cell")[mr * w + mc].click();
  for (let rr = 0; rr < h; rr++) for (let cc = 0; cc < w; cc++) {
    if (mines.has(`${rr},${cc}`)) continue;
    const cell = q(m2.root, ".swp-cell")[rr * w + cc];
    if (cell && !cell.classList.contains("open")) cell.click();
  }
  click(m2.root, "button", "See your score");
  const r2 = report("#39 sweep (one mine dug)", m2.done());
  if (r2.perfect) throw new Error("#39: digging a mine must not be perfect");
}

/* ---------------- #40 crates ---------------- */
{
  const { engine, puzzle } = await load(40, "crates");
  const { solve } = await import(`${ROOT}/engines/crates-rules.js`);
  const m = mount(engine, puzzle);

  for (let i = 0; i < puzzle.data.rooms.length; i++) {
    const rows = puzzle.data.rooms[i].rows;
    const cols = Math.max(...rows.map((x) => x.length));
    const padded = rows.map((x) => x.padEnd(cols, " "));
    const room = padded.map((x) => x.split("").map((ch) => (ch === "#" ? "#" : " ")));
    let worker = -1; const crates = [], goals = [];
    padded.forEach((line, r) => line.split("").forEach((ch, c) => {
      const idx = r * cols + c;
      if (ch === "$" || ch === "*") crates.push(idx);
      if (ch === "." || ch === "*" || ch === "+") goals.push(idx);
      if (ch === "@" || ch === "+") worker = idx;
    }));
    const sol = solve(room, worker, crates, goals, cols);
    const KEY = ["up", "down", "left", "right"];
    for (const dir of sol.path) {
      const b = q(m.root, ".crt-key").find((x) => x.getAttribute("aria-label") === KEY[dir]);
      if (!b) throw new Error("#40: missing key " + KEY[dir]);
      b.click();
    }
    click(m.root, "button", i === puzzle.data.rooms.length - 1 ? "See your score" : "Next room");
  }
  const r = report("#40 crates (par play)", m.done());
  if (!r.perfect) throw new Error("#40: optimal play should be perfect");
}

/* ---------------- #41 zebra ---------------- */
{
  const { engine, puzzle } = await load(41, "zebra");
  const { solve } = await import(`${ROOT}/engines/zebra-rules.js`);
  const answer = solve(puzzle.data.n, puzzle.data.categories, puzzle.data.clues, 2)[0];
  const n = puzzle.data.n, cats = puzzle.data.categories;

  const m = mount(engine, puzzle);
  // Rows render top floor first, so row index = n-1-pos.
  for (let pos = 0; pos < n; pos++) {
    for (let ci = 0; ci < cats.length; ci++) {
      const cells = q(m.root, ".zeb-cell");
      const idx = (n - 1 - pos) * cats.length + ci;
      cells[idx].click();
      const item = answer[ci][pos];
      const opts = q(m.root, ".zeb-sheet .option");
      if (!opts.length) throw new Error("#41: picker did not open");
      opts[item].click();
    }
  }
  click(m.root, "button", "Submit");
  click(m.root, "button", "See your score");
  const r = report("#41 zebra (first try)", m.done());
  if (!r.perfect) throw new Error("#41: correct first submission should be perfect");
}

/* ---------------- #42 knowing ---------------- */
{
  const { engine, puzzle } = await load(42, "knowing");
  const { check } = await import(`${ROOT}/engines/knowing-rules.js`);
  const m = mount(engine, puzzle);

  puzzle.data.rounds.forEach((rd, i) => {
    const answer = check(rd.candidates, rd.script).answer;
    const label = puzzle.data.axes.b.items[answer[1]];
    const rowLabel = puzzle.data.axes.a.items[answer[0]];
    // strike everything except the answer
    q(m.root, ".knw-row").forEach((row) => {
      const rl = row.querySelector(".knw-rowlabel").textContent.trim();
      row.querySelectorAll(".knw-cand").forEach((b) => {
        const isAnswer = rl === rowLabel && b.textContent.trim() === label;
        if (!isAnswer && !b.classList.contains("out")) b.click();
      });
    });
    click(m.root, "button", "Lock in");
    click(m.root, "button", i === puzzle.data.rounds.length - 1 ? "See your score" : "Next round");
  });
  const r = report("#42 knowing (clean)", m.done());
  if (!r.perfect) throw new Error("#42: clean play should be perfect");
}

teardowns.forEach((fn) => fn());
console.log("\nall seven engines played through to a result.");
