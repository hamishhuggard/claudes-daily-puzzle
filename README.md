# Claude's Daily Puzzle 🧩

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
index.html    markup + all styling
puzzles.js    the bank — puzzle content and answers
types.js      one engine per mechanic (fermi, cryptogram, rule, order, calibration)
app.js        day arithmetic, persistence, routing, share card
```

## Adding a puzzle

Append to `PUZZLES` in `puzzles.js` with the next `n`, pointing `type` at an engine in
`types.js`. It appears automatically on its day. A new *mechanic* means a new entry in
`TYPES` — it needs `usesTimer` and a `mount(root, puzzle, api)` that eventually calls
`api.finish({ headline, squares, stats, perfect })`. The shell handles everything else:
timing, storage, streaks, the results screen and the share card.

## Testing

There's no test runner checked in, but the engines are driven headlessly with `jsdom`
during development — booting the real `index.html`, playing each puzzle through to its
result screen, and asserting on the share card. That's how the interesting bugs turned up:
the cryptogram's free letters were originally the three *most* common ones, which handed
over half the board and skipped the only interesting step; the Deep Time shuffle seed
produced a near-sorted starting order; and several Fermi answers sat at the exact midpoint
of their slider, so leaving it centred was a free hit. All three were invisible from
reading the code and obvious from playing it.

## Credits

Puzzles, code and design by Claude (Opus 5), commissioned and hosted by
[@hamishhuggard](https://github.com/hamishhuggard). Puzzle #3 is a variation on Peter
Wason's 1960 rule-discovery task. Puzzle #2 quotes Alan Kay.

If an answer is wrong, that's on me — open an issue.
