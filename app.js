/* ============================================================================
   THE SHELL
   Day arithmetic, persistence, screen routing, and the share card.

   Puzzles are loaded one at a time, on the day they unlock — so a player's
   browser never holds next week's answers. Mechanics live in engines/ and are
   shared between puzzles; a puzzle that needs bespoke code can export its own
   `engine` instead of naming one.
   ========================================================================== */

import { MANIFEST, BANK_SIZE } from "./puzzles/index.js";
import { decode } from "./codec.js";

const $ = (id) => document.getElementById(id);

const EPOCH = new Date(2026, 6, 26); // 26 July 2026 = puzzle #1, local midnight
const now = new Date();
const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const dayNumber = Math.round((midnight - EPOCH) / 864e5);

/* Local-calendar date string. Deliberately not toISOString(), which would
   shift the day for anyone east or west of UTC. */
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const todayKey = ymd(midnight);
const yesterdayKey = ymd(new Date(midnight.getFullYear(), midnight.getMonth(), midnight.getDate() - 1));

const SITE_URL = location.origin.startsWith("http")
  ? location.origin + location.pathname.replace(/index\.html$/, "")
  : "";

/* Metadata is cheap and safe to hold for everything; it's what the home card
   and the archive list render from. */
const metaFor = (n) => MANIFEST.find((m) => m.n === n) || null;
const todaysMeta = dayNumber >= 0 ? metaFor(dayNumber + 1) : null;
const isReleased = (n) => n - 1 <= dayNumber;

/* ---------- lazy puzzle loading -------------------------------------------- */

const loaded = new Map();

async function loadPuzzle(n) {
  if (loaded.has(n)) return loaded.get(n);
  const mod = await import(`./puzzles/${String(n).padStart(3, "0")}.js`);
  const payload = decode(mod.blob, n);
  // A puzzle may bring its own engine; otherwise it names a shared one.
  const engine = mod.engine
    ? mod.engine
    : (await import(`./engines/${payload.type}.js`)).default;
  const puzzle = { ...metaFor(n), ...payload, engine };
  loaded.set(n, puzzle);
  return puzzle;
}

/* ---------- persistence ---------------------------------------------------- */

const store = (() => {
  const KEY = "cdp:v1";
  let data = { results: {}, streak: { n: 0, last: null } };
  try { data = { ...data, ...JSON.parse(localStorage.getItem(KEY) || "{}") }; } catch (e) {}
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} };

  return {
    result: (n) => data.results[n] || null,
    saveResult(n, r) {
      if (data.results[n]) return;         // first finish is the one that counts
      data.results[n] = r;
      // Only today's puzzle moves the streak; catching up on the archive doesn't.
      if (n === dayNumber + 1 && data.streak.last !== todayKey) {
        data.streak.n = data.streak.last === yesterdayKey ? data.streak.n + 1 : 1;
        data.streak.last = todayKey;
      }
      save();
    },
    streak() {
      if (data.streak.last === todayKey) return data.streak.n;
      return data.streak.last === yesterdayKey ? data.streak.n : 0;
    },
    solvedCount: () => Object.keys(data.results).length,
  };
})();

/* ---------- screens -------------------------------------------------------- */

function show(name) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.toggle("active", s.id === "s-" + name));
  window.scrollTo(0, 0);
}

/* ---------- home ----------------------------------------------------------- */

const DATE_FMT = { weekday: "long", day: "numeric", month: "long" };

function renderHome() {
  teardown();
  // Every back arrow routes here, so this has to switch screens itself — the
  // sibling renderers do, and leaving it to the caller meant the arrows only
  // ever redrew the home screen underneath whatever you were looking at.
  show("home");
  $("dateline").textContent = now.toLocaleDateString(undefined, DATE_FMT);

  const streak = store.streak();
  $("streak").textContent = streak > 0
    ? `🔥 ${streak}-day streak`
    : `🧩 ${store.solvedCount()} solved`;

  const card = $("today-card");
  if (!todaysMeta) {
    const early = dayNumber < 0;
    card.innerHTML = early
      ? `<div class="tc-emoji">⏳</div>
         <div class="tc-title">Not yet</div>
         <p class="tc-sub">Puzzle #1 goes live on
         ${EPOCH.toLocaleDateString(undefined, DATE_FMT)}. Either you're early, or your
         clock is.</p>`
      : `<div class="tc-emoji">🗒️</div>
         <div class="tc-title">The bank is empty</div>
         <p class="tc-sub">I've written ${BANK_SIZE} puzzles so far and you've reached the
         end of them. More are coming. In the meantime, everything I've made is in the
         archive.</p>`;
    const b = document.createElement("button");
    b.className = "cta-btn";
    b.textContent = "Open the archive";
    b.onclick = renderArchive;
    card.appendChild(b);
    return;
  }

  const done = store.result(todaysMeta.n);
  card.innerHTML = `
    <div class="tc-emoji">${todaysMeta.emoji}</div>
    <div class="tc-kicker">Puzzle #${todaysMeta.n}</div>
    <div class="tc-title">${todaysMeta.title}</div>
    <p class="tc-sub">${todaysMeta.blurb}</p>
    <div class="tc-goal"><span>Goal</span>${todaysMeta.goal}</div>`;

  const btn = document.createElement("button");
  btn.className = "cta-btn";
  if (done) {
    btn.textContent = "See your result";
    btn.onclick = () => openResult(todaysMeta.n);
    const replay = document.createElement("button");
    replay.className = "ghost wide-btn";
    replay.textContent = "Play again (won't count)";
    replay.onclick = () => startPuzzle(todaysMeta.n, true);
    card.append(btn, replay);
  } else {
    btn.textContent = "Start";
    btn.onclick = () => startPuzzle(todaysMeta.n, false);
    card.appendChild(btn);
  }
}

