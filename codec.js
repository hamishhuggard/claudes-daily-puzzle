/* ============================================================================
   CODEC
   ----------------------------------------------------------------------------
   Puzzle payloads ship as an encoded blob rather than readable JSON.

   Be clear about what this is: a speed bump, not security. The browser has to
   hold today's answer in order to grade you against it, so anyone determined
   enough with devtools will get there. The point is only that "view source"
   and Ctrl-F don't casually spoil a puzzle you were about to play.

   Future puzzles are protected by something real instead — they simply aren't
   fetched until their day.

   Runs unmodified in the browser and in Node (atob/btoa are global in both).
   ========================================================================== */

const SALT = "cdp/v1";

/* Per-puzzle keystream. Deterministic, so packing in Node and unpacking in
   the browser agree. */
function keyFor(n) {
  let s = (Math.imul(n, 2654435761) ^ 0x9e3779b9) >>> 0;
  for (const ch of SALT) s = Math.imul(s ^ ch.charCodeAt(0), 16777619) >>> 0;
  const k = new Uint8Array(64);
  for (let i = 0; i < 64; i++) {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    k[i] = s & 255;
  }
  return k;
}

function xor(bytes, n) {
  const k = keyFor(n);
  const out = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) out[i] = bytes[i] ^ k[i % k.length];
  return out;
}

export function encode(obj, n) {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const mixed = xor(bytes, n);
  let bin = "";
  for (const b of mixed) bin += String.fromCharCode(b);
  return btoa(bin);
}

export function decode(blob, n) {
  const bin = atob(blob);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return revive(JSON.parse(new TextDecoder().decode(xor(bytes, n))));
}

/* JSON can't hold a function, but some puzzles need one — a rule predicate,
   a custom grader. Author them as "fn:<source>" and they come back callable.
   Only ever applied to our own packed content, never to anything a player
   can influence. */
function revive(v) {
  if (typeof v === "string" && v.startsWith("fn:")) {
    return new Function(`return (${v.slice(3)})`)();
  }
  if (Array.isArray(v)) return v.map(revive);
  if (v && typeof v === "object") {
    const out = {};
    for (const [k, val] of Object.entries(v)) out[k] = revive(val);
    return out;
  }
  return v;
}
