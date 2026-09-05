/* ============================================================================
   PACKING — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/packing.js runs the board; this file does the overlapping
   and computes par, and is the same code the authoring tool used.

   The puzzle: given some words, write the shortest single string that contains
   every one of them. Words are allowed to overlap where they share letters —
   BRANDISH and DISHEVEL share DISH, so they pack into BRANDISHEVEL — and the
   whole game is finding which order lets the most overlap happen.

   Given an ORDER, the packing is not a choice: overlapping each word with the
   one before it as far as it will go is always at least as good as overlapping
   less, so the engine does it for you. The player's only decision is the
   order, which is why the interface only ever lets you reorder.

   The reason this is a puzzle rather than a procedure is that the obvious
   method fails. Repeatedly joining the two words with the largest overlap
   available — the greedy method, and the one everybody reaches for — does not
   always give the shortest answer, because taking a big overlap now can use up
   the end of a word that a later join needed more. The boards here are chosen
   so that it does fail, and by how much is in the notes.
   ========================================================================== */

/* How many characters at the end of `a` are also the start of `b`. Never
   returns the whole of either word: a word that swallows another is a
   different problem and the boards exclude it. */
export function overlap(a, b) {
  const most = Math.min(a.length, b.length) - 1;
  for (let n = most; n > 0; n--) {
    if (a.slice(a.length - n) === b.slice(0, n)) return n;
  }
  return 0;
}

/* Pack the words in this order, overlapping each with the previous as far as
   it goes. Returns the string and where each word landed. */
export function pack(words) {
  if (!words.length) return { text: "", spans: [] };
  let text = words[0];
  const spans = [{ word: words[0], at: 0 }];
  for (let i = 1; i < words.length; i++) {
    const n = overlap(text, words[i]);
    spans.push({ word: words[i], at: text.length - n });
    text += words[i].slice(n);
  }
  return { text, spans };
}

const permutations = (items) => {
  if (items.length <= 1) return [items];
  const out = [];
  items.forEach((x, i) => {
    const rest = items.slice(0, i).concat(items.slice(i + 1));
    for (const p of permutations(rest)) out.push([x, ...p]);
  });
  return out;
};

/* The true shortest packing, over every order. With six or seven words that is
   720 or 5,040 arrangements, so par is exact rather than a good attempt. */
export function par(words) {
  let best = null;
  for (const order of permutations(words)) {
    const p = pack(order);
    if (!best || p.text.length < best.text.length) best = { ...p, order };
  }
  return best;
}

/* The method everyone tries first: repeatedly merge the pair of fragments with
   the largest overlap going. It is a good heuristic and it is not optimal,
   which is the entire reason these boards are worth playing. */
export function greedy(words) {
  let parts = words.slice();
  while (parts.length > 1) {
    let bestN = -1, bi = 0, bj = 1;
    for (let i = 0; i < parts.length; i++) {
      for (let j = 0; j < parts.length; j++) {
        if (i === j) continue;
        const n = overlap(parts[i], parts[j]);
        if (n > bestN) { bestN = n; bi = i; bj = j; }
      }
    }
    const merged = parts[bi] + parts[bj].slice(Math.max(bestN, 0));
    parts = parts.filter((_, k) => k !== bi && k !== bj);
    parts.push(merged);
  }
  return parts[0];
}

/* Is any word buried inside another, or inside a join of two others? Those
   make the puzzle ill-posed for an ordering interface, so boards avoid them. */
export function hasBuriedWord(words) {
  return words.some((w, i) =>
    words.some((o, j) => j !== i && o.includes(w)));
}