/* ---------- archive -------------------------------------------------------- */

function renderArchive() {
  teardown();
  const list = $("archive-list");
  list.innerHTML = "";
  const available = MANIFEST.filter((m) => isReleased(m.n));

  if (!available.length) {
    const p = document.createElement("p");
    p.className = "q-detail center";
    p.textContent = "Nothing yet — come back tomorrow.";
    list.appendChild(p);
  }

  available.slice().reverse().forEach((m) => {
    const r = store.result(m.n);
    const row = document.createElement("button");
    row.className = "arch-row" + (r ? " solved" : "");
    row.innerHTML = `
      <span class="arch-emoji">${m.emoji}</span>
      <span class="arch-main">
        <b>#${m.n} · ${m.title}</b>
        <small>${r ? r.headline : m.goal}</small>
      </span>
      <span class="arch-tick">${r ? "✓" : "›"}</span>`;
    // An unplayed past puzzle still counts — you just can't rebuild a streak with it.
    row.onclick = () => (r ? openResult(m.n) : startPuzzle(m.n, false));
    list.appendChild(row);
  });
  show("archive");
}

/* ---------- playing -------------------------------------------------------- */

let session = null;
let teardownFns = [];

function teardown() {
  teardownFns.forEach((f) => { try { f(); } catch (e) {} });
  teardownFns = [];
  if (session && session.timerId) clearInterval(session.timerId);
  session = null;
}

const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function loadError(root, n, err) {
  console.error("puzzle load failed", n, err);
  root.innerHTML = `<p class="q-detail center">Couldn't load puzzle #${n}.
    Check your connection and try again.</p>`;
}

async function startPuzzle(n, isReplay) {
  teardown();
  const meta = metaFor(n);
  $("play-title").textContent = `#${n} · ${meta.title}`;
  $("play-goal").textContent = meta.goal;
  $("help-back").hidden = true;
  $("replay-flag").hidden = !isReplay;
  $("clock").hidden = true;

  const root = $("play-root");
  root.innerHTML = `<p class="q-detail center">Loading puzzle #${n}…</p>`;
  show("play");

  let puzzle;
  try { puzzle = await loadPuzzle(n); }
  catch (err) { return loadError(root, n, err); }

  // The one-line goal is on the topbar; the long version lives behind the ?.
  $("help-body").innerHTML = puzzle.help
    ? puzzle.help
    : `<p>${meta.goal}</p>`;

  const engine = puzzle.engine;
  session = { puzzle, isReplay, elapsed: 0, timerId: null };

  const clock = $("clock");
  clock.hidden = !engine.usesTimer;
  if (engine.usesTimer) {
    clock.textContent = "0:00";
    session.timerId = setInterval(() => {
      session.elapsed++;
      clock.textContent = fmtTime(session.elapsed);
    }, 1000);
  }

  root.innerHTML = "";
  engine.mount(root, puzzle, {
    timeText: () => fmtTime(session.elapsed),
    onTeardown: (fn) => teardownFns.push(fn),
    finish: (result) => {
      if (session && session.timerId) clearInterval(session.timerId);
      result.seconds = session ? session.elapsed : 0;
      if (!isReplay) store.saveResult(n, result);
      // A replay shows what you just did, not the run that's on record.
      const shown = isReplay ? result : (store.result(n) || result);
      setTimeout(() => showResult(puzzle, shown), 450);
    },
  });
}

/* Revisiting a stored result still needs the puzzle's author note, so the
   module gets loaded even though nothing will be played. */
async function openResult(n) {
  teardown();
  const r = store.result(n);
  try {
    const puzzle = await loadPuzzle(n);
    showResult(puzzle, r);
  } catch (err) {
    loadError($("play-root"), n, err);
    show("play");
  }
}

/* ---------- result + share ------------------------------------------------- */

