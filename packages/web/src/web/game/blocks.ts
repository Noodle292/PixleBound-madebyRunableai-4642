import type { BlockTexStyle } from "./sprites";

export const B = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  SAND: 4,
  SNOW: 5,
  CLAY: 6,
  LOG: 7,
  LEAVES: 8,
  GLASS: 9,
  BRICK: 10,
  MOSS: 11,
  MUD: 12,
  VOIDSTONE: 13,
  COPPER: 14,
  IRON: 15,
  SILVER: 16,
  GOLD: 17,
  CRYSTAL: 18,
  AETHERITE: 19,
  WATER: 20,
  PLANK: 21,
  PLATFORM: 22,
  DOOR: 23,
  TORCH: 24,
  CHEST: 25,
  WORKBENCH: 26,
  FURNACE: 27,
  ANVIL: 28,
  ALCHEMY: 29,
  ARCANE_FORGE: 30,
  TABLE: 31,
  CHAIR: 32,
  SANDSTONE: 33,
  ICE: 34,
  FUNGAL: 35,
  GLOWCAP: 36,
  LAVA: 37,
  PALEWOOD: 38,
  BONE: 39,
  CRYSTAL_BLOCK: 40,
  STARSTONE: 41,
  WALL_STONE: 42,
  ASH: 43,
  DOOR_OPEN: 44,
  TREE_TRUNK: 45,
  PALE_TREE_TRUNK: 46,
  JUNGLE_GRASS: 47,
  STEPPE_GRASS: 48,
  RED_SAND: 49,
  JUNGLE_LEAVES: 50,
  PINE_LEAVES: 51,
  BLOSSOM_LEAVES: 52,
  PALE_LEAVES: 53,
} as const;

export type BlockId = number;

export type BlockDef = {
  id: BlockId;
  name: string;
  color: string;
  accent?: string;
  style: BlockTexStyle;
  /** seconds of mining at power 1 */
  hardness: number;
  /** minimum tool tier to break at all */
  tier: number;
  /** item id dropped when broken */
  drop?: string;
  solid: boolean;
  /** walk-through-from-below platform */
  platform?: boolean;
  liquid?: boolean;
  /** emitted light 0..1 */
  light?: number;
  /** blocks sunlight but not movement (e.g. leaves) */
  transparent?: boolean;
  /** station id used by crafting */
  station?: string;
  interact?: "chest" | "door" | "station";
  damage?: number;
};

