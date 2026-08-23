import { el } from "./shared.js";
import { findAllTriples, isTriple, ATTRS } from "./triples-rules.js";

/* ============================================================================
   TRIPLES — "Odd One In"
   ----------------------------------------------------------------------------
   Twelve cards, four attributes (count, shape, shading, colour), three values
   each. Three cards form a valid triple only if, for EVERY attribute
   independently, the three are all the same or all different. This is the
   card game Set, minus the deck and the shouting.

   It's a perception puzzle, not a deduction one — there's nothing to work out
   on paper, the difficulty is entirely in your eye jumping to "same shape"
   and stopping there instead of checking all four attributes. Genuinely
   timed, unlike the rest of the bank's search/deduction days.

   Content ships as an explicit 12-card tableau plus an authored
   `expectedTriples` count; at mount we brute-force all C(12,3)=220 combos
   (triples-rules.js, shared with the authoring script) and throw if the
   real count disagrees — a silent content typo here just makes the puzzle
   permanently harder or unsolvable, invisible to the player.
   ========================================================================== */

const SHAPE_PATHS = {
  diamond: (cx, cy, w, h) => `M ${cx} ${cy - h / 2} L ${cx + w / 2} ${cy} L ${cx} ${cy + h / 2} L ${cx - w / 2} ${cy} Z`,
  oval: (cx, cy, w, h) => {
    const rx = w / 2, ry = h / 2;
    return `M ${cx - rx} ${cy} a ${rx} ${ry} 0 1 0 ${w} 0 a ${rx} ${ry} 0 1 0 ${-w} 0 Z`;
  },
  squiggle: (cx, cy, w, h) => {
    // A wobbly bean shape — asymmetric on purpose so it can't be mistaken for an oval.
    const x0 = cx - w / 2, x1 = cx + w / 2, yTop = cy - h / 2, yBot = cy + h / 2;
    return `M ${x0} ${cy}
      C ${x0} ${yTop}, ${cx - w * 0.1} ${yTop - h * 0.12}, ${cx} ${yTop}
      C ${cx + w * 0.35} ${yTop + h * 0.1}, ${x1 - w * 0.1} ${yTop + h * 0.18}, ${x1} ${cy}
      C ${x1} ${yBot}, ${cx + w * 0.1} ${yBot + h * 0.12}, ${cx} ${yBot}
      C ${cx - w * 0.35} ${yBot - h * 0.1}, ${x0 + w * 0.1} ${yBot - h * 0.18}, ${x0} ${cy} Z`;
  },
};

// Colour-blind-safe triple: orange / blue / purple, no red-green pairing.
const COLORS = { orange: "#e8825a", blue: "#7fb3d5", purple: "#b98cd1" };

let symId = 0;

function shapeSVG(shape, shade, color) {
  const id = `tri-pat-${symId++}`;
  const path = SHAPE_PATHS[shape](24, 24, 34, 28);
  const stroke = COLORS[color];
  let fill;
  let defs = "";
  if (shade === "solid") fill = stroke;
  else if (shade === "empty") fill = "none";
  else {
    fill = `url(#${id})`;
    defs = `<pattern id="${id}" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
      <rect width="5" height="5" fill="none"/>
      <line x1="0" y1="0" x2="0" y2="5" stroke="${stroke}" stroke-width="2.2"/>
    </pattern>`;
  }
  return `<svg viewBox="0 0 48 48" width="48" height="48">
    <defs>${defs}</defs>
    <path d="${path}" fill="${fill}" stroke="${stroke}" stroke-width="3" stroke-linejoin="round"/>
  </svg>`;
}

function cardHTML(card) {
  const one = shapeSVG(card.shape, card.shade, card.color);
  return `<div class="triples-syms">${one.repeat(card.n)}</div>`;
}

