// Deterministic pseudo-random helpers. Everything in world generation goes
// through these so a seed always rebuilds the same world.

export function hashString(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable hash of 2 integers + seed -> [0,1) */
export function hash2(seed: number, x: number, y: number): number {
  let h = seed ^ 0x9e3779b9;
  h = Math.imul(h ^ (x | 0), 0x85ebca6b);
  h = Math.imul(h ^ (y | 0), 0xc2b2ae35);
  h ^= h >>> 15;
  h = Math.imul(h, 0x27d4eb2d);
  h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}

function smooth(t: number): number {
  return t * t * (3 - 2 * t);
}

/** 1D value noise */
export function noise1(seed: number, x: number): number {
  const xi = Math.floor(x);
  const xf = x - xi;
  const a = hash2(seed, xi, 0);
  const b = hash2(seed, xi + 1, 0);
  return a + (b - a) * smooth(xf);
}

/** 2D value noise */
export function noise2(seed: number, x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const a = hash2(seed, xi, yi);
  const b = hash2(seed, xi + 1, yi);
  const c = hash2(seed, xi, yi + 1);
  const d = hash2(seed, xi + 1, yi + 1);
  const sx = smooth(xf);
  const sy = smooth(yf);
  const top = a + (b - a) * sx;
  const bot = c + (d - c) * sx;
  return top + (bot - top) * sy;
}

export function fbm1(seed: number, x: number, octaves = 4, lac = 2, gain = 0.5): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise1(seed + i * 7771, x * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

export function fbm2(seed: number, x: number, y: number, octaves = 4, lac = 2, gain = 0.5): number {
  let amp = 1;
  let freq = 1;
  let sum = 0;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(seed + i * 9173, x * freq, y * freq) * amp;
    norm += amp;
    amp *= gain;
    freq *= lac;
  }
  return sum / norm;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function randInt(rnd: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rnd() * (hi - lo + 1));
}

export function pick<T>(rnd: () => number, arr: readonly T[]): T {
  const i = Math.min(arr.length - 1, Math.floor(rnd() * arr.length));
  return arr[i] as T;
}
