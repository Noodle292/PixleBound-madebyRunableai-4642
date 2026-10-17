// Original pixel-art asset pipeline: every texture and icon in Pixelbound is
// generated at runtime from character grids or procedural pixel routines, so
// the game ships with zero external image assets (fast on phones, 100% original).

import { hash2 } from "./rng";

export type CharSprite = {
  rows: string[];
  pal: Record<string, string>;
};

export function bakeCharSprite(sp: CharSprite): HTMLCanvasElement {
  const h = sp.rows.length;
  const w = Math.max(...sp.rows.map((r) => r.length));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  for (let y = 0; y < h; y++) {
    const row = sp.rows[y] ?? "";
    for (let x = 0; x < row.length; x++) {
      const ch = row[x] as string;
      const col = sp.pal[ch];
      if (!col) continue;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return c;
}

/** Mirror a baked sprite horizontally (used for facing left). */
export function flipCanvas(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  return c;
}

export function shade(hex: string, amount: number): string {
  const m = hex.replace("#", "");
  const full =
    m.length === 3
      ? m
          .split("")
          .map((c) => c + c)
          .join("")
      : m;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount))));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

export type BlockTexStyle =
  | "soil"
  | "grass"
  | "stone"
  | "sand"
  | "snow"
  | "wood"
  | "leaves"
  | "glass"
  | "brick"
  | "ore"
  | "liquid"
  | "crystal"
  | "plank"
  | "fungal"
  | "ice"
  | "bone"
  | "flat";

export const TEX = 16; // texture resolution in pixels

type TexOpts = {
  style: BlockTexStyle;
  color: string;
  accent?: string;
  seed?: number;
};

