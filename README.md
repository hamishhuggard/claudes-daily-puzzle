| 28 | Ninety Percent Sure | Eight last quantities to bracket | Catches out of eight, narrower breaks ties |

**[Play it →](https://hamishhuggard.github.io/claudes-daily-puzzle/)**

A daily puzzle game where the puzzles are written by Claude — not generated from a
template at load time, but actually authored one at a time, each with its own mechanic,
its own scoring, and a short note from me explaining why I picked it.

## The premise

Most daily puzzle games pick one format and run it forever. That gives you exactly one
axis to compare on, and by week three the group chat conversation is always the same
shape. This one changes the game every day:

| # | Puzzle | Mechanic | You're scored on |
|---|--------|----------|------------------|
| 1 | Orders of Magnitude | Five Fermi estimates on a log slider | Total log-error — within 2× is a hit |
| 2 | Cold Open | Substitution cipher | Letters you had to reveal, then time |
| 3 | The Rule | Wason-style hypothesis testing | Test triples used, plus wrong guesses |
| 4 | Deep Time | Order six historical events | Checks used before you got all six |
| 5 | How Sure Are You? | Bet a probability on ten claims | Brier score — confidence has to be earned |
| 6 | Give or Take | Bracket eight quantities with 90% ranges | Catches out of eight, narrower breaks ties |
| 7 | The Odd Coin | Twelve coins, one fake, a balance scale | Weighings used — three is the theoretical floor |
| 8 | No Backsies | Optimal stopping, three rounds of offers | What you took, against what was still coming |
| 9 | Eyeball It | Judge the correlation of six scatterplots | Total error across the six, 0.1 is a hit |
| 10 | The Base Rate | Posterior estimation from a base rate | Average miss, in percentage points |
| 11 | Second Opinion | Bet a probability on ten more claims | Brier score again — with the tactics changed |
| 12 | Back of the Envelope | Five estimates, all reachable by multiplying | Total log-error |
| 13 | Room to Be Wrong | 90% ranges, ending on one nobody can pin down | Catches out of eight, narrower breaks ties |
| 14 | Fooling Yourself | Substitution cipher | Letters revealed, then time |
| 15 | Further North Than You Think | Order six cities by latitude | Checks used before all six land |
| 16 | Sure About That? | Bet a probability on ten claims | Brier score — the fun facts are half false |
| 17 | Entertaining a Thought | Substitution cipher, misattributed quote | Letters revealed, then time |
| 18 | Nobody Knows That | 90% ranges on eight unknowable numbers | Catches out of eight, narrower breaks ties |
| 19 | Twice As Obvious | Rule discovery from an over-determined seed | Test triples used, plus wrong guesses |
| 20 | Trust Your Eye Again | Six more correlations, by eye | Total error across the six |
| 21 | Going, Going | Optimal stopping, three more auctions | What you took, against what was coming |
| 22 | The Camel | Fairy chess: a 1-3 leaper, corner to corner | Moves used against a par found by search |
| 23 | The Grasshopper | Fairy chess: a piece that needs hurdles | Moves used against par — both pieces move |
| 24 | Mate in Two | Fairy chess: camel and grasshopper, Black defends | Attempts before the forced mate lands |
| 25 | Faster Than You Think | Order six animals by top speed | Checks used before all six land |
| 26 | Full of Doubts | Substitution cipher, Russell (roughly) | Letters revealed, then time |
| 27 | Third Opinion | Bet a probability on ten more claims | Brier score, third time — look for a direction |
| 28 | Ninety Percent Sure | Eight last quantities to bracket | Catches out of eight, narrower breaks ties |

So the morning question is never just "did you get it". It's "wait, how were we even
being scored today?"

Every result copies to your clipboard as a spoiler-free row of squares, Wordle-style —
but the row means something different each day. `🟨🟨🟩` is three checks on an ordering
puzzle. `💡💡` is two hints on a cipher. `🔬🔬🔬❌✅` is someone who tested three triples,
guessed wrong once, then got it.

## How it works

Puzzle *n* unlocks on day *n* after the epoch (26 July 2026), computed against the
player's local midnight — same trick Wordle uses, so everyone in a group chat is on the
same puzzle regardless of timezone. Past puzzles stay open in the archive; solving one
counts, but only today's puzzle moves your streak.

No build step, no framework, no server, no accounts, no analytics. Results live in
`localStorage` and nowhere else.

```
index.html          markup + all styling
app.js              day arithmetic, persistence, routing, share card
codec.js            payload encoding (see "Spoilers" below)
puzzles/index.js    manifest — metadata only, safe to read
puzzles/00n.js      one module per puzzle, encoded, fetched on its day
engines/*.js        one module per mechanic, shared across puzzles
tools/puzzle.js     authoring CLI, never shipped to the browser
```

### Why content and code aren't 1:1

The obvious move is "one file per puzzle, containing its own code". But **mechanics
recur and content doesn't** — day 12 will be another estimation puzzle, day 9 another
cipher — so bundling an engine into every puzzle file would ship the same engine a dozen
times.

Instead a puzzle module either *names* a shared engine or *defines* its own:

```js
// puzzles/007.js — reuses an existing mechanic
export const blob = "…";              // { type: "fermi", note, data }

// puzzles/008.js — brings bespoke code with it
export const blob = "…";
export const engine = { usesTimer: false, mount(root, puzzle, api) { … } };
```

Co-location when a puzzle needs its own code, reuse when it doesn't. The loader prefers
an exported `engine` and falls back to `engines/<type>.js`.

## Spoilers

Two different problems, with two very different answers.

**Future puzzles** are genuinely protected: they aren't in the bundle. Nothing is fetched
until its day, so a player's browser never holds next week's answers. That's the main
reason for the per-puzzle module split.

**Today's puzzle** can only be obscured, never hidden. The browser has to hold the answer
in order to grade you against it, so anyone determined with devtools will get there. The
payload is XOR'd and base64'd (`codec.js`) purely so that view-source and Ctrl-F don't
casually spoil a puzzle you were about to play. That's the whole claim — it is a speed
bump, not security, and it would be dishonest to describe it as anything more.

Note that hashing the answers instead wouldn't work: Deep Time has to know the real
permutation to tell you *how many* items are in the right place, so a one-way hash would
break the mechanic.

The manifest stays readable on purpose — titles, blurbs and scoring rules are what the
home card and archive already display.

## Adding a puzzle

Working content lives in `tools/content/` (gitignored); only the encoded module is
committed. Round-trip freely:

```bash
node tools/puzzle.js new 6        # scaffold tools/content/006.js
node tools/puzzle.js pack 6       # encode -> puzzles/006.js, update the manifest
node tools/puzzle.js unpack 6     # decode an existing puzzle to edit it again
node tools/puzzle.js verify       # decode everything, check shapes and engines
```

To *look* at a puzzle before its unlock day, serve the repo and open
`tools/preview.html?n=22` — it loads any puzzle by number, ignoring the calendar, and
prints the finished result object. It borrows the game's CSS from `index.html` rather
than forking it, so what you see is what players get.

`verify` is the thing to run before committing. A new *mechanic* means a new file in
`engines/` exporting `{ usesTimer, mount(root, puzzle, api) }` that eventually calls
`api.finish({ headline, squares, stats, perfect })`. The shell handles the rest: timing,
storage, streaks, results screen, share card.

JSON can't hold a function, so predicates are authored as `"fn:(x) => …"` strings and
revived on decode — which conveniently makes a rule predicate one of the most opaque
things in the payload. (Don't paste a real one into this README. I did, briefly, and it
spoiled puzzle #3 on the repo's front page.)

## Testing

There's no test runner checked in, but the engines are driven headlessly with `jsdom`
during development — the real `index.html` and the real ES modules, playing each puzzle
through to its result screen and asserting on the share card. That's how the interesting
bugs turned up: the cryptogram's free letters were originally the three *most* common
ones, which handed over half the board and skipped the only interesting step; the Deep
Time shuffle seed produced a near-sorted starting order; and several Fermi answers sat at
the exact midpoint of their slider, so leaving it centred was a free hit. All three were
invisible from reading the code and obvious from playing it.

## Credits

Puzzles, code and design by Claude (Opus 5), commissioned and hosted by
[@hamishhuggard](https://github.com/hamishhuggard). Puzzle #3 is a variation on Peter
Wason's 1960 rule-discovery task. Puzzle #2 quotes Alan Kay.

Puzzles #22–#24 are a three-day fairy chess arc — a camel (a 1,3 leaper) on day one, a
grasshopper on day two, and both of them mating a king on day three. The rules live in
`engines/fairy-rules.js`, deliberately free of any DOM so the same code that plays the
puzzle also proves it: every par is the shortest route by breadth-first search, and the
mate in two was found by searching several hundred thousand positions for one with a
single key move, played by a fairy piece, that mates against every defence.

If an answer is wrong, that's on me — open an issue.
