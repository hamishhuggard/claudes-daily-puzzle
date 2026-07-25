"use strict";

/* ============================================================================
   THE BANK
   ----------------------------------------------------------------------------
   Every puzzle here was written by Claude (Opus 5). Each one has its own
   mechanic and its own definition of "did well" — the whole point is that
   day 2 doesn't score like day 1, so the group chat has something new to
   argue about each morning.

   Shape of a puzzle:
     n      puzzle number (1-indexed, = day since EPOCH)
     type   which engine in types.js runs it
     title  short name
     blurb  one line, shown on the home card
     goal   the success criterion, in plain words
     emoji  the puzzle's face
     note   author's note, revealed only after you finish
     data   type-specific payload
   ========================================================================== */

/* Small seeded PRNG so cipher alphabets are fixed forever without me
   hand-writing a 26-letter bijection and getting it wrong. */
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

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

const PUZZLES = [
  /* ------------------------------------------------------------------ #1 */
  {
    n: 1,
    type: "fermi",
    title: "Orders of Magnitude",
    blurb: "Five quantities. You will not know any of them. Guess anyway.",
    goal: "Minimise your total error — being within 2× counts as a hit",
    emoji: "🔭",
    note:
      "I picked these so that knowing the answer is nearly useless and " +
      "reasoning is nearly everything. The chessboard one is the test: if you " +
      "recognised the wheat-and-chessboard story you had it instantly, and if " +
      "you didn't, doubling 64 times still gets you there. That's the kind of " +
      "question I like — no lookup, just arithmetic you can do in your head if " +
      "you're willing to be approximately right.",
    data: {
      questions: [
        {
          q: "How many times does a human heart beat in an 80-year life?",
          detail: "Assume a steady 70 beats per minute.",
          answer: 2.94e9,
          unit: "beats",
          min: 1e8, max: 1e12,
          reveal: "70 × 60 × 24 × 365 × 80 ≈ 2.9 billion. Roughly three billion — a number small enough to feel almost stingy.",
        },
        {
          q: "How many trees are there on Earth?",
          detail: "Living trees, all species, whole planet.",
          answer: 3.04e12,
          unit: "trees",
          min: 1e8, max: 1e14,
          reveal: "About 3 trillion, from a 2015 global survey that revised the previous estimate up by a factor of eight. That's roughly 400 trees per person.",
        },
        {
          q: "How many cells are in one human body?",
          detail: "Human cells only — don't count the bacteria.",
          answer: 3.7e13,
          unit: "cells",
          min: 1e11, max: 1e17,
          reveal: "About 37 trillion. You are, by cell count, roughly ten Earth-forests of cells wearing a coat.",
        },
        {
          q: "How many humans have ever been born?",
          detail: "Every anatomically modern human, from the beginning until now.",
          answer: 1.17e11,
          unit: "people",
          min: 1e8, max: 1e13,
          reveal: "About 117 billion. The ~8 billion alive today are roughly 7% of everyone who has ever lived — a much bigger share than most people guess.",
        },
        {
          q: "Put 1 grain of rice on the first square of a chessboard, 2 on the second, 4 on the third, doubling each time. How many grains on the whole board?",
          detail: "All 64 squares, added together.",
          answer: 1.845e19,
          unit: "grains",
          min: 1e9, max: 1e23,
          reveal: "2⁶⁴ − 1 ≈ 18.4 quintillion grains — several hundred times the world's annual rice harvest. Half of it sits on the final square alone.",
        },
      ],
    },
  },

  /* ------------------------------------------------------------------ #2 */
  {
    n: 2,
    type: "cryptogram",
    title: "Cold Open",
    blurb: "A quote, letter-swapped. Every A is some other letter, consistently.",
    goal: "Crack it using as few revealed letters as possible",
    emoji: "🔐",
    note:
      "Three letters come free because a cryptogram with no foothold is a " +
      "staring contest, not a puzzle — but deliberately not the two commonest " +
      "ones, because handing you E and T would solve half the board and skip " +
      "the only interesting step. After that it's the same trick every " +
      "time: attack the short words first — a two-letter word ending in the " +
      "commonest letter is almost certainly TO or IS — and look for a repeated " +
      "three-letter word, which is THE more often than it is anything else. " +
      "I chose this particular quote because it is the least fatalistic " +
      "sentence I know.",
    data: {
      text: "THE BEST WAY TO PREDICT THE FUTURE IS TO INVENT IT",
      attribution: "Alan Kay",
      seed: 20260727,
      freebies: 3,
    },
  },

  /* ------------------------------------------------------------------ #3 */
  {
    n: 3,
    type: "rule",
    title: "The Rule",
    blurb: "I'm thinking of a rule about number triples. 2, 4, 6 obeys it.",
    goal: "Name the rule — using as few test triples as you can",
    emoji: "🔬",
    note:
      "This is a variation on Peter Wason's 1960 experiment, and the finding " +
      "has held up for sixty years: most people only ever test triples they " +
      "expect to pass. If your rule guess was 'goes up by twos' or 'even " +
      "numbers ascending', notice that you could have killed it in one move " +
      "by testing something you expected to fail. Confirmation feels like " +
      "progress. It usually isn't. Testing 5, 1, 9 tells you more than testing " +
      "8, 10, 12 ever will.",
    data: {
      seed: [2, 4, 6],
      /* The rule is deliberately much looser than it looks. */
      test: (a, b, c) => c > a,
      options: [
        "Each number is two more than the one before",
        "The numbers are even and increasing",
        "The numbers increase",
        "The last number is larger than the first",
        "The last number is the sum of the first two",
        "Each number is larger than the average of the others",
      ],
      answer: 3, // index into options
    },
  },

  /* ------------------------------------------------------------------ #4 */
  {
    n: 4,
    type: "order",
    title: "Deep Time",
    blurb: "Six moments in history. Put them in order, oldest first.",
    goal: "Get all six right in as few checks as possible",
    emoji: "⏳",
    note:
      "Two of these break almost everybody. Woolly mammoths were still walking " +
      "around on Wrangel Island while Egyptian scribes were already writing " +
      "about the pyramids as ancient monuments. And Cleopatra was born closer " +
      "in time to the first Moon landing than to the building of the Great " +
      "Pyramid — she is a modern figure wearing an ancient costume. History is " +
      "not evenly spaced, and our intuitions about it are compressed near the " +
      "far end.",
    data: {
      prompt: "Oldest at the top, most recent at the bottom.",
      items: [
        { label: "The Great Pyramid of Giza is completed", when: "c. 2560 BC",
          note: "Older than every other thing on this list by nearly a thousand years." },
        { label: "The last woolly mammoths die out on Wrangel Island", when: "c. 1650 BC",
          note: "A full nine centuries after the Great Pyramid was finished." },
        { label: "Cleopatra is born", when: "69 BC",
          note: "Closer in time to the Moon landing than to the Great Pyramid." },
        { label: "The Western Roman Empire falls", when: "AD 476",
          note: "The conventional date; the reality was a slow fade over decades." },
        { label: "Teaching begins at Oxford", when: "c. 1096",
          note: "Older than the Aztec Empire, which wasn't founded until 1428." },
        { label: "Gutenberg prints with movable type in Europe", when: "c. 1440",
          note: "Movable type existed in Korea and China earlier; Gutenberg's press is what scaled." },
      ],
      /* Correct order is the order above. The engine shuffles deterministically. */
      shuffleSeed: 2983,
    },
  },

  /* ------------------------------------------------------------------ #5 */
  {
    n: 5,
    type: "calibration",
    title: "How Sure Are You?",
    blurb: "Ten claims. Say how likely each is to be true — and mean it.",
    goal: "Lowest Brier score wins. Confidence is only a virtue when it's earned",
    emoji: "🎚️",
    note:
      "This is the only puzzle in the bank you can lose by knowing things. " +
      "Answering every question at 100% and getting nine right scores worse " +
      "than answering at 90% and getting the same nine right — because the one " +
      "you missed, you missed loudly. A Brier score punishes confidence that " +
      "isn't backed by accuracy, which makes it the closest thing there is to " +
      "a number for intellectual honesty. Sliding to 50% on everything scores " +
      "0.25. If you can't beat 0.25, you'd have done better knowing nothing.",
    data: {
      statements: [
        { s: "Sharks existed before trees did.", t: true,
          why: "True. Sharks appear ~450 million years ago; the first true trees ~385 million years ago." },
        { s: "The summit of Mount Everest is the point on Earth's surface furthest from the planet's centre.", t: false,
          why: "False. Because Earth bulges at the equator, that title goes to Chimborazo in Ecuador." },
        { s: "Australia is wider than the Moon.", t: true,
          why: "True. Australia spans about 4,000 km east to west; the Moon's diameter is about 3,475 km." },
        { s: "Venus is the hottest planet in the Solar System.", t: true,
          why: "True. Its runaway greenhouse effect makes it hotter than Mercury despite being further from the Sun." },
        { s: "Bananas grow on trees.", t: false,
          why: "False. The banana plant is a giant herb — its 'trunk' is tightly packed leaf bases, not wood." },
        { s: "The Great Wall of China is visible to the naked eye from the Moon.", t: false,
          why: "False. It isn't even reliably visible from low Earth orbit without help." },
        { s: "Nigeria has a larger population than Russia.", t: true,
          why: "True, and not narrowly — roughly 220 million against roughly 145 million." },
        { s: "Oxford University is older than the Aztec Empire.", t: true,
          why: "True. Teaching at Oxford began around 1096; the Aztec Triple Alliance formed in 1428." },
        { s: "There are more possible games of chess than there are atoms in the observable universe.", t: true,
          why: "True. Chess game-trees run to roughly 10¹²⁰; atoms in the observable universe to roughly 10⁸⁰." },
        { s: "A day on Venus is shorter than a year on Venus.", t: false,
          why: "False. Venus rotates so slowly that one of its days lasts about 243 Earth days — longer than its 225-day year." },
      ],
    },
  },
];
