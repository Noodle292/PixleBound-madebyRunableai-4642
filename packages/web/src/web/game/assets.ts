import { BLOCKS, blockDef } from "./blocks";
import { BOSS_SPRITES, ENEMY_SPRITES, NPC_PALETTES, PLAYER_SPRITE, PROP_SPRITES } from "./entity-sprites";
import { itemDef, ITEMS } from "./items";
import { bakeBlockTexture, bakeCharSprite, bakeItemIcon, flipCanvas } from "./sprites";

export type Assets = {
  blockTex: Map<number, HTMLCanvasElement>;
  itemIcon: Map<string, HTMLCanvasElement>;
  itemIconUrl: Map<string, string>;
  player: { right: HTMLCanvasElement; left: HTMLCanvasElement };
  npc: Map<string, { right: HTMLCanvasElement; left: HTMLCanvasElement }>;
  enemy: Map<string, { right: HTMLCanvasElement; left: HTMLCanvasElement }>;
  boss: Map<string, { right: HTMLCanvasElement; left: HTMLCanvasElement }>;
  prop: Map<string, HTMLCanvasElement>;
};

let cache: Assets | null = null;

export function getAssets(): Assets {
  if (cache) return cache;
  const blockTex = new Map<number, HTMLCanvasElement>();
  for (const key of Object.keys(BLOCKS)) {
    const id = Number(key);
    if (id === 0) continue;
    const d = blockDef(id);
    blockTex.set(id, bakeBlockTexture({ style: d.style, color: d.color, accent: d.accent, seed: 1000 + id * 37 }));
  }

  const itemIcon = new Map<string, HTMLCanvasElement>();
  const itemIconUrl = new Map<string, string>();
  for (const id of Object.keys(ITEMS)) {
    const d = itemDef(id);
    const c = bakeItemIcon(d.icon, d.color);
    itemIcon.set(id, c);
    itemIconUrl.set(id, c.toDataURL());
  }

  const pr = bakeCharSprite(PLAYER_SPRITE);
  const player = { right: pr, left: flipCanvas(pr) };

  const npc = new Map<string, { right: HTMLCanvasElement; left: HTMLCanvasElement }>();
  for (const [key, pal] of Object.entries(NPC_PALETTES)) {
    const c = bakeCharSprite({ rows: PLAYER_SPRITE.rows, pal });
    npc.set(key, { right: c, left: flipCanvas(c) });
  }

  const enemy = new Map<string, { right: HTMLCanvasElement; left: HTMLCanvasElement }>();
  for (const [key, sp] of Object.entries(ENEMY_SPRITES)) {
    const c = bakeCharSprite(sp);
    enemy.set(key, { right: c, left: flipCanvas(c) });
  }

  const boss = new Map<string, { right: HTMLCanvasElement; left: HTMLCanvasElement }>();
  for (const [key, sp] of Object.entries(BOSS_SPRITES)) {
    const c = bakeCharSprite(sp);
    boss.set(key, { right: c, left: flipCanvas(c) });
  }

  const prop = new Map<string, HTMLCanvasElement>();
  for (const [key, sp] of Object.entries(PROP_SPRITES)) prop.set(key, bakeCharSprite(sp));

  cache = { blockTex, itemIcon, itemIconUrl, player, npc, enemy, boss, prop };
  return cache;
}

export function itemIconUrl(id: string): string {
  return getAssets().itemIconUrl.get(id) ?? "";
}
