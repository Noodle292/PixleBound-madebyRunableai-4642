// Frozen copy of the original (v1/v2) world generator. Saved worlds created
// before generator v3 keep their terrain; this module lets the loader compare
// saved tiles against the generator that produced them.
import { B, opaque } from "./blocks";
import { CHEST_TIERS } from "./entities";
import { clamp, fbm1, fbm2, hash2, mulberry32, randInt } from "./rng";
import { BIOME_LIST, normalizeSeed, SKY_H, type BiomeKey, type ChestContent, type World } from "./worldgen";

const WORLD_W = 1000;
const WORLD_H = 420;
const DEEP_START = 190;

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

/** Frozen v1/v2 generator. Only used to migrate and compare pre-v3 saves. */
export function generateClassicWorld(seedText: string, legacy = false): World {
  const seedNum = normalizeSeed(seedText);
  const rnd = mulberry32(seedNum ^ 0x5eed);
  const w = WORLD_W;
  const h = WORLD_H;
  const tiles = new Uint8Array(w * h);
  const surface = new Int16Array(w);
  const biome = new Uint8Array(w);
  const world: World = {
    seed: seedNum,
    generatorVersion: legacy ? 1 : 2,
    ground: new Int16Array(WORLD_W),
    size: "medium",
    surfaceRuins: [],
    seedText,
    w,
    h,
    tiles,
    surface,
    biome,
    chests: new Map(),
    spawnX: 0,
    spawnY: 0,
  };

  /* ------------------------- biome layout ------------------------- */
  // The spawn region is always forest; the other biomes are shuffled into
  // bands to the left and right so every seed feels different.
  const others: BiomeKey[] = ["desert", "snow", "fungal", "voidshroud"];
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    const a = others[i] as BiomeKey;
    others[i] = others[j] as BiomeKey;
    others[j] = a;
  }
  const centerStart = Math.floor(w * 0.5 - w * 0.13);
  const centerEnd = Math.floor(w * 0.5 + w * 0.13);
  const leftBands = others.slice(0, 2);
  const rightBands = others.slice(2);
  const bandEdges: { from: number; to: number; b: BiomeKey }[] = [];
  bandEdges.push({ from: centerStart, to: centerEnd, b: "forest" });
  // left side
  {
    let cursor = centerStart;
    const each = Math.floor(centerStart / Math.max(1, leftBands.length));
    for (const b of leftBands) {
      const from = Math.max(0, cursor - each);
      bandEdges.push({ from, to: cursor, b });
      cursor = from;
    }
    if (cursor > 0) bandEdges.push({ from: 0, to: cursor, b: "forest" });
  }
  // right side
  {
    let cursor = centerEnd;
    const each = Math.floor((w - centerEnd) / Math.max(1, rightBands.length));
    for (const b of rightBands) {
      const to = Math.min(w, cursor + each);
      bandEdges.push({ from: cursor, to, b });
      cursor = to;
    }
    if (cursor < w) bandEdges.push({ from: cursor, to: w, b: "forest" });
  }
  for (const band of bandEdges) {
    const bi = BIOME_LIST.indexOf(band.b);
    for (let x = band.from; x < band.to; x++) biome[x] = bi;
  }
  // soften the seams with a little noise so bands don't look like walls
  for (let x = 1; x < w - 1; x++) {
    if (biome[x] !== biome[x - 1] && hash2(seedNum, x, 777) > 0.5) {
      const run = 3 + Math.floor(hash2(seedNum, x, 778) * 6);
      for (let k = 0; k < run && x + k < w; k++)
        if (hash2(seedNum, x + k, 779) > 0.5) biome[x + k] = biome[x - 1] as number;
    }
  }

  /* -------------------------- height map -------------------------- */
  const baseY = SKY_H + 26;
  const heights = new Int16Array(w);
  for (let x = 0; x < w; x++) {
    const bi = BIOME_LIST[biome[x] ?? 0] as BiomeKey;
    const rough = bi === "snow" ? 26 : bi === "desert" ? 10 : bi === "voidshroud" ? 22 : 18;
    const big = fbm1(seedNum, x * 0.006, 4) - 0.5;
    const small = fbm1(seedNum + 31, x * 0.045, 3) - 0.5;
    let y = baseY + big * 46 + small * rough;
    if (bi === "desert") y += 6;
    if (bi === "snow") y -= 8;
    if (bi === "voidshroud") y += 2;
    heights[x] = clamp(Math.round(y), SKY_H - 20, SKY_H + 70);
  }
  // smooth
  for (let pass = 0; pass < 2; pass++) {
    for (let x = 1; x < w - 1; x++) {
      heights[x] = Math.round((((heights[x - 1] as number) + (heights[x] as number) * 2 + (heights[x + 1] as number)) / 4));
    }
  }

  /* ----------------------- terrain fill --------------------------- */
  for (let x = 0; x < w; x++) {
    const top = heights[x] as number;
    const bi = BIOME_LIST[biome[x] ?? 0] as BiomeKey;
    const soilDepth = 5 + Math.floor(fbm1(seedNum + 7, x * 0.06, 2) * 7);
    for (let y = top; y < h; y++) {
      const d = y - top;
      let t: number = B.STONE;
      if (d === 0) {
        t = bi === "desert" ? B.SAND : bi === "snow" ? B.SNOW : bi === "fungal" ? B.FUNGAL : bi === "voidshroud" ? B.ASH : B.GRASS;
      } else if (d < soilDepth) {
        t = bi === "desert" ? B.SAND : bi === "snow" ? (d < 3 ? B.SNOW : B.DIRT) : bi === "fungal" ? B.FUNGAL : bi === "voidshroud" ? B.ASH : B.DIRT;
      } else if (d < soilDepth + 6) {
        t = bi === "desert" ? B.SANDSTONE : bi === "snow" && hash2(seedNum, x, y) > 0.6 ? B.ICE : B.DIRT;
      } else {
        t = B.STONE;
        if (y > h - 18) t = B.VOIDSTONE;
      }
      // clay pockets
      if (t === B.DIRT && fbm2(seedNum + 55, x * 0.08, y * 0.08, 2) > 0.72) t = B.CLAY;
      if (t === B.STONE && y < DEEP_START && fbm2(seedNum + 65, x * 0.05, y * 0.05, 2) > 0.79) t = B.MOSS;
      tiles[y * w + x] = t;
    }
    surface[x] = top;
  }

  /* --------------------------- caves ------------------------------ */
  for (let x = 1; x < w - 1; x++) {
    const top = heights[x] as number;
    for (let y = top + 6; y < h - 6; y++) {
      const depth = y - top;
      const scale = y > DEEP_START ? 0.055 : 0.07;
      const n = fbm2(seedNum + 101, x * scale, y * scale * 1.6, 3);
      const n2 = fbm2(seedNum + 202, x * 0.02, y * 0.03, 2);
      let thresh = 0.62;
      if (depth < 14) thresh = 0.74;
      if (y > DEEP_START) thresh = 0.575;
      if (n2 > 0.66) thresh -= 0.055; // cavern zones
      if (n > thresh) tiles[y * w + x] = B.AIR;
    }
  }
  // large caverns
  {
    const caverns = 26;
    for (let i = 0; i < caverns; i++) {
      const cx = randInt(rnd, 40, w - 40);
      const cy = randInt(rnd, SKY_H + 70, h - 40);
      const rx = randInt(rnd, 14, 34);
      const ry = randInt(rnd, 7, 16);
      for (let y = cy - ry; y <= cy + ry; y++)
        for (let x = cx - rx; x <= cx + rx; x++) {
          if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) continue;
          const dx = (x - cx) / rx;
          const dy = (y - cy) / ry;
          const edge = fbm2(seedNum + i * 13, x * 0.12, y * 0.12, 2) * 0.35;
          if (dx * dx + dy * dy < 1 - 0.2 + edge) tiles[y * w + x] = B.AIR;
        }
      // floor decoration + a chest in the biggest ones
      if (rx > 22) {
        const fx = cx + randInt(rnd, -rx + 4, rx - 4);
        let fy = cy;
        while (fy < h - 3 && tiles[fy * w + fx] === B.AIR) fy++;
        placeChest(world, rnd, fx, fy - 1, cy > DEEP_START ? 3 : 2);
      }
    }
  }

  /* ----------------------- fungal underground --------------------- */
  for (let x = 0; x < w; x++) {
    if ((BIOME_LIST[biome[x] ?? 0] as BiomeKey) !== "fungal") continue;
    const top = heights[x] as number;
    for (let y = top; y < Math.min(h - 2, top + 90); y++) {
      const t = tiles[y * w + x] as number;
      if (t === B.STONE || t === B.DIRT) {
        if (fbm2(seedNum + 303, x * 0.07, y * 0.07, 2) > 0.45) tiles[y * w + x] = B.FUNGAL;
      }
    }
  }
  /* --------------------- voidshroud underground ------------------- */
  for (let x = 0; x < w; x++) {
    if ((BIOME_LIST[biome[x] ?? 0] as BiomeKey) !== "voidshroud") continue;
    const top = heights[x] as number;
    for (let y = top; y < Math.min(h - 2, top + 110); y++) {
      const t = tiles[y * w + x] as number;
      if (t === B.STONE && fbm2(seedNum + 404, x * 0.06, y * 0.06, 2) > 0.55) tiles[y * w + x] = B.VOIDSTONE;
    }
  }

  /* --------------------------- ore veins -------------------------- */
  type OreSpec = { block: number; count: number; size: [number, number]; minY: number; maxY: number };
  const ores: OreSpec[] = [
    { block: B.COPPER, count: 1500, size: [3, 8], minY: SKY_H + 12, maxY: h - 20 },
    { block: B.IRON, count: 1100, size: [3, 7], minY: SKY_H + 30, maxY: h - 14 },
    { block: B.SILVER, count: 700, size: [3, 6], minY: SKY_H + 70, maxY: h - 10 },
    { block: B.GOLD, count: 520, size: [2, 6], minY: DEEP_START - 40, maxY: h - 6 },
    { block: B.CRYSTAL, count: 340, size: [2, 5], minY: DEEP_START, maxY: h - 4 },
    { block: B.AETHERITE, count: 180, size: [2, 4], minY: DEEP_START + 60, maxY: h - 2 },
    { block: B.STARSTONE, count: 90, size: [2, 4], minY: DEEP_START + 20, maxY: h - 2 },
  ];
  for (const o of ores) {
    for (let i = 0; i < o.count; i++) {
      const x = randInt(rnd, 2, w - 3);
      const y = randInt(rnd, Math.max(2, o.minY), Math.min(h - 3, o.maxY));
      const n = randInt(rnd, o.size[0], o.size[1]);
      let cx = x;
      let cy = y;
      for (let k = 0; k < n; k++) {
        const t = tiles[cy * w + cx];
        if (t === B.STONE || t === B.VOIDSTONE || t === B.MOSS || t === B.SANDSTONE) tiles[cy * w + cx] = o.block;
        cx = clamp(cx + randInt(rnd, -1, 1), 1, w - 2);
        cy = clamp(cy + randInt(rnd, -1, 1), 1, h - 2);
      }
    }
  }

  /* ------------------------- water & lava ------------------------- */
  // underground pools: fill enclosed cave bottoms
  for (let i = 0; i < 500; i++) {
    const x = randInt(rnd, 6, w - 7);
    const y = randInt(rnd, SKY_H + 40, h - 30);
    if (tiles[y * w + x] !== B.AIR) continue;
    if (tiles[(y + 1) * w + x] === B.AIR) continue;
    // needs walls both sides within 8 tiles
    let okL = false;
    let okR = false;
    for (let k = 1; k <= 8; k++) if (tiles[y * w + x - k] !== B.AIR) { okL = true; break; }
    for (let k = 1; k <= 8; k++) if (tiles[y * w + x + k] !== B.AIR) { okR = true; break; }
    if (!okL || !okR) continue;
    const liquid = y > h - 45 ? B.LAVA : B.WATER;
    // flood a shallow puddle
    const depth = randInt(rnd, 1, 3);
    for (let dy = 0; dy < depth; dy++)
      for (let dx = -7; dx <= 7; dx++) {
        const px = x + dx;
        const py = y - dy;
        if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue;
        if (tiles[py * w + px] !== B.AIR) continue;
        if (tiles[(py + 1) * w + px] === B.AIR && dy === 0) continue;
        tiles[py * w + px] = liquid;
      }
  }
  // lava sea at the bottom
  for (let x = 0; x < w; x++)
    for (let y = h - 8; y < h - 2; y++) if (tiles[y * w + x] === B.AIR) tiles[y * w + x] = B.LAVA;

  // surface lakes in depressions
  for (let i = 0; i < 40; i++) {
    const cx = randInt(rnd, 30, w - 31);
    const bi = BIOME_LIST[biome[cx] ?? 0] as BiomeKey;
    if (bi === "voidshroud") continue;
    const top = heights[cx] as number;
    // is it a local low point?
    let lowest = true;
    for (let k = -10; k <= 10; k++) if ((heights[clamp(cx + k, 0, w - 1)] as number) < top - 2) { lowest = false; break; }
    if (!lowest) continue;
    const r = randInt(rnd, 6, 14);
    const depth = randInt(rnd, 3, 7);
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 1 || x >= w - 1) continue;
      const frac = 1 - Math.abs(x - cx) / r;
      const dd = Math.round(depth * frac);
      for (let d = 0; d < dd; d++) {
        const y = (heights[x] as number) + d;
        tiles[y * w + x] = bi === "snow" && d === 0 ? B.ICE : B.WATER;
      }
      // banks
      const bankY = (heights[x] as number) + dd;
      if (bankY < h - 1 && tiles[bankY * w + x] === B.GRASS) tiles[bankY * w + x] = B.SAND;
    }
  }

  /* --------------------------- surface flora ---------------------- */
  for (let x = 4; x < w - 4; x++) {
    const bi = BIOME_LIST[biome[x] ?? 0] as BiomeKey;
    const top = heights[x] as number;
    const ground = tiles[top * w + x];
    if (ground === B.WATER || ground === B.ICE) continue;
    const r = hash2(seedNum + 909, x, 3);
    if (bi === "forest" && r > 0.86 && ground === B.GRASS) {
      growTree(tiles, w, h, x, top - 1, randInt(rnd, 5, 11), legacy ? B.LOG : B.TREE_TRUNK, B.LEAVES, 3);
    } else if (bi === "snow" && r > 0.9 && (ground === B.SNOW || ground === B.DIRT)) {
      growPine(tiles, w, h, x, top - 1, randInt(rnd, 6, 12), legacy ? B.LOG : B.TREE_TRUNK);
    } else if (bi === "desert" && r > 0.955 && ground === B.SAND) {
      const hh = randInt(rnd, 2, 4);
      for (let k = 0; k < hh; k++) if (top - 1 - k > 1) tiles[(top - 1 - k) * w + x] = legacy ? B.LOG : B.TREE_TRUNK;
    } else if (bi === "fungal" && r > 0.8) {
      if (top - 1 > 1) tiles[(top - 1) * w + x] = B.GLOWCAP;
    } else if (bi === "voidshroud" && r > 0.93) {
      growTree(tiles, w, h, x, top - 1, randInt(rnd, 4, 8), legacy ? B.PALEWOOD : B.PALE_TREE_TRUNK, B.LEAVES, 2);
    } else if (bi === "forest" && r > 0.6 && r < 0.63 && ground === B.GRASS) {
      if (top - 1 > 1) tiles[(top - 1) * w + x] = B.GLOWCAP;
    }
  }

  /* ------------------------ floating islands ---------------------- */
  const islandCount = 9;
  for (let i = 0; i < islandCount; i++) {
    const cx = randInt(rnd, 50, w - 50);
    const cy = randInt(rnd, 14, SKY_H - 26);
    const rx = randInt(rnd, 12, 24);
    const ry = randInt(rnd, 4, 7);
    for (let x = cx - rx; x <= cx + rx; x++) {
      if (x < 2 || x >= w - 2) continue;
      const frac = 1 - Math.abs(x - cx) / rx;
      const thick = Math.round(ry * frac * (0.7 + fbm1(seedNum + i * 17, x * 0.2, 2) * 0.6));
      if (thick <= 0) continue;
      for (let d = 0; d < thick; d++) {
        const y = cy + d;
        if (y < 2 || y >= h) continue;
        tiles[y * w + x] = d === 0 ? B.GRASS : d < thick - 1 ? B.DIRT : B.STONE;
      }
      if (thick > 2 && hash2(seedNum + i, x, 5) > 0.88) growTree(tiles, w, h, x, cy - 1, randInt(rnd, 4, 7), legacy ? B.LOG : B.TREE_TRUNK, B.LEAVES, 3);
    }
    // island vault
    const vx = cx;
    const vy = cy + 1;
    for (let y = vy; y < vy + 4; y++)
      for (let x = vx - 3; x <= vx + 3; x++) {
        if (x < 2 || y < 2 || x >= w - 2 || y >= h - 2) continue;
        const border = y === vy || y === vy + 3 || x === vx - 3 || x === vx + 3;
        tiles[y * w + x] = border ? B.BRICK : B.AIR;
      }
    placeChest(world, rnd, vx, vy + 2, 2);
  }

  /* --------------------- hidden structures ------------------------ */
  // small stone cache rooms in the underground
  for (let i = 0; i < 40; i++) {
    const cx = randInt(rnd, 20, w - 20);
    const cy = randInt(rnd, SKY_H + 45, h - 30);
    const rw = randInt(rnd, 7, 12);
    const rh = randInt(rnd, 4, 6);
    let solidEnough = 0;
    for (let y = cy; y < cy + rh; y++)
      for (let x = cx; x < cx + rw; x++) if (tiles[y * w + x] !== B.AIR) solidEnough++;
    if (solidEnough < rw * rh * 0.75) continue;
    for (let y = cy; y < cy + rh; y++)
      for (let x = cx; x < cx + rw; x++) {
        const border = y === cy || y === cy + rh - 1 || x === cx || x === cx + rw - 1;
        tiles[y * w + x] = border ? B.BRICK : B.AIR;
      }
    tiles[(cy + 1) * w + cx + 1] = B.TORCH;
    tiles[(cy + 1) * w + cx + rw - 2] = B.TORCH;
    placeChest(world, rnd, cx + Math.floor(rw / 2), cy + rh - 2, cy > DEEP_START ? 3 : 1);
  }
  // deep bone dungeon: one large multi-room structure
  {
    const dx = randInt(rnd, 80, w - 140);
    const dy = DEEP_START + randInt(rnd, 20, 80);
    const rooms = 5;
    for (let r = 0; r < rooms; r++) {
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
      // door gaps between rooms
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
  // rare surface ruin
  for (let i = 0; i < 6; i++) {
    const cx = randInt(rnd, 30, w - 30);
    const top = heights[cx] as number;
    const rw = randInt(rnd, 8, 13);
    const rh = 6;
    // Keep random draws stable for old-save migration, but do not leave
    // generated brick barriers on the surface in new worlds.
    const original = new Map<number, number>();
    for (let y = top - rh; y < top; y++)
      for (let x = cx; x < cx + rw; x++) original.set(y * w + x, tiles[y * w + x]!);
    const chestKey = (top - 1) * w + cx + 2;
    const originalChest = world.chests.get(chestKey);
    world.surfaceRuins.push({ x: cx, y: top - rh, w: rw, h: rh });
    for (let y = top - rh; y < top; y++)
      for (let x = cx; x < cx + rw; x++) {
        if (x < 2 || y < 2) continue;
        const border = y === top - rh || x === cx || x === cx + rw - 1;
        if (border && hash2(seedNum + i, x, y) > 0.25) tiles[y * w + x] = B.BRICK;
        else if (!border) tiles[y * w + x] = B.AIR;
      }
    for (let x = cx; x < cx + rw; x++) if (x < w) tiles[(top - 1) * w + x] = B.AIR;
    placeChest(world, rnd, cx + 2, top - 1, 1);
    if (!legacy) {
      for (const [key, tile] of original) tiles[key] = tile;
      if (originalChest) world.chests.set(chestKey, originalChest);
      else world.chests.delete(chestKey);
    }
  }

  /* ------------------------- surface cache ------------------------ */
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h - 1 && !opaque(tiles[y * w + x] as number)) y++;
    surface[x] = y;
  }

  // Spawn on the main landmass, never on an island or in a tree canopy.
  const sx = Math.floor(w / 2);
  const sy = heights[sx] as number;
  for (let x = sx - 5; x <= sx + 5; x++) {
    for (let y = Math.max(0, sy - 30); y < sy; y++) tiles[y * w + x] = B.AIR;
    tiles[sy * w + x] = B.GRASS;
    for (let y = sy + 1; y < sy + 5; y++) tiles[y * w + x] = B.DIRT;
  }
  // spawn is stored in tile units
  world.spawnX = sx;
  world.spawnY = sy - 3;
  world.ground.set(heights);
  for (let x = 0; x < w; x++) {
    let y = 0;
    while (y < h - 1 && !opaque(tiles[y * w + x] as number)) y++;
    surface[x] = y;
  }

  return world;
}

