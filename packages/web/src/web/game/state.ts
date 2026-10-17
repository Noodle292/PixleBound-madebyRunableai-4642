import type { BossDef, EnemyDef, EventDef, NpcDef } from "./entities";
import type { ItemDef, ProjectileSpec, StatBonus } from "./items";
import { itemDef } from "./items";

/* ----------------------------- constants ---------------------------- */

export const PLAYER_W = 18;
export const PLAYER_H = 28;
export const GRAVITY = 1500;
export const MAX_FALL = 900;
export const BASE_SPEED = 152;
export const BASE_JUMP = 455;
export const REACH = 5.6; // tiles
export const HOTBAR = 10;
export const INV_SLOTS = 40;
export const CHEST_SLOTS = 20;
export const DAY_LENGTH = 600; // seconds of daylight
export const NIGHT_LENGTH = 400; // seconds of night
export const CYCLE = DAY_LENGTH + NIGHT_LENGTH;
export const MAX_ENEMIES = 16;
export const SAVE_KEY = "pixelbound.save.v1";
export const SETTINGS_KEY = "pixelbound.settings.v1";

export type EquipSlot = "helmet" | "chest" | "legs" | "boots" | "acc1" | "acc2" | "acc3";
export const EQUIP_SLOTS: EquipSlot[] = ["helmet", "chest", "legs", "boots", "acc1", "acc2", "acc3"];
export const EQUIP_LABEL: Record<EquipSlot, string> = {
  helmet: "Head",
  chest: "Body",
  legs: "Legs",
  boots: "Feet",
  acc1: "Charm I",
  acc2: "Charm II",
  acc3: "Charm III",
};

/* ------------------------------- stacks ----------------------------- */

export type Stack = { id: string; n: number } | null;

export type Inventory = {
  slots: Stack[];
  equip: Record<EquipSlot, Stack>;
  sel: number;
};

export function emptyInventory(): Inventory {
  return {
    slots: Array.from({ length: INV_SLOTS }, () => null),
    equip: { helmet: null, chest: null, legs: null, boots: null, acc1: null, acc2: null, acc3: null },
    sel: 0,
  };
}

export function stackLimit(id: string): number {
  return itemDef(id).stack;
}

/** Add items to a slot list, merging into existing stacks. Returns leftover count. */
export function addToSlots(slots: Stack[], id: string, n: number): number {
  const limit = stackLimit(id);
  let left = n;
  for (let i = 0; i < slots.length && left > 0; i++) {
    const s = slots[i];
    if (s && s.id === id && s.n < limit) {
      const take = Math.min(limit - s.n, left);
      s.n += take;
      left -= take;
    }
  }
  for (let i = 0; i < slots.length && left > 0; i++) {
    if (!slots[i]) {
      const take = Math.min(limit, left);
      slots[i] = { id, n: take };
      left -= take;
    }
  }
  return left;
}

export function countInSlots(slots: Stack[], id: string): number {
  let n = 0;
  for (const s of slots) if (s && s.id === id) n += s.n;
  return n;
}

export function removeFromSlots(slots: Stack[], id: string, n: number): boolean {
  if (countInSlots(slots, id) < n) return false;
  let left = n;
  for (let i = slots.length - 1; i >= 0 && left > 0; i--) {
    const s = slots[i];
    if (s && s.id === id) {
      const take = Math.min(s.n, left);
      s.n -= take;
      left -= take;
      if (s.n <= 0) slots[i] = null;
    }
  }
  return true;
}

export function sortSlots(slots: Stack[]) {
  const order: Record<string, number> = {
    tool: 0,
    weapon: 1,
    armor: 2,
    accessory: 3,
    potion: 4,
    summon: 5,
    station: 6,
    furniture: 7,
    block: 8,
    material: 9,
  };
  const items = slots.filter((s): s is { id: string; n: number } => !!s);
  const merged: { id: string; n: number }[] = [];
  for (const s of items) {
    const limit = stackLimit(s.id);
    const found = merged.find((m) => m.id === s.id && m.n < limit);
    if (found) {
      const take = Math.min(limit - found.n, s.n);
      found.n += take;
      if (s.n - take > 0) merged.push({ id: s.id, n: s.n - take });
    } else merged.push({ id: s.id, n: s.n });
  }
  merged.sort((a, b) => {
    const da = itemDef(a.id);
    const db = itemDef(b.id);
    const oa = order[da.kind] ?? 10;
    const ob = order[db.kind] ?? 10;
    if (oa !== ob) return oa - ob;
    return da.name.localeCompare(db.name);
  });
  for (let i = 0; i < slots.length; i++) slots[i] = merged[i] ?? null;
}