/** Procedurally paint a 16x16 pixel-art block texture. */
export function bakeBlockTexture(opts: TexOpts): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = TEX;
  c.height = TEX;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const seed = opts.seed ?? 1337;
  const base = opts.color;
  const accent = opts.accent ?? shade(base, -0.3);

  const px = (x: number, y: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 1);
  };

  ctx.fillStyle = base;
  ctx.fillRect(0, 0, TEX, TEX);

  const speckle = (density: number, dark: number, light: number) => {
    for (let y = 0; y < TEX; y++) {
      for (let x = 0; x < TEX; x++) {
        const n = hash2(seed, x, y);
        if (n < density * 0.5) px(x, y, shade(base, -dark));
        else if (n > 1 - density * 0.5) px(x, y, shade(base, light));
      }
    }
  };

  switch (opts.style) {
    case "soil":
      speckle(0.45, 0.22, 0.12);
      break;
    case "grass": {
      speckle(0.4, 0.2, 0.1);
      for (let x = 0; x < TEX; x++) {
        const top = hash2(seed, x, 99) > 0.55 ? 4 : 3;
        for (let y = 0; y < top; y++) px(x, y, shade(accent, y === 0 ? 0.12 : -0.05));
        if (hash2(seed, x, 7) > 0.8) px(x, top, shade(accent, -0.2));
      }
      break;
    }
    case "stone": {
      speckle(0.5, 0.2, 0.12);
      for (let i = 0; i < 4; i++) {
        const cx = Math.floor(hash2(seed, i, 3) * TEX);
        const cy = Math.floor(hash2(seed, i, 11) * TEX);
        for (let d = 0; d < 5; d++) px((cx + d) % TEX, (cy + (d % 2)) % TEX, shade(base, -0.28));
      }
      break;
    }
    case "sand":
      speckle(0.55, 0.14, 0.14);
      break;
    case "snow":
      speckle(0.3, 0.09, 0.2);
      break;
    case "ice":
      speckle(0.25, 0.12, 0.25);
      for (let i = 0; i < 3; i++) {
        const cx = Math.floor(hash2(seed, i, 21) * 12) + 2;
        for (let y = 2; y < 13; y++) px(cx + ((y % 3) - 1), y, shade(base, 0.32));
      }
      break;
    case "wood": {
      for (let x = 0; x < TEX; x++) {
        const n = hash2(seed, x, 5);
        const col = n > 0.66 ? shade(base, 0.12) : n > 0.33 ? base : shade(base, -0.18);
        ctx.fillStyle = col;
        ctx.fillRect(x, 0, 1, TEX);
      }
      for (let y = 0; y < TEX; y++) if (hash2(seed, y, 41) > 0.85) px(Math.floor(hash2(seed, y, 9) * TEX), y, shade(base, -0.35));
      break;
    }
    case "plank": {
      for (let y = 0; y < TEX; y++) {
        const band = Math.floor(y / 4);
        const col = band % 2 === 0 ? shade(base, 0.07) : shade(base, -0.07);
        ctx.fillStyle = col;
        ctx.fillRect(0, y, TEX, 1);
        if (y % 4 === 3) {
          ctx.fillStyle = shade(base, -0.3);
          ctx.fillRect(0, y, TEX, 1);
        }
      }
      for (let i = 0; i < 6; i++)
        px(Math.floor(hash2(seed, i, 13) * TEX), Math.floor(hash2(seed, i, 17) * TEX), shade(base, -0.25));
      break;
    }
    case "leaves": {
      ctx.fillStyle = shade(base, -0.35);
      ctx.fillRect(0, 0, TEX, TEX);
      for (let y = 0; y < TEX; y++)
        for (let x = 0; x < TEX; x++) {
          const n = hash2(seed, x * 3, y * 5);
          if (n > 0.35) px(x, y, n > 0.78 ? shade(base, 0.15) : base);
        }
      break;
    }
    case "glass": {
      ctx.clearRect(0, 0, TEX, TEX);
      ctx.fillStyle = "rgba(190,230,245,0.28)";
      ctx.fillRect(0, 0, TEX, TEX);
      ctx.fillStyle = "rgba(230,250,255,0.75)";
      ctx.fillRect(0, 0, TEX, 1);
      ctx.fillRect(0, 0, 1, TEX);
      ctx.fillStyle = "rgba(120,170,190,0.6)";
      ctx.fillRect(0, TEX - 1, TEX, 1);
      ctx.fillRect(TEX - 1, 0, 1, TEX);
      for (let i = 0; i < 4; i++) px(3 + i, 3 + i, "rgba(255,255,255,0.8)");
      break;
    }
    case "brick": {
      ctx.fillStyle = shade(base, -0.4);
      ctx.fillRect(0, 0, TEX, TEX);
      const drawBrick = (bx: number, by: number, bw: number) => {
        for (let y = 0; y < 6; y++)
          for (let x = 0; x < bw; x++) {
            const gx = (bx + x + TEX) % TEX;
            const gy = by + y;
            if (gy < 0 || gy >= TEX) continue;
            const n = hash2(seed, gx, gy);
            px(gx, gy, n > 0.75 ? shade(base, 0.12) : n < 0.2 ? shade(base, -0.14) : base);
          }
      };
      drawBrick(0, 0, 7);
      drawBrick(8, 0, 7);
      drawBrick(-4, 7, 7);
      drawBrick(4, 7, 7);
      drawBrick(12, 7, 7);
      break;
    }
    case "ore": {
      speckle(0.5, 0.2, 0.1);
      const blobs = 3;
      for (let i = 0; i < blobs; i++) {
        const cx = 3 + Math.floor(hash2(seed, i, 31) * 10);
        const cy = 3 + Math.floor(hash2(seed, i, 37) * 10);
        const r = 1.6 + hash2(seed, i, 43) * 1.4;
        for (let y = -3; y <= 3; y++)
          for (let x = -3; x <= 3; x++) {
            if (x * x + y * y > r * r) continue;
            const gx = cx + x;
            const gy = cy + y;
            if (gx < 0 || gy < 0 || gx >= TEX || gy >= TEX) continue;
            const edge = x * x + y * y > (r - 1) * (r - 1);
            px(gx, gy, edge ? shade(accent, -0.25) : accent);
          }
        px(cx - 1, cy - 1, shade(accent, 0.45));
      }
      break;
    }
    case "crystal": {
      ctx.fillStyle = shade(base, -0.3);
      ctx.fillRect(0, 0, TEX, TEX);
      for (let y = 0; y < TEX; y++)
        for (let x = 0; x < TEX; x++) {
          const d = Math.abs(x - 8) + Math.abs(y - 8);
          if (d < 7) px(x, y, d < 3 ? shade(base, 0.4) : base);
        }
      for (let i = 0; i < 3; i++) px(6 + i, 6 - i + 2, shade(base, 0.7));
      break;
    }
    case "liquid": {
      for (let y = 0; y < TEX; y++)
        for (let x = 0; x < TEX; x++) {
          const n = hash2(seed, x, y);
          px(x, y, n > 0.9 ? shade(base, 0.3) : n < 0.1 ? shade(base, -0.15) : base);
        }
      break;
    }
    case "fungal": {
      speckle(0.4, 0.18, 0.14);
      for (let i = 0; i < 5; i++) {
        const cx = Math.floor(hash2(seed, i, 53) * TEX);
        const cy = Math.floor(hash2(seed, i, 59) * TEX);
        px(cx, cy, accent);
        px((cx + 1) % TEX, cy, shade(accent, 0.2));
        px(cx, (cy + 1) % TEX, shade(accent, -0.2));
      }
      break;
    }
    case "bone": {
      speckle(0.3, 0.16, 0.16);
      for (let i = 0; i < 3; i++) {
        const y = 3 + i * 5;
        for (let x = 2; x < 14; x++) px(x, y, shade(base, 0.25));
        px(1, y - 1, shade(base, 0.25));
        px(1, y + 1, shade(base, 0.25));
        px(14, y - 1, shade(base, 0.25));
        px(14, y + 1, shade(base, 0.25));
      }
      break;
    }
    case "flat":
    default:
      speckle(0.2, 0.1, 0.1);
      break;
  }

  return c;
}

