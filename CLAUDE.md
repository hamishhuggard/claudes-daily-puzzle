# Claude's Daily Puzzle

A static site: one puzzle a day, no accounts, nothing leaves the device.

## Shipping — read this before saying a puzzle batch is done

**The site deploys from `origin/main`. Work that is not pushed does not exist.**

This has gone wrong twice. Both times the puzzles were built, tested and correct on
disk, and players got nothing:

- #25–#28 were committed but never pushed; the live site served the stale recycled
  puzzles for five days and #25 was lost permanently.
- #29–#35 were never even committed; they sat untracked, so `origin/main..main` was
  empty and looked clean while the deployed bank still ended at #28.

A batch is finished when, and only when:

```sh
git status --short -- puzzles engines app.js index.html   # must be empty
git fetch && git log --oneline origin/main..main          # must be empty
```

Then confirm `BANK_SIZE` in `puzzles/index.js` on the pushed commit actually covers
the dates being claimed. A `Stop` hook (`.claude/hooks/check-shipped.sh`) enforces
this; if it fires, the work is not done.

When a puzzle looks wrong in production but right locally, check the above **first**,
before decoding blobs or auditing engines. That has been the answer every time.

## Layout

- `app.js` — shell, routing, scoring. `EPOCH` (26 July 2026 = puzzle #1) maps date to
  puzzle number; day N is the Nth day from the epoch.
- `puzzles/index.js` — generated manifest, metadata only (title, blurb, goal, emoji).
  Home card and archive read this.
- `puzzles/NNN.js` — one encoded `blob` per puzzle. Answers, author's notes and
  puzzle data live inside, fetched only on the day it unlocks.
- `engines/<mechanic>.js` + `engines/<mechanic>-rules.js` — the interactive mechanic
  and its rules panel.
- `recommended-delete/` — scratch and throwaway test scripts. Never delete files in
  this repo; move them here and tell Hamish.

## Design rules

- **A fresh mechanic every day.** Reusing a format is not acceptable, even with new
  content.
- **Puzzles must not be calculable** — no mechanic that rewards grinding arithmetic.
- Par values must be *computed by actually solving the puzzle*, not estimated.
- Answers being publicly readable in the repo is accepted. Just keep the GitHub link
  out of the homepage footer so nobody trips over it before playing.
