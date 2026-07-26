import { el, rng } from "./shared.js";

/* Mastermind for sequences. Score: checks used. */
export default {
  usesTimer: false,

  mount(root, puzzle, api) {
    const d = puzzle.data;
    const correct = d.items.map((_, i) => i);

    // Deterministic shuffle so everyone gets the same starting arrangement.
    let order = correct.slice();
    const rand = rng(d.shuffleSeed);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    if (order.every((v, i) => v === i)) order.reverse();

    let checks = 0;

    root.appendChild(el("p", "q-detail center", d.prompt +
      " Check as often as you like — I'll tell you how many are in the right place, but not which."));

    const list = el("div", "order-list");
    const feedback = el("div", "order-feedback", "&nbsp;");
    const checkBtn = el("button", "primary", "Check");
    root.append(list, feedback, checkBtn);

    function move(from, to) {
      if (to < 0 || to >= order.length) return;
      [order[from], order[to]] = [order[to], order[from]];
      render();
    }

    function render() {
      list.innerHTML = "";
      order.forEach((itemIdx, pos) => {
        const row = el("div", "order-row");
        row.appendChild(el("span", "order-num", String(pos + 1)));
        row.appendChild(el("span", "order-label", d.items[itemIdx].label));
        const up = el("button", "nudge", "▲");
        up.disabled = pos === 0;
        up.setAttribute("aria-label", "Move up");
        up.onclick = () => move(pos, pos - 1);
        const dn = el("button", "nudge", "▼");
        dn.disabled = pos === order.length - 1;
        dn.setAttribute("aria-label", "Move down");
        dn.onclick = () => move(pos, pos + 1);
        const ctrl = el("div", "nudges");
        ctrl.append(up, dn);
        row.appendChild(ctrl);
        list.appendChild(row);
      });
    }

    checkBtn.onclick = () => {
      checks++;
      const right = order.filter((v, i) => v === correct[i]).length;
      if (right === order.length) return done();
      feedback.className = "order-feedback show";
      feedback.textContent = `${right} of ${order.length} in the right place · check ${checks}`;
    };

    function done() {
      root.querySelectorAll(".order-row").forEach((r, i) => {
        r.classList.add("right");
        r.querySelector(".nudges").remove();
        r.appendChild(el("span", "order-when", d.items[order[i]].when));
      });
      api.finish({
        headline: `${checks} check${checks === 1 ? "" : "s"}`,
        // One square per check: amber for each miss, green for the one that landed.
        squares: "🟨".repeat(Math.min(checks - 1, 20)) + "🟩",
        stats: [
          ["Checks used", String(checks)],
          ["Verdict", checks === 1 ? "Cold read" : checks <= 3 ? "Sharp" : checks <= 6 ? "Solid" : "Brute force"],
        ],
        perfect: checks === 1,
        notes: d.items.map((it) => `<b>${it.when}</b> — ${it.label}. ${it.note}`),
      });
    }

    render();
  },
};
