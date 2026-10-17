// Canvas renderer for Pixelbound. Everything drawn here comes from the
// procedural asset baker in assets.ts — no external images anywhere.

import { getAssets } from "./assets";
import { B, blockDef, isPlatform } from "./blocks";
import type { Game } from "./engine";
import { hash2 } from "./rng";
import { PLAYER_H, PLAYER_W, REACH } from "./state";
import { TILE } from "./worldgen";

const SKY_DAY_TOP = [0x5c, 0x9e, 0xdd] as const;
const SKY_DAY_BOT = [0xa8, 0xd8, 0xf0] as const;
const SKY_NIGHT_TOP = [0x08, 0x0a, 0x1e] as const;
const SKY_NIGHT_BOT = [0x1c, 0x22, 0x44] as const;

function mix(a: readonly number[], b: readonly number[], t: number): string {
  const r = Math.round((a[0] ?? 0) + ((b[0] ?? 0) - (a[0] ?? 0)) * t);
  const g = Math.round((a[1] ?? 0) + ((b[1] ?? 0) - (a[1] ?? 0)) * t);
  const bl = Math.round((a[2] ?? 0) + ((b[2] ?? 0) - (a[2] ?? 0)) * t);
  return `rgb(${r},${g},${bl})`;
}

/** cached offscreen canvas used to upscale the tile-resolution light grid */
let lightCanvas: HTMLCanvasElement | null = null;
let lightCtx: CanvasRenderingContext2D | null = null;
let lightData: ImageData | null = null;

/** cached star field (screen-space, regenerated on resize) */
let starSeed = 1;

export function drawScene(g: Game, ctx: CanvasRenderingContext2D) {
  const dpr = g.dpr;
  const s = g.scale * dpr;
  const camX = g.camX;
  const camY = g.camY;
  const tilesW = Math.ceil(g.viewW / g.scale / TILE) + 2;
  const tilesH = Math.ceil(g.viewH / g.scale / TILE) + 2;
  const x0 = Math.floor(camX / TILE) - 1;
  const y0 = Math.floor(camY / TILE) - 1;
  const light = g.daylight();

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.imageSmoothingEnabled = false;

  drawSky(g, ctx, light, dpr);

  // ---- world space ----
  ctx.setTransform(s, 0, 0, s, -camX * s, -camY * s);

  drawParallax(g, ctx, light, camX, camY);
  drawTiles(g, ctx, x0, y0, tilesW, tilesH);
  drawDrops(g, ctx);
  drawNpcs(g, ctx);
  drawMobs(g, ctx);
  drawPlayer(g, ctx);
  drawProjectiles(g, ctx);
  drawMiningOverlay(g, ctx);
  drawParticles(g, ctx);

  // ---- lighting composite (screen space) ----
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (g.settings.quality !== "low") drawLighting(g, ctx, x0, y0, tilesW, tilesH, s, camX, camY);
  if (g.desktop && g.input.pointer && g.panel === "none" && !g.player.dead) {
    ctx.setTransform(s, 0, 0, s, -camX * s, -camY * s);
    drawCursor(g, ctx);
  }

  drawVignette(g, ctx, dpr);
}

/* --------------------------------- sky -------------------------------- */

