/* ============================================================================
   FAIRY CHESS — rules core
   ----------------------------------------------------------------------------
   Deliberately free of DOM: engines/fairy.js draws the board, and the authoring
   tools import this same file under Node to prove a position actually works
   (that the mate is forced, that the par really is the shortest route).

   Only the pieces the puzzles use are here, and pawns are not among them —
   promotion, double steps and en passant are a lot of rules to carry for a
   piece none of these puzzles need.
   ========================================================================== */

const ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
const STAR = [...ORTH, ...DIAG];

/* Leaper offsets are generated from a pair {m,n}: all eight sign-and-swap
   combinations. A knight is {1,2}; a camel is {1,3}. */
const leaps = (m, n) => {
  const out = [];
  for (const [a, b] of [[m, n], [n, m]])
    for (const sa of [1, -1])
      for (const sb of [1, -1]) out.push([a * sa, b * sb]);
  return out.filter(([x, y], i, arr) =>
    arr.findIndex(([p, q]) => p === x && q === y) === i);
};

export const PIECES = {
  K:  { name: "King",        glyph: "♚", move: "leap",   offs: STAR },
  Q:  { name: "Queen",       glyph: "♛", move: "ride",   offs: STAR },
  R:  { name: "Rook",        glyph: "♜", move: "ride",   offs: ORTH },
  B:  { name: "Bishop",      glyph: "♝", move: "ride",   offs: DIAG },
  N:  { name: "Knight",      glyph: "♞", move: "leap",   offs: leaps(1, 2) },
  /* The fairies. No standard glyphs exist, so they wear their letter. */
  C:  { name: "Camel",       glyph: "C", move: "leap",   offs: leaps(1, 3), fairy: true },
  G:  { name: "Grasshopper", glyph: "G", move: "hop",    offs: STAR,        fairy: true },
  NN: { name: "Nightrider",  glyph: "NN", move: "ride",  offs: leaps(1, 2), fairy: true },
};

/* ---------- squares -------------------------------------------------------- */

export const FILES = "abcdefgh";
export const xy = (name) => [FILES.indexOf(name[0]), Number(name.slice(1)) - 1];
export const name = (x, y) => FILES[x] + (y + 1);
export const light = (x, y) => (x + y) % 2 === 1;

/* ---------- position ------------------------------------------------------- */

/* A position is { size, at: Map<"e4", {s,t}> } — sparse, because these boards
   hold four pieces, not thirty-two. */
export function position(size, pieces) {
  const at = new Map();
  for (const [s, t, sq] of pieces) at.set(sq, { s, t });
  return { size, at };
}

export const clone = (p) => ({ size: p.size, at: new Map(p.at) });

export function apply(p, mv) {
  const next = clone(p);
  const piece = next.at.get(mv.from);
  next.at.delete(mv.from);
  next.at.set(mv.to, piece);
  return next;
}

const onBoard = (p, x, y) => x >= 0 && y >= 0 && x < p.size && y < p.size;

/* ---------- movement ------------------------------------------------------- */

/* Pseudo-legal destinations for the piece standing on `from`. "Pseudo" because
   it does not yet ask whether the move exposes your own king. */
export function movesFrom(p, from) {
  const piece = p.at.get(from);
  if (!piece) return [];
  const spec = PIECES[piece.t];
  const [x0, y0] = xy(from);
  const out = [];
  const takeable = (sq) => {
    const occ = p.at.get(sq);
    return !occ || occ.s !== piece.s;
  };

  if (spec.move === "leap") {
    for (const [dx, dy] of spec.offs) {
      const x = x0 + dx, y = y0 + dy;
      if (onBoard(p, x, y) && takeable(name(x, y))) out.push(name(x, y));
    }
  }

  if (spec.move === "ride") {
    for (const [dx, dy] of spec.offs) {
      let x = x0 + dx, y = y0 + dy;
      while (onBoard(p, x, y)) {
        const sq = name(x, y);
        if (p.at.has(sq)) { if (takeable(sq)) out.push(sq); break; }
        out.push(sq);
        x += dx; y += dy;
      }
    }
  }

  /* The grasshopper travels along queen lines but may not land anywhere it
     likes: it needs a hurdle — any piece, either colour — and drops on the
     square immediately beyond it. No hurdle, no move. */
  if (spec.move === "hop") {
    for (const [dx, dy] of spec.offs) {
      let x = x0 + dx, y = y0 + dy;
      while (onBoard(p, x, y) && !p.at.has(name(x, y))) { x += dx; y += dy; }
      if (!onBoard(p, x, y)) continue;              // ran off the edge, no hurdle
      const land = [x + dx, y + dy];
      if (!onBoard(p, ...land)) continue;           // hurdle sits on the rim
      const sq = name(...land);
      if (takeable(sq)) out.push(sq);
    }
  }

  return out;
}

export function attacked(p, sq, by) {
  for (const [from, piece] of p.at)
    if (piece.s === by && movesFrom(p, from).includes(sq)) return true;
  return false;
}

export function kingSquare(p, side) {
  for (const [sq, piece] of p.at) if (piece.s === side && piece.t === "K") return sq;
  return null;
}

export function inCheck(p, side) {
  const k = kingSquare(p, side);
  return k ? attacked(p, k, side === "w" ? "b" : "w") : false;
}

/* Every move that side may actually play. With no king on the board for that
   side, nothing is pinned and every pseudo-legal move stands. */
export function legalMoves(p, side) {
  const out = [];
  for (const [from, piece] of p.at) {
    if (piece.s !== side) continue;
    for (const to of movesFrom(p, from)) {
      const mv = { from, to };
      if (!inCheck(apply(p, mv), side)) out.push(mv);
    }
  }
  return out;
}

export const isMate = (p, side) => inCheck(p, side) && legalMoves(p, side).length === 0;
export const isStalemate = (p, side) => !inCheck(p, side) && legalMoves(p, side).length === 0;

/* ---------- solving -------------------------------------------------------- */

/* Can `side` force mate within n of its own moves? Returns the list of first
   moves that do, so the authoring tool can check the key is unique. */
export function mateInN(p, side, n) {
  const other = side === "w" ? "b" : "w";
  const keys = [];
  for (const mv of legalMoves(p, side)) {
    const after = apply(p, mv);
    if (isMate(after, other)) { if (n >= 1) keys.push(mv); continue; }
    if (n <= 1) continue;
    if (isStalemate(after, other)) continue;          // a draw is not a win
    const replies = legalMoves(after, other);
    if (replies.every((r) => mateInN(apply(after, r), side, n - 1).length > 0)) keys.push(mv);
  }
  return keys;
}

/* Shortest route for one piece to walk a list of squares in order, with the
   rest of the board standing still. Used to set par on the reach puzzles. */
export function shortestTour(p, from, targets) {
  let at = from, total = 0;
  for (const target of targets) {
    const seen = new Set([at]);
    let frontier = [at], d = 0, found = false;
    while (frontier.length && !found) {
      const next = [];
      for (const sq of frontier) {
        const hop = apply(p, { from: at, to: sq });   // the piece, standing on sq
        for (const to of movesFrom(hop, sq)) {
          if (seen.has(to)) continue;
          seen.add(to);
          next.push(to);
        }
      }
      d++;
      frontier = next;
      if (next.includes(target)) found = true;
    }
    if (!found) return null;
    total += d;
    at = target;
  }
  return total;
}
