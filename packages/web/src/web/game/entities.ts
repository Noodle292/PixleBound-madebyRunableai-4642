import type { ProjectileSpec } from "./items";

export type LootEntry = { item: string; chance: number; min: number; max: number };

export type EnemyBehavior = "walker" | "jumper" | "flyer" | "burrower" | "shooter";

export type EnemyDef = {
  id: string;
  name: string;
  sprite: string;
  w: number;
  h: number;
  hp: number;
  damage: number;
  defense: number;
  speed: number;
  behavior: EnemyBehavior;
  /** biome keys it can spawn in, empty = any */
  biomes: string[];
  layer: "surface" | "under" | "deep" | "any";
  nightOnly?: boolean;
  jump?: number;
  shoot?: { cd: number; damage: number; projectile: ProjectileSpec };
  loot: LootEntry[];
  coins: [number, number];
  knockbackResist?: number;
  tier: number;
};

const coin = (a: number, b: number): [number, number] => [a, b];

export const ENEMIES: EnemyDef[] = [
  {
    id: "bog_slime",
    name: "Bog Slime",
    sprite: "bog_slime",
    w: 26,
    h: 22,
    hp: 32,
    damage: 8,
    defense: 0,
    speed: 26,
    behavior: "jumper",
    biomes: [],
    layer: "surface",
    jump: 190,
    loot: [{ item: "slime_gel", chance: 0.9, min: 1, max: 3 }],
    coins: coin(1, 4),
    tier: 0,
  },
  {
    id: "cave_crawler",
    name: "Cave Crawler",
    sprite: "cave_crawler",
    w: 28,
    h: 22,
    hp: 46,
    damage: 12,
    defense: 1,
    speed: 54,
    behavior: "walker",
    biomes: [],
    layer: "under",
    loot: [
      { item: "cave_fang", chance: 0.6, min: 1, max: 2 },
      { item: "slime_gel", chance: 0.2, min: 1, max: 1 },
    ],
    coins: coin(2, 7),
    tier: 1,
  },
  {
    id: "rock_beetle",
    name: "Rock Beetle",
    sprite: "rock_beetle",
    w: 30,
    h: 24,
    hp: 78,
    damage: 15,
    defense: 4,
    speed: 32,
    behavior: "walker",
    biomes: [],
    layer: "under",
    knockbackResist: 0.5,
    loot: [{ item: "beetle_shell", chance: 0.7, min: 1, max: 2 }],
    coins: coin(3, 9),
    tier: 1,
  },
  {
    id: "night_stalker",
    name: "Night Stalker",
    sprite: "night_stalker",
    w: 26,
    h: 32,
    hp: 95,
    damage: 21,
    defense: 3,
    speed: 66,
    behavior: "walker",
    biomes: [],
    layer: "surface",
    nightOnly: true,
    loot: [{ item: "shadow_dust", chance: 0.7, min: 1, max: 3 }],
    coins: coin(5, 14),
    tier: 2,
  },
  {
    id: "sand_burrower",
    name: "Sand Burrower",
    sprite: "sand_burrower",
    w: 34,
    h: 20,
    hp: 64,
    damage: 17,
    defense: 2,
    speed: 48,
    behavior: "burrower",
    biomes: ["desert"],
    layer: "any",
    loot: [
      { item: "sand", chance: 0.8, min: 2, max: 6 },
      { item: "cave_fang", chance: 0.3, min: 1, max: 1 },
    ],
    coins: coin(3, 10),
    tier: 1,
  },
  {
    id: "frost_wisp",
    name: "Frost Wisp",
    sprite: "frost_wisp",
    w: 26,
    h: 26,
    hp: 58,
    damage: 15,
    defense: 1,
    speed: 44,
    behavior: "shooter",
    biomes: ["snow"],
    layer: "any",
    shoot: {
      cd: 2.2,
      damage: 13,
      projectile: { speed: 13, gravity: 0, look: "frost", size: 7, life: 2, color: "#cdeeff" },
    },
    loot: [{ item: "frost_shard", chance: 0.7, min: 1, max: 3 }],
    coins: coin(4, 11),
    tier: 2,
  },
  {
    id: "crystal_golem",
    name: "Crystal Golem",
    sprite: "crystal_golem",
    w: 34,
    h: 34,
    hp: 185,
    damage: 28,
    defense: 8,
    speed: 30,
    behavior: "walker",
    biomes: [],
    layer: "deep",
    knockbackResist: 0.8,
    loot: [
      { item: "crystal_sliver", chance: 0.8, min: 1, max: 3 },
      { item: "crystal_ore", chance: 0.4, min: 1, max: 2 },
    ],
    coins: coin(10, 25),
    tier: 4,
  },
  {
    id: "shade_bat",
    name: "Shade Bat",
    sprite: "shade_bat",
    w: 30,
    h: 18,
    hp: 36,
    damage: 11,
    defense: 0,
    speed: 78,
    behavior: "flyer",
    biomes: [],
    layer: "under",
    loot: [{ item: "shadow_dust", chance: 0.4, min: 1, max: 1 }],
    coins: coin(2, 6),
    tier: 1,
  },
  {
    id: "fungal_hopper",
    name: "Fungal Hopper",
    sprite: "fungal_hopper",
    w: 28,
    h: 26,
    hp: 92,
    damage: 19,
    defense: 3,
    speed: 40,
    behavior: "jumper",
    biomes: ["fungal"],
    layer: "any",
    jump: 260,
    loot: [
      { item: "glowcap", chance: 0.7, min: 1, max: 3 },
      { item: "herb_bundle", chance: 0.3, min: 1, max: 2 },
    ],
    coins: coin(6, 15),
    tier: 3,
  },
  {
    id: "voidling",
    name: "Voidling",
    sprite: "voidling",
    w: 28,
    h: 28,
    hp: 150,
    damage: 32,
    defense: 7,
    speed: 58,
    behavior: "shooter",
    biomes: [],
    layer: "deep",
    shoot: {
      cd: 1.8,
      damage: 24,
      projectile: { speed: 15, gravity: 0, look: "nova", size: 9, life: 2.4, homing: 1, color: "#c88aff" },
    },
    loot: [
      { item: "void_ember", chance: 0.6, min: 1, max: 2 },
      { item: "aether_mote", chance: 0.15, min: 1, max: 1 },
    ],
    coins: coin(12, 30),
    tier: 5,
  },
  {
    id: "dust_wraith",
    name: "Dust Wraith",
    sprite: "dust_wraith",
    w: 28,
    h: 26,
    hp: 74,
    damage: 18,
    defense: 2,
    speed: 62,
    behavior: "flyer",
    biomes: ["desert"],
    layer: "any",
    nightOnly: true,
    loot: [
      { item: "shadow_dust", chance: 0.5, min: 1, max: 2 },
      { item: "sand", chance: 0.5, min: 2, max: 5 },
    ],
    coins: coin(5, 13),
    tier: 2,
  },
];

