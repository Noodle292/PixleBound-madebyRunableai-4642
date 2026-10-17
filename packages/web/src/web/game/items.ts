import { B } from "./blocks";
import type { IconShape } from "./sprites";

export type WeaponKind = "melee" | "bow" | "magic" | "thrown" | "gun";

export type ProjectileSpec = {
  speed: number;
  gravity: number;
  look: "arrow" | "bolt" | "ember" | "frost" | "prism" | "star" | "nova" | "disc" | "spore";
  size: number;
  pierce?: number;
  homing?: number;
  life?: number;
  color: string;
};

export type WeaponSpec = {
  damage: number;
  /** swings per second */
  speed: number;
  /** melee reach in tiles */
  range: number;
  knockback: number;
  kind: WeaponKind;
  projectile?: ProjectileSpec;
  /** extra: number of projectiles per shot */
  shots?: number;
  spread?: number;
  burn?: number;
  chill?: number;
  returns?: boolean;
};

export type ArmorSpec = {
  slot: "helmet" | "chest" | "legs" | "boots";
  defense: number;
  bonus?: Partial<StatBonus>;
};

export type StatBonus = {
  speed: number;
  jump: number;
  defense: number;
  maxHp: number;
  mineSpeed: number;
  light: number;
  dmgMult: number;
  regen: number;
  doubleJump: number;
};

export type ItemKind =
  | "material"
  | "block"
  | "tool"
  | "weapon"
  | "armor"
  | "accessory"
  | "potion"
  | "summon"
  | "station"
  | "furniture";

export type ItemDef = {
  id: string;
  name: string;
  kind: ItemKind;
  icon: IconShape;
  color: string;
  stack: number;
  desc: string;
  block?: number;
  tool?: { tier: number; power: number; type: "pick" | "axe" };
  weapon?: WeaponSpec;
  armor?: ArmorSpec;
  accessory?: Partial<StatBonus>;
  potion?: { heal?: number; buff?: keyof StatBonus; amount?: number; duration?: number; permanentHp?: number };
  summon?: string;
  value?: number;
  tier?: number;
};

const items: ItemDef[] = [];
function add(def: ItemDef) {
  items.push(def);
  return def;
}

/* ---------------------------- materials --------------------------- */

const mat = (id: string, name: string, color: string, icon: IconShape = "ore", desc = "", value = 1) =>
  add({ id, name, kind: "material", icon, color, stack: 999, desc, value });

mat("copper_ore", "Copper Ore", "#c87b41", "ore", "Raw copper chunks. Smelt into bars.", 3);
mat("iron_ore", "Ironbark Ore", "#b7b0a4", "ore", "Dense grey ore, needs a copper pick.", 5);
mat("silver_ore", "Palesteel Ore", "#d8e3ea", "ore", "Cold, bright ore from the deep.", 8);
mat("gold_ore", "Sunmetal Ore", "#ecc54a", "ore", "Warm to the touch.", 12);
mat("crystal_ore", "Glasscore Ore", "#5fe0d6", "ore", "Hums faintly. Found in caverns.", 20);
mat("aetherite_ore", "Aetherite Ore", "#cf7bff", "ore", "Magical ore of the deep void.", 35);
mat("starstone_ore", "Starstone", "#ffd76e", "ore", "Falls from the sky during a Starfall.", 25);
mat("copper_bar", "Copper Bar", "#c87b41", "ingot", "Smelted copper.", 9);
mat("iron_bar", "Ironbark Bar", "#b7b0a4", "ingot", "Smelted ironbark.", 15);
mat("silver_bar", "Palesteel Bar", "#d8e3ea", "ingot", "Smelted palesteel.", 24);
mat("gold_bar", "Sunmetal Bar", "#ecc54a", "ingot", "Smelted sunmetal.", 36);
mat("crystal_bar", "Glasscore Bar", "#5fe0d6", "ingot", "Fused at an arcane forge.", 60);
mat("aetherite_bar", "Aetherite Bar", "#cf7bff", "ingot", "Fused at an arcane forge.", 105);
mat("coin", "Coin", "#ffd76e", "coin", "Currency accepted by every settler.", 1);
mat("slime_gel", "Bog Gel", "#7ad06a", "seed", "Sticky, faintly sweet.", 2);
mat("cave_fang", "Cave Fang", "#dcd6c4", "gem", "Torn from a crawler.", 4);
mat("beetle_shell", "Shell Plate", "#8a7a5c", "gem", "Hard chitin plating.", 4);
mat("shadow_dust", "Shadow Dust", "#4b3d6b", "seed", "Night-born residue.", 6);
mat("frost_shard", "Frost Shard", "#a8dcf0", "gem", "Never melts.", 7);
mat("crystal_sliver", "Crystal Sliver", "#63d8e8", "gem", "Shed by crystal beasts.", 10);
mat("void_ember", "Void Ember", "#a05fff", "gem", "Burns cold.", 18);
mat("aether_mote", "Aether Mote", "#ffb0f0", "orb", "A fragment of raw magic.", 30);
mat("herb_bundle", "Herb Bundle", "#7fbf4a", "seed", "Brewing ingredient.", 3);
mat("seed", "Sapling Seed", "#8fc35a", "seed", "Plant it, or brew it.", 1);
mat("boss_core_1", "Thicket Heart", "#7fbf4a", "orb", "Trophy of the Grovewarden.", 80);
mat("boss_core_2", "Dune Fang", "#dbc27a", "gem", "Trophy of the Dunecarver.", 100);
mat("boss_core_3", "Royal Chitin", "#c8a24a", "gem", "Trophy of the Hollow Queen.", 120);
mat("boss_core_4", "Rime Horn", "#a8dcf0", "gem", "Trophy of the Rimefang.", 150);
mat("boss_core_5", "Spore Crown", "#8ce0c0", "orb", "Trophy of the Sovereign.", 180);
mat("boss_core_6", "Prism Eye", "#5fe0d6", "orb", "Trophy of the Prismgeist.", 220);
mat("boss_core_7", "Void Scale", "#a05fff", "gem", "Trophy of the Nyxdrake.", 280);
mat("boss_core_8", "Aether Crown", "#ffb0f0", "orb", "Trophy of Astralith.", 400);

