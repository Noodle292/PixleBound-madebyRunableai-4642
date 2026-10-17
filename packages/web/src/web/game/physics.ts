import { B, blockDef, isPlatform, isSolid } from "./blocks";
import { getTile, TILE, type World } from "./worldgen";

export type Body = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  onGround: boolean;
};

export type MoveResult = { hitX: boolean; hitY: boolean; landed: boolean };

function blocked(world: World, x: number, y: number, w: number, h: number, platformTop: number | null): boolean {
  const x0 = Math.floor(x / TILE);
  const x1 = Math.floor((x + w - 0.01) / TILE);
  const y0 = Math.floor(y / TILE);
  const y1 = Math.floor((y + h - 0.01) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const t = getTile(world, tx, ty);
      if (isPlatform(t)) {
        if (platformTop !== null && platformTop <= ty * TILE + 3) return true;
        continue;
      }
      if (isSolid(t)) return true;
    }
  }
  return false;
}

/** Axis-separated AABB movement against the tile grid. */
export function moveBody(world: World, b: Body, dt: number, ghost = false): MoveResult {
  const res: MoveResult = { hitX: false, hitY: false, landed: false };
  // Keep each collision step shorter than half a tile, even on a slow phone.
  const steps = Math.ceil(Math.max(Math.abs(b.vx), Math.abs(b.vy)) * dt / (TILE * 0.45));
  if (!ghost && steps > 1) {
    for (let i = 0; i < steps; i++) {
      const r = moveBody(world, b, dt / steps, false);
      res.hitX ||= r.hitX;
      res.hitY ||= r.hitY;
      res.landed ||= r.landed;
    }
    return res;
  }
  const prevBottom = b.y + b.h;
  if (ghost) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.onGround = false;
    return res;
  }

  b.x += b.vx * dt;
  if (blocked(world, b.x, b.y, b.w, b.h, null)) {
    if (b.vx > 0) b.x = Math.floor((b.x + b.w) / TILE) * TILE - b.w - 0.01;
    else b.x = (Math.floor(b.x / TILE) + 1) * TILE + 0.01;
    b.vx = 0;
    res.hitX = true;
  }

  b.onGround = false;
  b.y += b.vy * dt;
  const platformTop = b.vy > 0 ? prevBottom : null;
  if (blocked(world, b.x, b.y, b.w, b.h, platformTop)) {
    if (b.vy > 0) {
      b.y = Math.floor((b.y + b.h) / TILE) * TILE - b.h - 0.01;
      b.onGround = true;
      res.landed = true;
    } else {
      b.y = (Math.floor(b.y / TILE) + 1) * TILE + 0.01;
    }
    b.vy = 0;
    res.hitY = true;
  } else if (blocked(world, b.x, b.y + 2, b.w, b.h, b.y + b.h)) {
    b.onGround = true;
  }
  return res;
}

/** True when the body can step up one tile from its current spot (used by walking AI). */
export function canStepUp(world: World, b: Body, dir: number): boolean {
  const probeX = dir > 0 ? b.x + b.w + 2 : b.x - 2;
  const tx = Math.floor(probeX / TILE);
  const footY = Math.floor((b.y + b.h - 2) / TILE);
  const solidAtFoot = isSolid(getTile(world, tx, footY));
  const clearAbove = !isSolid(getTile(world, tx, footY - 1)) && !isSolid(getTile(world, tx, footY - 2));
  return solidAtFoot && clearAbove;
}

export function solidAt(world: World, x: number, y: number): boolean {
  return isSolid(getTile(world, Math.floor(x / TILE), Math.floor(y / TILE)));
}

export function liquidAt(world: World, x: number, y: number): number {
  const t = getTile(world, Math.floor(x / TILE), Math.floor(y / TILE));
  return t === B.WATER || t === B.LAVA ? t : 0;
}

export function tileDamageAt(world: World, x: number, y: number, w: number, h: number): number {
  const x0 = Math.floor(x / TILE);
  const x1 = Math.floor((x + w) / TILE);
  const y0 = Math.floor(y / TILE);
  const y1 = Math.floor((y + h) / TILE);
  let dmg = 0;
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const d = blockDef(getTile(world, tx, ty));
      if (d.damage) dmg = Math.max(dmg, d.damage);
    }
  }
  return dmg;
}

/** Find a free vertical spot at a column: returns world-pixel y for a body of height h, or null. */
export function groundSpot(world: World, tx: number, fromY: number, h: number, maxScan = 60): number | null {
  for (let ty = fromY; ty < fromY + maxScan; ty++) {
    const t = getTile(world, tx, ty);
    if (!isSolid(t)) continue;
    const need = Math.ceil(h / TILE);
    let clear = true;
    for (let k = 1; k <= need; k++) {
      if (isSolid(getTile(world, tx, ty - k))) {
        clear = false;
        break;
      }
    }
    if (clear) return ty * TILE - h - 1;
  }
  return null;
}

export function aabb(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}