export const ENEMY_MAP: Record<string, EnemyDef> = {};
for (const e of ENEMIES) ENEMY_MAP[e.id] = e;

/* ------------------------------ bosses ----------------------------- */

export type BossPattern =
  | { kind: "charge"; cd: number; speed: number; dur: number }
  | { kind: "hop"; cd: number; power: number; count: number }
  | { kind: "dive"; cd: number; speed: number }
  | { kind: "spread"; cd: number; count: number; spread: number; damage: number; proj: ProjectileSpec }
  | { kind: "homing"; cd: number; count: number; damage: number; proj: ProjectileSpec }
  | { kind: "summon"; cd: number; enemy: string; count: number }
  | { kind: "laser"; cd: number; damage: number; dur: number }
  | { kind: "burrow"; cd: number; dur: number }
  | { kind: "rain"; cd: number; count: number; damage: number; proj: ProjectileSpec }
  | { kind: "orbit"; cd: number; count: number; damage: number };

export type BossDef = {
  id: string;
  name: string;
  title: string;
  sprite: string;
  size: number;
  hp: number;
  damage: number;
  defense: number;
  speed: number;
  flying: boolean;
  patterns: BossPattern[];
  loot: LootEntry[];
  coins: [number, number];
  tier: number;
  color: string;
};