/* ------------------------- placeable blocks ----------------------- */

const blockItem = (
  id: string,
  name: string,
  block: number,
  color: string,
  kind: ItemKind = "block",
  icon: IconShape = "ingot",
  desc = "Placeable block.",
) => add({ id, name, kind, icon, color, stack: 999, desc, block, value: 1 });

blockItem("dirt", "Dirt", B.DIRT, "#6b4a2b");
blockItem("stone", "Stone", B.STONE, "#7b7b86");
blockItem("sand", "Sand", B.SAND, "#dbc27a");
blockItem("snow", "Snow", B.SNOW, "#e8f2f7");
blockItem("clay", "Clay", B.CLAY, "#a9705c");
blockItem("mud", "Mud", B.MUD, "#4e3b28");
blockItem("red_sand", "Rust Sand", B.RED_SAND, "#c4703f");
blockItem("wood", "Timberwood", B.LOG, "#7a5230");
blockItem("plank", "Plankwood", B.PLANK, "#a8763f");
blockItem("glass", "Glass", B.GLASS, "#bde4f2");
blockItem("brick", "Stone Brick", B.BRICK, "#8a8a95");
blockItem("sandstone", "Sandstone", B.SANDSTONE, "#c3a768");
blockItem("ice", "Rimeice", B.ICE, "#a8dcf0");
blockItem("fungal_loam", "Fungal Loam", B.FUNGAL, "#5b4a6e");
blockItem("glowcap", "Glowcap", B.GLOWCAP, "#7be0c0", "furniture", "orb", "A living lamp.");
blockItem("palewood", "Palewood", B.PALEWOOD, "#cfc6b0");
blockItem("bonebrick", "Bonebrick", B.BONE, "#8a8272");
blockItem("crystal_block", "Crystal Block", B.CRYSTAL_BLOCK, "#63d8e8");
blockItem("voidstone", "Voidstone", B.VOIDSTONE, "#2b2440");
blockItem("wall_stone", "Cut Wall", B.WALL_STONE, "#5f5f6b");
blockItem("ash", "Ashcrust", B.ASH, "#4a4045");
blockItem("platform", "Skyplank", B.PLATFORM, "#b8854a", "block", "ingot", "Walk on it, jump up through it.");
blockItem("door", "Door", B.DOOR, "#8a6134", "furniture", "chest", "Tap to open. Houses need one.");
blockItem("torch", "Emberlight", B.TORCH, "#f0b64a", "furniture", "torch", "Light source. Houses need one.");
blockItem("chest", "Strongbox", B.CHEST, "#9a6b34", "furniture", "chest", "Stores 20 stacks.");
blockItem("table", "Table", B.TABLE, "#9c7343", "furniture", "chest", "Furniture. Houses need one.");
blockItem("chair", "Chair", B.CHAIR, "#8a6134", "furniture", "chest", "Furniture. Houses need one.");
blockItem("workbench", "Workbench", B.WORKBENCH, "#9c7343", "station", "chest", "Crafting station: basics.");
blockItem("furnace", "Smeltpit", B.FURNACE, "#6d6d78", "station", "chest", "Crafting station: smelting.");
blockItem("anvil", "Forging Anvil", B.ANVIL, "#5a5a66", "station", "chest", "Crafting station: metal gear.");
blockItem("alchemy_table", "Alchemy Table", B.ALCHEMY, "#5c7a6b", "station", "chest", "Crafting station: potions.");
blockItem("arcane_forge", "Arcane Forge", B.ARCANE_FORGE, "#4a3f6b", "station", "chest", "Crafting station: late-game gear.");

