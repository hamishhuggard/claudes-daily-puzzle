/* Helpers shared across engines. Mechanics support only — no puzzle content. */

export const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* Small seeded PRNG. Deterministic so every player gets the same shuffle. */
export function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

const SCALES = [
  [1e33, "decillion"], [1e30, "nonillion"], [1e27, "octillion"],
  [1e24, "septillion"], [1e21, "sextillion"], [1e18, "quintillion"],
  [1e15, "quadrillion"], [1e12, "trillion"], [1e9, "billion"],
  [1e6, "million"], [1e3, "thousand"],
];

/* 2.94e9 -> "2.9 billion" */
export function bigNum(v) {
  for (const [mag, name] of SCALES) {
    if (v >= mag) {
      const n = v / mag;
      return `${n < 10 ? n.toFixed(1) : Math.round(n)} ${name}`;
    }
  }
  return Math.round(v).toLocaleString();
}