const P = (
  speed: number,
  look: ProjectileSpec["look"],
  color: string,
  size = 10,
  extra: Partial<ProjectileSpec> = {},
): ProjectileSpec => ({ speed, gravity: 0, look, size, color, life: 3.5, ...extra });

export const BOSSES: BossDef[] = [
  {
    id: "thicketmaw",
    name: "Thicketmaw",
    title: "The Grovewarden",
    sprite: "thicketmaw",
    size: 112,
    hp: 900,
    damage: 22,
    defense: 4,
    speed: 60,
    flying: false,
    patterns: [
      { kind: "hop", cd: 3.2, power: 420, count: 3 },
      { kind: "charge", cd: 7, speed: 175, dur: 1.4 },
      { kind: "summon", cd: 11, enemy: "bog_slime", count: 3 },
      { kind: "spread", cd: 6, count: 5, spread: 0.7, damage: 18, proj: P(13, "spore", "#9ade6a", 11) },
    ],
    loot: [
      { item: "boss_core_1", chance: 1, min: 1, max: 1 },
      { item: "iron_bar", chance: 1, min: 6, max: 12 },
      { item: "vital_bloom", chance: 0.8, min: 1, max: 1 },
    ],
    coins: coin(120, 220),
    tier: 1,
    color: "#7fbf4a",
  },
  {
    id: "skarn",
    name: "Skarn",
    title: "The Dunecarver",
    sprite: "skarn",
    size: 124,
    hp: 1500,
    damage: 28,
    defense: 7,
    speed: 74,
    flying: false,
    patterns: [
      { kind: "burrow", cd: 6.5, dur: 1.6 },
      { kind: "charge", cd: 5, speed: 230, dur: 1.5 },
      { kind: "rain", cd: 8, count: 7, damage: 22, proj: P(0, "arrow", "#e8cf90", 10, { gravity: 20 }) },
      { kind: "summon", cd: 13, enemy: "sand_burrower", count: 2 },
    ],
    loot: [
      { item: "boss_core_2", chance: 1, min: 1, max: 1 },
      { item: "silver_bar", chance: 1, min: 6, max: 12 },
      { item: "vital_bloom", chance: 0.8, min: 1, max: 1 },
    ],
    coins: coin(180, 320),
    tier: 2,
    color: "#dbc27a",
  },
  {
    id: "vespa",
    name: "Vespa",
    title: "Hollow Queen",
    sprite: "vespa",
    size: 118,
    hp: 2200,
    damage: 32,
    defense: 8,
    speed: 105,
    flying: true,
    patterns: [
      { kind: "dive", cd: 4, speed: 300 },
      { kind: "summon", cd: 8, enemy: "shade_bat", count: 4 },
      { kind: "spread", cd: 5.5, count: 6, spread: 1.1, damage: 24, proj: P(16, "bolt", "#e0c25a", 9) },
      { kind: "homing", cd: 9, count: 3, damage: 26, proj: P(11, "nova", "#ffd76e", 12, { homing: 1.6 }) },
    ],
    loot: [
      { item: "boss_core_3", chance: 1, min: 1, max: 1 },
      { item: "gold_bar", chance: 1, min: 6, max: 12 },
      { item: "vital_bloom", chance: 0.8, min: 1, max: 1 },
    ],
    coins: coin(240, 400),
    tier: 3,
    color: "#c8a24a",
  },
  {
    id: "rimefang",
    name: "Rimefang Colossus",
    title: "Warden of the White Waste",
    sprite: "rimefang",
    size: 136,
    hp: 3200,
    damage: 38,
    defense: 12,
    speed: 66,
    flying: false,
    patterns: [
      { kind: "charge", cd: 5, speed: 250, dur: 1.8 },
      { kind: "spread", cd: 4.5, count: 8, spread: 1.4, damage: 28, proj: P(15, "frost", "#cdeeff", 10) },
      { kind: "hop", cd: 7, power: 480, count: 2 },
      { kind: "summon", cd: 12, enemy: "frost_wisp", count: 3 },
    ],
    loot: [
      { item: "boss_core_4", chance: 1, min: 1, max: 1 },
      { item: "crystal_ore", chance: 1, min: 10, max: 20 },
      { item: "vital_bloom", chance: 0.8, min: 1, max: 1 },
    ],
    coins: coin(320, 520),
    tier: 4,
    color: "#a8dcf0",
  },
  {
    id: "mycelor",
    name: "Mycelor",
    title: "Fungal Sovereign",
    sprite: "mycelor",
    size: 130,
    hp: 4200,
    damage: 42,
    defense: 13,
    speed: 58,
    flying: false,
    patterns: [
      { kind: "hop", cd: 3, power: 520, count: 4 },
      { kind: "spread", cd: 4, count: 10, spread: 2.2, damage: 30, proj: P(9, "spore", "#a8f0d0", 13, { gravity: -2 }) },
      { kind: "summon", cd: 9, enemy: "fungal_hopper", count: 3 },
      { kind: "orbit", cd: 11, count: 6, damage: 32 },
    ],
    loot: [
      { item: "boss_core_5", chance: 1, min: 1, max: 1 },
      { item: "crystal_bar", chance: 1, min: 5, max: 10 },
      { item: "vital_bloom", chance: 0.8, min: 1, max: 1 },
    ],
    coins: coin(400, 650),
    tier: 5,
    color: "#8ce0c0",
  },
  {
    id: "prismgeist",
    name: "Prismgeist",
    title: "The Crystalline Devourer",
    sprite: "prismgeist",
    size: 128,
    hp: 5400,
    damage: 46,
    defense: 15,
    speed: 118,
    flying: true,
    patterns: [
      { kind: "laser", cd: 6, damage: 34, dur: 2.2 },
      { kind: "orbit", cd: 8, count: 8, damage: 36 },
      { kind: "dive", cd: 4.5, speed: 330 },
      { kind: "spread", cd: 5, count: 12, spread: 6.28, damage: 32, proj: P(14, "prism", "#8ff2e8", 11) },
    ],
    loot: [
      { item: "boss_core_6", chance: 1, min: 1, max: 1 },
      { item: "aetherite_ore", chance: 1, min: 12, max: 24 },
      { item: "vital_bloom", chance: 0.8, min: 1, max: 1 },
    ],
    coins: coin(520, 800),
    tier: 6,
    color: "#5fe0d6",
  },
  {
    id: "nyxdrake",
    name: "Nyxdrake",
    title: "Voidbound Leviathan",
    sprite: "nyxdrake",
    size: 150,
    hp: 7200,
    damage: 54,
    defense: 18,
    speed: 140,
    flying: true,
    patterns: [
      { kind: "dive", cd: 3.4, speed: 400 },
      { kind: "homing", cd: 5, count: 5, damage: 40, proj: P(13, "nova", "#c88aff", 14, { homing: 2.2 }) },
      { kind: "spread", cd: 6, count: 14, spread: 6.28, damage: 36, proj: P(17, "bolt", "#a05fff", 10) },
      { kind: "summon", cd: 10, enemy: "voidling", count: 2 },
    ],
    loot: [
      { item: "boss_core_7", chance: 1, min: 1, max: 1 },
      { item: "void_reaver", chance: 1, min: 1, max: 1 },
      { item: "aetherite_bar", chance: 1, min: 6, max: 12 },
    ],
    coins: coin(700, 1100),
    tier: 7,
    color: "#a05fff",
  },
  {
    id: "astralith",
    name: "Astralith",
    title: "Aether Sovereign",
    sprite: "astralith",
    size: 160,
    hp: 11000,
    damage: 62,
    defense: 22,
    speed: 130,
    flying: true,
    patterns: [
      { kind: "laser", cd: 5, damage: 46, dur: 2.6 },
      { kind: "homing", cd: 4.5, count: 7, damage: 44, proj: P(14, "star", "#ffe9a8", 13, { homing: 2.6 }) },
      { kind: "rain", cd: 7, count: 14, damage: 42, proj: P(0, "star", "#ffd76e", 12, { gravity: 26 }) },
      { kind: "orbit", cd: 9, count: 10, damage: 44 },
      { kind: "dive", cd: 5.5, speed: 380 },
      { kind: "summon", cd: 12, enemy: "crystal_golem", count: 2 },
    ],
    loot: [
      { item: "boss_core_8", chance: 1, min: 1, max: 1 },
      { item: "aetherite_bar", chance: 1, min: 15, max: 30 },
      { item: "aether_mote", chance: 1, min: 8, max: 16 },
    ],
    coins: coin(1200, 2000),
    tier: 8,
    color: "#ffb0f0",
  },
];