/* ------------------------ tools & armor sets ---------------------- */

export type MatTier = {
  key: string;
  name: string;
  tier: number;
  bar: string;
  color: string;
  dmg: number;
  power: number;
  def: number;
  station: string | null;
};

export const MAT_TIERS: MatTier[] = [
  { key: "wood", name: "Timber", tier: 0, bar: "wood", color: "#a8763f", dmg: 7, power: 1, def: 1, station: "workbench" },
  { key: "copper", name: "Copper", tier: 1, bar: "copper_bar", color: "#c87b41", dmg: 11, power: 1.6, def: 2, station: "anvil" },
  { key: "iron", name: "Ironbark", tier: 2, bar: "iron_bar", color: "#b7b0a4", dmg: 17, power: 2.2, def: 3, station: "anvil" },
  { key: "silver", name: "Palesteel", tier: 3, bar: "silver_bar", color: "#d8e3ea", dmg: 24, power: 3, def: 4, station: "anvil" },
  { key: "gold", name: "Sunmetal", tier: 4, bar: "gold_bar", color: "#ecc54a", dmg: 32, power: 3.8, def: 6, station: "anvil" },
  { key: "crystal", name: "Glasscore", tier: 5, bar: "crystal_bar", color: "#5fe0d6", dmg: 44, power: 5, def: 8, station: "arcane" },
  { key: "aetherite", name: "Aetherite", tier: 6, bar: "aetherite_bar", color: "#cf7bff", dmg: 60, power: 6.5, def: 11, station: "arcane" },
];

const SWORD_NAMES: Record<string, string> = {
  wood: "Splinter Blade",
  copper: "Copper Cleaver",
  iron: "Ironbark Saber",
  silver: "Palesteel Edge",
  gold: "Sunmetal Falchion",
  crystal: "Glasscore Brand",
  aetherite: "Aetherite Warblade",
};

for (const m of MAT_TIERS) {
  add({
    id: `${m.key}_pick`,
    name: `${m.name} Pick`,
    kind: "tool",
    icon: "pick",
    color: m.color,
    stack: 1,
    desc: `Mines tier ${m.tier} materials. Power ${m.power.toFixed(1)}.`,
    tool: { tier: m.tier, power: m.power, type: "pick" },
    tier: m.tier,
    value: 20 * (m.tier + 1),
  });
  add({
    id: `${m.key}_axe`,
    name: `${m.name} Axe`,
    kind: "tool",
    icon: "axe",
    color: m.color,
    stack: 1,
    desc: `Chops wood fast. Doubles as a crude weapon.`,
    tool: { tier: m.tier, power: m.power * 1.1, type: "axe" },
    weapon: { damage: Math.round(m.dmg * 0.8), speed: 1.4, range: 1.7, knockback: 5, kind: "melee" },
    tier: m.tier,
    value: 18 * (m.tier + 1),
  });
  add({
    id: `${m.key}_sword`,
    name: SWORD_NAMES[m.key] ?? `${m.name} Sword`,
    kind: "weapon",
    icon: "sword",
    color: m.color,
    stack: 1,
    desc: `Melee blade. ${m.dmg} damage.`,
    weapon: { damage: m.dmg, speed: 2.1 + m.tier * 0.06, range: 1.9 + m.tier * 0.06, knockback: 6 + m.tier, kind: "melee" },
    tier: m.tier,
    value: 25 * (m.tier + 1),
  });

  const pieces: { slot: ArmorSpec["slot"]; suffix: string; mult: number; icon: IconShape; bonus?: Partial<StatBonus> }[] = [
    { slot: "helmet", suffix: "Helm", mult: 1, icon: "helmet", bonus: { mineSpeed: 0.04 * (m.tier + 1) } },
    { slot: "chest", suffix: "Chestplate", mult: 1.5, icon: "chest", bonus: { maxHp: 4 * m.tier } },
    { slot: "legs", suffix: "Greaves", mult: 1.2, icon: "legs", bonus: { speed: 0.02 * m.tier } },
    { slot: "boots", suffix: "Boots", mult: 0.8, icon: "boots", bonus: { speed: 0.03 * (m.tier + 1), jump: 0.02 * m.tier } },
  ];
  for (const p of pieces) {
    add({
      id: `${m.key}_${p.slot}`,
      name: `${m.name} ${p.suffix}`,
      kind: "armor",
      icon: p.icon,
      color: m.color,
      stack: 1,
      desc: `+${Math.round(m.def * p.mult)} defense`,
      armor: { slot: p.slot, defense: Math.round(m.def * p.mult), bonus: p.bonus },
      tier: m.tier,
      value: 30 * (m.tier + 1),
    });
  }
}

