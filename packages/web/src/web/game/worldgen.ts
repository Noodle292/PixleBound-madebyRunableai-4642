import { B, opaque } from "./blocks";
import { CHEST_TIERS } from "./entities";
import { clamp, fbm1, fbm2, hash2, mulberry32, randInt } from "./rng";

export const TILE = 16;
export const WORLD_W = 1000;
export const WORLD_H = 420;
/** Bumped whenever generation changes. Saves record the version that made them. */
export const GENERATOR_VERSION = 3;

export type WorldSize = "small" | "medium" | "large";
export const WORLD_SIZES: Record<WorldSize, { w: number; label: string; desc: string }> = {
  small: { w: 760, label: "Small", desc: "Quick runs · 760 wide" },
  medium: { w: 1000, label: "Medium", desc: "Balanced · 1000 wide" },
  large: { w: 1400, label: "Large", desc: "Epic journeys · 1400 wide" },
};

export type BiomeKey =
  | "forest"
  | "desert"
  | "snow"
  | "fungal"
  | "voidshroud"
  | "jungle"
  | "steppe"
  | "mesa"
  | "ocean";

export type ChestContent = { item: string; count: number }[];

export type World = {
  seed: number;
  generatorVersion: number;
  size: WorldSize;
  surfaceRuins: { x: number; y: number; w: number; h: number }[];
  seedText: string;
  w: number;
  h: number;
  tiles: Uint8Array;
  /** per-column surface height (first opaque tile from the sky, includes islands) */
  surface: Int16Array;
  /** per-column height of the main landmass, used for relative depth */
  ground: Int16Array;
  /** per-column biome */
  biome: Uint8Array;
  chests: Map<number, ChestContent>;
  spawnX: number;
  spawnY: number;
};

// Order matters: saves from older versions index into the first five.
export const BIOME_LIST: BiomeKey[] = ["forest", "desert", "snow", "fungal", "voidshroud", "jungle", "steppe", "mesa", "ocean"];

export const BIOME_NAMES: Record<BiomeKey, string> = {
  forest: "Verdant Reach",
  desert: "Ashen Dunes",
  snow: "White Waste",
  fungal: "Fungal Hollow",
  voidshroud: "Voidshroud",
  jungle: "Mirewood",
  steppe: "Amber Steppe",
  mesa: "Rust Mesa",
  ocean: "Brine Coast",
};

/** Enemy pools are written for the five core biomes; newer biomes borrow one. */
export function biomeFamily(b: BiomeKey): BiomeKey {
  if (b === "mesa") return "desert";
  if (b === "jungle" || b === "steppe" || b === "ocean") return "forest";
  return b;
}

export function biomeAt(world: World, tx: number): BiomeKey {
  const i = clamp(tx | 0, 0, world.w - 1);
  return BIOME_LIST[world.biome[i] ?? 0] ?? "forest";
}

export function idx(world: World, x: number, y: number): number {
  return y * world.w + x;
}

export function getTile(world: World, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= world.w || y >= world.h) return B.STONE;
  return world.tiles[y * world.w + x] as number;
}

export function setTile(world: World, x: number, y: number, v: number) {
  if (x < 0 || y < 0 || x >= world.w || y >= world.h) return;
  world.tiles[y * world.w + x] = v;
  // keep the surface cache fresh so lighting/spawning stays correct
  const s = world.surface[x] ?? 0;
  if (opaque(v) && y < s) world.surface[x] = y;
  else if (v === B.AIR && y === s) {
    let ny = y;
    while (ny < world.h - 1 && !opaque(world.tiles[ny * world.w + x] as number)) ny++;
    world.surface[x] = ny;
  }
}

export const SKY_H = 90; // rows of sky above the main terrain band
const UNDER_DEPTH = 28; // tiles below local ground where "underground" begins
export const DEEP_START = 190; // absolute y where the deep layer begins

export function layerAt(world: World, y: number, x?: number): "surface" | "under" | "deep" {
  if (y >= DEEP_START) return "deep";
  const g = x === undefined ? SKY_H + 26 : (world.ground[clamp(x | 0, 0, world.w - 1)] ?? SKY_H + 26);
  if (y - g > UNDER_DEPTH) return "under";
  return "surface";
}

function rollLoot(rnd: () => number, tier: number): ChestContent {
  const t = CHEST_TIERS[clamp(tier, 0, CHEST_TIERS.length - 1)];
  const out: ChestContent = [];
  if (!t) return out;
  for (const e of t.entries) {
    if (rnd() <= e.chance) {
      const n = randInt(rnd, e.min, e.max);
      if (n > 0) out.push({ item: e.item, count: n });
    }
  }
  return out;
}

function placeChest(world: World, rnd: () => number, x: number, y: number, tier: number) {
  if (x < 2 || y < 2 || x >= world.w - 2 || y >= world.h - 2) return;
  world.tiles[y * world.w + x] = B.CHEST;
  world.chests.set(y * world.w + x, rollLoot(rnd, tier));
}

type BiomeParams = { off: number; rough: number };
const PARAMS: Record<BiomeKey, BiomeParams> = {
  forest: { off: 0, rough: 7 },
  desert: { off: 5, rough: 3 },
  snow: { off: -11, rough: 13 },
  fungal: { off: 4, rough: 6 },
  voidshroud: { off: 2, rough: 9 },
  jungle: { off: 3, rough: 8 },
  steppe: { off: -2, rough: 2.5 },
  mesa: { off: -7, rough: 6 },
  ocean: { off: 24, rough: 2 },
};

const STONEY = new Set<number>([B.STONE, B.MOSS, B.SANDSTONE, B.VOIDSTONE]);

function shuffle<T>(rnd: () => number, a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const t = a[i] as T;
    a[i] = a[j] as T;
    a[j] = t;
  }
  return a;
}

export type GenOptions = { size?: WorldSize };

