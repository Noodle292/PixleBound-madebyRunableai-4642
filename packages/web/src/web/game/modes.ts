/** Character game modes. Every rule that differs per mode lives here so the engine reads one table. */

export type GameMode = "journey" | "classic" | "extreme" | "hardcore" | "death" | "creative";

export type ModeDef = {
  id: GameMode;
  name: string;
  tag: string;
  color: string;
  /** one-line rules summary shown in the creator and lists */
  rules: string[];
  enemyHp: number;
  bossHp: number;
  /** multiplier on all incoming damage */
  damageTaken: number;
  /** multiplier on enemy spawn chance */
  spawn: number;
  /** extra enemy cap */
  extraCap: number;
  /** fraction of carried coins dropped on death */
  coinLoss: number;
  /** respawn HP as a fraction of max */
  respawnHp: number;
  respawnDelay: number;
  /** passive regen multiplier */
  regen: number;
  /** extra coin drops from kills */
  coinBonus: number;
  permadeath: boolean;
  creative: boolean;
};

export const MODES: Record<GameMode, ModeDef> = {
  journey: {
    id: "journey",
    name: "Journey",
    tag: "Relaxed",
    color: "#7fd6a0",
    rules: ["Enemies have 70% health and deal half damage", "Fewer spawns", "No coin loss on death, respawn at full health"],
    enemyHp: 0.7,
    bossHp: 0.75,
    damageTaken: 0.5,
    spawn: 0.7,
    extraCap: -2,
    coinLoss: 0,
    respawnHp: 1,
    respawnDelay: 1,
    regen: 1.6,
    coinBonus: 1,
    permadeath: false,
    creative: false,
  },
  classic: {
    id: "classic",
    name: "Classic",
    tag: "Standard",
    color: "#f0b64a",
    rules: ["The intended balance", "Drop half your coins on death", "Respawn at 60% health"],
    enemyHp: 1,
    bossHp: 1,
    damageTaken: 1,
    spawn: 1,
    extraCap: 0,
    coinLoss: 0.5,
    respawnHp: 0.6,
    respawnDelay: 2.5,
    regen: 1,
    coinBonus: 1,
    permadeath: false,
    creative: false,
  },
  extreme: {
    id: "extreme",
    name: "Extreme",
    tag: "Brutal",
    color: "#ff8a4a",
    rules: ["Enemies: 1.6× health, 1.5× damage, 40% more spawns", "Bosses: 1.5× health", "Drop all coins on death, respawn at 40% after 6s", "Kills drop 50% more coins"],
    enemyHp: 1.6,
    bossHp: 1.5,
    damageTaken: 1.5,
    spawn: 1.4,
    extraCap: 3,
    coinLoss: 1,
    respawnHp: 0.4,
    respawnDelay: 6,
    regen: 1,
    coinBonus: 1.5,
    permadeath: false,
    creative: false,
  },
  hardcore: {
    id: "hardcore",
    name: "Hardcore",
    tag: "One life",
    color: "#e0435f",
    rules: ["Classic balance", "One life: if you die, this character is gone for good", "The world survives"],
    enemyHp: 1,
    bossHp: 1,
    damageTaken: 1,
    spawn: 1,
    extraCap: 0,
    coinLoss: 0,
    respawnHp: 0,
    respawnDelay: 0,
    regen: 1,
    coinBonus: 1,
    permadeath: true,
    creative: false,
  },
  death: {
    id: "death",
    name: "Death",
    tag: "Extreme + one life",
    color: "#b23cff",
    rules: ["Extreme enemies and bosses", "No natural health regen — potions, regen gear and the Healer only", "One life: death is permanent"],
    enemyHp: 1.6,
    bossHp: 1.5,
    damageTaken: 1.5,
    spawn: 1.4,
    extraCap: 3,
    coinLoss: 0,
    respawnHp: 0,
    respawnDelay: 0,
    regen: 0,
    coinBonus: 1.5,
    permadeath: true,
    creative: false,
  },
  creative: {
    id: "creative",
    name: "Creative",
    tag: "Build freely",
    color: "#5ec8ff",
    rules: ["Every item, unlimited blocks", "Fly with jump, no damage, instant mining", "No natural spawns · plays Creative worlds only"],
    enemyHp: 1,
    bossHp: 1,
    damageTaken: 0,
    spawn: 0,
    extraCap: 0,
    coinLoss: 0,
    respawnHp: 1,
    respawnDelay: 1,
    regen: 1,
    coinBonus: 1,
    permadeath: false,
    creative: true,
  },
};

export const MODE_ORDER: GameMode[] = ["journey", "classic", "extreme", "hardcore", "death", "creative"];

export function modeDef(m: GameMode | undefined): ModeDef {
  return MODES[m ?? "classic"] ?? MODES.classic;
}