export const BOSS_MAP: Record<string, BossDef> = {};
for (const b of BOSSES) BOSS_MAP[b.id] = b;

/* -------------------------------- NPCs ----------------------------- */

export type NpcDef = {
  id: string;
  name: string;
  role: string;
  palette: string;
  greeting: string[];
  /** requirement text shown before they arrive */
  requirement: string;
  /** predicate key evaluated in game logic */
  unlock: "always" | "coins50" | "ore_iron" | "boss1" | "boss2" | "boss4";
  shop: { item: string; price: number }[];
  heals?: boolean;
};

export const NPCS: NpcDef[] = [
  {
    id: "merchant",
    name: "Tess Halloway",
    role: "Merchant",
    palette: "merchant",
    greeting: [
      "Fresh stock, friend. Dig deep, spend deeper.",
      "Coins first, questions later.",
      "I walked a long way to sell you rope I don't have.",
    ],
    requirement: "Have 50 coins and a spare house",
    unlock: "coins50",
    shop: [
      { item: "torch", price: 3 },
      { item: "lesser_salve", price: 25 },
      { item: "plank", price: 2 },
      { item: "platform", price: 2 },
      { item: "chest", price: 60 },
      { item: "herb_bundle", price: 10 },
    ],
  },
  {
    id: "blacksmith",
    name: "Orin Brackwell",
    role: "Blacksmith",
    palette: "blacksmith",
    greeting: ["Bring me ore, I'll bring the noise.", "Anvil's hot. Don't touch it."],
    requirement: "Mine ironbark ore and build a house",
    unlock: "ore_iron",
    shop: [
      { item: "anvil", price: 150 },
      { item: "copper_bar", price: 20 },
      { item: "iron_bar", price: 40 },
      { item: "copper_pick", price: 90 },
      { item: "iron_helmet", price: 140 },
    ],
  },
  {
    id: "healer",
    name: "Sister Vale",
    role: "Healer",
    palette: "healer",
    greeting: ["Hold still. This will only sting spiritually.", "You bleed too generously."],
    requirement: "Build a second house",
    unlock: "always",
    shop: [
      { item: "lesser_salve", price: 22 },
      { item: "greater_salve", price: 70 },
      { item: "herb_bundle", price: 8 },
    ],
    heals: true,
  },
  {
    id: "explorer",
    name: "Cass Pike",
    role: "Explorer",
    palette: "explorer",
    greeting: ["There's a cavern south of here. Probably fatal.", "Take rope. Always take rope."],
    requirement: "Defeat the Grovewarden",
    unlock: "boss1",
    shop: [
      { item: "torch", price: 2 },
      { item: "miners_brew", price: 45 },
      { item: "swiftroot_charm", price: 260 },
      { item: "wood_bow", price: 60 },
    ],
  },
  {
    id: "engineer",
    name: "Bex Ondry",
    role: "Engineer",
    palette: "engineer",
    greeting: ["Everything is a machine if you hit it right.", "Platforms. Buy platforms."],
    requirement: "Defeat the Dunecarver",
    unlock: "boss2",
    shop: [
      { item: "platform", price: 1 },
      { item: "glass", price: 4 },
      { item: "furnace", price: 80 },
      { item: "copper_boltcaster", price: 320 },
      { item: "stonehide_band", price: 380 },
    ],
  },
  {
    id: "wizard",
    name: "Ombric the Dim",
    role: "Wizard",
    palette: "wizard",
    greeting: ["I foresaw your arrival. Roughly. Vaguely.", "Magic is just very confident physics."],
    requirement: "Defeat the Rimefang Colossus",
    unlock: "boss4",
    shop: [
      { item: "nightsight", price: 60 },
      { item: "ember_wand", price: 300 },
      { item: "frost_staff", price: 620 },
      { item: "crystal_block", price: 12 },
      { item: "prism_ward", price: 1400 },
    ],
  },
];