/* ---------------------------- weapons ----------------------------- */

const weapon = (
  id: string,
  name: string,
  icon: IconShape,
  color: string,
  spec: WeaponSpec,
  desc: string,
  tier: number,
) => add({ id, name, kind: "weapon", icon, color, stack: 1, desc, weapon: spec, tier, value: 40 * (tier + 1) });

weapon("wood_spear", "Sharpened Pike", "spear", "#a8763f", { damage: 9, speed: 1.2, range: 2.9, knockback: 9, kind: "melee" }, "Long reach, slow jab.", 0);
weapon("iron_spear", "Ironbark Lance", "spear", "#b7b0a4", { damage: 21, speed: 1.3, range: 3.3, knockback: 12, kind: "melee" }, "Keeps enemies at bay.", 2);
weapon("crystal_spear", "Prism Lance", "spear", "#5fe0d6", { damage: 41, speed: 1.5, range: 3.6, knockback: 14, kind: "melee" }, "Reach of a polearm, bite of a blade.", 5);
weapon("thorn_lash", "Thornlash", "dagger", "#7fbf4a", { damage: 14, speed: 3.4, range: 2.2, knockback: 3, kind: "melee" }, "Very fast, low knockback.", 1);
weapon("ember_lash", "Emberlash", "dagger", "#f0803c", { damage: 26, speed: 3, range: 2.4, knockback: 4, kind: "melee", burn: 6 }, "Sets foes alight.", 3);

weapon(
  "wood_bow",
  "Sapling Bow",
  "bow",
  "#a8763f",
  { damage: 8, speed: 1.6, range: 0, knockback: 5, kind: "bow", projectile: { speed: 17, gravity: 14, look: "arrow", size: 6, color: "#d9c79a" } },
  "Fires arrows in an arc.",
  0,
);
weapon(
  "iron_bow",
  "Tensile Longbow",
  "bow",
  "#b7b0a4",
  { damage: 17, speed: 1.9, range: 0, knockback: 7, kind: "bow", projectile: { speed: 22, gravity: 11, look: "arrow", size: 7, color: "#e6dcc0" } },
  "Flatter, faster shots.",
  2,
);
weapon(
  "crystal_bow",
  "Glasscore Bow",
  "bow",
  "#5fe0d6",
  { damage: 31, speed: 2.2, range: 0, knockback: 8, kind: "bow", projectile: { speed: 27, gravity: 8, look: "prism", size: 7, pierce: 1, color: "#8ff2e8" } },
  "Shots pierce one enemy.",
  5,
);
weapon(
  "starfall_bow",
  "Starfall Bow",
  "bow",
  "#ffd76e",
  { damage: 44, speed: 2.4, range: 0, knockback: 9, kind: "bow", shots: 2, spread: 0.1, projectile: { speed: 30, gravity: 6, look: "star", size: 8, pierce: 2, color: "#ffe9a8" } },
  "Twin starlit arrows.",
  6,
);