const label = (card) =>
  `${card.n} ${card.color} ${card.shade} ${card.shape}${card.n === 1 ? "" : "s"}`;

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const d = puzzle.data;
    const cards = d.cards; // [{ n, shape, shade, color }] x 12

    const solution = findAllTriples(cards); // array of [i,j,k], sorted indices
    if (solution.length !== d.expectedTriples) {
      throw new Error(`triples: expected ${d.expectedTriples} valid triples, found ${solution.length}`);
    }
    const solutionKeys = new Set(solution.map((t) => t.join(",")));

    if (!document.getElementById("triples-style")) {
      const style = document.createElement("style");
      style.id = "triples-style";
      style.textContent = `
        .triples-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 12px 0; }
        .triples-card {
          background: var(--panel); border: 1px solid var(--line); border-radius: var(--r-sm, 10px);
          padding: 8px 4px; display: flex; align-items: center; justify-content: center;
          cursor: pointer; transition: border-color .12s, background .12s, transform .08s;
          min-height: 64px;
        }
        .triples-card:active { transform: scale(.97); }
        .triples-card.sel { border-color: var(--accent); background: rgba(232,130,90,.12); }
        .triples-card.locked { opacity: .32; pointer-events: none; }
        .triples-syms { display: flex; gap: 2px; flex-wrap: wrap; justify-content: center; align-items: center; }
        .triples-syms svg { width: 30px; height: 30px; }
        .order-feedback.good { color: var(--good); }
      `;
      document.head.appendChild(style);
    }

    root.appendChild(el("p", "q-detail center",
      "Tap three cards that form a set: for every one of count, shape, shading and colour, all three cards must match or all three must differ."));

    const found = new Set(); // indices into `solution`, by key
    let selected = [];
    let wrongTries = 0;
    const wrongLog = []; // [[i,j,k], breakingAttr][]
    const remainingEl = el("div", "q-detail center");
    const feedback = el("div", "order-feedback", "&nbsp;");
    const grid = el("div", "triples-grid");
    root.append(remainingEl, grid, feedback);

    function renderRemaining() {
      remainingEl.textContent = `${found.size} of ${solution.length} sets found`;
    }

    function renderGrid() {
      grid.innerHTML = "";
      cards.forEach((card, i) => {
        const btn = el("div", "triples-card");
        btn.innerHTML = cardHTML(card);
        if (selected.includes(i)) btn.classList.add("sel");
        if (lockedSet().has(i)) btn.classList.add("locked");
        btn.onclick = () => toggle(i);
        grid.appendChild(btn);
      });
    }

    // Two solution triples can share a card (that's a real feature of the
    // game, not a bug), so a card only locks once EVERY triple it belongs to
    // has been found — locking on first find would strand the other triple.
    const triplesByCard = cards.map((_, i) =>
      solution.map((t, fk) => (t.includes(i) ? fk : -1)).filter((fk) => fk >= 0));

    function lockedSet() {
      const s = new Set();
      cards.forEach((_, i) => {
        const owns = triplesByCard[i];
        if (owns.length && owns.every((fk) => found.has(fk))) s.add(i);
      });
      return s;
    }

    function toggle(i) {
      if (lockedSet().has(i)) return;
      const at = selected.indexOf(i);
      if (at >= 0) { selected.splice(at, 1); renderGrid(); return; }
      if (selected.length >= 3) return;
      selected.push(i);
      renderGrid();
      if (selected.length === 3) checkSelection();
    }

    function breakingAttr(a, b, c) {
      for (const attr of ATTRS) {
        const vs = [a[attr], b[attr], c[attr]];
        const allSame = vs[0] === vs[1] && vs[1] === vs[2];
        const allDiff = vs[0] !== vs[1] && vs[1] !== vs[2] && vs[0] !== vs[2];
        if (!allSame && !allDiff) return attr;
      }
      return null;
    }

    function checkSelection() {
      const [i, j, k] = selected.slice().sort((x, y) => x - y);
      const key = [i, j, k].join(",");
      const fkIdx = solution.findIndex((t) => t.join(",") === key);
      if (fkIdx >= 0) {
        found.add(fkIdx);
        feedback.className = "order-feedback show good";
        feedback.textContent = "Set! Locked in.";
      } else {
        wrongTries++;
        const attr = breakingAttr(cards[i], cards[j], cards[k]);
        wrongLog.push([[i, j, k], attr]);
        feedback.className = "order-feedback show";
        feedback.textContent = `Not a set — ${attr} breaks it.`;
      }
      selected = [];
      renderRemaining();
      renderGrid();
      if (found.size === solution.length) setTimeout(done, 500);
    }

    renderRemaining();
    renderGrid();

    function done() {
      root.innerHTML = "";
      const perfect = wrongTries === 0;
      const time = api.timeText();

      root.appendChild(el("div", "reveal-badge " + (perfect ? "good" : "ok"),
        `👁️ ${solution.length} sets found in ${time} · ${wrongTries} wrong`));

      const grid2 = el("div", "reveal-nums");
      grid2.append(
        el("div", null, `<span>Sets found</span><b>${solution.length}/${solution.length}</b>`),
        el("div", null, `<span>Wrong taps</span><b>${wrongTries}</b>`),
        el("div", null, `<span>Time</span><b>${time}</b>`),
      );
      root.appendChild(grid2);

      const squares = "🟢".repeat(solution.length) + "❌".repeat(Math.min(wrongTries, 5)) + ` ⏱️`;

      const notes = solution.map((t, idx) => {
        const [i, j, k] = t;
        const parts = ATTRS.map((attr) => {
          const vs = [cards[i][attr], cards[j][attr], cards[k][attr]];
          const same = vs[0] === vs[1] && vs[1] === vs[2];
          return `${attr} ${same ? "all " + vs[0] : "all different"}`;
        });
        return `✅ Set ${idx + 1}: ${label(cards[i])} · ${label(cards[j])} · ${label(cards[k])} — ${parts.join(", ")}.`;
      });
      wrongLog.forEach(([[i, j, k], attr]) => {
        notes.push(`❌ You tried ${label(cards[i])} · ${label(cards[j])} · ${label(cards[k])} — broken by ${attr}.`);
      });

      api.finish({
        headline: perfect
          ? `All ${solution.length} sets, no wrong taps — ${time}`
          : `All ${solution.length} sets in ${time}, ${wrongTries} wrong tap${wrongTries === 1 ? "" : "s"}`,
        squares,
        stats: [
          ["Sets found", `${solution.length}/${solution.length}`],
          ["Wrong taps", String(wrongTries)],
          ["Time", time],
        ],
        perfect,
        extra: [
          perfect ? "👁️ clean sweep" : `❌ ${wrongTries} wrong tap${wrongTries === 1 ? "" : "s"}`,
          `⏱️ ${time}`,
        ],
        notes,
      });
    }
  },
};