export const NPC_MAP: Record<string, NpcDef> = {};
for (const n of NPCS) NPC_MAP[n.id] = n;

/* ---------------------------- chest loot --------------------------- */

export type LootTier = { name: string; entries: LootEntry[] };

export const CHEST_TIERS: LootTier[] = [
  {
    name: "Weathered Strongbox",
    entries: [
      { item: "coin", chance: 1, min: 15, max: 60 },
      { item: "torch", chance: 0.9, min: 3, max: 10 },
      { item: "copper_ore", chance: 0.7, min: 4, max: 12 },
      { item: "lesser_salve", chance: 0.6, min: 1, max: 3 },
      { item: "wood_bow", chance: 0.18, min: 1, max: 1 },
      { item: "swiftroot_charm", chance: 0.12, min: 1, max: 1 },
      { item: "herb_bundle", chance: 0.4, min: 2, max: 5 },
    ],
  },
  {
    name: "Iron-Bound Cache",
    entries: [
      { item: "coin", chance: 1, min: 60, max: 180 },
      { item: "iron_ore", chance: 0.8, min: 6, max: 16 },
      { item: "lesser_salve", chance: 0.7, min: 2, max: 5 },
      { item: "kestrel_chakram", chance: 0.15, min: 1, max: 1 },
      { item: "featherstep", chance: 0.12, min: 1, max: 1 },
      { item: "miners_lumen", chance: 0.12, min: 1, max: 1 },
      { item: "iron_helmet", chance: 0.2, min: 1, max: 1 },
      { item: "vital_bloom", chance: 0.1, min: 1, max: 1 },
    ],
  },
  {
    name: "Cavern Vault",
    entries: [
      { item: "coin", chance: 1, min: 150, max: 420 },
      { item: "silver_ore", chance: 0.8, min: 8, max: 20 },
      { item: "gold_ore", chance: 0.5, min: 4, max: 12 },
      { item: "greater_salve", chance: 0.7, min: 2, max: 5 },
      { item: "frost_staff", chance: 0.12, min: 1, max: 1 },
      { item: "iron_bow", chance: 0.18, min: 1, max: 1 },
      { item: "vital_bloom", chance: 0.2, min: 1, max: 1 },
    ],
  },
  {
    name: "Voidsealed Reliquary",
    entries: [
      { item: "coin", chance: 1, min: 400, max: 1000 },
      { item: "crystal_ore", chance: 0.9, min: 10, max: 24 },
      { item: "aetherite_ore", chance: 0.5, min: 5, max: 14 },
      { item: "greater_salve", chance: 0.9, min: 3, max: 8 },
      { item: "shatter_disc", chance: 0.14, min: 1, max: 1 },
      { item: "voidwalker_sigil", chance: 0.12, min: 1, max: 1 },
      { item: "vital_bloom", chance: 0.35, min: 1, max: 1 },
      { item: "crystal_sword", chance: 0.1, min: 1, max: 1 }, // Glasscore Brand
    ],
  },
];

