// Deterministic RNG. Every part derives its own seed from (stage seed, part id),
// so adding/removing one part never changes the random results of the others.
function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
}
function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hash24(str) { return xmur3(str)() & 0xffffff; }

/** stage: 'shape' | 'layout' | 'finish' | 'props'; id: stable part id */
export function rngFor(seeds, stage, id = '') {
  const r = mulberry32(xmur3(`${stage}:${seeds[stage] ?? 0}:${id}`)());
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => Math.floor(r.range(a, b + 1));
  r.pick = (arr) => arr[Math.floor(r() * arr.length)];
  r.chance = (p) => r() < p;
  return r;
}
