import { el } from "./shared.js";
import { solve, safe, moves, apply, rowerMask, parIfNeverTired } from "./ferry-rules.js";

/* ============================================================================
   FERRY — "one at the oars"
   ----------------------------------------------------------------------------
   Get everyone across. The boat holds two, only some of them can row, and
   nobody may row two crossings in a row — whoever rowed it over is too tired
   to row it back.

   The classic has a boatman who is always aboard, so the only question is the
   order people go in. Here the oars are a resource with a cooling-off period:
   somebody able to row has to already be standing on the far bank when the
   boat arrives, which sometimes means ferrying a rower back for no other
   reason than to have them available later.

   Par is the true minimum, from a breadth-first sweep of every
   (who is across, which side the boat is on, who rowed last).
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const spec = { people: puzzle.data.people, feuds: puzzle.data.feuds };
    const n = spec.people.length;
    const ALL = (1 << n) - 1;

    const best = solve(spec);
    if (!best) throw new Error("ferry: nobody can get across");
    const PAR = best.par;
    const UNTIRED = parIfNeverTired(spec);
    const ROWERS = rowerMask(spec);

    let farMask = 0, boatFar = false, lastRower = -1;
    let aboard = 0;                       // who is currently in the boat
    let crossings = 0, hints = 0, over = false, message = "";

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    const nameOf = (i) => spec.people[i].name;
    const bankOf = (i) => ((farMask & (1 << i)) ? 1 : 0);

    function toggle(i) {
      if (over) return;
      if (bankOf(i) !== (boatFar ? 1 : 0)) return;      // not on the boat's bank
      if (aboard & (1 << i)) aboard &= ~(1 << i);
      else if (popcount(aboard) < 2) aboard |= (1 << i);
      message = "";
      render();
    }

    const popcount = (m) => { let c = 0; while (m) { c += m & 1; m >>= 1; } return c; };

    function cross(rower) {
      const ns = apply(farMask, boatFar, aboard);
      if (!safe(spec, ns.farMask, ns.boatFar)) {
        message = "That would leave a feuding pair alone on a bank.";
        render();
        return;
      }
      farMask = ns.farMask; boatFar = ns.boatFar;
      lastRower = rower;
      aboard = 0;
      crossings++;
      message = "";
      if (farMask === ALL) over = true;
      render();
    }

    function hint() {
      const rest = solve(spec, { farMask, boatFar, lastRower });
      if (!rest || !rest.route.length) { message = "No crossing helps from here."; render(); return; }
      hints++;
      const { load, rower } = rest.route[0];
      aboard = load;
      const who = spec.people.filter((_, i) => load & (1 << i)).map((p) => p.name).join(" and ");
      message = `Hint: ${who}, rowed by ${nameOf(rower)}.`;
      cross(rower);
    }

    /* Who could take the oars on this crossing, given who is aboard. */
    function eligible() {
      const out = [];
      for (let i = 0; i < n; i++) {
        if (!(aboard & (1 << i))) continue;
        if (!(ROWERS & (1 << i))) continue;
        if (i === lastRower) continue;
        out.push(i);
      }
      return out;
    }

    function bank(side) {
      const box = el("div", "fry-bank" + (boatFar === (side === 1) ? " hasboat" : ""));
      box.appendChild(el("div", "fry-banklabel",
        side === 0 ? "This side" : "Far side"));
      const row = el("div", "fry-people");
      for (let i = 0; i < n; i++) {
        if (bankOf(i) !== side) continue;
        if (aboard & (1 << i)) continue;                // shown in the boat
        const p = spec.people[i];
        const b = el("button", "fry-person"
          + (p.rows ? " rower" : "")
          + (i === lastRower ? " tired" : ""));
        b.textContent = p.name + (p.rows ? (i === lastRower ? " (winded)" : " ⚓") : "");
        b.disabled = over || bankOf(i) !== (boatFar ? 1 : 0);
        b.onclick = () => toggle(i);
        row.appendChild(b);
      }
      if (!row.children.length) row.appendChild(el("span", "fry-empty", "—"));
      box.appendChild(row);
      return box;
    }

    function render() {
      wrap.innerHTML = "";

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Crossings</small><b>${crossings}</b>`),
        el("div", "grid-score-cell", `<small>Par</small><b>${PAR}</b>`),
        el("div", "grid-score-cell", `<small>Across</small><b>${popcount(farMask)}/${n}</b>`),
      );
      wrap.appendChild(head);

      wrap.appendChild(bank(0));

      /* The boat sits between the banks and shows which side it is on. */
      const boat = el("div", "fry-boat" + (boatFar ? " far" : ""));
      boat.appendChild(el("div", "fry-banklabel", boatFar ? "Boat · far side" : "Boat · this side"));
      const load = el("div", "fry-people");
      for (let i = 0; i < n; i++) {
        if (!(aboard & (1 << i))) continue;
        const p = spec.people[i];
        const b = el("button", "fry-person aboard" + (p.rows ? " rower" : ""));
        b.textContent = p.name + (p.rows ? " ⚓" : "");
        b.disabled = over;
        b.onclick = () => toggle(i);
        load.appendChild(b);
      }
      if (!load.children.length) load.appendChild(el("span", "fry-empty", "empty"));
      boat.appendChild(load);
      wrap.appendChild(boat);

      wrap.appendChild(bank(1));

      if (!over) {
        const go = el("div", "fry-go");
        const can = eligible();
        if (!aboard) {
          go.appendChild(el("span", "fry-note", "Tap people on the boat's side to put them aboard."));
        } else if (!can.length) {
          go.appendChild(el("span", "fry-note",
            "Nobody aboard can row this one — a rower who isn't winded has to be in the boat."));
        } else {
          for (const r of can) {
            const b = el("button", "primary compact", `Row across · ${nameOf(r)}`);
            b.onclick = () => cross(r);
            go.appendChild(b);
          }
        }
        wrap.appendChild(go);
      }

      const feuds = el("p", "q-detail center fry-feuds");
      feuds.innerHTML = "<b>Never leave alone together:</b> "
        + spec.feuds.map(([a, b]) => `${nameOf(a)} & ${nameOf(b)}`).join(" · ");
      wrap.appendChild(feuds);

      const msg = el("p", "q-detail center fry-msg");
      msg.innerHTML = over
        ? (crossings === PAR
            ? `Everyone across in <b>${PAR} crossings</b> — the true minimum.`
            : `Everyone across in ${crossings} crossings, against a par of ${PAR}.`)
        : message
          || (lastRower >= 0
              ? `${nameOf(lastRower)} rowed the last one and can't row this one.`
              : "Anyone marked ⚓ can row. Nobody may row twice in a row.");
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = finish;
        bar.appendChild(b);
      } else {
        const h = el("button", "ghost compact", "Hint (costs you)");
        h.onclick = hint;
        const rs = el("button", "ghost compact", "Start again");
        rs.disabled = crossings === 0;
        rs.onclick = () => {
          farMask = 0; boatFar = false; lastRower = -1; aboard = 0; crossings = 0;
          message = "Back to the start."; render();
        };
        bar.append(h, rs);
      }
      wrap.appendChild(bar);
    }

    function finish() {
      const spare = crossings - PAR;
      const squares = [
        spare === 0 ? "🟩" : spare <= 4 ? "🟨" : "🟧",
        hints === 0 ? "🟩" : hints <= 2 ? "🟨" : "🟧",
      ].join("") + (spare === 0 && hints === 0 ? "🟩🟩🟩" : spare === 0 ? "🟩🟩🟨" : "🟩🟨🟧");

      api.finish({
        headline: spare === 0
          ? `Everyone across in ${PAR}, the minimum`
          : `${crossings} crossings against par ${PAR}`,
        squares,
        stats: [
          ["Crossings", String(crossings)],
          ["Par", String(PAR)],
          ["Hints", String(hints)],
        ],
        perfect: spare === 0 && hints === 0,
        notes: [
          `<b>Par is ${PAR} crossings</b><br>`
          + `If a rower could take every crossing in a row it would only be ${UNTIRED}. `
          + `The other ${PAR - UNTIRED} are spent getting a rested pair of hands onto the `
          + `right bank.`,
        ],
        extra: [
          spare === 0 ? "🚣 the true minimum" : `➕ ${spare} over par`,
          hints === 0 ? "🧠 unaided" : `💡 ${hints} hint${hints === 1 ? "" : "s"}`,
        ],
      });
    }

    render();
  },
};
