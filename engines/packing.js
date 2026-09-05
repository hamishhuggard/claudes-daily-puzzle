import { el } from "./shared.js";
import { pack, par, greedy, overlap } from "./packing-rules.js";

/* ============================================================================
   PACKING — "packed tight"
   ----------------------------------------------------------------------------
   Six words. Write the shortest single string that contains all of them,
   overlapping where they share letters. RAINFALL and FALLOUT share FALL, so
   they pack into RAINFALLOUT.

   Given an order, the packing is forced — overlapping each word with the one
   before it as far as it goes is never worse than overlapping less — so the
   engine does that for you and the only thing you choose is the order. That is
   why the interface only ever reorders.

   The reason this is a puzzle and not a procedure is that the obvious method
   fails. Merging whichever two fragments share the most letters, then
   repeating, is what everybody reaches for, and on this set it lands on 32
   characters against a true best of 29 — because taking a big overlap early
   consumes the end of a word that a later join needed more.

   Par is exact: 720 orders for six words, all of them tried.
   ========================================================================== */

export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const words = puzzle.data.words;

    const best = par(words);
    const naive = greedy(words);
    const loose = words.reduce((a, w) => a + w.length, 0);

    let order = words.slice();               // as presented; the player reorders
    let sel = null, moves = 0, over = false;

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function tap(i) {
      if (over) return;
      if (sel === null) { sel = i; return render(); }
      if (sel === i) { sel = null; return render(); }
      [order[sel], order[i]] = [order[i], order[sel]];
      sel = null;
      moves++;
      render();
    }

    function render() {
      wrap.innerHTML = "";
      const p = pack(order);

      const head = el("div", "grid-score");
      head.append(
        el("div", "grid-score-cell", `<small>Length</small><b>${p.text.length}</b>`),
        el("div", "grid-score-cell", `<small>Par</small><b>${best.text.length}</b>`),
        el("div", "grid-score-cell", `<small>Unpacked</small><b>${loose}</b>`),
        el("div", "grid-score-cell", `<small>Swaps</small><b>${moves}</b>`),
      );
      wrap.appendChild(head);

      /* The packed string, with the shared letters marked — seeing which
         letters are doing double duty is the whole feedback loop. */
      const shared = new Array(p.text.length).fill(0);
      p.spans.forEach((s) => {
        for (let k = 0; k < s.word.length; k++) shared[s.at + k]++;
      });
      const strip = el("div", "pk-strip");
      p.text.split("").forEach((ch, i) => {
        const c = el("span", "pk-ch" + (shared[i] > 1 ? " shared" : ""));
        c.textContent = ch;
        strip.appendChild(c);
      });
      wrap.appendChild(strip);

      const chips = el("div", "pk-chips");
      order.forEach((w, i) => {
        const gain = i === 0 ? 0 : overlap(pack(order.slice(0, i)).text, w);
        const b = el("button", "pk-chip" + (sel === i ? " sel" : ""));
        b.innerHTML = `<b>${w}</b>`
          + (i === 0 ? "<em>first</em>" : `<em>${gain ? `saves ${gain}` : "no join"}</em>`);
        b.disabled = over;
        b.onclick = () => tap(i);
        chips.appendChild(b);
      });
      wrap.appendChild(chips);

      const msg = el("p", "q-detail center pk-msg");
      msg.innerHTML = over
        ? (p.text.length === best.text.length
            ? `<b>${p.text.length}</b> characters — the shortest packing there is.`
            : `<b>${p.text.length}</b> characters. It can be done in <b>${best.text.length}</b>.`)
        : sel === null
          ? "Tap two words to swap them. Each word overlaps the one before it as far as it will go."
          : `Swapping <b>${order[sel]}</b> — tap another word to trade places.`;
      wrap.appendChild(msg);

      const bar = el("div", "fairy-bar grid-bar");
      if (over) {
        const b = el("button", "primary compact", "See your score");
        b.onclick = done;
        bar.appendChild(b);
      } else {
        // As in #48, no auto-finish: an arrangement can be good on the way to a
        // better one, and ending there would lock in a score still improving.
        const f = el("button", "primary compact", "Seal it");
        f.onclick = () => { over = true; sel = null; render(); };
        const s = el("button", "ghost compact", "Shuffle");
        s.onclick = () => {
          for (let i = order.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [order[i], order[j]] = [order[j], order[i]];
          }
          sel = null; render();
        };
        bar.append(f, s);
      }
      wrap.appendChild(bar);
    }

    function done() {
      const n = pack(order).text.length;
      const overPar = n - best.text.length;
      const squares = [
        overPar === 0 ? "🟩" : overPar <= 2 ? "🟨" : "🟧",
        n < naive.length ? "🟩" : n === naive.length ? "🟨" : "🟧",
      ].join("") + (overPar === 0 ? "🟩🟩🟩" : overPar <= 2 ? "🟩🟩🟨" : "🟩🟨🟧");

      api.finish({
        headline: overPar === 0
          ? `Packed into ${n} — the shortest there is`
          : `Packed into ${n}, against a par of ${best.text.length}`,
        squares,
        stats: [
          ["Length", String(n)],
          ["Par", String(best.text.length)],
          ["Unpacked", String(loose)],
        ],
        perfect: overPar === 0,
        extra: [
          overPar === 0 ? "🎯 nothing wasted" : `✂️ ${overPar} over par`,
          n < naive.length ? `🧠 beat the greedy answer by ${naive.length - n}`
            : n === naive.length ? "🤖 exactly the greedy answer"
            : `📉 ${n - naive.length} worse than greedy`,
        ],
        notes: [
          `<b>${best.text.length}</b> — ${best.text}`,
          `The greedy method gets <b>${naive.length}</b> — ${naive}`,
          `Laid end to end with no overlap at all: <b>${loose}</b>`,
        ],
      });
    }

    render();
  },
};
