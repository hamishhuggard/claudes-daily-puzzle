"use strict";

/* ============================================================================
   PUZZLE ENGINES
   ----------------------------------------------------------------------------
   One engine per mechanic. Each exposes:

     usesTimer  should the shell show a running clock?
     mount(root, puzzle, api)

   `api.finish(result)` ends the puzzle. A result is:
     headline  the single number you brag about, as text
     squares   an emoji row for the share card ("" if the puzzle has none)
     stats     [[label, value], ...] for the results screen
     perfect   did you max it out?
     extra     optional lines appended to the share text
   ========================================================================== */

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* Human-readable big numbers: 2.94e9 -> "2.9 billion" */
const SCALES = [
  [1e33, "decillion"], [1e30, "nonillion"], [1e27, "octillion"],
  [1e24, "septillion"], [1e21, "sextillion"], [1e18, "quintillion"],
  [1e15, "quadrillion"], [1e12, "trillion"], [1e9, "billion"],
  [1e6, "million"], [1e3, "thousand"],
];

function bigNum(v) {
  for (const [mag, name] of SCALES) {
    if (v >= mag) {
      const n = v / mag;
      return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${name}`;
    }
  }
  return Math.round(v).toLocaleString();
}

const TYPES = {};

/* ========================================================================== */
/* 1. FERMI — five estimates on a log slider. Score: total log-error.          */
/* ========================================================================== */

TYPES.fermi = {
  usesTimer: false,

  mount(root, puzzle, api) {
    const qs = puzzle.data.questions;
    let idx = 0;
    const errors = [];

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function grade(err) {
      // err is |log10(guess) - log10(answer)|
      if (err < 0.301) return { sq: "🟩", word: "within 2×", kind: "good" };
      if (err < 0.7) return { sq: "🟨", word: "within 5×", kind: "ok" };
      if (err < 1.3) return { sq: "🟧", word: "within 20×", kind: "ok" };
      return { sq: "🟥", word: "way off", kind: "bad" };
    }

    function render() {
      const q = qs[idx];
      wrap.innerHTML = "";

      wrap.appendChild(el("div", "pips", qs.map((_, i) =>
        `<i class="${i < idx ? "done" : i === idx ? "now" : ""}"></i>`).join("")));

      wrap.appendChild(el("p", "q-num", `Estimate ${idx + 1} of ${qs.length}`));
      wrap.appendChild(el("h2", "q-text", q.q));
      if (q.detail) wrap.appendChild(el("p", "q-detail", q.detail));

      const readout = el("div", "readout");
      const val = el("b", null, "—");
      const unit = el("span", "unit", q.unit);
      readout.append(val, unit);
      wrap.appendChild(readout);

      const lo = Math.log10(q.min), hi = Math.log10(q.max);
      const slider = el("input", "slider");
      slider.type = "range";
      slider.min = "0"; slider.max = "1000"; slider.step = "1";
      // Start well away from the answer so the midpoint is never a free hit.
      const answerPos = ((Math.log10(q.answer) - lo) / (hi - lo)) * 1000;
      slider.value = String(answerPos > 500 ? 300 : 700);
      slider.setAttribute("aria-label", "Your estimate");

      const scale = el("div", "scale",
        `<span>${bigNum(q.min)}</span><span>${bigNum(q.max)}</span>`);

      const guessOf = () => Math.pow(10, lo + (slider.value / 1000) * (hi - lo));
      const update = () => { val.textContent = bigNum(guessOf()); };
      slider.addEventListener("input", update);
      update();

      wrap.append(slider, scale);

      const btn = el("button", "primary", "Lock it in");
      btn.onclick = () => {
        const guess = guessOf();
        const err = Math.abs(Math.log10(guess) - Math.log10(q.answer));
        errors.push(err);
        showReveal(q, guess, err);
      };
      wrap.appendChild(btn);
    }

    function showReveal(q, guess, err) {
      const g = grade(err);
      wrap.innerHTML = "";
      wrap.appendChild(el("div", "reveal-badge " + g.kind, `${g.sq} ${g.word}`));
      wrap.appendChild(el("div", "reveal-nums", `
        <div><span>You said</span><b>${bigNum(guess)}</b></div>
        <div><span>Actually</span><b>${bigNum(q.answer)}</b></div>`));
      wrap.appendChild(el("p", "reveal-text", q.reveal));

      const btn = el("button", "primary", idx === qs.length - 1 ? "See your score" : "Next estimate");
      btn.onclick = () => {
        idx++;
        if (idx < qs.length) render();
        else done();
      };
      wrap.appendChild(btn);
    }

    function done() {
      const total = errors.reduce((a, b) => a + b, 0);
      const avg = total / errors.length;
      const hits = errors.filter((e) => e < 0.301).length;
      api.finish({
        headline: total.toFixed(2) + " total error",
        squares: errors.map((e) => grade(e).sq).join(""),
        stats: [
          ["Total error", total.toFixed(2)],
          ["Within 2×", `${hits}/${errors.length}`],
          ["Typical miss", `${Math.pow(10, avg).toFixed(1)}×`],
        ],
        perfect: hits === errors.length,
        extra: [`🎯 ${hits}/${errors.length} within a factor of two`],
      });
    }

    render();
  },
};

/* ========================================================================== */
/* 2. CRYPTOGRAM — substitution cipher. Score: letters revealed, then time.    */
/* ========================================================================== */

TYPES.cryptogram = {
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

/* ========================================================================== */
/* 3. RULE — Wason-style hypothesis testing. Score: probes + wrong guesses.    */
/* ========================================================================== */

TYPES.rule = {
  usesTimer: false,

  mount(root, puzzle, api) {
    const d = puzzle.data;
    let probes = 0, wrong = 0;
    const log = [];

    root.appendChild(el("p", "q-detail center",
      `I'm thinking of a rule that some triples of numbers obey and others don't. ` +
      `<b>${d.seed.join(", ")}</b> obeys it. Test as many triples as you like, then name the rule.`));

    const form = el("div", "triple-form");
    const inputs = [0, 1, 2].map((i) => {
      const inp = el("input", "num");
      inp.type = "number";
      inp.setAttribute("aria-label", `Number ${i + 1}`);
      inp.placeholder = "—";
      return inp;
    });
    const testBtn = el("button", "primary compact", "Test");
    form.append(...inputs, testBtn);
    root.appendChild(form);

    const logBox = el("div", "log");
    root.appendChild(logBox);

    const guessBtn = el("button", "ghost wide-btn", "I know the rule");
    root.appendChild(guessBtn);

    testBtn.onclick = () => {
      const v = inputs.map((i) => Number(i.value));
      if (inputs.some((i) => i.value === "") || v.some((n) => !Number.isFinite(n))) return;
      probes++;
      const ok = d.test(v[0], v[1], v[2]);
      log.unshift({ v, ok });
      renderLog();
      inputs[0].focus();
      inputs.forEach((i) => (i.value = ""));
    };

    inputs.forEach((inp, i) => {
      inp.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { (i < 2 ? inputs[i + 1] : testBtn).focus(); if (i === 2) testBtn.click(); }
      });
    });

    function renderLog() {
      logBox.innerHTML = "";
      logBox.appendChild(el("div", "log-count",
        `${probes} test${probes === 1 ? "" : "s"} so far`));
      for (const r of log) {
        logBox.appendChild(el("div", "log-row " + (r.ok ? "yes" : "no"),
          `<span>${r.v.join(", ")}</span><b>${r.ok ? "✓ obeys" : "✗ breaks"}</b>`));
      }
      logBox.appendChild(el("div", "log-row yes seed",
        `<span>${d.seed.join(", ")}</span><b>✓ obeys</b>`));
    }
    renderLog();

    guessBtn.onclick = () => {
      const sheet = el("div", "sheet");
      sheet.appendChild(el("h3", null, "Which rule am I using?"));
      d.options.forEach((opt, i) => {
        const b = el("button", "option", opt);
        b.onclick = () => {
          if (i === d.answer) {
            sheet.remove();
            api.finish({
              headline: `${probes} test${probes === 1 ? "" : "s"}`,
              // One flask per test, one cross per wrong guess, tick when it clicked.
              squares: "🔬".repeat(Math.min(probes, 15)) + "❌".repeat(Math.min(wrong, 5)) + "✅",
              stats: [
                ["Tests run", String(probes)],
                ["Wrong guesses", String(wrong)],
                ["Verdict", probes <= 3 ? "Bold" : probes <= 8 ? "Thorough" : "Exhaustive"],
              ],
              perfect: wrong === 0,
              extra: [wrong === 0 ? "✅ first guess" : `❌ ${wrong} wrong guess${wrong === 1 ? "" : "es"}`],
            });
          } else {
            wrong++;
            b.classList.add("wrong");
            b.disabled = true;
            sheet.querySelector(".sheet-msg").textContent =
              "Not that one. Close it and run more tests, or try again.";
          }
        };
        sheet.appendChild(b);
      });
      sheet.appendChild(el("p", "sheet-msg", ""));
      const close = el("button", "ghost", "Keep testing");
      close.onclick = () => sheet.remove();
      sheet.appendChild(close);
      root.appendChild(sheet);
    };
  },
};

/* ========================================================================== */
/* 4. ORDER — Mastermind for sequences. Score: checks used.                    */
/* ========================================================================== */

TYPES.order = {
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

/* ========================================================================== */
/* 5. CALIBRATION — probability betting. Score: Brier (lower is better).       */
/* ========================================================================== */

TYPES.calibration = {
  usesTimer: false,

  mount(root, puzzle, api) {
    const items = puzzle.data.statements;
    let idx = 0;
    const bets = [];

    const wrap = el("div", "stack");
    root.appendChild(wrap);

    function render() {
      const it = items[idx];
      wrap.innerHTML = "";
      wrap.appendChild(el("div", "pips", items.map((_, i) =>
        `<i class="${i < idx ? "done" : i === idx ? "now" : ""}"></i>`).join("")));
      wrap.appendChild(el("p", "q-num", `Claim ${idx + 1} of ${items.length}`));
      wrap.appendChild(el("h2", "q-text claim", `“${it.s}”`));

      const readout = el("div", "readout");
      const val = el("b", null, "50%");
      readout.append(val, el("span", "unit", "chance this is true"));
      wrap.appendChild(readout);

      const slider = el("input", "slider");
      slider.type = "range";
      slider.min = "1"; slider.max = "99"; slider.step = "1"; slider.value = "50";
      slider.setAttribute("aria-label", "Probability this claim is true");
      const scale = el("div", "scale", `<span>Certainly false</span><span>Certainly true</span>`);
      const upd = () => {
        val.textContent = slider.value + "%";
        val.className = slider.value > 60 ? "lean-t" : slider.value < 40 ? "lean-f" : "";
      };
      slider.addEventListener("input", upd);
      wrap.append(slider, scale);

      const btn = el("button", "primary", "Lock it in");
      btn.onclick = () => {
        bets.push({ p: Number(slider.value) / 100, it });
        idx++;
        if (idx < items.length) render();
        else done();
      };
      wrap.appendChild(btn);
      upd();
    }

    function sq(b) {
      const o = b.it.t ? 1 : 0;
      const e = Math.abs(b.p - o);
      if (e <= 0.15) return "🟩";   // confident and right
      if (e <= 0.4) return "🟨";    // leaned the right way
      if (e <= 0.6) return "⬜";    // basically a coin flip
      if (e <= 0.85) return "🟧";   // leaned wrong
      return "🟥";                  // confidently wrong
    }

    function done() {
      const brier = bets.reduce((a, b) => a + Math.pow(b.p - (b.it.t ? 1 : 0), 2), 0) / bets.length;
      const acc = bets.filter((b) => (b.p > 0.5) === b.it.t).length;
      const overconf = bets.filter((b) => Math.abs(b.p - (b.it.t ? 1 : 0)) > 0.85).length;

      api.finish({
        headline: `Brier ${brier.toFixed(3)}`,
        squares: bets.map(sq).join(""),
        stats: [
          ["Brier score", brier.toFixed(3)],
          ["Called right", `${acc}/${bets.length}`],
          ["Beat a coin flip?", brier < 0.25 ? "Yes" : "No"],
        ],
        perfect: brier < 0.05,
        extra: [
          `✅ ${acc}/${bets.length} called right`,
          overconf ? `🟥 ${overconf} confidently wrong` : `🛡️ nothing confidently wrong`,
        ],
        notes: bets.map((b) => {
          const o = b.it.t ? 1 : 0;
          return `${sq(b)} You said <b>${Math.round(b.p * 100)}%</b> true. ${b.it.why}`;
        }),
      });
    }

    render();
  },
};
