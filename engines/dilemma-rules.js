/* ============================================================================
   DILEMMA — rules core
   ----------------------------------------------------------------------------
   No DOM. engines/dilemma.js runs the matches; this file holds the opponents
   and the arithmetic, and is the same code the authoring tool used to compute
   the ceiling for each match by brute force.

   The game is the iterated prisoner's dilemma. Each round both sides choose
   COOPERATE or DEFECT at the same time, and the payoffs are the standard ones:

                       they cooperate   they defect
     you cooperate            3 / 3          0 / 5
     you defect               5 / 0          1 / 1

   Every opponent here is a deterministic function of the history, so a whole
   match is decided by the eight choices the player makes — which means the
   best possible score against a given opponent can be found exactly, by trying
   all 256 sequences. That is what `ceiling` does, and it is the par.

   The puzzle is that you are not told which opponent you are facing, and the
   strategies that behave identically while you are being nice only separate
   once you defect. Telling a forgiver from a grudge-holder REQUIRES defecting
   and then cooperating to see whether you are forgiven, and that probe costs
   real points. Information is not free here; it is bought at a known price.
   ========================================================================== */

export const C = 0, D = 1;

/* [yourPayoff, theirPayoff] indexed [you][them]. */
const PAYOFF = [
  [[3, 3], [0, 5]],
  [[5, 0], [1, 1]],
];

export const payoff = (you, them) => PAYOFF[you][them];

/* Each strategy sees the full history so far as two arrays, oldest first:
   `mine` is the opponent's own past moves, `yours` is the player's. */
export const STRATEGIES = {
  saint: {
    name: "The Saint",
    blurb: "Cooperates every round, whatever you do.",
    play: () => C,
  },
  brute: {
    name: "The Brute",
    blurb: "Defects every round, whatever you do.",
    play: () => D,
  },
  mirror: {
    name: "The Mirror",
    blurb: "Cooperates first, then copies your last move.",
    play: (mine, yours) => (yours.length ? yours[yours.length - 1] : C),
  },
  suspect: {
    name: "The Suspect",
    blurb: "Defects first, then copies your last move.",
    play: (mine, yours) => (yours.length ? yours[yours.length - 1] : D),
  },
  grudge: {
    name: "The Grudge",
    blurb: "Cooperates until you defect once — then defects forever.",
    play: (mine, yours) => (yours.includes(D) ? D : C),
  },
  patient: {
    name: "The Patient",
    blurb: "Cooperates unless you defected in both of the last two rounds.",
    play: (mine, yours) => (yours.length >= 2
      && yours[yours.length - 1] === D && yours[yours.length - 2] === D ? D : C),
  },
  clock: {
    name: "The Clock",
    blurb: "Cooperates, defects, cooperates, defects — ignoring you completely.",
    play: (mine) => (mine.length % 2 === 0 ? C : D),
  },
  pavlov: {
    name: "Pavlov",
    blurb: "Repeats its last move if it scored well, switches if it didn't.",
    play: (mine, yours) => {
      if (!mine.length) return C;
      const last = mine[mine.length - 1], theirs = yours[yours.length - 1];
      const won = payoff(last, theirs)[0] >= 3;   // 3 or 5: keep doing that
      return won ? last : 1 - last;
    },
  },
};

/* Play one match out. `moves` is the player's choices, oldest first. */
export function playMatch(key, moves) {
  const strat = STRATEGIES[key];
  const mine = [], yours = [];
  let you = 0, them = 0;
  const rounds = [];
  for (const move of moves) {
    const theirMove = strat.play(mine, yours);
    const [a, b] = payoff(move, theirMove);
    you += a; them += b;
    rounds.push({ you: move, them: theirMove, gained: a });
    mine.push(theirMove); yours.push(move);
  }
  return { you, them, rounds };
}

/* The most a player could possibly score against this opponent over `n`
   rounds, found by trying every sequence. With n = 8 that is 256 matches,
   which is nothing, and it means par is the true maximum rather than an
   estimate. */
export function ceiling(key, n) {
  let best = -1, bestMoves = null;
  for (let bits = 0; bits < (1 << n); bits++) {
    const moves = [];
    for (let i = 0; i < n; i++) moves.push((bits >> i) & 1);
    const r = playMatch(key, moves);
    if (r.you > best) { best = r.you; bestMoves = moves; }
  }
  return { score: best, moves: bestMoves };
}

/* What always-cooperate scores — the floor a trusting player gets, and the
   number worth comparing the ceiling against. */
export const ifAlwaysNice = (key, n) =>
  playMatch(key, new Array(n).fill(C)).you;

/* Two opponents are only worth putting in the same puzzle if telling them
   apart costs something. This returns the first round at which they diverge,
   for a player who cooperates throughout — INFINITY meaning a nice player can
   never tell them apart at all, which is exactly the interesting case. */
export function divergenceIfNice(a, b, n) {
  const nice = new Array(n).fill(C);
  const ra = playMatch(a, nice).rounds.map((r) => r.them);
  const rb = playMatch(b, nice).rounds.map((r) => r.them);
  for (let i = 0; i < n; i++) if (ra[i] !== rb[i]) return i + 1;
  return Infinity;
}