weapon(
  "ember_wand",
  "Emberwisp Wand",
  "staff",
  "#f0803c",
  { damage: 13, speed: 2.4, range: 0, knockback: 4, kind: "magic", projectile: { speed: 15, gravity: 0, look: "ember", size: 7, life: 1.4, color: "#ffa54a" }, burn: 4 },
  "Lobs burning wisps.",
  1,
);
weapon(
  "frost_staff",
  "Rimecall Staff",
  "staff",
  "#a8dcf0",
  { damage: 23, speed: 2, range: 0, knockback: 6, kind: "magic", shots: 3, spread: 0.22, projectile: { speed: 16, gravity: 2, look: "frost", size: 6, life: 1.2, color: "#cdeeff" }, chill: 2 },
  "A fan of freezing shards.",
  3,
);
weapon(
  "crystal_staff",
  "Prismbolt Staff",
  "staff",
  "#5fe0d6",
  { damage: 36, speed: 2.6, range: 0, knockback: 6, kind: "magic", projectile: { speed: 24, gravity: 0, look: "prism", size: 8, pierce: 2, life: 1.6, color: "#7ff0e4" } },
  "Piercing beam of light.",
  5,
);
weapon(
  "aether_staff",
  "Aether Nova Staff",
  "staff",
  "#cf7bff",
  { damage: 52, speed: 1.8, range: 0, knockback: 12, kind: "magic", projectile: { speed: 18, gravity: 0, look: "nova", size: 12, pierce: 4, life: 2, homing: 2.5, color: "#e0a8ff" } },
  "Homing nova that tears through ranks.",
  6,
);

weapon(
  "kestrel_chakram",
  "Kestrel Chakram",
  "thrown",
  "#c8d8e0",
  { damage: 19, speed: 1.5, range: 0, knockback: 8, kind: "thrown", returns: true, projectile: { speed: 20, gravity: 0, look: "disc", size: 9, pierce: 3, life: 1.6, color: "#dfe9f0" } },
  "Thrown disc that returns.",
  2,
);
weapon(
  "shatter_disc",
  "Shatterglass Disc",
  "thrown",
  "#5fe0d6",
  { damage: 33, speed: 1.8, range: 0, knockback: 10, kind: "thrown", returns: true, projectile: { speed: 25, gravity: 0, look: "disc", size: 10, pierce: 5, life: 1.8, color: "#9ff4ea" } },
  "Slices through whole groups.",
  5,
);
weapon(
  "copper_boltcaster",
  "Copper Boltcaster",
  "staff",
  "#c87b41",
  { damage: 12, speed: 4.5, range: 0, knockback: 2, kind: "gun", projectile: { speed: 30, gravity: 0, look: "bolt", size: 5, life: 1, color: "#ffd9a8" } },
  "Rapid-fire spring-loaded bolts.",
  1,
);
weapon(
  "aether_railspike",
  "Aetherite Railspike",
  "staff",
  "#cf7bff",
  { damage: 47, speed: 3.2, range: 0, knockback: 6, kind: "gun", projectile: { speed: 42, gravity: 0, look: "bolt", size: 7, pierce: 3, life: 1.2, color: "#f0c8ff" } },
  "Hypervelocity spikes.",
  6,
);
weapon(
  "spore_bloom",
  "Mycelium Bloom",
  "staff",
  "#8ce0c0",
  { damage: 28, speed: 1.4, range: 0, knockback: 5, kind: "magic", shots: 4, spread: 0.5, projectile: { speed: 11, gravity: -1.5, look: "spore", size: 8, life: 2.4, color: "#a8f0d0" } },
  "Drifting spore clouds that linger.",
  4,
);
weapon(
  "void_reaver",
  "Voidfang Reaver",
  "sword",
  "#a05fff",
  { damage: 74, speed: 2.6, range: 2.6, knockback: 18, kind: "melee", burn: 10 },
  "Boss loot. Cleaves reality itself.",
  7,
);

/* -------------------------- accessories --------------------------- */

const acc = (id: string, name: string, color: string, bonus: Partial<StatBonus>, desc: string, tier: number, icon: IconShape = "ring") =>
  add({ id, name, kind: "accessory", icon, color, stack: 1, desc, accessory: bonus, tier, value: 60 * (tier + 1) });

acc("swiftroot_charm", "Swiftroot Charm", "#7fbf4a", { speed: 0.18 }, "+18% movement speed", 0);
acc("stonehide_band", "Stonehide Band", "#8a8a95", { defense: 5 }, "+5 defense", 1);
acc("miners_lumen", "Miner's Lumen", "#f0b64a", { light: 0.55, mineSpeed: 0.25 }, "Personal light, +25% mining speed", 1, "orb");
acc("featherstep", "Featherstep Talisman", "#cfe6f0", { jump: 0.22, doubleJump: 1 }, "Higher jump + one mid-air jump", 2);
acc("vigor_locket", "Vigor Locket", "#e05a6a", { maxHp: 25, regen: 0.6 }, "+25 max health, slow regeneration", 2, "heart");
acc("prism_ward", "Prism Ward", "#5fe0d6", { defense: 8, regen: 1 }, "+8 defense, regeneration", 4);
acc("voidwalker_sigil", "Voidwalker Sigil", "#a05fff", { speed: 0.22, jump: 0.15, doubleJump: 1 }, "Speed, jump and an extra air jump", 5);
acc("aether_core", "Aether Core", "#ffb0f0", { maxHp: 40, defense: 6, dmgMult: 0.15 }, "+40 HP, +6 defense, +15% damage", 6, "orb");