/* ------------------------------------------------------------------ */
/* Item icons: 16x16 procedural pixel icons, tinted per item          */
/* ------------------------------------------------------------------ */

export type IconShape =
  | "sword"
  | "spear"
  | "dagger"
  | "bow"
  | "staff"
  | "thrown"
  | "pick"
  | "axe"
  | "ingot"
  | "ore"
  | "gem"
  | "coin"
  | "potion"
  | "helmet"
  | "chest"
  | "legs"
  | "boots"
  | "ring"
  | "torch"
  | "arrow"
  | "totem"
  | "heart"
  | "seed"
  | "orb";

export function bakeItemIcon(shape: IconShape, color: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  const ctx = c.getContext("2d");
  if (!ctx) return c;
  const A = color;
  const D = shade(color, -0.35);
  const L = shade(color, 0.4);
  const wood = "#8a5a33";
  const woodD = "#5c3a20";
  const px = (x: number, y: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, 1, 1);
  };
  const rect = (x: number, y: number, w: number, h: number, col: string) => {
    ctx.fillStyle = col;
    ctx.fillRect(x, y, w, h);
  };

  switch (shape) {
    case "sword": {
      for (let i = 0; i < 9; i++) {
        px(4 + i, 11 - i, D);
        px(5 + i, 11 - i, A);
        px(5 + i, 10 - i, L);
      }
      rect(2, 10, 5, 2, woodD);
      rect(3, 11, 3, 3, wood);
      px(2, 13, woodD);
      break;
    }
    case "spear": {
      for (let i = 0; i < 12; i++) px(3 + i, 12 - i, wood);
      for (let i = 0; i < 4; i++) {
        px(11 + i, 4 - i + 1, A);
        px(12 + i, 5 - i, L);
      }
      px(14, 1, A);
      px(13, 2, A);
      px(13, 1, L);
      break;
    }
    case "dagger": {
      for (let i = 0; i < 6; i++) {
        px(6 + i, 9 - i, A);
        px(6 + i, 8 - i, L);
      }
      rect(4, 9, 4, 2, woodD);
      rect(4, 10, 2, 3, wood);
      break;
    }
    case "bow": {
      for (let y = 2; y < 14; y++) {
        const dx = Math.round(4 * Math.sin(((y - 2) / 11) * Math.PI));
        px(4 + dx, y, wood);
        px(4 + dx + 1, y, woodD);
      }
      for (let y = 2; y < 14; y++) px(4, y, "#e8e0cf");
      px(9, 8, A);
      break;
    }
    case "staff": {
      for (let i = 0; i < 10; i++) px(4 + i, 13 - i, wood);
      rect(10, 2, 4, 4, A);
      px(10, 2, D);
      px(13, 5, D);
      px(11, 3, L);
      px(9, 1, L);
      px(14, 6, L);
      break;
    }
    case "thrown": {
      for (let i = 0; i < 5; i++) {
        px(8 + i, 8, A);
        px(8 - i, 8, A);
        px(8, 8 + i, A);
        px(8, 8 - i, A);
      }
      rect(7, 7, 3, 3, L);
      px(8, 8, D);
      px(12, 8, D);
      px(8, 12, D);
      break;
    }
    case "pick": {
      for (let i = 0; i < 9; i++) px(4 + i, 13 - i, wood);
      for (let i = 0; i < 6; i++) {
        px(6 + i, 5 - Math.floor(i / 2), A);
        px(6 + i, 6 - Math.floor(i / 2), D);
      }
      px(5, 6, L);
      px(12, 3, L);
      px(4, 7, A);
      px(13, 2, A);
      break;
    }
    case "axe": {
      for (let i = 0; i < 9; i++) px(5 + i, 13 - i, wood);
      rect(8, 2, 5, 6, A);
      px(8, 2, D);
      px(12, 7, D);
      rect(9, 3, 2, 2, L);
      px(7, 4, A);
      px(7, 5, A);
      break;
    }
    case "ingot": {
      rect(3, 8, 10, 5, A);
      rect(4, 7, 8, 1, L);
      rect(3, 12, 10, 1, D);
      px(5, 9, L);
      px(6, 9, L);
      break;
    }
    case "ore": {
      const pts: [number, number][] = [
        [5, 5],
        [8, 4],
        [10, 6],
        [11, 9],
        [8, 11],
        [5, 10],
        [4, 7],
      ];
      ctx.fillStyle = "#6b6b76";
      ctx.beginPath();
      ctx.moveTo(4, 4);
      for (const p of pts) ctx.lineTo(p[0] + 1, p[1] + 1);
      ctx.closePath();
      ctx.fill();
      px(6, 6, A);
      px(7, 6, L);
      px(7, 7, A);
      px(9, 8, A);
      px(8, 9, L);
      px(5, 8, A);
      px(9, 5, A);
      break;
    }
    case "gem": {
      for (let y = 0; y < 6; y++) {
        const w = 5 - Math.abs(y - 2);
        rect(8 - w, 5 + y, w * 2, 1, y < 2 ? L : A);
      }
      px(6, 6, L);
      px(10, 9, D);
      break;
    }
    case "coin": {
      ctx.fillStyle = A;
      ctx.beginPath();
      ctx.arc(8, 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = L;
      ctx.beginPath();
      ctx.arc(7, 7, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case "potion": {
      rect(7, 2, 2, 3, "#c9c2b0");
      rect(6, 4, 4, 1, "#c9c2b0");
      ctx.fillStyle = "rgba(220,235,245,0.55)";
      ctx.beginPath();
      ctx.arc(8, 10, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = A;
      ctx.beginPath();
      ctx.arc(8, 11, 4, 0, Math.PI * 2);
      ctx.fill();
      px(6, 9, L);
      break;
    }
    case "helmet": {
      rect(4, 4, 8, 6, A);
      rect(4, 4, 8, 1, L);
      rect(4, 10, 3, 3, A);
      rect(9, 10, 3, 3, A);
      rect(6, 7, 4, 3, "#2a2a33");
      px(4, 9, D);
      break;
    }
    case "chest": {
      rect(3, 4, 10, 8, A);
      rect(3, 4, 10, 1, L);
      rect(7, 5, 2, 7, D);
      rect(2, 5, 1, 4, D);
      rect(13, 5, 1, 4, D);
      break;
    }
    case "legs": {
      rect(4, 3, 8, 4, A);
      rect(4, 7, 3, 6, A);
      rect(9, 7, 3, 6, A);
      rect(4, 3, 8, 1, L);
      break;
    }
    case "boots": {
      rect(3, 6, 4, 5, A);
      rect(2, 11, 6, 2, D);
      rect(9, 6, 4, 5, A);
      rect(9, 11, 6, 2, D);
      break;
    }
    case "ring": {
      ctx.strokeStyle = A;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(8, 10, 4, 0, Math.PI * 2);
      ctx.stroke();
      rect(7, 3, 3, 3, L);
      break;
    }
    case "torch": {
      rect(7, 7, 2, 7, wood);
      rect(6, 4, 4, 3, A);
      px(7, 3, L);
      px(8, 2, L);
      px(6, 6, D);
      break;
    }
    case "arrow": {
      for (let i = 0; i < 10; i++) px(3 + i, 12 - i, wood);
      px(13, 2, A);
      px(12, 3, A);
      px(13, 3, L);
      px(3, 12, "#e8e0cf");
      px(4, 13, "#e8e0cf");
      px(2, 11, "#e8e0cf");
      break;
    }
    case "totem": {
      rect(5, 2, 6, 12, A);
      rect(5, 2, 6, 1, L);
      rect(3, 5, 10, 2, D);
      px(7, 8, "#20202a");
      px(9, 8, "#20202a");
      rect(6, 10, 4, 1, D);
      break;
    }
    case "heart": {
      const rows = [
        "..AA.AA..",
        ".AAAAAAA.",
        ".AAAAAAA.",
        "..AAAAA..",
        "...AAA...",
        "....A....",
      ];
      rows.forEach((r, y) => {
        for (let x = 0; x < r.length; x++) if (r[x] === "A") px(4 + x, 4 + y, y < 2 ? L : A);
      });
      break;
    }
    case "seed": {
      ctx.fillStyle = A;
      ctx.beginPath();
      ctx.ellipse(8, 9, 3, 4, 0.4, 0, Math.PI * 2);
      ctx.fill();
      px(7, 7, L);
      rect(8, 3, 1, 3, "#4f7a2f");
      break;
    }
    case "orb":
    default: {
      ctx.fillStyle = D;
      ctx.beginPath();
      ctx.arc(8, 8, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = A;
      ctx.beginPath();
      ctx.arc(8, 8, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = L;
      ctx.beginPath();
      ctx.arc(6, 6, 2, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
  }
  return c;
}