const SOCIALS = [
  { name: "WhatsApp", brand: "#25d366", url: (t) => `https://wa.me/?text=${t}`,
    path: "M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.65.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.61-.92-2.21-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.06 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.69.63.71.22 1.36.19 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.18-1.42-.07-.12-.27-.2-.57-.35ZM12.05 21.8h-.01a9.8 9.8 0 0 1-5-1.37l-.36-.21-3.72.98.99-3.63-.23-.37a9.79 9.79 0 0 1-1.5-5.23c0-5.4 4.4-9.8 9.83-9.8a9.77 9.77 0 0 1 9.8 9.81c0 5.4-4.4 9.8-9.8 9.8ZM20.52 3.45A11.7 11.7 0 0 0 12.05 0C5.6 0 .35 5.25.34 11.7c0 2.06.54 4.08 1.57 5.85L.24 24l6.6-1.73a11.7 11.7 0 0 0 5.2 1.24h.01c6.45 0 11.7-5.25 11.7-11.7a11.64 11.64 0 0 0-3.23-8.36Z" },
  { name: "Telegram", brand: "#2aabee", url: (t) => `https://t.me/share/url?url=${encodeURIComponent(SITE_URL)}&text=${t}`,
    path: "M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0Zm5.56 8.22-1.86 8.77c-.14.62-.51.77-1.03.48l-2.85-2.1-1.37 1.32c-.15.15-.28.28-.58.28l.21-2.93 5.33-4.82c.23-.2-.05-.32-.36-.12l-6.59 4.15-2.84-.89c-.62-.19-.63-.62.13-.92l11.09-4.27c.51-.19.96.12.72.99Z" },
  { name: "X", brand: "#4a4a4a", url: (t) => `https://twitter.com/intent/tweet?text=${t}`,
    path: "M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.41l-5.8-7.58-6.64 7.58H.46l8.6-9.83L0 1.15h7.59l5.24 6.93 6.07-6.93Zm-1.29 19.5h2.04L6.48 3.24H4.3l13.31 17.41Z" },
];

/* Four lines, always. This is not a performance summary — it's a message in
   someone else's group chat, so it says what the puzzle was, how it went, the
   squares, and the link. Engines still pass r.extra badges and the result
   screen still shows every stat; the badges stay out of the paste because they
   almost always restate the headline ("Both rounds at the true minimum" beside
   "💡 minimum both rounds") and cost a line each to do it. */
export function shareText(puzzle, r) {
  return [
    `🧩 Claude's Daily Puzzle #${puzzle.n} — ${puzzle.title}`,
    `${puzzle.emoji} ${String(r.headline || "").trim().replace(/[.]$/, "")}`,
    r.squares || "",
    SITE_URL,
  ].filter(Boolean).join("\n");
}

function showResult(puzzle, r) {
  teardown();
  $("done-emoji").textContent = r.perfect ? "🏆" : puzzle.emoji;
  $("done-title").textContent = r.perfect ? "Perfect." : "Done.";
  $("done-sub").textContent = `Puzzle #${puzzle.n} · ${puzzle.title}`;
  $("done-headline").textContent = r.headline;
  $("done-squares").textContent = r.squares || "";
  $("done-squares").hidden = !r.squares;

  const streak = store.streak();
  $("done-streak").textContent = streak > 0 ? `🔥 ${streak}-day streak` : "";

  $("done-stats").innerHTML = (r.stats || [])
    .map(([label, value]) => `<span><b>${value}</b>${label}</span>`).join("");

  const notes = r.notes || [];
  $("done-notes").innerHTML = notes.map((n) => `<li>${n}</li>`).join("");
  $("done-answers").hidden = !notes.length;
  $("done-answers").open = false;

  $("author-note").innerHTML = puzzle.note;

  const text = shareText(puzzle, r);
  $("share").onclick = async () => {
    if (navigator.share) {
      try { await navigator.share({ text }); return; } catch (e) { if (e.name === "AbortError") return; }
    }
    try {
      await navigator.clipboard.writeText(text);
      $("toast").classList.add("show");
      setTimeout(() => $("toast").classList.remove("show"), 1800);
    } catch (e) { prompt("Copy your result:", text); }
  };

  const enc = encodeURIComponent(text);
  $("social-links").innerHTML = SOCIALS.map((s) => `
    <a href="${s.url(enc)}" target="_blank" rel="noopener"
       title="Share on ${s.name}" aria-label="Share on ${s.name}" style="--brand:${s.brand}">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="${s.path}"/></svg>
    </a>`).join("");

  $("done-replay").textContent = "Play again (won't count)";
  $("done-replay").onclick = () => startPuzzle(puzzle.n, true);

  show("done");
}

/* ---------- nav ------------------------------------------------------------ */

$("play-help").onclick = () => { $("help-back").hidden = false; };
$("help-close").onclick = () => { $("help-back").hidden = true; };
$("help-back").onclick = (e) => { if (e.target.id === "help-back") $("help-back").hidden = true; };
$("play-back").onclick = renderHome;
$("done-home").onclick = renderHome;
$("archive-back").onclick = renderHome;
$("about-back").onclick = renderHome;
$("open-archive").onclick = renderArchive;
$("open-about").onclick = () => { teardown(); show("about"); };
$("bank-count").textContent = BANK_SIZE;

renderHome();

/* Exposed for the headless test harness. */
export { startPuzzle, openResult, renderArchive, renderHome, loadPuzzle, store, MANIFEST };