/* --------------------------- world events -------------------------- */

export type EventDef = {
  id: string;
  name: string;
  desc: string;
  duration: number;
  color: string;
  night?: boolean;
  day?: boolean;
  minTier?: number;
};

export const EVENTS: EventDef[] = [
  { id: "starfall", name: "Starfall", desc: "Starstone is raining from the sky!", duration: 60, color: "#ffd76e", night: true },
  { id: "gloomtide", name: "Gloomtide", desc: "The sky bleeds. Everything hunts tonight.", duration: 120, color: "#e0435f", night: true, minTier: 1 },
  { id: "swarm", name: "Hollow Swarm", desc: "A swarm boils out of the caves!", duration: 90, color: "#c8a24a", minTier: 1 },
  { id: "crystal_squall", name: "Crystal Squall", desc: "Crystal shards drift through the air — and so do golems.", duration: 90, color: "#5fe0d6", minTier: 3 },
  { id: "cache_bloom", name: "Cache Bloom", desc: "Buried caches have surfaced nearby!", duration: 75, color: "#7fbf4a", day: true },
  { id: "trader", name: "Wandering Trader", desc: "A trader with strange stock is passing through.", duration: 120, color: "#b5783f", day: true },
  { id: "migration", name: "Wisp Migration", desc: "Rare creatures drift across the world.", duration: 80, color: "#a8dcf0" },
];
