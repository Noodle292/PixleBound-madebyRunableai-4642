import { SAVE_KEY } from "./state";
import { DEFAULT_LOOK, sanitizeLook, type Look } from "./look";
import type { GameMode } from "./modes";
import { MODES } from "./modes";
import type { WorldSize } from "./worldgen";

/* ------------------------- tile RLE + base64 ------------------------ */

export function encodeTiles(tiles: Uint8Array): string {
  const bytes: number[] = [];
  let i = 0;
  while (i < tiles.length) {
    const v = tiles[i]!;
    let run = 1;
    while (i + run < tiles.length && tiles[i + run] === v) run++;
    i += run;
    bytes.push(v);
    // varint run length
    let r = run;
    while (r >= 0x80) {
      bytes.push((r & 0x7f) | 0x80);
      r >>>= 7;
    }
    bytes.push(r);
  }
  let out = "";
  const CH = 0x8000;
  for (let p = 0; p < bytes.length; p += CH) {
    out += String.fromCharCode(...bytes.slice(p, p + CH));
  }
  return btoa(out);
}

export function decodeTiles(b64: string, len: number): Uint8Array {
  const raw = atob(b64);
  const out = new Uint8Array(len);
  let o = 0;
  let p = 0;
  while (p < raw.length && o < len) {
    const v = raw.charCodeAt(p++);
    let run = 0;
    let shift = 0;
    for (;;) {
      const b = raw.charCodeAt(p++);
      run |= (b & 0x7f) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    const end = Math.min(len, o + run);
    if (v !== 0) out.fill(v, o, end);
    o = end;
  }
  return out;
}

/* --------------------------- legacy single save --------------------------- */


export type SaveStack = { id: string; n: number } | null;

/** The pre-library format (one world + one player). Kept only for migration. */
export type LegacySave = {
  v: number;
  generatorVersion?: number;
  savedAt: number;
  seedText: string;
  w: number;
  h: number;
  tiles: string;
  chests: [number, { item: string; count: number }[]][];
  spawnX: number;
  spawnY: number;
  player: { x: number; y: number; hp: number; maxHp: number; bonusHp: number; deaths: number };
  inv: { slots: SaveStack[]; equip: Record<string, SaveStack>; sel: number };
  npcs: { id: string; x: number; y: number; homeX: number; homeY: number }[];
  houses: { x: number; y: number; w: number; h: number; owner: string | null }[];
  time: number;
  day: number;
  bosses: string[];
  playtime: number;
  tutorial: boolean;
  discovered: string[];
};

/* ------------------------------ library ------------------------------ */

export const MAX_WORLDS = 6;
export const MAX_CHARACTERS = 6;
const WORLD_INDEX = "pixelbound.v2.worlds";
const WORLD_PREFIX = "pixelbound.v2.world.";
const CHAR_KEY = "pixelbound.v2.characters";
const MIGRATED_KEY = "pixelbound.v2.migrated";

export type WorldMeta = {
  id: string;
  name: string;
  seedText: string;
  size: WorldSize;
  creative: boolean;
  generatorVersion: number;
  day: number;
  bossCount: number;
  createdAt: number;
  savedAt: number;
};

export type WorldSave = WorldMeta & {
  v: 2;
  w: number;
  h: number;
  tiles: string;
  chests: [number, { item: string; count: number }[]][];
  spawnX: number;
  spawnY: number;
  npcs: { id: string; x: number; y: number; homeX: number; homeY: number }[];
  houses: { x: number; y: number; w: number; h: number; owner: string | null }[];
  time: number;
  bosses: string[];
  playtime: number;
};

export type CharacterSave = {
  v: 2;
  id: string;
  name: string;
  mode: GameMode;
  look: Look;
  createdAt: number;
  savedAt: number;
  hp: number;
  bonusHp: number;
  deaths: number;
  /** permadeath characters are kept for the memorial but cannot play */
  dead: boolean;
  diedIn: string | null;
  playtime: number;
  inv: { slots: SaveStack[]; equip: Record<string, SaveStack>; sel: number } | null;
  tutorial: boolean;
  discovered: string[];
  positions: Record<string, { x: number; y: number }>;
  lastWorld: string | null;
};

export type Result = { ok: boolean; error?: string };

function get(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function put(key: string, value: string): Result {
  try {
    localStorage.setItem(key, value);
    return { ok: true };
  } catch (e) {
    const quota = e instanceof DOMException && (e.name === "QuotaExceededError" || e.code === 22);
    return { ok: false, error: quota ? "device storage is full — delete a world" : e instanceof Error ? e.message : "save failed" };
  }
}

function drop(key: string) {
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

function parse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
}

export function metaOf(ws: WorldSave): WorldMeta {
  return {
    id: ws.id,
    name: ws.name,
    seedText: ws.seedText,
    size: ws.size,
    creative: ws.creative,
    generatorVersion: ws.generatorVersion,
    day: ws.day,
    bossCount: ws.bosses.length,
    createdAt: ws.createdAt,
    savedAt: ws.savedAt,
  };
}

export function listWorlds(): WorldMeta[] {
  migrateLegacy();
  const list = parse<WorldMeta[]>(get(WORLD_INDEX)) ?? [];
  return list.filter((m) => m && typeof m.id === "string").sort((a, b) => b.savedAt - a.savedAt);
}

export function readWorld(id: string): WorldSave | null {
  const ws = parse<WorldSave>(get(WORLD_PREFIX + id));
  if (!ws || ws.v !== 2) return null;
  return ws;
}

export function writeWorld(ws: WorldSave): Result {
  const res = put(WORLD_PREFIX + ws.id, JSON.stringify(ws));
  if (!res.ok) return res;
  const list = (parse<WorldMeta[]>(get(WORLD_INDEX)) ?? []).filter((m) => m.id !== ws.id);
  list.push(metaOf(ws));
  return put(WORLD_INDEX, JSON.stringify(list));
}

export function deleteWorld(id: string) {
  drop(WORLD_PREFIX + id);
  const list = (parse<WorldMeta[]>(get(WORLD_INDEX)) ?? []).filter((m) => m.id !== id);
  put(WORLD_INDEX, JSON.stringify(list));
  const chars = listCharacters();
  for (const c of chars) {
    if (c.positions[id] || c.lastWorld === id) {
      delete c.positions[id];
      if (c.lastWorld === id) c.lastWorld = null;
    }
  }
  put(CHAR_KEY, JSON.stringify(chars));
}

function sanitizeChar(c: CharacterSave): CharacterSave {
  return {
    ...c,
    mode: MODES[c.mode] ? c.mode : "classic",
    look: sanitizeLook(c.look),
    positions: c.positions ?? {},
    discovered: c.discovered ?? [],
    lastWorld: c.lastWorld ?? null,
    diedIn: c.diedIn ?? null,
    dead: !!c.dead,
  };
}

export function listCharacters(): CharacterSave[] {
  migrateLegacy();
  const list = parse<CharacterSave[]>(get(CHAR_KEY)) ?? [];
  return list.filter((c) => c && c.v === 2 && typeof c.id === "string").map(sanitizeChar).sort((a, b) => b.savedAt - a.savedAt);
}

export function readCharacter(id: string): CharacterSave | null {
  return listCharacters().find((c) => c.id === id) ?? null;
}

export function writeCharacter(cs: CharacterSave): Result {
  const list = (parse<CharacterSave[]>(get(CHAR_KEY)) ?? []).filter((c) => c.id !== cs.id);
  list.push(cs);
  return put(CHAR_KEY, JSON.stringify(list));
}

export function deleteCharacter(id: string) {
  const list = (parse<CharacterSave[]>(get(CHAR_KEY)) ?? []).filter((c) => c.id !== id);
  put(CHAR_KEY, JSON.stringify(list));
}

export function blankCharacter(name: string, mode: GameMode, look: Look): CharacterSave {
  const now = Date.now();
  return {
    v: 2,
    id: newId("c"),
    name: name.trim().slice(0, 18) || "Wanderer",
    mode,
    look,
    createdAt: now,
    savedAt: now,
    hp: 100,
    bonusHp: 0,
    deaths: 0,
    dead: false,
    diedIn: null,
    playtime: 0,
    inv: null,
    tutorial: false,
    discovered: [],
    positions: {},
    lastWorld: null,
  };
}

/** One-time import of the single-slot save. The old key is left in place as a backup. */
export function migrateLegacy() {
  if (get(MIGRATED_KEY)) return;
  const raw = get(SAVE_KEY);
  const old = parse<LegacySave>(raw);
  if (!old || old.v !== 1 || !old.tiles) {
    put(MIGRATED_KEY, "1");
    return;
  }
  const now = Date.now();
  const worldId = newId("w");
  const ws: WorldSave = {
    v: 2,
    id: worldId,
    name: old.seedText || "My world",
    seedText: old.seedText,
    size: "medium",
    creative: false,
    generatorVersion: old.generatorVersion ?? 1,
    day: old.day ?? 1,
    bossCount: (old.bosses ?? []).length,
    createdAt: old.savedAt ?? now,
    savedAt: old.savedAt ?? now,
    w: old.w,
    h: old.h,
    tiles: old.tiles,
    chests: old.chests ?? [],
    spawnX: old.spawnX,
    spawnY: old.spawnY,
    npcs: old.npcs ?? [],
    houses: old.houses ?? [],
    time: old.time ?? 60,
    bosses: old.bosses ?? [],
    playtime: old.playtime ?? 0,
  };
  const cs = blankCharacter("Wanderer", "classic", DEFAULT_LOOK);
  cs.createdAt = ws.createdAt;
  cs.savedAt = ws.savedAt;
  cs.hp = old.player?.hp ?? 100;
  cs.bonusHp = old.player?.bonusHp ?? 0;
  cs.deaths = old.player?.deaths ?? 0;
  cs.playtime = old.playtime ?? 0;
  cs.inv = old.inv ?? null;
  cs.tutorial = !!old.tutorial;
  cs.discovered = old.discovered ?? [];
  cs.positions[worldId] = { x: old.player.x, y: old.player.y };
  cs.lastWorld = worldId;
  if (!writeWorld(ws).ok) return; // retry next launch
  if (!writeCharacter(cs).ok) {
    deleteWorld(worldId);
    return;
  }
  put(MIGRATED_KEY, "1");
}