function growTree(
  tiles: Uint8Array,
  w: number,
  h: number,
  x: number,
  baseY: number,
  height: number,
  log: number,
  leaf: number,
  crown: number,
) {
  for (let k = 0; k < height; k++) {
    const y = baseY - k;
    if (y < 2) return;
    tiles[y * w + x] = log;
  }
  const topY = baseY - height;
  for (let dy = -crown; dy <= 1; dy++)
    for (let dx = -crown; dx <= crown; dx++) {
      const px = x + dx;
      const py = topY + dy;
      if (px < 1 || py < 1 || px >= w - 1 || py >= h - 1) continue;
      if (Math.abs(dx) + Math.abs(dy) > crown + 1) continue;
      if (tiles[py * w + px] === 0) tiles[py * w + px] = leaf;
    }
}

function growPine(tiles: Uint8Array, w: number, _h: number, x: number, baseY: number, height: number, log: number) {
  for (let k = 0; k < height; k++) {
    const y = baseY - k;
    if (y < 2) return;
    tiles[y * w + x] = log;
    const spread = Math.max(0, Math.round((height - k) / 3));
    for (let dx = -spread; dx <= spread; dx++) {
      const px = x + dx;
      if (px < 1 || px >= w - 1) continue;
      if (dx !== 0 && tiles[y * w + px] === 0) tiles[y * w + px] = B.LEAVES;
    }
  }
}