const defs: BlockDef[] = [
  { id: B.TREE_TRUNK, name: "Timberwood Tree", color: "#7a5230", style: "wood", hardness: 0.6, tier: 0, drop: "wood", solid: false, transparent: true },
  { id: B.PALE_TREE_TRUNK, name: "Palewood Tree", color: "#cfc6b0", style: "wood", hardness: 0.7, tier: 0, drop: "palewood", solid: false, transparent: true },
  { id: B.AIR, name: "Air", color: "#000000", style: "flat", hardness: 0, tier: 0, solid: false },
  { id: B.GRASS, name: "Grass", color: "#6b4a2b", accent: "#5aa63a", style: "grass", hardness: 0.35, tier: 0, drop: "dirt", solid: true },
  { id: B.DIRT, name: "Dirt", color: "#6b4a2b", style: "soil", hardness: 0.35, tier: 0, drop: "dirt", solid: true },
  { id: B.STONE, name: "Stone", color: "#7b7b86", style: "stone", hardness: 0.9, tier: 0, drop: "stone", solid: true },
  { id: B.SAND, name: "Sand", color: "#dbc27a", style: "sand", hardness: 0.3, tier: 0, drop: "sand", solid: true },
  { id: B.SNOW, name: "Snow", color: "#e8f2f7", style: "snow", hardness: 0.3, tier: 0, drop: "snow", solid: true },
  { id: B.CLAY, name: "Clay", color: "#a9705c", style: "soil", hardness: 0.5, tier: 0, drop: "clay", solid: true },
  { id: B.LOG, name: "Timberwood", color: "#7a5230", style: "wood", hardness: 0.6, tier: 0, drop: "wood", solid: true },
  { id: B.LEAVES, name: "Leaves", color: "#4f9c39", style: "leaves", hardness: 0.15, tier: 0, drop: "seed", solid: false, transparent: true },
  { id: B.GLASS, name: "Glass", color: "#bde4f2", style: "glass", hardness: 0.3, tier: 0, drop: "glass", solid: true, transparent: true },
  { id: B.BRICK, name: "Stone Brick", color: "#8a8a95", style: "brick", hardness: 1.1, tier: 0, drop: "brick", solid: true },
  { id: B.MOSS, name: "Mossy Stone", color: "#6e7d5c", style: "stone", hardness: 0.95, tier: 0, drop: "stone", solid: true },
  { id: B.MUD, name: "Mud", color: "#4e3b28", style: "soil", hardness: 0.4, tier: 0, drop: "mud", solid: true },
  { id: B.VOIDSTONE, name: "Voidstone", color: "#2b2440", accent: "#6a4fd0", style: "stone", hardness: 4.5, tier: 4, drop: "voidstone", solid: true },
  { id: B.COPPER, name: "Copper Vein", color: "#7b7b86", accent: "#c87b41", style: "ore", hardness: 1.2, tier: 0, drop: "copper_ore", solid: true },
  { id: B.IRON, name: "Ironbark Vein", color: "#7b7b86", accent: "#b7b0a4", style: "ore", hardness: 1.7, tier: 1, drop: "iron_ore", solid: true },
  { id: B.SILVER, name: "Palesteel Vein", color: "#7b7b86", accent: "#d8e3ea", style: "ore", hardness: 2.3, tier: 2, drop: "silver_ore", solid: true },
  { id: B.GOLD, name: "Sunmetal Vein", color: "#7b7b86", accent: "#ecc54a", style: "ore", hardness: 2.9, tier: 3, drop: "gold_ore", solid: true },
  { id: B.CRYSTAL, name: "Glasscore Vein", color: "#6d6d7c", accent: "#5fe0d6", style: "ore", hardness: 3.8, tier: 4, drop: "crystal_ore", solid: true },
  { id: B.AETHERITE, name: "Aetherite Vein", color: "#4a4260", accent: "#cf7bff", style: "ore", hardness: 5.5, tier: 5, drop: "aetherite_ore", solid: true },
  { id: B.WATER, name: "Water", color: "#3f7ec4", style: "liquid", hardness: 0, tier: 0, solid: false, liquid: true },
  { id: B.PLANK, name: "Plankwood", color: "#a8763f", style: "plank", hardness: 0.6, tier: 0, drop: "plank", solid: true },
  { id: B.PLATFORM, name: "Skyplank", color: "#b8854a", style: "plank", hardness: 0.3, tier: 0, drop: "platform", solid: true, platform: true },
  { id: B.DOOR, name: "Door", color: "#8a6134", style: "plank", hardness: 0.5, tier: 0, drop: "door", solid: true, interact: "door" },
  { id: B.TORCH, name: "Emberlight", color: "#f0b64a", style: "flat", hardness: 0.05, tier: 0, drop: "torch", solid: false, light: 1 },
  { id: B.CHEST, name: "Strongbox", color: "#9a6b34", style: "plank", hardness: 0.5, tier: 0, drop: "chest", solid: true, interact: "chest" },
  { id: B.WORKBENCH, name: "Workbench", color: "#9c7343", style: "plank", hardness: 0.5, tier: 0, drop: "workbench", solid: false, station: "workbench", interact: "station" },
  { id: B.FURNACE, name: "Smeltpit", color: "#6d6d78", accent: "#ff8a3c", style: "brick", hardness: 1.2, tier: 0, drop: "furnace", solid: false, station: "furnace", light: 0.6, interact: "station" },
  { id: B.ANVIL, name: "Forging Anvil", color: "#5a5a66", style: "flat", hardness: 1.4, tier: 0, drop: "anvil", solid: false, station: "anvil", interact: "station" },
  { id: B.ALCHEMY, name: "Alchemy Table", color: "#5c7a6b", style: "plank", hardness: 0.8, tier: 0, drop: "alchemy_table", solid: false, station: "alchemy", interact: "station" },
  { id: B.ARCANE_FORGE, name: "Arcane Forge", color: "#4a3f6b", accent: "#b57bff", style: "brick", hardness: 2, tier: 0, drop: "arcane_forge", solid: false, station: "arcane", light: 0.7, interact: "station" },
  { id: B.TABLE, name: "Table", color: "#9c7343", style: "plank", hardness: 0.4, tier: 0, drop: "table", solid: false },
  { id: B.CHAIR, name: "Chair", color: "#8a6134", style: "plank", hardness: 0.4, tier: 0, drop: "chair", solid: false },
  { id: B.SANDSTONE, name: "Sandstone", color: "#c3a768", style: "brick", hardness: 1, tier: 0, drop: "sandstone", solid: true },
  { id: B.ICE, name: "Rimeice", color: "#a8dcf0", style: "ice", hardness: 0.6, tier: 0, drop: "ice", solid: true },
  { id: B.FUNGAL, name: "Fungal Loam", color: "#5b4a6e", accent: "#8ce0c0", style: "fungal", hardness: 0.7, tier: 0, drop: "fungal_loam", solid: true },
  { id: B.GLOWCAP, name: "Glowcap", color: "#7be0c0", style: "flat", hardness: 0.2, tier: 0, drop: "glowcap", solid: false, light: 0.75 },
  { id: B.LAVA, name: "Emberflow", color: "#e2541f", style: "liquid", hardness: 0, tier: 0, solid: false, liquid: true, light: 0.9, damage: 14 },
  { id: B.PALEWOOD, name: "Palewood", color: "#cfc6b0", style: "wood", hardness: 0.7, tier: 0, drop: "palewood", solid: true },
  { id: B.BONE, name: "Bonebrick", color: "#8a8272", style: "bone", hardness: 2.2, tier: 2, drop: "bonebrick", solid: true },
  { id: B.CRYSTAL_BLOCK, name: "Crystal Block", color: "#63d8e8", style: "crystal", hardness: 1.4, tier: 1, drop: "crystal_block", solid: true, light: 0.35 },
  { id: B.STARSTONE, name: "Starstone", color: "#3b3550", accent: "#ffd76e", style: "ore", hardness: 3.2, tier: 3, drop: "starstone_ore", solid: true, light: 0.2 },
  { id: B.WALL_STONE, name: "Cut Wall", color: "#5f5f6b", style: "brick", hardness: 1, tier: 0, drop: "wall_stone", solid: true },
  { id: B.ASH, name: "Ashcrust", color: "#4a4045", style: "soil", hardness: 0.5, tier: 0, drop: "ash", solid: true },
  { id: B.DOOR_OPEN, name: "Open Door", color: "#8a6134", style: "plank", hardness: 0.5, tier: 0, drop: "door", solid: false, transparent: true, interact: "door" },
  { id: B.JUNGLE_GRASS, name: "Mire Grass", color: "#4e3b28", accent: "#2fae4a", style: "grass", hardness: 0.4, tier: 0, drop: "mud", solid: true },
  { id: B.STEPPE_GRASS, name: "Steppe Grass", color: "#7a5634", accent: "#b9b04a", style: "grass", hardness: 0.35, tier: 0, drop: "dirt", solid: true },
  { id: B.RED_SAND, name: "Rust Sand", color: "#c4703f", style: "sand", hardness: 0.35, tier: 0, drop: "red_sand", solid: true },
  { id: B.JUNGLE_LEAVES, name: "Mire Leaves", color: "#2f8a3a", style: "leaves", hardness: 0.15, tier: 0, drop: "seed", solid: false, transparent: true },
  { id: B.PINE_LEAVES, name: "Pine Needles", color: "#2f6b52", style: "leaves", hardness: 0.15, tier: 0, drop: "seed", solid: false, transparent: true },
  { id: B.BLOSSOM_LEAVES, name: "Blossom", color: "#e48fb0", style: "leaves", hardness: 0.15, tier: 0, drop: "seed", solid: false, transparent: true },
  { id: B.PALE_LEAVES, name: "Duskleaf", color: "#7a5fb0", style: "leaves", hardness: 0.15, tier: 0, drop: "seed", solid: false, transparent: true },
];

export const BLOCKS: Record<number, BlockDef> = {};
for (const d of defs) BLOCKS[d.id] = d;

export const AIR_DEF = BLOCKS[B.AIR] as BlockDef;

export function blockDef(id: number): BlockDef {
  return BLOCKS[id] ?? AIR_DEF;
}

export function isLeaf(id: number): boolean {
  return id === B.LEAVES || id === B.JUNGLE_LEAVES || id === B.PINE_LEAVES || id === B.BLOSSOM_LEAVES || id === B.PALE_LEAVES;
}

export function isTreeTrunk(id: number): boolean {
  return id === B.TREE_TRUNK || id === B.PALE_TREE_TRUNK;
}

export function isSolid(id: number): boolean {
  return blockDef(id).solid === true;
}

export function isPlatform(id: number): boolean {
  return blockDef(id).platform === true;
}

export function blockLight(id: number): number {
  return blockDef(id).light ?? 0;
}

/** Does this block stop sunlight from travelling further down? */
export function opaque(id: number): boolean {
  if (id === B.AIR) return false;
  const d = blockDef(id);
  if (d.liquid) return false;
  if (d.transparent) return false;
  if (!d.solid && !d.station) return false;
  return true;
}