export function generateWorld(seedText: string, opts: GenOptions = {}): World {
  const size: WorldSize = opts.size ?? "medium";
  const seedNum = normalizeSeed(seedText);
  const rnd = mulberry32(seedNum ^ 0x3a7e);
  const w = WORLD_SIZES[size].w;
  const h = WORLD_H;
  const tiles = new Uint8Array(w * h);
  const surface = new Int16Array(w);
  const ground = new Int16Array(w);
  const biome = new Uint8Array(w);
  const world: World = {
    seed: seedNum,
    generatorVersion: GENERATOR_VERSION,
    size,
    surfaceRuins: [],
    seedText,
    w,
    h,
    tiles,
    surface,
    ground,
    biome,
    chests: new Map(),
    spawnX: 0,
    spawnY: 0,
  };
  const at = (x: number, y: number) => tiles[y * w + x] as number;
  const put = (x: number, y: number, v: number) => {
    if (x >= 1 && y >= 1 && x < w - 1 && y < h - 1) tiles[y * w + x] = v;
  };

  /* ------------------------- biome layout ------------------------- */
  const ocean = size === "small" ? 40 : 52;
  const cHalf = Math.floor(w * 0.085);
  const centerStart = Math.floor(w / 2) - cHalf;
  const centerEnd = Math.floor(w / 2) + cHalf;
  const required: BiomeKey[] = ["desert", "snow", "fungal", "voidshroud"];
  const fillers: BiomeKey[] = shuffle(rnd, ["jungle", "steppe", "mesa", "forest"]);
  const fillerCount = size === "small" ? 2 : size === "medium" ? 3 : 4;
  const hot = new Set<BiomeKey>(["desert", "mesa"]);
  let left: BiomeKey[] = [];
  let right: BiomeKey[] = [];
  for (let attempt = 0; attempt < 40; attempt++) {
    const req = shuffle(rnd, [...required]);
    const fil = fillers.slice(0, fillerCount);
    const l = [req[0]!, req[1]!];
    const r = [req[2]!, req[3]!];
    fil.forEach((f, i) => (i % 2 === 0 ? l : r).push(f));
    shuffle(rnd, l);
    shuffle(rnd, r);
    // Voidshroud is the frontier: keep it furthest from spawn.
    for (const side of [l, r]) {
      const vi = side.indexOf("voidshroud");
      if (vi >= 0) side.push(...side.splice(vi, 1));
    }
    const seq = [...[...l].reverse(), "forest" as BiomeKey, ...r];
    let ok = true;
    for (let i = 1; i < seq.length; i++) {
      const a = seq[i - 1]!, b = seq[i]!;
      if (a === b) ok = false;
      if ((hot.has(a) && b === "snow") || (hot.has(b) && a === "snow")) ok = false;
    }
    left = l;
    right = r;
    if (ok) break;
  }
  const lay = (from: number, to: number, list: BiomeKey[], outward: -1 | 1) => {
    const weights = list.map(() => 0.75 + rnd() * 0.5);
    const total = weights.reduce((s, v) => s + v, 0);
    const span = to - from;
    let cursor = outward === 1 ? from : to;
    list.forEach((b, i) => {
      const len = i === list.length - 1 ? Math.abs((outward === 1 ? to : from) - cursor) : Math.round((span * weights[i]!) / total);
      const a = outward === 1 ? cursor : cursor - len;
      const z = outward === 1 ? cursor + len : cursor;
      for (let x = Math.max(0, a); x < Math.min(w, z); x++) biome[x] = BIOME_LIST.indexOf(b);
      cursor = outward === 1 ? z : a;
    });
  };
  for (let x = 0; x < w; x++) biome[x] = 0;
  lay(ocean, centerStart, left, -1);
  lay(centerEnd, w - ocean, right, 1);
  for (let x = 0; x < ocean; x++) {
    biome[x] = BIOME_LIST.indexOf("ocean");
    biome[w - 1 - x] = BIOME_LIST.indexOf("ocean");
  }
  // dither seams a few columns so material borders aren't ruler-straight
  for (let x = 2; x < w - 2; x++) {
    if (biome[x] !== biome[x - 1]) {
      const shift = Math.round((hash2(seedNum, x, 7) - 0.5) * 6);
      const from = biome[x - 1] as number;
      if (shift > 0) for (let k = 0; k < shift && x + k < w; k++) biome[x + k] = from;
      x += Math.max(0, shift) + 2;
    }
  }
  const bAt = (x: number) => BIOME_LIST[biome[clamp(x, 0, w - 1)] ?? 0] as BiomeKey;

  /* -------------------------- height map -------------------------- */
  // Biome parameters are box-blurred so terrain eases between biomes.
  const blend = 26;
  const offP = new Float32Array(w);
  const roughP = new Float32Array(w);
  const mesaW = new Float32Array(w);
  const desertW = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let o = 0, r = 0, m = 0, d = 0, n = 0;
    for (let k = -blend; k <= blend; k++) {
      const b = bAt(x + k);
      const wt = 1 - Math.abs(k) / (blend + 1);
      o += PARAMS[b].off * wt;
      r += PARAMS[b].rough * wt;
      if (b === "mesa") m += wt;
      if (b === "desert") d += wt;
      n += wt;
    }
    offP[x] = o / n;
    roughP[x] = r / n;
    mesaW[x] = m / n;
    desertW[x] = d / n;
  }
  const baseY = SKY_H + 26;
  const seaLevel = baseY + 7;
  const hf = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    const big = (fbm1(seedNum, x * 0.0045, 4) - 0.5) * 30;
    const mid = (fbm1(seedNum + 31, x * 0.021, 3) - 0.5) * 2 * (roughP[x] as number);
    const fine = (fbm1(seedNum + 57, x * 0.07, 2) - 0.5) * 1.6;
    let y = baseY + (offP[x] as number) + big * (1 - Math.min(1, Math.max(0, (offP[x] as number) - 10) / 14)) + mid + fine;
    // rolling dunes
    y += Math.sin(x * 0.085 + fbm1(seedNum + 77, x * 0.01, 2) * 6) * 2.4 * (desertW[x] as number);
    // mesa terraces: soft steps that the slope limiter turns into ledges
    const mw = mesaW[x] as number;
    if (mw > 0) y = y + (Math.round(y / 6) * 6 - y) * 0.85 * mw;
    hf[x] = y;
  }
  const heights = new Int16Array(w);
  for (let x = 0; x < w; x++) heights[x] = clamp(Math.round(hf[x] as number), SKY_H - 14, SKY_H + 62);
  const fixed = new Uint8Array(w);
  const limit = (maxStep: (x: number) => number) => {
    for (let pass = 0; pass < 4; pass++) {
      for (let x = 1; x < w; x++) {
        if (fixed[x]) continue;
        const m = maxStep(x);
        const p = heights[x - 1] as number;
        if ((heights[x] as number) - p > m) heights[x] = p + m;
        else if (p - (heights[x] as number) > m) heights[x] = p - m;
      }
      for (let x = w - 2; x >= 0; x--) {
        if (fixed[x]) continue;
        const m = maxStep(x);
        const p = heights[x + 1] as number;
        if ((heights[x] as number) - p > m) heights[x] = p + m;
        else if (p - (heights[x] as number) > m) heights[x] = p - m;
      }
    }
    // no one-column pillars or pits
    for (let x = 1; x < w - 1; x++) {
      if (fixed[x]) continue;
      const a = heights[x - 1] as number, b = heights[x + 1] as number, c = heights[x] as number;
      if (a === b && c !== a) heights[x] = a;
      else if (Math.abs(c - a) >= 2 && Math.abs(c - b) >= 2 && Math.sign(c - a) === Math.sign(c - b)) heights[x] = Math.round((a + b) / 2);
    }
  };
  const stepFor = (x: number) => ((mesaW[x] as number) > 0.5 ? 3 : (roughP[x] as number) > 10 ? 2 : 2);
  // gentle smoothing then slope limiting
  for (let pass = 0; pass < 2; pass++) {
    const copy = Float32Array.from(heights);
    for (let x = 2; x < w - 2; x++) {
      heights[x] = Math.round(((copy[x - 2] as number) + (copy[x - 1] as number) * 2 + (copy[x] as number) * 3 + (copy[x + 1] as number) * 2 + (copy[x + 2] as number)) / 9);
    }
  }
  limit(stepFor);

  /* ------------------------------ spawn --------------------------- */
  let sx = Math.floor(w / 2);
  {
    let best = Infinity;
    for (let x = Math.floor(w / 2) - 30; x <= Math.floor(w / 2) + 30; x++) {
      let rough = 0;
      for (let k = -5; k <= 5; k++) rough += Math.abs((heights[x + k] as number) - (heights[x] as number));
      rough += Math.abs(x - w / 2) * 0.05;
      if (rough < best) {
        best = rough;
        sx = x;
      }
    }
    // a small, natural-looking flat clearing (no carved pit)
    const sy = heights[sx] as number;
    for (let x = sx - 3; x <= sx + 3; x++) {
      heights[x] = sy;
      fixed[x] = 1;
    }
    limit(stepFor);
  }

  /* ---------------------------- lakes ----------------------------- */
  const water = new Int16Array(w).fill(-1); // water surface y per column, -1 = none
  const lakes: { x0: number; x1: number; level: number }[] = [];
  {
    const want = Math.round(w / 85);
    let lastX = -999;
    const order = shuffle(rnd, Array.from({ length: Math.floor((w - 2 * ocean - 60) / 6) }, (_, i) => ocean + 30 + i * 6));
    for (const cx0 of order) {
      if (lakes.length >= want) break;
      const b = bAt(cx0);
      if (b === "voidshroud" || b === "ocean" || b === "mesa") continue;
      if (Math.abs(cx0 - sx) < 34) continue;
      if (lakes.some((l) => Math.abs((l.x0 + l.x1) / 2 - cx0) < 48)) continue;
      // walk downhill to the local valley floor
      let cx = cx0;
      for (let i = 0; i < 30; i++) {
        if ((heights[cx + 1] as number) > (heights[cx] as number)) cx++;
        else if ((heights[cx - 1] as number) > (heights[cx] as number)) cx--;
        else break;
      }
      if (Math.abs(cx - sx) < 30) continue;
      const r = randInt(rnd, 7, b === "desert" ? 9 : 13);
      const hl = heights[cx - r] as number;
      const hr = heights[cx + r] as number;
      if (Math.abs(hl - hr) > 2) continue;
      const level = Math.max(hl, hr);
      let humpy = false;
      for (let x = cx - r + 1; x < cx + r; x++) if ((heights[x] as number) < level - 3) humpy = true;
      if (humpy) continue;
      const depth = randInt(rnd, 3, b === "desert" ? 4 : 6);
      for (let x = cx - r + 1; x < cx + r; x++) {
        const f = 1 - ((x - cx) / r) ** 2;
        const bottom = level + 1 + Math.round(depth * Math.sqrt(Math.max(0, f)));
        heights[x] = Math.max(heights[x] as number, bottom);
        fixed[x] = 1;
        water[x] = level;
      }
      lakes.push({ x0: cx - r + 1, x1: cx + r - 1, level });
      lastX = cx;
    }
    void lastX;
    // seas at both edges
    for (let x = 0; x < w; x++) {
      if (bAt(x) !== "ocean" && !(x < ocean + 8 || x > w - ocean - 9)) continue;
      if ((heights[x] as number) > seaLevel) water[x] = seaLevel;
    }
    limit(stepFor);
  }
  ground.set(heights);

  /* ----------------------- terrain fill --------------------------- */
  for (let x = 0; x < w; x++) {
    const top = heights[x] as number;
    const b = bAt(x);
    const soil = 4 + Math.floor(fbm1(seedNum + 7, x * 0.05, 2) * 6);
    const lakeBed = water[x] !== -1;
    for (let y = top; y < h; y++) {
      const d = y - top;
      let t: number = B.STONE;
      switch (b) {
        case "desert":
          t = d < soil + 5 ? B.SAND : d < soil + 26 ? B.SANDSTONE : B.STONE;
          break;
        case "mesa": {
          if (d < 2) t = B.RED_SAND;
          else if (d < 30) {
            const band = Math.floor((y + fbm1(seedNum + 88, x * 0.03, 2) * 3) / 3) % 4;
            t = band === 0 ? B.CLAY : band === 1 ? B.RED_SAND : band === 2 ? B.SANDSTONE : B.CLAY;
          }
          break;
        }
        case "snow":
          t = d === 0 ? B.SNOW : d < 3 ? B.SNOW : d < soil ? B.DIRT : d < soil + 8 && fbm2(seedNum + 9, x * 0.1, y * 0.1, 2) > 0.58 ? B.ICE : B.STONE;
          break;
        case "jungle":
          t = d === 0 ? B.JUNGLE_GRASS : d < soil + 5 ? B.MUD : B.STONE;
          break;
        case "steppe":
          t = d === 0 ? B.STEPPE_GRASS : d < soil ? B.DIRT : B.STONE;
          break;
        case "fungal":
          t = d < 2 ? B.FUNGAL : d < soil ? B.DIRT : B.STONE;
          break;
        case "voidshroud":
          t = d < soil ? B.ASH : B.STONE;
          break;
        case "ocean":
          t = d < soil + 3 ? B.SAND : B.STONE;
          break;
        default:
          t = d === 0 ? B.GRASS : d < soil ? B.DIRT : B.STONE;
      }
      if (lakeBed && d < 2 && b !== "snow") t = B.SAND;
      if (t === B.STONE) {
        if (y > h - 18) t = B.VOIDSTONE;
        else if (y < DEEP_START && fbm2(seedNum + 65, x * 0.05, y * 0.05, 2) > 0.76) t = B.MOSS;
        else if (d < 60 && fbm2(seedNum + 66, x * 0.07, y * 0.07, 2) > 0.74) t = b === "jungle" ? B.MUD : B.DIRT;
      }
      if (t === B.DIRT && fbm2(seedNum + 55, x * 0.08, y * 0.08, 2) > 0.73) t = B.CLAY;
      if (b === "fungal" && t === B.STONE && d < 100 && fbm2(seedNum + 303, x * 0.07, y * 0.07, 2) > 0.5) t = B.FUNGAL;
      if (b === "voidshroud" && t === B.STONE && d > 14 && d < 120 && fbm2(seedNum + 404, x * 0.06, y * 0.06, 2) > 0.56) t = B.VOIDSTONE;
      tiles[y * w + x] = t;
    }
    // sandy shoreline next to water
    if (!lakeBed && (water[x - 1] !== undefined && water[x - 1] !== -1 || water[x + 1] !== undefined && water[x + 1] !== -1)) {
      if (b !== "snow" && b !== "voidshroud") for (let d = 0; d < 2; d++) tiles[(top + d) * w + x] = B.SAND;
    }
  }

  /* --------------------------- caves ------------------------------ */
  const carve = (cx: number, cy: number, r: number) => {
    const ri = Math.ceil(r);
    for (let y = cy - ri; y <= cy + ri; y++)
      for (let x = cx - ri; x <= cx + ri; x++) {
        if (x < 2 || y < 2 || x >= w - 2 || y >= h - 3) continue;
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) tiles[y * w + x] = B.AIR;
      }
  };
  // Noise caves fade in with depth, so the surface stays intact.
  for (let x = 2; x < w - 2; x++) {
    const top = heights[x] as number;
    for (let y = top + 18; y < h - 4; y++) {
      const d = y - top;
      const fade = clamp((d - 22) / 40, 0, 1);
      if (fade <= 0) continue;
      const cheese = fbm2(seedNum + 101, x * 0.04, y * 0.065, 3);
      let carveIt = cheese > 0.7 - 0.07 * fade - (y > DEEP_START ? 0.025 : 0);
      if (!carveIt) {
        // spaghetti tunnels: thin ridges of noise, connected across the map
        const s1 = Math.abs(fbm2(seedNum + 202, x * 0.018, y * 0.03, 2) - 0.5);
        const s2 = Math.abs(fbm2(seedNum + 203, x * 0.026, y * 0.02, 2) - 0.5);
        carveIt = s1 < 0.016 * fade || s2 < 0.012 * fade;
      }
      if (carveIt) tiles[y * w + x] = B.AIR;
    }
  }
  // A few deliberate cave entrances that wind down from the surface.
  {
    const count = Math.max(3, Math.round(w / 170));
    const used: number[] = [];
    for (let i = 0, tries = 0; i < count && tries < 200; tries++) {
      const x0 = randInt(rnd, ocean + 20, w - ocean - 20);
      if (Math.abs(x0 - sx) < 45 || water[x0] !== -1 || used.some((u) => Math.abs(u - x0) < 70)) continue;
      if (Math.abs((heights[x0 - 3] as number) - (heights[x0 + 3] as number)) > 3) continue;
      used.push(x0);
      i++;
      let x = x0;
      let y = (heights[x0] as number) - 1;
      let ang = Math.PI / 2 + (rnd() - 0.5) * 0.9;
      const len = randInt(rnd, 70, 120);
      for (let s = 0; s < len; s++) {
        const r = s < 4 ? 1.6 : 1.8 + fbm1(seedNum + i * 31, s * 0.12, 2) * 1.2;
        carve(Math.round(x), Math.round(y), r);
        ang += (fbm1(seedNum + i * 97, s * 0.08, 2) - 0.5) * 0.35;
        ang = clamp(ang, 0.35, Math.PI - 0.35);
        x += Math.cos(ang);
        y += Math.sin(ang) * 0.85;
        if (y > (heights[clamp(Math.round(x), 0, w - 1)] as number) + 70) break;
      }
    }
  }
  // Large caverns, always well below the local ground.
  const caverns = Math.round(w / 40);
  for (let i = 0; i < caverns; i++) {
    const cx = randInt(rnd, 40, w - 40);
    const rx = randInt(rnd, 14, 30);
    const ry = randInt(rnd, 7, 13);
    const minY = (heights[cx] as number) + 52 + ry;
    if (minY > h - 40) continue;
    const cy = randInt(rnd, minY, h - 34);
    for (let y = cy - ry; y <= cy + ry; y++)
      for (let x = cx - rx; x <= cx + rx; x++) {
        if (x < 2 || y < 2 || x >= w - 2 || y >= h - 4) continue;
        const dx = (x - cx) / rx;
        const dy = (y - cy) / ry;
        const edge = (fbm2(seedNum + i * 13, x * 0.11, y * 0.11, 2) - 0.5) * 0.5;
        if (dx * dx + dy * dy < 0.85 + edge) tiles[y * w + x] = B.AIR;
      }
    if (rx > 20) {
      const fx = cx + randInt(rnd, -rx + 5, rx - 5);
      let fy = cy;
      while (fy < h - 4 && tiles[fy * w + fx] === B.AIR) fy++;
      if (fy < h - 4 && tiles[(fy - 1) * w + fx] === B.AIR) placeChest(world, rnd, fx, fy - 1, cy > DEEP_START ? 3 : 2);
    }
  }
  // One cellular pass to round off jagged single-tile noise underground.
  {
    const copy = tiles.slice();
    for (let x = 2; x < w - 2; x++) {
      const top = (heights[x] as number) + 6;
      for (let y = Math.max(top, 3); y < h - 4; y++) {
        let solid = 0;
        for (let oy = -1; oy <= 1; oy++)
          for (let ox = -1; ox <= 1; ox++) if ((ox || oy) && copy[(y + oy) * w + x + ox] !== B.AIR) solid++;
        const cur = copy[y * w + x] as number;
        if (cur === B.AIR && solid >= 7) tiles[y * w + x] = copy[(y + 1) * w + x] || B.STONE;
        else if (cur !== B.AIR && cur !== B.CHEST && solid <= 1) tiles[y * w + x] = B.AIR;
      }
    }
  }
  // Biome-flavoured cave linings.
  for (let x = 2; x < w - 2; x++) {
    const b = bAt(x);
    const top = heights[x] as number;
    for (let y = top + 10; y < Math.min(h - 4, top + 110); y++) {
      const t = at(x, y);
      if (t === B.AIR || !STONEY.has(t)) continue;
      const exposed = at(x, y - 1) === B.AIR;
      if (!exposed) continue;
      if (b === "snow" && hash2(seedNum, x, y) > 0.4) tiles[y * w + x] = B.ICE;
      else if (b === "jungle" && hash2(seedNum, x, y) > 0.35) tiles[y * w + x] = B.MOSS;
      else if (b === "fungal") {
        tiles[y * w + x] = B.FUNGAL;
        if (hash2(seedNum + 5, x, y) > 0.82) put(x, y - 1, B.GLOWCAP);
      }
    }
  }

  /* --------------------------- ore veins -------------------------- */
  type OreSpec = { block: number; per1000: number; r: [number, number]; rel?: [number, number]; abs?: [number, number]; bias?: number };
  const ores: OreSpec[] = [
    { block: B.COPPER, per1000: 560, r: [1.1, 2.2], rel: [7, 150], bias: 1.6 },
    { block: B.IRON, per1000: 430, r: [1.1, 2.0], rel: [26, 230], bias: 1.3 },
    { block: B.SILVER, per1000: 300, r: [1.0, 1.9], rel: [70, 280] },
    { block: B.GOLD, per1000: 230, r: [1.0, 1.8], abs: [DEEP_START - 30, h - 10] },
    { block: B.CRYSTAL, per1000: 170, r: [1.0, 1.7], abs: [DEEP_START + 10, h - 8] },
    { block: B.STARSTONE, per1000: 75, r: [0.9, 1.6], abs: [DEEP_START + 30, h - 6] },
    { block: B.AETHERITE, per1000: 95, r: [0.9, 1.5], abs: [DEEP_START + 80, h - 4] },
  ];
  for (const o of ores) {
    const n = Math.round((o.per1000 * w) / 1000);
    for (let i = 0; i < n; i++) {
      const x = randInt(rnd, 3, w - 4);
      let y: number;
      if (o.rel) {
        const t = Math.pow(rnd(), o.bias ?? 1);
        y = (heights[x] as number) + o.rel[0] + Math.floor(t * (o.rel[1] - o.rel[0]));
      } else y = randInt(rnd, o.abs![0], o.abs![1]);
      if (y < 3 || y > h - 4) continue;
      const r = o.r[0] + rnd() * (o.r[1] - o.r[0]);
      const ri = Math.ceil(r);
      for (let dy = -ri; dy <= ri; dy++)
        for (let dx = -ri; dx <= ri; dx++) {
          const px = x + dx, py = y + dy;
          if (px < 2 || py < 2 || px >= w - 2 || py >= h - 2) continue;
          if (dx * dx + dy * dy > r * r * (0.55 + hash2(seedNum + o.block, px, py) * 0.7)) continue;
          if (STONEY.has(tiles[py * w + px] as number)) tiles[py * w + px] = o.block;
        }
    }
  }

  /* ------------------- underground pools ------------------------- */
  // Fill only true basins, row by row, so liquid never hangs in the air.
  const fillBasin = (x0: number, y0: number, liquid: number) => {
    let y = y0;
    for (let row = 0; row < 4; row++, y--) {
      if (y < 3 || at(x0, y) !== B.AIR) return;
      let a = x0, b = x0;
      while (a > 2 && at(a - 1, y) === B.AIR && x0 - a < 18) a--;
      while (b < w - 3 && at(b + 1, y) === B.AIR && b - x0 < 18) b++;
      if (at(a - 1, y) === B.AIR || at(b + 1, y) === B.AIR) return; // not enclosed
      for (let x = a; x <= b; x++) {
        const below = at(x, y + 1);
        if (below === B.AIR) return; // would leak
      }
      for (let x = a; x <= b; x++) tiles[y * w + x] = liquid;
      if (b - a < 2) return;
    }
  };
  for (let i = 0; i < Math.round(w * 0.55); i++) {
    const x = randInt(rnd, 6, w - 7);
    const y = randInt(rnd, (heights[x] as number) + 30, h - 12);
    if (at(x, y) !== B.AIR) continue;
    let fy = y;
    while (fy < h - 3 && at(x, fy + 1) === B.AIR) fy++;
    fillBasin(x, fy, fy > h - 70 ? B.LAVA : B.WATER);
  }
  for (let x = 0; x < w; x++)
    for (let y = h - 8; y < h - 2; y++) if (tiles[y * w + x] === B.AIR) tiles[y * w + x] = B.LAVA;

  /* ------------------- lakes and sea water ----------------------- */
  for (let x = 0; x < w; x++) {
    const lv = water[x] as number;
    if (lv < 0) continue;
    const top = heights[x] as number;
    for (let y = lv; y < top; y++) tiles[y * w + x] = bAt(x) === "snow" && y === lv ? B.ICE : B.WATER;
  }

  /* --------------------------- surface flora ---------------------- */
  const clearAbove = (x: number, y: number, hgt: number, half: number) => {
    for (let yy = y - hgt; yy <= y; yy++)
      for (let xx = x - half; xx <= x + half; xx++) if (yy < 2 || at(xx, yy) !== B.AIR) return false;
    return true;
  };
  const canopy = (cx: number, cy: number, rx: number, ry: number, leaf: number, salt: number) => {
    for (let dy = -ry; dy <= ry; dy++)
      for (let dx = -rx; dx <= rx; dx++) {
        const v = (dx / (rx + 0.5)) ** 2 + (dy / (ry + 0.5)) ** 2;
        if (v > 1 + (hash2(seedNum + salt, cx + dx, cy + dy) - 0.5) * 0.3) continue;
        if (at(cx + dx, cy + dy) === B.AIR) put(cx + dx, cy + dy, leaf);
      }
  };
  const trunk = (x: number, base: number, hgt: number, id: number) => {
    for (let k = 0; k < hgt; k++) put(x, base - k, id);
  };
  const plant = (x: number, b: BiomeKey) => {
    const top = heights[x] as number;
    const base = top - 1;
    const salt = x * 7;
    switch (b) {
      case "forest": {
        const hgt = randInt(rnd, 5, 8);
        const r = hgt > 6 ? 3 : 2;
        if (!clearAbove(x, base, hgt + r + 1, r)) return false;
        trunk(x, base, hgt, B.TREE_TRUNK);
        canopy(x, base - hgt, r, r - 1 + (hgt > 7 ? 1 : 0), rnd() < 0.12 ? B.BLOSSOM_LEAVES : B.LEAVES, salt);
        return true;
      }
      case "jungle": {
        const hgt = randInt(rnd, 9, 14);
        if (!clearAbove(x, base, hgt + 3, 3)) return false;
        trunk(x, base, hgt, B.TREE_TRUNK);
        canopy(x, base - hgt, 3, 2, B.JUNGLE_LEAVES, salt);
        if (hgt > 11) canopy(x, base - Math.floor(hgt * 0.55), 2, 1, B.JUNGLE_LEAVES, salt + 3);
        return true;
      }
      case "snow": {
        const hgt = randInt(rnd, 7, 11);
        if (!clearAbove(x, base, hgt + 2, 3)) return false;
        trunk(x, base, hgt, B.TREE_TRUNK);
        put(x, base - hgt, B.PINE_LEAVES);
        put(x, base - hgt - 1, B.PINE_LEAVES);
        for (let k = 0; k < hgt - 2; k++) {
          const y = base - hgt + k;
          const spread = Math.min(3, 1 + Math.floor(k / 2.2));
          if (k % 3 === 2) continue; // tiers
          for (let dx = -spread; dx <= spread; dx++) if (dx !== 0 && at(x + dx, y) === B.AIR) put(x + dx, y, B.PINE_LEAVES);
        }
        return true;
      }
      case "steppe": {
        const hgt = randInt(rnd, 4, 6);
        if (!clearAbove(x, base, hgt + 2, 4)) return false;
        trunk(x, base, hgt, B.TREE_TRUNK);
        for (let dx = -4; dx <= 4; dx++) put(x + dx, base - hgt, B.LEAVES);
        for (let dx = -3; dx <= 3; dx++) put(x + dx, base - hgt - 1, B.LEAVES);
        return true;
      }
      case "voidshroud": {
        const hgt = randInt(rnd, 5, 8);
        if (!clearAbove(x, base, hgt + 3, 2)) return false;
        trunk(x, base, hgt, B.PALE_TREE_TRUNK);
        canopy(x, base - hgt, 2, 2, B.PALE_LEAVES, salt);
        return true;
      }
      case "desert": {
        // palms grow only beside an oasis
        const hgt = randInt(rnd, 5, 7);
        if (!clearAbove(x, base, hgt + 2, 3)) return false;
        trunk(x, base, hgt, B.TREE_TRUNK);
        const ty = base - hgt;
        for (let dx = -3; dx <= 3; dx++) put(x + dx, ty, B.JUNGLE_LEAVES);
        put(x, ty - 1, B.JUNGLE_LEAVES);
        put(x - 3, ty + 1, B.JUNGLE_LEAVES);
        put(x + 3, ty + 1, B.JUNGLE_LEAVES);
        return true;
      }
      default:
        return false;
    }
  };
  {
    const gap: Partial<Record<BiomeKey, [number, number]>> = {
      forest: [7, 13],
      jungle: [8, 11],
      snow: [7, 12],
      steppe: [20, 42],
      voidshroud: [9, 16],
    };
    const nearLake = (x: number, dist: number) => lakes.some((l) => x >= l.x0 - dist && x <= l.x1 + dist);
    let next = ocean + 4;
    for (let x = ocean + 4; x < w - ocean - 4; x++) {
      const b = bAt(x);
      const top = heights[x] as number;
      const g = at(x, top);
      const flat = Math.abs((heights[x - 1] as number) - top) <= 1 && Math.abs((heights[x + 1] as number) - top) <= 1;
      if (b === "fungal") {
        if (g === B.FUNGAL && at(x, top - 1) === B.AIR && hash2(seedNum + 11, x, 1) > 0.72) put(x, top - 1, B.GLOWCAP);
        continue;
      }
      if (x < next || Math.abs(x - sx) < 5 || water[x] !== -1 || nearLake(x, 1)) continue;
      if (!flat) continue;
      if (b === "desert") {
        if (nearLake(x, 5) && g === B.SAND && plant(x, b)) next = x + 9;
        continue;
      }
      const range = gap[b];
      if (!range) continue;
      if (!(g === B.GRASS || g === B.JUNGLE_GRASS || g === B.STEPPE_GRASS || g === B.SNOW || g === B.ASH)) continue;
      // natural clustering: sparse patches and groves
      if (fbm1(seedNum + 333, x * 0.03, 2) < (b === "forest" ? 0.36 : 0.3)) continue;
      if (plant(x, b)) next = x + randInt(rnd, range[0], range[1]);
    }
  }

  /* ------------------------ floating islands ---------------------- */
  {
    const want = size === "small" ? 7 : size === "medium" ? 10 : 14;
    const placed: { x0: number; x1: number; y0: number; y1: number }[] = [];
    for (let tries = 0; placed.length < want && tries < 400; tries++) {
      const cx = randInt(rnd, ocean + 40, w - ocean - 40);
      const rx = randInt(rnd, 9, 21);
      const thick = randInt(rnd, 5, 9);
      const cy = randInt(rnd, 14, SKY_H - 22);
      let minGround = h;
      for (let x = cx - rx - 6; x <= cx + rx + 6; x++) minGround = Math.min(minGround, heights[clamp(x, 0, w - 1)] as number);
      if (cy + thick + 22 > minGround) continue;
      const box = { x0: cx - rx - 14, x1: cx + rx + 14, y0: cy - 14, y1: cy + thick + 10 };
      if (placed.some((p) => box.x0 < p.x1 && box.x1 > p.x0 && box.y0 < p.y1 && box.y1 > p.y0)) continue;
      placed.push(box);
      const kindRoll = rnd();
      const kind = kindRoll < 0.45 ? "meadow" : kindRoll < 0.65 ? "crystal" : kindRoll < 0.85 ? "lake" : "frost";
      const topOf = (x: number) => cy + Math.round(((x - cx) / rx) ** 4 * 2);
      for (let x = cx - rx; x <= cx + rx; x++) {
        const f = 1 - ((x - cx) / rx) ** 2;
        if (f <= 0) continue;
        const ty = topOf(x);
        const depth = Math.max(1, Math.round(thick * Math.pow(f, 0.8) * (0.75 + fbm1(seedNum + tries * 17, x * 0.18, 2) * 0.5)));
        for (let d = 0; d < depth; d++) {
          const y = ty + d;
          let t: number = d === 0 ? B.GRASS : d < 3 ? B.DIRT : B.STONE;
          if (kind === "frost") t = d < 2 ? B.SNOW : d < 4 ? B.ICE : B.STONE;
          if (kind === "crystal" && d >= depth - 2 && depth > 3) t = B.CRYSTAL_BLOCK;
          put(x, y, t);
        }
      }
      if (kind === "lake" && rx > 11) {
        const lr = Math.floor(rx * 0.45);
        for (let x = cx - lr; x <= cx + lr; x++) {
          const f = 1 - ((x - cx) / (lr + 1)) ** 2;
          const dd = Math.max(1, Math.round(2.5 * Math.sqrt(f)));
          for (let d = 0; d < dd; d++) put(x, cy + d, B.WATER);
          put(x, cy + dd, B.SAND);
        }
      }
      // buried strongbox: dig into the island centre to find it
      const chestX = kind === "lake" ? cx - Math.floor(rx * 0.7) : cx;
      const cyTop = topOf(chestX);
      if (thick >= 5) {
        for (let y = cyTop + 2; y <= cyTop + 3; y++) for (let x = chestX - 1; x <= chestX + 1; x++) put(x, y, B.AIR);
        placeChest(world, rnd, chestX, cyTop + 3, 2);
        put(chestX + 1, cyTop + 3, B.TORCH);
      }
      // a tree or two on the meadow
      if (kind === "meadow" || kind === "frost") {
        const spots = rx > 14 ? [-Math.floor(rx * 0.5), Math.floor(rx * 0.45)] : [Math.floor(rx * 0.4)];
        for (const off of spots) {
          const tx = cx + off;
          const base = topOf(tx) - 1;
          const hgt = randInt(rnd, 4, 6);
          if (!clearAbove(tx, base, hgt + 3, 2)) continue;
          trunk(tx, base, hgt, B.TREE_TRUNK);
          canopy(tx, base - hgt, 2, kind === "frost" ? 2 : 1, kind === "frost" ? B.PINE_LEAVES : rnd() < 0.3 ? B.BLOSSOM_LEAVES : B.LEAVES, tx);
        }
      }
    }
  }

  /* --------------------- hidden structures ------------------------ */
  // Small cabins, always fully buried well below the local ground.
  const cabins = Math.round(w / 24);
  for (let i = 0; i < cabins; i++) {
    const cx = randInt(rnd, 20, w - 32);
    const rw = randInt(rnd, 8, 12);
    const rh = randInt(rnd, 5, 6);
    let lowest = 0;
    for (let x = cx - 2; x < cx + rw + 2; x++) lowest = Math.max(lowest, heights[x] as number);
    const minY = lowest + 34;
    if (minY > h - 30) continue;
    const cy = randInt(rnd, minY, Math.min(h - 30, minY + 150));
    let solid = 0, total = 0;
    for (let y = cy - 1; y <= cy + rh; y++)
      for (let x = cx - 1; x <= cx + rw; x++) {
        total++;
        if (tiles[y * w + x] !== B.AIR && tiles[y * w + x] !== B.WATER && tiles[y * w + x] !== B.LAVA) solid++;
      }
    if (solid < total * 0.82) continue;
    const b = bAt(cx);
    const wall = cy > DEEP_START ? B.BRICK : b === "desert" || b === "mesa" ? B.SANDSTONE : b === "snow" ? B.ICE : b === "jungle" ? B.MOSS : B.PLANK;
    for (let y = cy; y < cy + rh; y++)
      for (let x = cx; x < cx + rw; x++) {
        const border = y === cy || y === cy + rh - 1 || x === cx || x === cx + rw - 1;
        tiles[y * w + x] = border ? wall : B.AIR;
      }
    tiles[(cy + 1) * w + cx + 1] = B.TORCH;
    if (rw > 9) tiles[(cy + rh - 2) * w + cx + 2] = B.TABLE;
    placeChest(world, rnd, cx + Math.floor(rw / 2), cy + rh - 2, cy > DEEP_START ? 3 : 1);
  }
  // Deep bone dungeon: one large multi-room structure.
  {
    const dx = randInt(rnd, 80, w - 150);
    const dy = DEEP_START + randInt(rnd, 25, 80);
    for (let r = 0; r < 5; r++) {
      const rx = dx + r * 14;
      const ry = dy + (r % 2 === 0 ? 0 : 7);
      const rw = 15;
      const rh = 9;
      for (let y = ry; y < ry + rh; y++)
        for (let x = rx; x < rx + rw; x++) {
          if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) continue;
          const border = y === ry || y === ry + rh - 1 || x === rx || x === rx + rw - 1;
          tiles[y * w + x] = border ? B.BONE : B.AIR;
        }
      if (r > 0) {
        for (let y = ry + rh - 4; y < ry + rh - 1; y++) {
          tiles[y * w + rx] = B.AIR;
          tiles[y * w + rx - 1] = B.AIR;
        }
      }
      tiles[(ry + 1) * w + rx + 2] = B.TORCH;
      tiles[(ry + 1) * w + rx + rw - 3] = B.TORCH;
      if (r % 2 === 0) placeChest(world, rnd, rx + Math.floor(rw / 2), ry + rh - 2, 3);
    }
  }

  /* ------------------- seal leaks under liquid -------------------- */
  // There is no fluid simulation, so a lake that sits over a later-carved cave
  // mouth would hang in mid-air. Plug any such gap with the local bed material.
  for (let y = 1; y < h - 1; y++)
    for (let x = 0; x < w; x++) {
      const t = tiles[y * w + x];
      if ((t !== B.WATER && t !== B.LAVA) || tiles[(y + 1) * w + x] !== B.AIR) continue;
      const b = bAt(x);
      tiles[(y + 1) * w + x] =
        b === "desert" || b === "ocean" ? B.SAND : b === "mesa" ? B.RED_SAND : b === "jungle" ? B.MUD : t === B.LAVA ? B.STONE : B.DIRT;
    }
  // Then drain any liquid that stands as a wall against open air (a sea level above
  // its beach, a pool beside a cave). Draining spreads until every surface is level.
  {
    const isLiquid = (i: number) => tiles[i] === B.WATER || tiles[i] === B.LAVA;
    const exposed = (x: number, y: number) =>
      (x > 0 && tiles[y * w + x - 1] === B.AIR) || (x < w - 1 && tiles[y * w + x + 1] === B.AIR) || tiles[(y + 1) * w + x] === B.AIR;
    const queue: number[] = [];
    for (let y = 1; y < h - 1; y++)
      for (let x = 0; x < w; x++) if (isLiquid(y * w + x) && exposed(x, y)) queue.push(y * w + x);
    while (queue.length) {
      const i = queue.pop() as number;
      if (!isLiquid(i)) continue;
      const x = i % w;
      const y = (i - x) / w;
      if (y >= h - 1 || !exposed(x, y)) continue;
      tiles[i] = B.AIR;
      if (x > 0 && isLiquid(i - 1)) queue.push(i - 1);
      if (x < w - 1 && isLiquid(i + 1)) queue.push(i + 1);
      if (y > 0 && isLiquid(i - w)) queue.push(i - w);
    }
  }

  /* ------------------------- surface cache ------------------------ */
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h - 1 && !opaque(tiles[y * w + x] as number)) y++;
    surface[x] = y;
  }
  // spawn is stored in tile units: two tiles above the clearing
  world.spawnX = sx;
  world.spawnY = (heights[sx] as number) - 2;
  return world;
}

export function normalizeSeed(text: string): number {
  const t = text.trim();
  if (/^\d+$/.test(t)) return Number(t) % 4294967295;
  let hsh = 2166136261 >>> 0;
  for (let i = 0; i < t.length; i++) {
    hsh ^= t.charCodeAt(i);
    hsh = Math.imul(hsh, 16777619);
  }
  return hsh >>> 0;
}

export function randomSeedText(): string {
  const a = ["Ember", "Hollow", "Rime", "Void", "Prism", "Bramble", "Dune", "Stone", "Moss", "Star"];
  const b = ["reach", "fall", "hold", "mere", "watch", "spire", "gate", "veil", "run", "crest"];
  const p = a[Math.floor(Math.random() * a.length)];
  const q = b[Math.floor(Math.random() * b.length)];
  return `${p}${q}-${Math.floor(Math.random() * 9000 + 1000)}`;
}
