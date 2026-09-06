/* ============================================================================
   STAIRCASE — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/staircase.js draws the steps; this file is the validation
   and the chain census that decided each round was findable.

   The word-ladder original changes exactly one letter per step and keeps every
   letter where it is: COLD, CORD, CARD, WARD, WARM. Position is everything,
   and you solve it by staring at one column at a time.

   This variant adds a letter instead of swapping one, and lets you rearrange
   all of them freely. PIN, PINS, PAINS, PAINTS, PANTIES, PAINTERS. Position
   stops meaning anything: a word is just a bag of letters, and the question at
   every step is "what does this bag become when I drop one more letter in".
   That is a different faculty from the ladder — it is anagram-sight rather
   than pattern-matching — and it is why the steps get harder as they get
   longer instead of easier.

   Because every step adds exactly one letter, every legal chain from a
   3-letter start to an 8-letter target is the same length. There is no
   shortest route to find. The difficulty is entirely in whether a route
   exists through the words you can actually think of, so the score is wrong
   guesses and hints, not step count.

   Every word in a chain contains all of the start's letters and none the
   target lacks, so a round's whole legal vocabulary is the multiset interval
   between them. That set is small, which is why it ships inside the puzzle:
   the accepted word list is finite, hand-picked everyday English, and the
   engine never has to consult a dictionary it does not have.
   ========================================================================== */

/* Letter-count vector, so "bag of letters" comparisons are cheap. */
export function vec(word) {
  const v = new Int8Array(26);
  for (const ch of word) {
    const i = ch.charCodeAt(0) - 97;
    if (i >= 0 && i < 26) v[i]++;
  }
  return v;
}

/* Does `big` contain every letter of `small`, counting repeats? */
export function contains(big, small) {
  for (let i = 0; i < 26; i++) if (small[i] > big[i]) return false;
  return true;
}

/* Why a proposed next word is or isn't a legal step up from `from`.
   Returns null when it is fine, otherwise a reason the engine can print. */
export function reject(from, word, wordSet) {
  if (!word) return "Type a word.";
  if (!/^[a-z]+$/.test(word)) return "Letters only.";
  if (word === from) return "That's the word you already have.";
  if (word.length !== from.length + 1) {
    return `Every step adds exactly one letter — that needs to be ${from.length + 1} long.`;
  }
  if (!contains(vec(word), vec(from))) {
    return `You have to keep every letter of ${from.toUpperCase()} and add one more.`;
  }
  if (!wordSet.has(word)) return "Not a word this puzzle knows.";
  return null;
}

/* Legal next words from `from`, given the round's vocabulary. */
export function nextWords(from, words) {
  const fv = vec(from);
  return words.filter((w) => w.length === from.length + 1 && contains(vec(w), fv));
}

/* Every chain from start to target. Used by the authoring script to check a
   round has routes, and by the engine to pick a hint that actually leads
   somewhere rather than into a dead end. */
export function chains(round, cap = 20000) {
  const { start, target, words } = round;
  const byLen = new Map();
  for (const w of words) {
    if (!byLen.has(w.length)) byLen.set(w.length, []);
    byLen.get(w.length).push(w);
  }
  const out = [];
  (function rec(cur, path) {
    if (out.length >= cap) return;
    if (cur === target) { out.push(path); return; }
    const cv = vec(cur);
    for (const w of byLen.get(cur.length + 1) || []) {
      if (contains(vec(w), cv)) rec(w, [...path, w]);
    }
  })(start, [start]);
  return out;
}

/* Words from which the target is still reachable. A hint must land on one of
   these, and a player standing on a word not in this set is stuck. */
export function liveWords(round) {
  const live = new Set();
  for (const chain of chains(round)) for (const w of chain) live.add(w);
  return live;
}