function drawSky(g: Game, ctx: CanvasRenderingContext2D, light: number, dpr: number) {
  const w = g.viewW * dpr;
  const h = g.viewH * dpr;
  const cx = Math.floor((g.camX + g.viewW / g.scale / 2) / TILE);
  // key off the main landmass so floating islands overhead don't black out the sky
  const surf = Math.max(g.world.surface[cx] ?? 100, g.world.ground[cx] ?? 0) * TILE;
  // how far underground the camera is (0 = above ground, 1 = fully buried)
  const under = Math.max(0, Math.min(1, (g.camY + g.viewH / g.scale * 0.4 - surf) / (TILE * 26)));

  const top = mix(SKY_NIGHT_TOP, SKY_DAY_TOP, light);
  const bot = mix(SKY_NIGHT_BOT, SKY_DAY_BOT, light);
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bot);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  if (light < 0.75) {
    // stars
    const a = (0.75 - light) / 0.75;
    ctx.fillStyle = `rgba(255,255,240,${(0.85 * a).toFixed(3)})`;
    const nx = Math.floor(g.camX / 40);
    for (let i = 0; i < 90; i++) {
      const hx = hash2(starSeed, i + nx * 7, 0);
      const hy = hash2(starSeed + 5, i * 3 + 11, 1);
      const sx = ((hx * w * 1.4 - (g.camX * dpr * 0.06)) % w + w) % w;
      const sy = hy * h * 0.62;
      const sz = hx > 0.86 ? 2 * dpr : dpr;
      ctx.fillRect(Math.floor(sx), Math.floor(sy), sz, sz);
    }
  }

  // sun / moon
  const cyclePos = g.time / 1000;
  const arc = g.isNight ? (g.time - 600) / 400 : g.time / 600;
  const bx = (0.08 + arc * 0.84) * w;
  const by = h * 0.52 - Math.sin(arc * Math.PI) * h * 0.42;
  ctx.save();
  if (g.isNight) {
    ctx.fillStyle = "#e8eefc";
    ctx.beginPath();
    ctx.arc(bx, by, 15 * dpr, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = mix(SKY_NIGHT_TOP, SKY_NIGHT_BOT, 0.5);
    ctx.beginPath();
    ctx.arc(bx + 6 * dpr, by - 4 * dpr, 13 * dpr, 0, Math.PI * 2);
    ctx.fill();
  } else {
    const gr = ctx.createRadialGradient(bx, by, 4 * dpr, bx, by, 44 * dpr);
    gr.addColorStop(0, "rgba(255,246,196,0.95)");
    gr.addColorStop(0.3, "rgba(255,228,140,0.45)");
    gr.addColorStop(1, "rgba(255,220,120,0)");
    ctx.fillStyle = gr;
    ctx.fillRect(bx - 50 * dpr, by - 50 * dpr, 100 * dpr, 100 * dpr);
    ctx.fillStyle = "#fff4c0";
    ctx.beginPath();
    ctx.arc(bx, by, 14 * dpr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  void cyclePos;

  if (under > 0.01) {
    ctx.fillStyle = `rgba(14,11,16,${(under * 0.98).toFixed(3)})`;
    ctx.fillRect(0, 0, w, h);
  }
}

/* ------------------------------ parallax ------------------------------ */

function drawParallax(g: Game, ctx: CanvasRenderingContext2D, light: number, camX: number, camY: number) {
  const w = g.world;
  const tw = g.viewW / g.scale;
  const th = g.viewH / g.scale;
  const mcx = Math.floor((camX + tw / 2) / TILE);
  const midSurf = Math.max(w.surface[mcx] ?? 100, w.ground[mcx] ?? 0);
  if (camY + th < (midSurf - 40) * TILE) return;
  if (camY > (midSurf + 30) * TILE) return;

  const layers = [
    { k: 0.35, col: light > 0.4 ? "#4a6b7a" : "#161d2e", amp: 26, base: 10, step: 90 },
    { k: 0.58, col: light > 0.4 ? "#3d5c52" : "#111826", amp: 18, base: 2, step: 62 },
  ];
  for (const L of layers) {
    const ox = camX * (1 - L.k);
    ctx.fillStyle = L.col;
    ctx.beginPath();
    const startX = camX - 40;
    const endX = camX + tw + 40;
    const baseY = (midSurf + L.base) * TILE;
    ctx.moveTo(startX, baseY + 400);
    for (let x = startX; x <= endX; x += 8) {
      const u = (x + ox) / L.step;
      const y = baseY - (Math.sin(u) * 0.6 + Math.sin(u * 0.41 + 2) * 0.4) * L.amp - L.amp;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(endX, baseY + 400);
    ctx.closePath();
    ctx.fill();
  }
}

/* -------------------------------- tiles ------------------------------- */

function drawTiles(g: Game, ctx: CanvasRenderingContext2D, x0: number, y0: number, tw: number, th: number) {
  const A = getAssets();
  const w = g.world;
  const t = g.playtime;

  // cave backdrop for air pockets below the surface
  for (let y = 0; y < th; y++) {
    const wy = y0 + y;
    if (wy < 0 || wy >= w.h) continue;
    for (let x = 0; x < tw; x++) {
      const wx = x0 + x;
      if (wx < 0 || wx >= w.w) continue;
      // air above the main landmass is sky, even under a floating island
      const surf = Math.max(w.surface[wx] ?? 0, w.ground[wx] ?? 0);
      if (wy < surf) continue;
      const tile = w.tiles[wy * w.w + wx] ?? 0;
      if (tile !== B.AIR) continue;
      ctx.fillStyle = "#171320";
      ctx.fillRect(wx * TILE, wy * TILE, TILE, TILE);
    }
  }

  for (let y = 0; y < th; y++) {
    const wy = y0 + y;
    if (wy < 0 || wy >= w.h) continue;
    for (let x = 0; x < tw; x++) {
      const wx = x0 + x;
      if (wx < 0 || wx >= w.w) continue;
      const tile = w.tiles[wy * w.w + wx] ?? 0;
      if (tile === B.AIR) continue;
      const px = wx * TILE;
      const py = wy * TILE;
      const d = blockDef(tile);

      if (d.liquid) {
        const wave = Math.sin(t * 2 + wx * 0.7) * 1.2;
        const above = (w.tiles[(wy - 1) * w.w + wx] ?? 0) === tile;
        ctx.globalAlpha = tile === B.LAVA ? 0.92 : 0.66;
        ctx.fillStyle = tile === B.LAVA ? "#e2541f" : "#3f7ec4";
        const off = above ? 0 : 2 + wave;
        ctx.fillRect(px, py + off, TILE, TILE - off);
        if (!above) {
          ctx.fillStyle = tile === B.LAVA ? "#ff9a4a" : "#79b6e8";
          ctx.fillRect(px, py + off, TILE, 2);
        }
        ctx.globalAlpha = 1;
        continue;
      }

      if (tile === B.TORCH) {
        const prop = A.prop.get("torch");
        if (prop) ctx.drawImage(prop, px + 5, py + 5, 6, 10);
        const fl = 1 + Math.sin(t * 11 + wx * 3.1) * 0.25;
        ctx.globalAlpha = 0.5;
        ctx.fillStyle = "#ffbe5c";
        ctx.beginPath();
        ctx.arc(px + 8, py + 6, 4 * fl, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        continue;
      }

      if (tile === B.CHEST) {
        const prop = A.prop.get("chest");
        if (prop) ctx.drawImage(prop, px + 1, py + 7, 14, 9);
        continue;
      }

      if (isPlatform(tile)) {
        const tex = A.blockTex.get(tile);
        if (tex) ctx.drawImage(tex, 0, 0, 16, 5, px, py, TILE, 5);
        continue;
      }

      if (tile === B.DOOR_OPEN) {
        const tex = A.blockTex.get(tile);
        if (tex) ctx.drawImage(tex, px, py, 5, TILE);
        continue;
      }

      const tex = A.blockTex.get(tile);
      if (tex) ctx.drawImage(tex, px, py, TILE, TILE);
      else {
        ctx.fillStyle = d.color;
        ctx.fillRect(px, py, TILE, TILE);
      }

      if (d.station) {
        // small glow so stations read at a glance
        ctx.globalAlpha = 0.25;
        ctx.fillStyle = d.accent ?? "#ffe6a7";
        ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
        ctx.globalAlpha = 1;
      }
    }
  }
}

/* ------------------------------ desktop cursor ------------------------- */

function drawCursor(g: Game, ctx: CanvasRenderingContext2D) {
  const ptr = g.input.pointer;
  if (!ptr) return;
  const p = g.player;
  const tx = Math.floor(ptr.x / TILE);
  const ty = Math.floor(ptr.y / TILE);
  const d = Math.hypot(ptr.x - (p.x + PLAYER_W / 2), ptr.y - (p.y + PLAYER_H / 2)) / TILE;
  const inReach = d <= REACH + 0.8;
  ctx.save();
  ctx.globalAlpha = inReach ? 0.9 : 0.35;
  ctx.strokeStyle = inReach ? "#f0b64a" : "#e8e2d2";
  ctx.lineWidth = 1;
  ctx.strokeRect(tx * TILE + 0.5, ty * TILE + 0.5, TILE - 1, TILE - 1);
  ctx.restore();
}

/* ----------------------------- mining crack --------------------------- */

function drawMiningOverlay(g: Game, ctx: CanvasRenderingContext2D) {
  const m = g.mining;
  if (!m) return;
  const px = m.tx * TILE;
  const py = m.ty * TILE;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = 0.7;
  ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
  const stage = Math.min(3, Math.floor(m.p * 4));
  ctx.fillStyle = `rgba(0,0,0,${(0.12 + stage * 0.12).toFixed(2)})`;
  ctx.fillRect(px, py, TILE, TILE);
  ctx.strokeStyle = "rgba(20,16,14,0.8)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i <= stage; i++) {
    ctx.beginPath();
    ctx.moveTo(px + 2 + i * 3, py + 1);
    ctx.lineTo(px + 6 + i * 2, py + 8);
    ctx.lineTo(px + 3 + i * 3, py + 15);
    ctx.stroke();
  }
}

/* -------------------------------- drops ------------------------------- */

function drawDrops(g: Game, ctx: CanvasRenderingContext2D) {
  const A = getAssets();
  for (const d of g.drops) {
    const icon = A.itemIcon.get(d.id);
    const bob = Math.sin(g.playtime * 4 + d.x * 0.1) * 1.4;
    if (icon) ctx.drawImage(icon, d.x - 5, d.y - 5 + bob, 11, 11);
    if (d.n > 1) {
      ctx.fillStyle = "#fff";
      ctx.font = "5px monospace";
      ctx.fillText(String(d.n), d.x + 3, d.y + 7 + bob);
    }
  }
}

/* --------------------------------- npcs ------------------------------- */

function drawNpcs(g: Game, ctx: CanvasRenderingContext2D) {
  const A = getAssets();
  for (const n of g.npcs) {
    const pair = A.npc.get(n.def.palette) ?? A.player;
    const img = n.facing === 1 ? pair.right : pair.left;
    const hop = n.onGround && Math.abs(n.vx) > 4 ? Math.abs(Math.sin(n.anim * 9)) * 1.2 : 0;
    ctx.drawImage(img, Math.round(n.x), Math.round(n.y - hop), 14, 20);
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.font = "5px monospace";
    const label = n.def.name.split(" ")[0] ?? n.def.name;
    ctx.fillText(label, n.x + 7 - label.length * 1.5, n.y - 4);
  }
}

/* --------------------------------- mobs ------------------------------- */

function drawMobs(g: Game, ctx: CanvasRenderingContext2D) {
  const A = getAssets();
  for (const m of g.mobs) {
    const pair = m.boss ? A.boss.get(m.sprite) : A.enemy.get(m.sprite);
    const img = pair ? (m.facing === 1 ? pair.right : pair.left) : null;
    const wob = m.onGround || m.flying ? Math.sin(m.anim * 7) * (m.h * 0.04) : 0;
    ctx.save();
    if (m.hurt > 0) {
      ctx.globalAlpha = 0.85;
      ctx.filter = "brightness(2.2)";
    }
    if (img) ctx.drawImage(img, Math.round(m.x), Math.round(m.y + wob), m.w, m.h);
    else {
      ctx.fillStyle = m.bossDef?.color ?? "#c44";
      ctx.fillRect(m.x, m.y, m.w, m.h);
    }
    ctx.restore();

    if (m.burn > 0) {
      ctx.globalAlpha = 0.4;
      ctx.fillStyle = "#ff8a3c";
      ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.globalAlpha = 1;
    }
    if (m.chill > 0) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = "#8fd8ff";
      ctx.fillRect(m.x, m.y, m.w, m.h);
      ctx.globalAlpha = 1;
    }

    // small floating health bar for non-boss mobs that have taken damage
    if (!m.boss && m.hp < m.maxHp) {
      const bw = Math.max(12, m.w);
      const frac = Math.max(0, m.hp / m.maxHp);
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(m.x + (m.w - bw) / 2, m.y - 5, bw, 2.5);
      ctx.fillStyle = frac > 0.5 ? "#68d05a" : frac > 0.25 ? "#e8c14a" : "#e0435f";
      ctx.fillRect(m.x + (m.w - bw) / 2, m.y - 5, bw * frac, 2.5);
    }
  }
}

/* -------------------------------- player ------------------------------ */

function drawPlayer(g: Game, ctx: CanvasRenderingContext2D) {
  const p = g.player;
  if (p.dead) return;
  const img = p.facing === 1 ? g.sprite.right : g.sprite.left;
  const walking = p.onGround && Math.abs(p.vx) > 8;
  const bob = walking ? Math.abs(Math.sin(g.playtime * 12)) * 1.3 : 0;

  // swing arc
  if (p.swing > 0) {
    const held = g.selected();
    const hd = held ? itemIconFor(held.id) : null;
    const prog = 1 - p.swing / 0.26;
    const ang = (-0.9 + prog * 2.0) * p.swingDir;
    ctx.save();
    ctx.translate(p.x + PLAYER_W / 2 + p.swingDir * 3, p.y + PLAYER_H * 0.45);
    ctx.rotate(ang);
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.arc(0, 0, 15, -0.7, 0.7);
    ctx.lineTo(0, 0);
    ctx.fill();
    if (hd) {
      ctx.scale(p.swingDir, 1);
      ctx.drawImage(hd, 2, -7, 15, 15);
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  ctx.save();
  if (p.iframe > 0 && Math.floor(g.playtime * 18) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.drawImage(img, Math.round(p.x - 1), Math.round(p.y - bob), PLAYER_W + 2, PLAYER_H);
  ctx.restore();
}

function itemIconFor(id: string): HTMLCanvasElement | null {
  return getAssets().itemIcon.get(id) ?? null;
}

/* ----------------------------- projectiles ---------------------------- */

function drawProjectiles(g: Game, ctx: CanvasRenderingContext2D) {
  for (const pr of g.projectiles) {
    const spec = pr.spec;
    const sz = spec.size * 0.6;
    const ang = Math.atan2(pr.vy, pr.vx);
    ctx.save();
    ctx.translate(pr.x, pr.y);
    ctx.fillStyle = spec.color;
    switch (spec.look) {
      case "arrow": {
        ctx.rotate(ang);
        ctx.fillRect(-sz, -0.9, sz * 2, 1.8);
        ctx.fillStyle = "#e8e0c8";
        ctx.beginPath();
        ctx.moveTo(sz, 0);
        ctx.lineTo(sz - 3, -2);
        ctx.lineTo(sz - 3, 2);
        ctx.fill();
        break;
      }
      case "bolt": {
        ctx.rotate(ang);
        ctx.fillRect(-sz * 1.2, -1.1, sz * 2.4, 2.2);
        break;
      }
      case "disc": {
        ctx.rotate(pr.spin);
        ctx.fillRect(-sz, -sz * 0.35, sz * 2, sz * 0.7);
        ctx.fillRect(-sz * 0.35, -sz, sz * 0.7, sz * 2);
        break;
      }
      case "star": {
        ctx.rotate(pr.spin);
        ctx.globalAlpha = 0.9;
        for (let i = 0; i < 4; i++) {
          ctx.rotate(Math.PI / 2);
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(sz, sz * 0.3);
          ctx.lineTo(sz * 1.5, 0);
          ctx.lineTo(sz, -sz * 0.3);
          ctx.fill();
        }
        break;
      }
      case "nova": {
        const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, sz * 1.6);
        gr.addColorStop(0, "#ffffff");
        gr.addColorStop(0.4, spec.color);
        gr.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 1.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "frost":
      case "prism": {
        ctx.rotate(pr.spin);
        ctx.beginPath();
        ctx.moveTo(0, -sz);
        ctx.lineTo(sz * 0.6, 0);
        ctx.lineTo(0, sz);
        ctx.lineTo(-sz * 0.6, 0);
        ctx.fill();
        break;
      }
      case "spore":
      case "ember":
      default: {
        ctx.globalAlpha = 0.9;
        ctx.beginPath();
        ctx.arc(0, 0, sz * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.7)";
        ctx.beginPath();
        ctx.arc(-sz * 0.2, -sz * 0.2, sz * 0.3, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
    ctx.restore();
  }
}

/* ------------------------------ particles ----------------------------- */

function drawParticles(g: Game, ctx: CanvasRenderingContext2D) {
  for (const p of g.particles) {
    const a = Math.max(0, Math.min(1, p.life / p.max));
    if (p.text) {
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = `${p.crit ? "bold " : ""}${p.crit ? 9 : 7}px monospace`;
      ctx.fillStyle = "rgba(0,0,0,0.65)";
      ctx.fillText(p.text, p.x + 0.7, p.y + 0.7);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
      continue;
    }
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;
}

/* ------------------------------- lighting ----------------------------- */

function drawLighting(
  g: Game,
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  tw: number,
  th: number,
  s: number,
  camX: number,
  camY: number,
) {
  if (!lightCanvas || lightCanvas.width !== tw || lightCanvas.height !== th) {
    lightCanvas = document.createElement("canvas");
    lightCanvas.width = tw;
    lightCanvas.height = th;
    lightCtx = lightCanvas.getContext("2d");
    lightData = lightCtx ? lightCtx.createImageData(tw, th) : null;
  }
  if (!lightCtx || !lightData) return;
  const data = lightData.data;
  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const v = g.lightAt(x0 + x, y0 + y);
      const a = Math.round(Math.max(0, Math.min(1, 1 - v)) * 248);
      const i = (y * tw + x) * 4;
      data[i] = 6;
      data[i + 1] = 5;
      data[i + 2] = 12;
      data[i + 3] = a;
    }
  }
  lightCtx.putImageData(lightData, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(
    lightCanvas,
    (x0 * TILE - camX) * s,
    (y0 * TILE - camY) * s,
    tw * TILE * s,
    th * TILE * s,
  );
  ctx.restore();
}

function drawVignette(g: Game, ctx: CanvasRenderingContext2D, dpr: number) {
  const w = g.viewW * dpr;
  const h = g.viewH * dpr;
  const p = g.player;
  if (p.hp / Math.max(1, p.maxHp + 0) < 0.3 && !p.dead) {
    const pulse = 0.18 + Math.sin(g.playtime * 5) * 0.06;
    const gr = ctx.createRadialGradient(w / 2, h / 2, h * 0.25, w / 2, h / 2, h * 0.78);
    gr.addColorStop(0, "rgba(180,20,40,0)");
    gr.addColorStop(1, `rgba(180,20,40,${pulse.toFixed(3)})`);
    ctx.fillStyle = gr;
    ctx.fillRect(0, 0, w, h);
  }
  if (g.event) {
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = g.event.def.color;
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }
}