/* ---------------------------- potions ----------------------------- */

const potion = (id: string, name: string, color: string, p: ItemDef["potion"], desc: string) =>
  add({ id, name, kind: "potion", icon: "potion", color, stack: 30, desc, potion: p, value: 15 });

potion("lesser_salve", "Lesser Salve", "#e0556a", { heal: 45 }, "Restores 45 health.");
potion("greater_salve", "Greater Salve", "#ff4f7a", { heal: 110 }, "Restores 110 health.");
potion("stoneskin", "Stoneskin Draught", "#9aa0aa", { buff: "defense", amount: 10, duration: 90 }, "+10 defense for 90s.");
potion("haste_tonic", "Haste Tonic", "#f0d24a", { buff: "speed", amount: 0.3, duration: 90 }, "+30% speed for 90s.");
potion("miners_brew", "Miner's Brew", "#c87b41", { buff: "mineSpeed", amount: 0.5, duration: 120 }, "+50% mining speed for 120s.");
potion("nightsight", "Nightsight Draught", "#7be0c0", { buff: "light", amount: 0.5, duration: 150 }, "See in the dark for 150s.");
potion("vital_bloom", "Vital Bloom", "#ff6a8a", { permanentHp: 20 }, "Permanently +20 max health.");

/* ------------------------- boss summons --------------------------- */

const summon = (id: string, name: string, color: string, bossId: string, desc: string) =>
  add({ id, name, kind: "summon", icon: "totem", color, stack: 5, desc, summon: bossId, value: 100 });

summon("bramble_totem", "Bramble Totem", "#7fbf4a", "thicketmaw", "Summons the Grovewarden on the surface.");
summon("sunbaked_idol", "Sunbaked Idol", "#dbc27a", "skarn", "Summons the Dunecarver in the desert.");
summon("hive_pheromone", "Hive Pheromone", "#c8a24a", "vespa", "Summons the Hollow Queen underground.");
summon("frozen_horn", "Frozen Horn", "#a8dcf0", "rimefang", "Summons the Rimefang Colossus in the snow.");
summon("spore_censer", "Spore Censer", "#8ce0c0", "mycelor", "Summons the Fungal Sovereign.");
summon("prism_lattice", "Prism Lattice", "#5fe0d6", "prismgeist", "Summons the Prismgeist in the caverns.");
summon("void_sigil", "Void Sigil", "#a05fff", "nyxdrake", "Summons the Nyxdrake in the deep.");
summon("aether_beacon", "Aether Beacon", "#ffb0f0", "astralith", "Summons Astralith, Aether Sovereign.");

/* ---------------------------- registry ---------------------------- */

export const ITEMS: Record<string, ItemDef> = {};
for (const it of items) ITEMS[it.id] = it;

export const FALLBACK_ITEM: ItemDef = {
  id: "unknown",
  name: "Unknown",
  kind: "material",
  icon: "ore",
  color: "#888",
  stack: 99,
  desc: "",
};

export function itemDef(id: string): ItemDef {
  return ITEMS[id] ?? FALLBACK_ITEM;
}

/** item id that a placed block drops */
export function itemForBlock(block: number): string | undefined {
  for (const it of items) if (it.block === block) return it.id;
  return undefined;
}

/* ---------------------------- recipes ----------------------------- */

export type Recipe = {
  id: string;
  out: { item: string; count: number };
  ing: { item: string; count: number }[];
  station: string | null;
  category: string;
};

const recipes: Recipe[] = [];
function rec(out: string, count: number, ing: [string, number][], station: string | null, category: string) {
  recipes.push({
    id: `${out}_${recipes.length}`,
    out: { item: out, count },
    ing: ing.map(([item, c]) => ({ item, count: c })),
    station,
    category,
  });
}