/* ------------------------------- player ----------------------------- */

export type Buff = { key: keyof StatBonus; amount: number; t: number; name: string; color: string };

export type PlayerState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  hp: number;
  maxHp: number;
  bonusHp: number;
  airJumps: number;
  iframe: number;
  swing: number;
  swingDir: 1 | -1;
  attackCd: number;
  useCd: number;
  dead: boolean;
  respawn: number;
  buffs: Buff[];
  breath: number;
  regenT: number;
  deaths: number;
};

export function newPlayer(x: number, y: number): PlayerState {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    facing: 1,
    onGround: false,
    hp: 100,
    maxHp: 100,
    bonusHp: 0,
    airJumps: 0,
    iframe: 0,
    swing: 0,
    swingDir: 1,
    attackCd: 0,
    useCd: 0,
    dead: false,
    respawn: 0,
    buffs: [],
    breath: 10,
    regenT: 0,
    deaths: 0,
  };
}

export type Stats = {
  defense: number;
  speed: number;
  jump: number;
  maxHp: number;
  mineSpeed: number;
  light: number;
  dmgMult: number;
  regen: number;
  doubleJump: number;
};

/* ------------------------------ entities ---------------------------- */

export type Mob = {
  uid: number;
  defId: string;
  boss: boolean;
  sprite: string;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  facing: 1 | -1;
  onGround: boolean;
  hurt: number;
  atkCd: number;
  shootCd: number;
  jumpCd: number;
  flying: boolean;
  chill: number;
  burn: number;
  burnDmg: number;
  life: number;
  /** per-pattern cooldowns for bosses */
  pcd: number[];
  action: { kind: string; t: number; ax: number; ay: number; i: number } | null;
  phase: number;
  def: EnemyDef | null;
  bossDef: BossDef | null;
  anim: number;
};

export type Projectile = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  dmg: number;
  friendly: boolean;
  spec: ProjectileSpec;
  life: number;
  pierce: number;
  knockback: number;
  hit: Set<number>;
  spin: number;
  homingUid: number;
  returns: boolean;
  age: number;
  chill: number;
  burn: number;
  /** item dropped where it lands (starfall meteors) */
  dropOnHit: string;
  /** rotate velocity each second (orbiting boss orbs) */
  spinRate: number;
};

export type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  size: number;
  grav: number;
  text?: string;
  crit?: boolean;
};

export type Npc = {
  id: string;
  def: NpcDef;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  homeX: number;
  homeY: number;
  idle: number;
  temp: boolean;
  life: number;
  anim: number;
};

export type House = { x: number; y: number; w: number; h: number; owner: string | null };

export type Drop = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  id: string;
  n: number;
  life: number;
  pick: number;
};

export type ActiveEvent = { def: EventDef; t: number; timer: number };

/* ------------------------------ settings ---------------------------- */

export type Settings = {
  master: number;
  music: number;
  sfx: number;
  controlScale: number;
  quality: "low" | "medium" | "high";
  vibrate: boolean;
  lefty: boolean;
  /** auto picks mouse/keyboard on devices with a fine pointer, touch otherwise */
  controls: "auto" | "touch" | "desktop";
};

export const DEFAULT_SETTINGS: Settings = {
  master: 0.8,
  music: 0.5,
  sfx: 0.8,
  controlScale: 1,
  quality: "high",
  vibrate: true,
  lefty: false,
  controls: "auto",
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}

/* -------------------------------- misc ------------------------------ */

export type Panel = "none" | "inventory" | "craft" | "chest" | "npc" | "settings" | "map" | "death";


export type Toast = { text: string; t: number; color: string };

export function itemName(id: string): string {
  return itemDef(id).name;
}

export function def(id: string): ItemDef {
  return itemDef(id);
}
