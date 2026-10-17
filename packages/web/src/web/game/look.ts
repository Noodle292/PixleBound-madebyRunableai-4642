/** Character appearance: palette + hair style baked into the 12×16 player sprite. */
import type { CharSprite } from "./sprites";
import { bakeCharSprite, flipCanvas, shade } from "./sprites";

export type HairStyle = "short" | "long" | "bob" | "spiky" | "ponytail" | "buzz";

export type Look = {
  skin: string;
  hair: string;
  hairStyle: HairStyle;
  eyes: string;
  shirt: string;
  pants: string;
  boots: string;
};

export const HAIR_STYLES: { id: HairStyle; name: string }[] = [
  { id: "short", name: "Short" },
  { id: "long", name: "Long" },
  { id: "bob", name: "Bob" },
  { id: "spiky", name: "Spiky" },
  { id: "ponytail", name: "Ponytail" },
  { id: "buzz", name: "Buzz" },
];

export const SKIN_TONES = ["#f6d2b4", "#e6b48a", "#d29a6c", "#b67a4e", "#8c5a36", "#5e3a22"];
export const HAIR_COLORS = ["#1e1a1c", "#3d2617", "#6b3f22", "#a8652e", "#d9b25c", "#e8e2d2", "#c7463c", "#4f7fd0", "#4fa36b", "#9a5cc8"];
export const EYE_COLORS = ["#22222c", "#3b5fa8", "#3f7d4a", "#7a4a26"];
export const CLOTH_COLORS = [
  "#4a7fb5", "#b5463f", "#4f8f4a", "#c8a24a", "#6a4c9c", "#d97a3a",
  "#3f9c9c", "#d8d4c8", "#3a3446", "#b2557f",
];
export const BOOT_COLORS = ["#3b2b20", "#1f1d24", "#6b4a2c", "#8a8a95"];

export const DEFAULT_LOOK: Look = {
  skin: "#e6b48a",
  hair: "#6b3f22",
  hairStyle: "short",
  eyes: "#22222c",
  shirt: "#4a7fb5",
  pants: "#4b4258",
  boots: "#3b2b20",
};

export const LOOK_PRESETS: { name: string; look: Look }[] = [
  { name: "Wanderer", look: DEFAULT_LOOK },
  { name: "Ranger", look: { skin: "#d29a6c", hair: "#3d2617", hairStyle: "ponytail", eyes: "#3f7d4a", shirt: "#4f8f4a", pants: "#6b4a2c", boots: "#3b2b20" } },
  { name: "Smith", look: { skin: "#b67a4e", hair: "#1e1a1c", hairStyle: "buzz", eyes: "#22222c", shirt: "#d97a3a", pants: "#3a3446", boots: "#1f1d24" } },
  { name: "Scholar", look: { skin: "#f6d2b4", hair: "#d9b25c", hairStyle: "bob", eyes: "#3b5fa8", shirt: "#6a4c9c", pants: "#3a3446", boots: "#6b4a2c" } },
  { name: "Rogue", look: { skin: "#8c5a36", hair: "#c7463c", hairStyle: "spiky", eyes: "#7a4a26", shirt: "#3a3446", pants: "#1f1d24", boots: "#1f1d24" } },
  { name: "Mystic", look: { skin: "#5e3a22", hair: "#e8e2d2", hairStyle: "long", eyes: "#3b5fa8", shirt: "#3f9c9c", pants: "#d8d4c8", boots: "#8a8a95" } },
];

const BODY = [
  "..tttttttt..",
  ".sttTTTTtts.",
  ".sttTTTTtts.",
  "..tttttttt..",
  "..pppppppp..",
  "..ppp..ppp..",
  "..ppp..ppp..",
  "..bbb..bbb..",
  ".bbbb..bbbb.",
];

/** First seven rows (head) per style; long styles also drape over row 7. */
const HEADS: Record<HairStyle, { head: string[]; shoulder?: string }> = {
  short: {
    head: [
      "...oooooo...",
      "..ohhhhhho..",
      "..hhhhhhhh..",
      "..hssssssh..",
      "..hsKssKsh..",
      "...ssssss...",
      "...sSSSSs...",
    ],
  },
  long: {
    head: [
      "...oooooo...",
      "..ohhhhhho..",
      ".ohhhhhhhho.",
      ".hhsssssshh.",
      ".hhsKssKshh.",
      ".hhsssssshh.",
      ".hhsSSSSshh.",
    ],
    shoulder: ".hhtttttthh.",
  },
  bob: {
    head: [
      "...oooooo...",
      "..ohhhhhho..",
      ".ohhhhhhhho.",
      ".hhhhsshhhh.",
      ".hhsKssKshh.",
      ".hhsssssshh.",
      "...sSSSSs...",
    ],
  },
  spiky: {
    head: [
      "..o..oo..o..",
      "..hhohhohh..",
      "..hhhhhhhh..",
      "..hssssssh..",
      "..hsKssKsh..",
      "...ssssss...",
      "...sSSSSs...",
    ],
  },
  ponytail: {
    head: [
      "...oooooo...",
      "..ohhhhhho..",
      "ohhhhhhhhh..",
      "hhhssssssh..",
      "h.hsKssKsh..",
      "h..ssssss...",
      "...sSSSSs...",
    ],
  },
  buzz: {
    head: [
      "............",
      "...oooooo...",
      "..ohhhhhho..",
      "..ssssssss..",
      "..ssKssKss..",
      "...ssssss...",
      "...sSSSSs...",
    ],
  },
};

export function sanitizeLook(l: Partial<Look> | undefined): Look {
  const style = HAIR_STYLES.some((h) => h.id === l?.hairStyle) ? (l!.hairStyle as HairStyle) : DEFAULT_LOOK.hairStyle;
  const hex = (v: unknown, d: string) => (typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : d);
  return {
    skin: hex(l?.skin, DEFAULT_LOOK.skin),
    hair: hex(l?.hair, DEFAULT_LOOK.hair),
    hairStyle: style,
    eyes: hex(l?.eyes, DEFAULT_LOOK.eyes),
    shirt: hex(l?.shirt, DEFAULT_LOOK.shirt),
    pants: hex(l?.pants, DEFAULT_LOOK.pants),
    boots: hex(l?.boots, DEFAULT_LOOK.boots),
  };
}

export function lookSprite(look: Look): CharSprite {
  const h = HEADS[look.hairStyle] ?? HEADS.short;
  const body = [...BODY];
  if (h.shoulder) body[0] = h.shoulder;
  return {
    rows: [...h.head, ...body],
    pal: {
      o: shade(look.hair, -0.35),
      h: look.hair,
      s: look.skin,
      S: shade(look.skin, -0.16),
      K: look.eyes,
      t: look.shirt,
      T: shade(look.shirt, -0.2),
      p: look.pants,
      b: look.boots,
    },
  };
}

const cache = new Map<string, { right: HTMLCanvasElement; left: HTMLCanvasElement }>();

export function bakeLook(look: Look): { right: HTMLCanvasElement; left: HTMLCanvasElement } {
  const key = JSON.stringify(look);
  const hit = cache.get(key);
  if (hit) return hit;
  const right = bakeCharSprite(lookSprite(look));
  const pair = { right, left: flipCanvas(right) };
  if (cache.size > 40) cache.clear();
  cache.set(key, pair);
  return pair;
}