// basics
rec("plank", 4, [["wood", 1]], null, "blocks");
rec("workbench", 1, [["wood", 10]], null, "stations");
rec("torch", 4, [["wood", 2]], null, "light");
rec("platform", 4, [["wood", 1]], "workbench", "blocks");
rec("door", 1, [["plank", 6]], "workbench", "furniture");
rec("chest", 1, [["plank", 8], ["iron_bar", 1]], "workbench", "storage");
rec("table", 1, [["plank", 8]], "workbench", "furniture");
rec("chair", 1, [["plank", 4]], "workbench", "furniture");
rec("furnace", 1, [["stone", 20], ["wood", 4]], "workbench", "stations");
rec("anvil", 1, [["copper_bar", 6], ["stone", 10]], "workbench", "stations");
rec("alchemy_table", 1, [["plank", 10], ["glass", 5], ["herb_bundle", 3]], "workbench", "stations");
rec("arcane_forge", 1, [["gold_bar", 8], ["crystal_ore", 12], ["brick", 20]], "anvil", "stations");
rec("brick", 4, [["stone", 4]], "furnace", "blocks");
rec("sandstone", 4, [["sand", 4]], "furnace", "blocks");
rec("glass", 2, [["sand", 3]], "furnace", "blocks");
rec("wall_stone", 4, [["stone", 3]], "workbench", "blocks");
rec("glowcap", 2, [["glowcap", 1], ["slime_gel", 1]], "workbench", "light");

// smelting
rec("copper_bar", 1, [["copper_ore", 3]], "furnace", "materials");
rec("iron_bar", 1, [["iron_ore", 3]], "furnace", "materials");
rec("silver_bar", 1, [["silver_ore", 3]], "furnace", "materials");
rec("gold_bar", 1, [["gold_ore", 3]], "furnace", "materials");
rec("crystal_bar", 1, [["crystal_ore", 3], ["gold_bar", 1]], "arcane", "materials");
rec("aetherite_bar", 1, [["aetherite_ore", 3], ["crystal_bar", 1]], "arcane", "materials");

// tools / swords / armor per tier
for (const m of MAT_TIERS) {
  const st = m.station;
  const bar = m.bar;
  rec(`${m.key}_pick`, 1, m.tier === 0 ? [["wood", 12]] : [[bar, 4], ["wood", 3]], st, "tools");
  rec(`${m.key}_axe`, 1, m.tier === 0 ? [["wood", 10]] : [[bar, 3], ["wood", 3]], st, "tools");
  rec(`${m.key}_sword`, 1, m.tier === 0 ? [["wood", 8]] : [[bar, 5], ["wood", 2]], st, "weapons");
  rec(`${m.key}_helmet`, 1, m.tier === 0 ? [["wood", 10], ["seed", 4]] : [[bar, 5]], st, "armor");
  rec(`${m.key}_chest`, 1, m.tier === 0 ? [["wood", 14], ["seed", 6]] : [[bar, 8]], st, "armor");
  rec(`${m.key}_legs`, 1, m.tier === 0 ? [["wood", 12], ["seed", 5]] : [[bar, 6]], st, "armor");
  rec(`${m.key}_boots`, 1, m.tier === 0 ? [["wood", 8], ["seed", 3]] : [[bar, 4]], st, "armor");
}

// special weapons
rec("wood_spear", 1, [["wood", 12], ["cave_fang", 2]], "workbench", "weapons");
rec("iron_spear", 1, [["iron_bar", 6], ["wood", 4]], "anvil", "weapons");
rec("crystal_spear", 1, [["crystal_bar", 6], ["frost_shard", 4]], "arcane", "weapons");
rec("thorn_lash", 1, [["wood", 8], ["slime_gel", 10], ["seed", 6]], "workbench", "weapons");
rec("ember_lash", 1, [["iron_bar", 4], ["slime_gel", 12], ["boss_core_2", 1]], "anvil", "weapons");
rec("wood_bow", 1, [["wood", 12], ["slime_gel", 4]], "workbench", "weapons");
rec("iron_bow", 1, [["iron_bar", 6], ["wood", 6], ["beetle_shell", 4]], "anvil", "weapons");
rec("crystal_bow", 1, [["crystal_bar", 7], ["crystal_sliver", 8]], "arcane", "weapons");
rec("starfall_bow", 1, [["aetherite_bar", 6], ["starstone_ore", 10], ["boss_core_6", 1]], "arcane", "weapons");
rec("ember_wand", 1, [["wood", 8], ["copper_bar", 4], ["cave_fang", 3]], "workbench", "weapons");
rec("frost_staff", 1, [["silver_bar", 5], ["frost_shard", 10]], "anvil", "weapons");
rec("crystal_staff", 1, [["crystal_bar", 6], ["aether_mote", 3]], "arcane", "weapons");
rec("aether_staff", 1, [["aetherite_bar", 8], ["aether_mote", 8], ["boss_core_7", 1]], "arcane", "weapons");
rec("kestrel_chakram", 1, [["iron_bar", 5], ["beetle_shell", 6]], "anvil", "weapons");
rec("shatter_disc", 1, [["crystal_bar", 5], ["crystal_sliver", 10]], "arcane", "weapons");
rec("copper_boltcaster", 1, [["copper_bar", 8], ["wood", 6]], "anvil", "weapons");
rec("aether_railspike", 1, [["aetherite_bar", 7], ["void_ember", 8]], "arcane", "weapons");
rec("spore_bloom", 1, [["gold_bar", 5], ["glowcap", 8], ["boss_core_5", 1]], "anvil", "weapons");

