import { el, rng } from "./shared.js";

/* Substitution cipher. Score: letters revealed, then time. */

/* A derangement of A–Z: no letter maps to itself, so nothing is a freebie. */
function cipherAlphabet(seed) {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const rand = rng(seed);
  for (let attempt = 0; attempt < 200; attempt++) {
    const out = A.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [out[i], out[j]] = [out[j], out[i]];
    }
    if (out.every((c, i) => c !== A[i])) return out.join("");
  }
  return A.slice().reverse().join(""); // unreachable in practice
}
export default {
  usesTimer: true,

  mount(root, puzzle, api) {
    const plain = puzzle.data.text.toUpperCase();
    const key = cipherAlphabet(puzzle.data.seed); // plain[i] -> key[i]
    const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const enc = (ch) => (A.includes(ch) ? key[A.indexOf(ch)] : ch);
    const cipher = plain.split("").map(enc).join("");

    /* guesses: cipherLetter -> plainLetter (or "") */
    const guesses = {};
    const revealed = new Set();
    let selected = null; // index into cipher
    let hints = 0;

    /* Free letters: skip the two commonest letters (handing over E and T
       solves half the board and kills the frequency-analysis step), then
       give the next few. A foothold, not a leg-up. */
    const freq = {};
    for (const ch of plain) if (A.includes(ch)) freq[ch] = (freq[ch] || 0) + 1;
    Object.entries(freq)
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(2, 2 + puzzle.data.freebies)
      .forEach(([p]) => { guesses[enc(p)] = p; revealed.add(enc(p)); });

    const board = el("div", "crypt-board");
    const kb = el("div", "keyboard");
    const bar = el("div", "crypt-bar");
    root.append(
      el("p", "q-detail center", `A quote from ${puzzle.data.attribution}. Each letter has been swapped for a different one — the same way every time.`),
      board, bar, kb
    );

    const idxs = [];
    for (let i = 0; i < cipher.length; i++) if (A.includes(cipher[i])) idxs.push(i);

    function build() {
      board.innerHTML = "";
      let word = el("div", "word");
      for (let i = 0; i < cipher.length; i++) {
        const ch = cipher[i];
        if (ch === " ") {
          board.appendChild(word);
          word = el("div", "word");
          continue;
        }
        if (!A.includes(ch)) { word.appendChild(el("div", "tile punc", ch)); continue; }
        const t = el("div", "tile");
        t.dataset.i = String(i);
        t.dataset.c = ch;
        t.innerHTML = `<b></b><small>${ch}</small>`;
        t.onclick = () => { selected = i; paint(); };
        word.appendChild(t);
      }
      board.appendChild(word);

      kb.innerHTML = "";
      for (const L of A) {
        const b = el("button", "key", L);
        b.onclick = () => assign(L);
        kb.appendChild(b);
      }
      const del = el("button", "key wide", "⌫");
      del.onclick = () => assign("");
      kb.appendChild(del);

      bar.innerHTML = "";
      const hint = el("button", "ghost", "💡 Reveal a letter");
      hint.onclick = doHint;
      bar.appendChild(hint);
    }

    function assign(L) {
      if (selected == null) return;
      const c = cipher[selected];
      if (revealed.has(c)) return; // revealed letters are locked
      if (L) {
        // one plaintext letter can only be used once
        for (const k of Object.keys(guesses)) {
          if (guesses[k] === L && !revealed.has(k)) delete guesses[k];
        }
        guesses[c] = L;
      } else {
        delete guesses[c];
      }
      advance();
      paint();
      check();
    }

    function advance() {
      const pos = idxs.indexOf(selected);
      for (let k = 1; k <= idxs.length; k++) {
        const cand = idxs[(pos + k) % idxs.length];
        if (!guesses[cipher[cand]]) { selected = cand; return; }
      }
    }

    function doHint() {
      const unsolved = idxs.filter((i) => guesses[cipher[i]] !== plain[i]);
      if (!unsolved.length) return;
      const pick = selected != null && unsolved.includes(selected)
        ? selected
        : unsolved[0];
      const c = cipher[pick], p = plain[pick];
      for (const k of Object.keys(guesses)) {
        if (guesses[k] === p && !revealed.has(k)) delete guesses[k];
      }
      guesses[c] = p;
      revealed.add(c);
      hints++;
      paint();
      check();
    }

    function paint() {
      const selC = selected == null ? null : cipher[selected];
      board.querySelectorAll(".tile:not(.punc)").forEach((t) => {
        const c = t.dataset.c;
        const i = Number(t.dataset.i);
        t.querySelector("b").textContent = guesses[c] || "";
        t.classList.toggle("sel", i === selected);
        t.classList.toggle("peer", c === selC && i !== selected);
        t.classList.toggle("locked", revealed.has(c));
      });
      const used = new Set(Object.values(guesses));
      kb.querySelectorAll(".key").forEach((b) => {
        if (b.textContent.length === 1) b.classList.toggle("used", used.has(b.textContent));
      });
    }

    function check() {
      const solved = idxs.every((i) => guesses[cipher[i]] === plain[i]);
      if (!solved) return;
      const free = puzzle.data.freebies;
      api.finish({
        headline: hints === 0 ? "no hints" : `${hints} hint${hints === 1 ? "" : "s"}`,
        // One bulb per hint; a clean solve gets a green row instead.
        squares: hints === 0 ? "🟩🟩🟩" : "💡".repeat(Math.min(hints, 20)),
        stats: [
          ["Hints used", String(hints)],
          ["Time", api.timeText()],
          ["Free letters", String(free)],
        ],
        perfect: hints === 0,
        extra: [`⏱️ ${api.timeText()}`],
      });
    }

    document.addEventListener("keydown", onKey);
    api.onTeardown(() => document.removeEventListener("keydown", onKey));
    function onKey(e) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const L = e.key.toUpperCase();
      if (A.includes(L) && L.length === 1) { assign(L); e.preventDefault(); }
      else if (e.key === "Backspace") { assign(""); e.preventDefault(); }
    }

    build();
    selected = idxs.find((i) => !guesses[cipher[i]]);
    paint();
  },
};