// accessories
rec("swiftroot_charm", 1, [["seed", 10], ["slime_gel", 8], ["copper_bar", 2]], "workbench", "accessories");
rec("stonehide_band", 1, [["stone", 40], ["copper_bar", 4], ["beetle_shell", 5]], "anvil", "accessories");
rec("miners_lumen", 1, [["torch", 10], ["copper_bar", 6], ["glowcap", 4]], "anvil", "accessories");
rec("featherstep", 1, [["iron_bar", 5], ["seed", 12], ["shadow_dust", 6]], "anvil", "accessories");
rec("vigor_locket", 1, [["gold_bar", 4], ["slime_gel", 20], ["boss_core_1", 1]], "anvil", "accessories");
rec("prism_ward", 1, [["crystal_bar", 5], ["crystal_sliver", 12], ["boss_core_4", 1]], "arcane", "accessories");
rec("voidwalker_sigil", 1, [["aetherite_bar", 4], ["void_ember", 10], ["shadow_dust", 20]], "arcane", "accessories");
rec("aether_core", 1, [["aetherite_bar", 10], ["aether_mote", 12], ["boss_core_8", 1]], "arcane", "accessories");

// potions
rec("lesser_salve", 2, [["herb_bundle", 2], ["slime_gel", 2]], "alchemy", "potions");
rec("greater_salve", 2, [["herb_bundle", 4], ["glowcap", 2], ["crystal_sliver", 1]], "alchemy", "potions");
rec("stoneskin", 1, [["herb_bundle", 2], ["stone", 20], ["beetle_shell", 2]], "alchemy", "potions");
rec("haste_tonic", 1, [["herb_bundle", 2], ["seed", 6], ["gold_ore", 2]], "alchemy", "potions");
rec("miners_brew", 1, [["herb_bundle", 2], ["copper_ore", 6]], "alchemy", "potions");
rec("nightsight", 1, [["herb_bundle", 2], ["glowcap", 4]], "alchemy", "potions");
rec("vital_bloom", 1, [["crystal_ore", 8], ["aether_mote", 1], ["herb_bundle", 6]], "alchemy", "potions");

// boss summons — each gated behind the previous tier's materials
rec("bramble_totem", 1, [["wood", 25], ["seed", 15], ["slime_gel", 10]], "workbench", "summons");
rec("sunbaked_idol", 1, [["sandstone", 20], ["copper_bar", 6], ["boss_core_1", 1]], "workbench", "summons");
rec("hive_pheromone", 1, [["slime_gel", 20], ["cave_fang", 12], ["boss_core_2", 1]], "alchemy", "summons");
rec("frozen_horn", 1, [["ice", 30], ["frost_shard", 14], ["boss_core_3", 1]], "anvil", "summons");
rec("spore_censer", 1, [["fungal_loam", 25], ["glowcap", 14], ["boss_core_4", 1]], "alchemy", "summons");
rec("prism_lattice", 1, [["crystal_block", 20], ["crystal_sliver", 16], ["boss_core_5", 1]], "arcane", "summons");
rec("void_sigil", 1, [["voidstone", 25], ["void_ember", 12], ["boss_core_6", 1]], "arcane", "summons");
rec("aether_beacon", 1, [["aetherite_bar", 8], ["aether_mote", 10], ["boss_core_7", 1]], "arcane", "summons");

export const RECIPES: Recipe[] = recipes;

export const CRAFT_CATEGORIES = [
  "tools",
  "weapons",
  "armor",
  "accessories",
  "potions",
  "blocks",
  "furniture",
  "light",
  "storage",
  "stations",
  "materials",
  "summons",
] as const;

export const STATION_NAMES: Record<string, string> = {
  workbench: "Workbench",
  furnace: "Smeltpit",
  anvil: "Forging Anvil",
  alchemy: "Alchemy Table",
  arcane: "Arcane Forge",
};
