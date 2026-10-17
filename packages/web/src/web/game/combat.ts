import { B, isSolid } from "./blocks";
import type { BossDef, BossPattern, EnemyDef, LootEntry } from "./entities";
import { BOSS_MAP, BOSSES, ENEMIES, ENEMY_MAP } from "./entities";
import type { Game } from "./engine";
import { itemDef, type ProjectileSpec } from "./items";
import { aabb, canStepUp, dist2, groundSpot, moveBody, tileDamageAt } from "./physics";
import { randInt } from "./rng";
import { GRAVITY, MAX_ENEMIES, MAX_FALL, PLAYER_H, PLAYER_W, type Mob } from "./state";
import { biomeAt, biomeFamily, getTile, layerAt, TILE } from "./worldgen";

/* ------------------------------ helpers ----------------------------- */

export function makeMob(g: Game, def: EnemyDef, x: number, y: number): Mob {
  const hpScale = 1 + g.tier * 0.12 + (g.event?.def.id === "gloomtide" ? 0.35 : 0);
  const hp = Math.round(def.hp * hpScale * g.mode.enemyHp);
  return {
    uid: g.uid(),
    defId: def.id,
    boss: false,
    sprite: def.sprite,
    name: def.name,
    x,
    y,
    vx: 0,
    vy: 0,
    w: def.w,
    h: def.h,
    hp,
    maxHp: hp,
    facing: 1,
    onGround: false,
    hurt: 0,
    atkCd: 0,
    shootCd: Math.random() * 2,
    jumpCd: Math.random(),
    flying: def.behavior === "flyer",
    chill: 0,
    burn: 0,
    burnDmg: 0,
    life: 120,
    pcd: [],
    action: null,
    phase: 1,
    def,
    bossDef: null,
    anim: Math.random() * 10,
  };
}

export function makeBoss(g: Game, def: BossDef, x: number, y: number): Mob {
  const hp = Math.round(def.hp * (1 + g.tier * 0.03) * g.mode.bossHp);
  return {
    uid: g.uid(),
    defId: def.id,
    boss: true,
    sprite: def.sprite,
    name: def.name,
    x,
    y,
    vx: 0,
    vy: 0,
    w: def.size,
    h: Math.round(def.size * 0.92),
    hp,
    maxHp: hp,
    facing: 1,
    onGround: false,
    hurt: 0,
    atkCd: 0,
    shootCd: 0,
    jumpCd: 0,
    flying: def.flying,
    chill: 0,
    burn: 0,
    burnDmg: 0,
    life: 99999,
    pcd: def.patterns.map((p) => 1.2 + Math.random() * p.cd * 0.5),
    action: null,
    phase: 1,
    def: null,
    bossDef: def,
    anim: 0,
  };
}

export function rollLoot(g: Game, loot: LootEntry[], x: number, y: number) {
  for (const l of loot) {
    if (Math.random() > l.chance) continue;
    const n = randInt(Math.random, l.min, l.max);
    if (n > 0) g.dropItem(x, y, l.item, n);
  }
}

/* ---------------------------- player attack -------------------------- */

const FIST = { damage: 6, speed: 1.8, range: 1.5, knockback: 90, kind: "melee" as const };

export function playerAttack(g: Game) {
  const p = g.player;
  if (p.attackCd > 0 || p.dead) return;
  const held = g.selected();
  const wd = held ? itemDef(held.id) : null;
  const spec = wd?.weapon ?? (wd?.tool ? { damage: wd.tool.power * 2 + 4, speed: 1.6, range: 1.7, knockback: 80, kind: "melee" as const } : FIST);
  const st = g.stats();
  p.attackCd = 1 / Math.max(0.4, spec.speed);
  p.swing = 0.2;
  if (g.input.pointer) p.facing = g.input.pointer.x >= p.x + PLAYER_W / 2 ? 1 : -1;
  p.swingDir = p.facing;
  const dmgMult = st.dmgMult;

  if (spec.kind === "melee") {
    g.sfx("swing");
    const reach = spec.range * TILE;
    const bx = p.facing > 0 ? p.x + PLAYER_W - 2 : p.x - reach + 2;
    const by = p.y - 6;
    const bh = PLAYER_H + 10;
    let hitAny = false;
    for (const m of g.mobs) {
      if (aabb(bx, by, reach, bh, m.x, m.y, m.w, m.h)) {
        damageMob(g, m, spec.damage * dmgMult, p.facing, spec.knockback, {
          burn: (spec as { burn?: number }).burn ?? 0,
          chill: (spec as { chill?: number }).chill ?? 0,
        });
        hitAny = true;
      }
    }
    if (hitAny) g.sfx("hit");
    else g.fxBurst(p.x + (p.facing > 0 ? PLAYER_W + 6 : -6), p.y + 12, "#ffffff", 2, 40);
    return;
  }

  // ranged: auto-aim at the closest mob, otherwise straight ahead
  const proj = spec.projectile;
  if (!proj) return;
  const ox = p.x + PLAYER_W / 2;
  const oy = p.y + PLAYER_H * 0.4;
  let tx = ox + p.facing * 200;
  let ty = oy - 20;
  let best = 520 * 520;
  const cursor = g.input.pointer;
  if (cursor) {
    tx = cursor.x;
    ty = cursor.y;
    best = -1;
  }
  for (const m of g.mobs) {
    const d = dist2(ox, oy, m.x + m.w / 2, m.y + m.h / 2);
    if (d < best) {
      best = d;
      tx = m.x + m.w / 2;
      ty = m.y + m.h / 2;
    }
  }
  const shots = (spec as { shots?: number }).shots ?? 1;
  const spread = (spec as { spread?: number }).spread ?? 0;
  const base = Math.atan2(ty - oy, tx - ox);
  for (let i = 0; i < shots; i++) {
    const off = shots === 1 ? 0 : (i / (shots - 1) - 0.5) * spread;
    const a = base + off + (Math.random() - 0.5) * 0.04;
    spawnProjectile(g, {
      x: ox,
      y: oy,
      vx: Math.cos(a) * proj.speed * TILE,
      vy: Math.sin(a) * proj.speed * TILE,
      dmg: spec.damage * dmgMult,
      friendly: true,
      spec: proj,
      knockback: spec.knockback,
      returns: (spec as { returns?: boolean }).returns ?? false,
      burn: (spec as { burn?: number }).burn ?? 0,
      chill: (spec as { chill?: number }).chill ?? 0,
    });
  }
  g.sfx(spec.kind === "magic" ? "magic" : "shoot");
}

/* ----------------------------- projectiles --------------------------- */

export function spawnProjectile(
  g: Game,
  o: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    dmg: number;
    friendly: boolean;
    spec: ProjectileSpec;
    knockback?: number;
    returns?: boolean;
    burn?: number;
    chill?: number;
    dropOnHit?: string;
    spinRate?: number;
  },
) {
  g.projectiles.push({
    x: o.x,
    y: o.y,
    vx: o.vx,
    vy: o.vy,
    dmg: o.dmg,
    friendly: o.friendly,
    spec: o.spec,
    life: o.spec.life ?? 3,
    pierce: o.spec.pierce ?? 0,
    knockback: o.knockback ?? 60,
    hit: new Set<number>(),
    spin: Math.random() * 6,
    homingUid: 0,
    returns: o.returns ?? false,
    age: 0,
    chill: o.chill ?? 0,
    burn: o.burn ?? 0,
    dropOnHit: o.dropOnHit ?? "",
    spinRate: o.spinRate ?? 0,
  });
  if (g.projectiles.length > 160) g.projectiles.splice(0, g.projectiles.length - 160);
}

export function updateProjectiles(g: Game, dt: number) {
  const p = g.player;
  for (let i = g.projectiles.length - 1; i >= 0; i--) {
    const pr = g.projectiles[i]!;
    pr.age += dt;
    pr.life -= dt;
    pr.spin += dt * 8;
    if (pr.spinRate) {
      const c = Math.cos(pr.spinRate * dt);
      const s = Math.sin(pr.spinRate * dt);
      const nvx = pr.vx * c - pr.vy * s;
      const nvy = pr.vx * s + pr.vy * c;
      pr.vx = nvx;
      pr.vy = nvy;
    }
    if (pr.spec.gravity) pr.vy += pr.spec.gravity * dt;
    if (pr.spec.homing) {
      let tx: number;
      let ty: number;
      if (pr.friendly) {
        let best = 400 * 400;
        tx = pr.x + pr.vx;
        ty = pr.y + pr.vy;
        for (const m of g.mobs) {
          const d = dist2(pr.x, pr.y, m.x + m.w / 2, m.y + m.h / 2);
          if (d < best) {
            best = d;
            tx = m.x + m.w / 2;
            ty = m.y + m.h / 2;
          }
        }
      } else {
        tx = p.x + PLAYER_W / 2;
        ty = p.y + PLAYER_H / 2;
      }
      const a = Math.atan2(ty - pr.y, tx - pr.x);
      const sp = Math.hypot(pr.vx, pr.vy) || pr.spec.speed * TILE;
      const turn = pr.spec.homing * dt * 4;
      const ca = Math.atan2(pr.vy, pr.vx);
      let diff = a - ca;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const na = ca + Math.max(-turn, Math.min(turn, diff));
      pr.vx = Math.cos(na) * sp;
      pr.vy = Math.sin(na) * sp;
    }
    if (pr.returns && pr.age > 0.45) {
      const a = Math.atan2(p.y + PLAYER_H / 2 - pr.y, p.x + PLAYER_W / 2 - pr.x);
      const sp = pr.spec.speed * TILE;
      pr.vx += (Math.cos(a) * sp - pr.vx) * dt * 6;
      pr.vy += (Math.sin(a) * sp - pr.vy) * dt * 6;
      if (dist2(pr.x, pr.y, p.x, p.y) < 20 * 20 && pr.age > 0.9) {
        g.projectiles.splice(i, 1);
        continue;
      }
    }

    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;

    if (g.settings.quality !== "low" && Math.random() < 0.5) {
      g.particles.push({
        x: pr.x,
        y: pr.y,
        vx: 0,
        vy: 0,
        life: 0.22,
        max: 0.22,
        color: pr.spec.color,
        size: Math.max(2, pr.spec.size * 0.4),
        grav: 0,
      });
    }

    const tx = Math.floor(pr.x / TILE);
    const ty = Math.floor(pr.y / TILE);
    const hitTile = isSolid(getTile(g.world, tx, ty));
    if (hitTile || pr.life <= 0) {
      if (hitTile && pr.dropOnHit) {
        g.dropItem(pr.x, pr.y - 8, pr.dropOnHit, randInt(Math.random, 1, 3));
        g.fxBurst(pr.x, pr.y, pr.spec.color, 14, 150);
        g.sfx("boss_spawn");
      } else if (hitTile) {
        g.fxBurst(pr.x, pr.y, pr.spec.color, 5, 90);
      }
      g.projectiles.splice(i, 1);
      continue;
    }

    const s = pr.spec.size;
    if (pr.friendly) {
      for (const m of g.mobs) {
        if (pr.hit.has(m.uid)) continue;
        if (!aabb(pr.x - s / 2, pr.y - s / 2, s, s, m.x, m.y, m.w, m.h)) continue;
        damageMob(g, m, pr.dmg, pr.vx >= 0 ? 1 : -1, pr.knockback, { burn: pr.burn, chill: pr.chill });
        pr.hit.add(m.uid);
        if (pr.pierce > 0) pr.pierce--;
        else if (!pr.returns) {
          g.fxBurst(pr.x, pr.y, pr.spec.color, 6, 110);
          g.projectiles.splice(i, 1);
        }
        break;
      }
    } else if (!p.dead && aabb(pr.x - s / 2, pr.y - s / 2, s, s, p.x, p.y, PLAYER_W, PLAYER_H)) {
      g.hurtPlayer(pr.dmg, pr.vx >= 0 ? 1 : -1, 130);
      g.fxBurst(pr.x, pr.y, pr.spec.color, 6, 110);
      g.projectiles.splice(i, 1);
    }
  }
}

/* -------------------------------- mobs ------------------------------- */

export function damageMob(
  g: Game,
  m: Mob,
  raw: number,
  dir: number,
  knockback: number,
  fx?: { burn?: number; chill?: number },
) {
  if (m.hp <= 0) return;
  const defense = m.boss ? (m.bossDef?.defense ?? 0) : (m.def?.defense ?? 0);
  const crit = Math.random() < 0.1;
  let dmg = Math.max(1, raw * (crit ? 1.7 : 1) - defense * 0.6);
  dmg = Math.round(dmg * (0.9 + Math.random() * 0.2));
  m.hp -= dmg;
  m.hurt = 0.16;
  const resist = m.boss ? 0.25 : 1 - (m.def?.knockbackResist ?? 0);
  m.vx += dir * knockback * resist;
  if (!m.flying) m.vy = Math.min(m.vy, -70 * resist);
  if (fx?.burn) {
    m.burn = Math.max(m.burn, 3);
    m.burnDmg = Math.max(m.burnDmg, fx.burn);
  }
  if (fx?.chill) m.chill = Math.max(m.chill, fx.chill);
  g.fxText(m.x + m.w / 2, m.y - 4, `${dmg}`, crit ? "#ffe066" : "#ffffff", crit);
  g.fxBurst(m.x + m.w / 2, m.y + m.h / 2, m.boss ? (m.bossDef?.color ?? "#fff") : "#ff6b6b", crit ? 8 : 4, 120);
  if (m.hp <= 0) killMob(g, m);
}

export function killMob(g: Game, m: Mob) {
  const cx = m.x + m.w / 2;
  const cy = m.y + m.h / 2;
  g.fxBurst(cx, cy, m.boss ? (m.bossDef?.color ?? "#fff") : "#c94f4f", m.boss ? 60 : 12, m.boss ? 320 : 160);
  const idx = g.mobs.indexOf(m);
  if (idx >= 0) g.mobs.splice(idx, 1);
  if (m.boss && m.bossDef) {
    rollLoot(g, m.bossDef.loot, cx, cy);
    const coins = randInt(Math.random, m.bossDef.coins[0], m.bossDef.coins[1]);
    if (coins > 0) g.dropItem(cx, cy, "coin", Math.round(coins * g.mode.coinBonus));
    g.onBossDefeated(m.bossDef);
    return;
  }
  if (m.def) {
    rollLoot(g, m.def.loot, cx, cy);
    const coins = randInt(Math.random, m.def.coins[0], m.def.coins[1]);
    if (coins > 0) g.dropItem(cx, cy, "coin", Math.round(coins * g.mode.coinBonus));
  }
  g.tut.killed++;
  g.sfx("enemy_die");
}

export function updateMobs(g: Game, dt: number) {
  const p = g.player;
  const px = p.x + PLAYER_W / 2;
  const py = p.y + PLAYER_H / 2;

  for (let i = g.mobs.length - 1; i >= 0; i--) {
    const m = g.mobs[i]!;
    m.anim += dt;
    if (m.hurt > 0) m.hurt -= dt;
    if (m.atkCd > 0) m.atkCd -= dt;
    if (m.chill > 0) m.chill -= dt;
    if (m.burn > 0) {
      m.burn -= dt;
      if (Math.random() < dt * 2) {
        m.hp -= m.burnDmg;
        g.fxText(m.x + m.w / 2, m.y - 2, `${m.burnDmg}`, "#ff9a3c");
        if (m.hp <= 0) {
          killMob(g, m);
          continue;
        }
      }
    }

    const dx = px - (m.x + m.w / 2);
    const dy = py - (m.y + m.h / 2);
    const distX = Math.abs(dx);
    const far = distX > 1400 || Math.abs(dy) > 900;

    if (!m.boss) {
      m.life -= dt;
      if (far || m.life <= 0) {
        if (far) {
          g.mobs.splice(i, 1);
          continue;
        }
      }
      if (distX < 900) m.life = Math.max(m.life, 20);
    }

    const chillMul = m.chill > 0 ? 0.55 : 1;
    if (m.boss && m.bossDef) {
      updateBoss(g, m, dt, dx, dy);
    } else if (m.def) {
      const d = m.def;
      const speed = d.speed * chillMul * (g.event?.def.id === "gloomtide" ? 1.15 : 1);
      m.facing = dx >= 0 ? 1 : -1;
      switch (d.behavior) {
        case "flyer": {
          const a = Math.atan2(dy, dx);
          const wob = Math.sin(m.anim * 3) * 40;
          m.vx += (Math.cos(a) * speed - m.vx) * dt * 2.2;
          m.vy += (Math.sin(a) * speed + wob - m.vy) * dt * 2.2;
          moveBody(g.world, m, dt, true);
          break;
        }
        case "jumper": {
          m.jumpCd -= dt;
          if (m.onGround) {
            m.vx *= 0.86;
            if (m.jumpCd <= 0 && distX < 420) {
              m.vy = -(d.jump ?? 320);
              m.vx = Math.sign(dx) * speed * 1.5;
              m.jumpCd = 1 + Math.random() * 0.8;
            }
          }
          m.vy = Math.min(MAX_FALL, m.vy + GRAVITY * dt);
          moveBody(g.world, m, dt);
          break;
        }
        case "burrower": {
          const submerged = distX > 120;
          if (submerged) {
            const a = Math.atan2(dy + 40, dx);
            m.vx = Math.cos(a) * speed * 1.3;
            m.vy = Math.sin(a) * speed * 1.3;
            moveBody(g.world, m, dt, true);
            if (g.settings.quality !== "low" && Math.random() < 0.35) {
              g.fxBurst(m.x + m.w / 2, m.y + m.h, "#d8c08a", 1, 50);
            }
          } else {
            m.vx += (Math.sign(dx) * speed - m.vx) * dt * 4;
            m.vy = Math.min(MAX_FALL, m.vy + GRAVITY * dt);
            if (m.onGround && canStepUp(g.world, m, Math.sign(dx))) m.vy = -300;
            moveBody(g.world, m, dt);
          }
          break;
        }
        case "shooter": {
          const want = 150;
          const dir = distX > want + 40 ? Math.sign(dx) : distX < want - 40 ? -Math.sign(dx) : 0;
          m.vx += (dir * speed - m.vx) * dt * 3;
          m.vy = Math.min(MAX_FALL, m.vy + GRAVITY * dt * (d.behavior === "shooter" && m.flying ? 0 : 1));
          moveBody(g.world, m, dt);
          m.shootCd -= dt;
          if (d.shoot && m.shootCd <= 0 && distX < 460 && Math.abs(dy) < 260) {
            m.shootCd = d.shoot.cd;
            const a = Math.atan2(dy, dx);
            spawnProjectile(g, {
              x: m.x + m.w / 2,
              y: m.y + m.h / 2,
              vx: Math.cos(a) * d.shoot.projectile.speed * TILE,
              vy: Math.sin(a) * d.shoot.projectile.speed * TILE,
              dmg: d.shoot.damage,
              friendly: false,
              spec: d.shoot.projectile,
            });
            g.sfx("shoot");
          }
          break;
        }
        default: {
          m.vx += (Math.sign(dx) * speed - m.vx) * dt * 4;
          m.vy = Math.min(MAX_FALL, m.vy + GRAVITY * dt);
          if (m.onGround && canStepUp(g.world, m, Math.sign(dx)) && distX < 700) m.vy = -(d.jump ?? 300);
          moveBody(g.world, m, dt);
          break;
        }
      }
    }

    // contact damage
    if (!p.dead && p.iframe <= 0 && aabb(m.x, m.y, m.w, m.h, p.x, p.y, PLAYER_W, PLAYER_H)) {
      const dmg = m.boss ? (m.bossDef?.damage ?? 10) : (m.def?.damage ?? 5);
      const mult = m.action?.kind === "charge" ? 1.4 : 1;
      g.hurtPlayer(dmg * mult, dx >= 0 ? -1 : 1, m.boss ? 260 : 160);
    }

    const td = tileDamageAt(g.world, m.x, m.y, m.w, m.h);
    if (td > 0 && !m.boss && Math.random() < dt * 3) {
      m.hp -= td;
      if (m.hp <= 0) {
        killMob(g, m);
        continue;
      }
    }
  }
}

/* -------------------------------- bosses ----------------------------- */

function startAction(g: Game, m: Mob, pattern: BossPattern, i: number, dx: number, dy: number) {
  const dur =
    pattern.kind === "charge"
      ? pattern.dur
      : pattern.kind === "laser"
        ? pattern.dur + 0.6
        : pattern.kind === "burrow"
          ? pattern.dur
          : pattern.kind === "hop"
            ? pattern.count * 0.9
            : pattern.kind === "rain"
              ? 1.6
              : pattern.kind === "dive"
                ? 1.6
                : 0.5;
  m.action = { kind: pattern.kind, t: dur, ax: dx, ay: dy, i };
  const cx = m.x + m.w / 2;
  const cy = m.y + m.h / 2;
  const a = Math.atan2(dy, dx);

  switch (pattern.kind) {
    case "charge":
      m.vx = Math.cos(a) * pattern.speed;
      m.vy = m.flying ? Math.sin(a) * pattern.speed : m.vy;
      g.sfx("boss_spawn");
      break;
    case "spread": {
      for (let k = 0; k < pattern.count; k++) {
        const off = (k / Math.max(1, pattern.count - 1) - 0.5) * pattern.spread;
        spawnProjectile(g, {
          x: cx,
          y: cy,
          vx: Math.cos(a + off) * pattern.proj.speed * TILE,
          vy: Math.sin(a + off) * pattern.proj.speed * TILE,
          dmg: pattern.damage,
          friendly: false,
          spec: pattern.proj,
        });
      }
      g.sfx("magic");
      break;
    }
    case "homing": {
      for (let k = 0; k < pattern.count; k++) {
        const off = (k - pattern.count / 2) * 0.3;
        spawnProjectile(g, {
          x: cx,
          y: cy,
          vx: Math.cos(a + off) * pattern.proj.speed * TILE,
          vy: Math.sin(a + off) * pattern.proj.speed * TILE,
          dmg: pattern.damage,
          friendly: false,
          spec: pattern.proj,
        });
      }
      g.sfx("magic");
      break;
    }
    case "summon": {
      const def = ENEMY_MAP[pattern.enemy];
      if (def) {
        for (let k = 0; k < pattern.count; k++) {
          const sx = cx + (Math.random() - 0.5) * 260;
          const mob = makeMob(g, def, sx, cy - 40);
          mob.life = 45;
          g.mobs.push(mob);
        }
      }
      g.sfx("boss_spawn");
      break;
    }
    case "orbit": {
      const spec: ProjectileSpec = {
        speed: 8,
        gravity: 0,
        look: "nova",
        size: 12,
        color: m.bossDef?.color ?? "#fff",
        life: 7,
      };
      for (let k = 0; k < pattern.count; k++) {
        const ang = (k / pattern.count) * Math.PI * 2;
        spawnProjectile(g, {
          x: cx + Math.cos(ang) * 90,
          y: cy + Math.sin(ang) * 90,
          vx: Math.cos(ang + Math.PI / 2) * 170,
          vy: Math.sin(ang + Math.PI / 2) * 170,
          dmg: pattern.damage,
          friendly: false,
          spec,
          spinRate: 1.6,
        });
      }
      g.sfx("magic");
      break;
    }
    case "rain":
      g.sfx("event");
      break;
    case "laser":
      g.sfx("boss_spawn");
      break;
    case "dive":
      m.vy = -260;
      break;
    case "burrow":
      g.fxBurst(cx, cy, m.bossDef?.color ?? "#fff", 24, 220);
      break;
    case "hop":
      break;
  }
}

function updateBoss(g: Game, m: Mob, dt: number, dx: number, dy: number) {
  const def = m.bossDef!;
  const p = g.player;
  const speedMul = m.phase === 2 ? 1.35 : 1;
  if (m.phase === 1 && m.hp < m.maxHp * 0.5) {
    m.phase = 2;
    g.toast(`${def.name} is enraged!`, def.color);
    g.fxBurst(m.x + m.w / 2, m.y + m.h / 2, def.color, 40, 300);
  }
  m.facing = dx >= 0 ? 1 : -1;

  for (let i = 0; i < m.pcd.length; i++) m.pcd[i] = (m.pcd[i] ?? 0) - dt * speedMul;

  if (m.action) {
    m.action.t -= dt;
    const act = m.action;
    if (act.kind === "laser") {
      const warm = act.t > (def.patterns[act.i] as { dur: number }).dur;
      if (!warm) {
        const pat = def.patterns[act.i] as { kind: "laser"; damage: number };
        const a = Math.atan2(act.ay, act.ax);
        const bx = m.x + m.w / 2;
        const by = m.y + m.h / 2;
        // damage the player when standing in the beam line
        const relX = p.x + PLAYER_W / 2 - bx;
        const relY = p.y + PLAYER_H / 2 - by;
        const along = relX * Math.cos(a) + relY * Math.sin(a);
        const perp = Math.abs(-relX * Math.sin(a) + relY * Math.cos(a));
        if (along > 0 && along < 900 && perp < 18) g.hurtPlayer(pat.damage * dt * 3, Math.sign(relX) || 1, 60);
        if (g.settings.quality !== "low") {
          for (let k = 0; k < 3; k++) {
            const d = Math.random() * 700;
            g.particles.push({
              x: bx + Math.cos(a) * d,
              y: by + Math.sin(a) * d,
              vx: 0,
              vy: 0,
              life: 0.15,
              max: 0.15,
              color: def.color,
              size: 6,
              grav: 0,
            });
          }
        }
      }
    } else if (act.kind === "rain") {
      const pat = def.patterns[act.i] as { kind: "rain"; count: number; damage: number; proj: ProjectileSpec };
      if (Math.random() < dt * pat.count * 1.2) {
        const sx = p.x + (Math.random() - 0.5) * 520;
        spawnProjectile(g, {
          x: sx,
          y: p.y - 420,
          vx: (Math.random() - 0.5) * 60,
          vy: pat.proj.speed * TILE * 0.6,
          dmg: pat.damage,
          friendly: false,
          spec: { ...pat.proj, gravity: 420 },
        });
      }
    } else if (act.kind === "hop") {
      const pat = def.patterns[act.i] as { kind: "hop"; power: number; count: number };
      if (m.onGround) {
        m.vy = -pat.power;
        m.vx = Math.sign(dx) * def.speed * 1.6;
        g.sfx("hit");
      }
    } else if (act.kind === "dive") {
      if (act.t < 1.1) {
        const a = Math.atan2(dy, dx);
        const pat = def.patterns[act.i] as { kind: "dive"; speed: number };
        m.vx = Math.cos(a) * pat.speed;
        m.vy = Math.sin(a) * pat.speed;
      }
    } else if (act.kind === "burrow") {
      m.vx = (dx > 0 ? 1 : -1) * def.speed * 2.4;
      m.vy = 0;
    }
    if (m.action.t <= 0) {
      if (m.action.kind === "burrow") {
        const spot = groundSpot(g.world, Math.floor((p.x + PLAYER_W / 2) / TILE), Math.floor(p.y / TILE) - 6, m.h);
        if (spot !== null) {
          m.x = p.x - m.w / 2;
          m.y = spot;
        }
        m.vy = -420;
        g.fxBurst(m.x + m.w / 2, m.y + m.h, def.color, 30, 260);
      }
      m.pcd[m.action.i] = (def.patterns[m.action.i]?.cd ?? 4) * (m.phase === 2 ? 0.65 : 1);
      m.action = null;
    }
  } else {
    // idle movement
    if (m.flying) {
      const targetX = p.x - m.w / 2 + Math.cos(m.anim * 0.8) * 120;
      const targetY = p.y - 120 + Math.sin(m.anim * 1.1) * 60;
      m.vx += ((targetX - m.x) * 2.2 - m.vx) * dt * 2;
      m.vy += ((targetY - m.y) * 2.2 - m.vy) * dt * 2;
      const cap = def.speed * 1.6;
      m.vx = Math.max(-cap, Math.min(cap, m.vx));
      m.vy = Math.max(-cap, Math.min(cap, m.vy));
    } else {
      m.vx += (Math.sign(dx) * def.speed - m.vx) * dt * 3;
      m.vy = Math.min(MAX_FALL, m.vy + GRAVITY * dt);
      if (m.onGround && (canStepUp(g.world, m, Math.sign(dx)) || (Math.abs(dy) > 60 && dy < 0 && Math.random() < dt * 2))) {
        m.vy = -460;
      }
    }
    // choose a pattern
    const ready: number[] = [];
    for (let i = 0; i < def.patterns.length; i++) if ((m.pcd[i] ?? 0) <= 0) ready.push(i);
    if (ready.length) {
      const i = ready[Math.floor(Math.random() * ready.length)]!;
      startAction(g, m, def.patterns[i]!, i, dx, dy);
    }
  }

  const ghost = m.flying || m.action?.kind === "burrow";
  if (!ghost) m.vy = Math.min(MAX_FALL, m.vy + GRAVITY * dt * 0.6);
  moveBody(g.world, m, dt, ghost);
  // never let a boss fall out of the world
  if (m.y > g.world.h * TILE - 40) m.y = g.world.h * TILE - 40;
}

export function spawnBoss(g: Game, bossId: string): boolean {
  const def = BOSS_MAP[bossId];
  if (!def) return false;
  if (g.mobs.some((m) => m.boss)) {
    g.toast("A boss is already here!", "#ff8a5c");
    return false;
  }
  const p = g.player;
  const x = p.x + (p.facing > 0 ? 180 : -180 - def.size);
  const y = p.y - def.size * 0.6;
  const m = makeBoss(g, def, x, y);
  g.mobs.push(m);
  g.boss = m;
  g.toast(`${def.name}, ${def.title}`, def.color);
  g.sfx("boss_spawn");
  g.setMusic("boss");
  return true;
}

/* ------------------------------ spawning ----------------------------- */

export function spawnLoop(g: Game, dt: number) {
  g.spawnTimer -= dt;
  if (g.spawnTimer > 0) return;
  g.spawnTimer = 1.1;
  const eventMul = g.event?.def.id === "gloomtide" ? 2.2 : g.event?.def.id === "swarm" ? 2.6 : 1;
  if (g.mode.spawn <= 0) return;
  const cap = Math.min(MAX_ENEMIES + (eventMul > 1 ? 6 : 0), MAX_ENEMIES + g.tier) + g.mode.extraCap;
  const nonBoss = g.mobs.filter((m) => !m.boss).length;
  if (nonBoss >= cap) return;
  if (g.mobs.some((m) => m.boss)) return;
  const chance = (g.isNight ? 0.75 : 0.45) * eventMul * g.mode.spawn;
  if (Math.random() > chance) return;

  const p = g.player;
  const ptx = Math.floor((p.x + PLAYER_W / 2) / TILE);
  const pty = Math.floor((p.y + PLAYER_H / 2) / TILE);
  const layer = layerAt(g.world, pty, ptx);
  const rawBiome = biomeAt(g.world, ptx);
  const biome = biomeFamily(rawBiome);
  const maxTier = Math.min(8, 1 + g.tier + (layer === "deep" ? 2 : layer === "under" ? 1 : 0));

  const pool = ENEMIES.filter((e) => {
    if (e.tier > maxTier) return false;
    if (e.layer !== "any" && e.layer !== layer) return false;
    if (e.biomes.length && !e.biomes.includes(biome) && !e.biomes.includes(rawBiome)) return false;
    if (e.nightOnly && !g.isNight && layer === "surface") return false;
    return true;
  });
  if (!pool.length) return;
  const def = pool[Math.floor(Math.random() * pool.length)]!;

  const viewTiles = Math.ceil(g.viewW / (TILE * g.scale) / 2) + 3;
  for (let tries = 0; tries < 24; tries++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const tx = ptx + side * (viewTiles + Math.floor(Math.random() * 16));
    if (tx < 4 || tx > g.world.w - 5) continue;
    let ty: number;
    if (layer === "surface") {
      ty = (g.world.surface[tx] ?? 0) - 1;
      if (getTile(g.world, tx, ty) !== B.AIR) continue;
      const spot = groundSpot(g.world, tx, ty - 2, def.h, 10);
      if (spot === null) continue;
      const mob = makeMob(g, def, tx * TILE, spot);
      g.mobs.push(mob);
      return;
    }
    ty = pty + Math.floor((Math.random() - 0.5) * 24);
    if (ty < 5 || ty > g.world.h - 6) continue;
    if (getTile(g.world, tx, ty) !== B.AIR) continue;
    const spot = groundSpot(g.world, tx, ty, def.h, 14);
    if (spot === null) continue;
    const mob = makeMob(g, def, tx * TILE, spot);
    g.mobs.push(mob);
    return;
  }
}

/** Returns the boss the player is allowed to summon next (for progression hints). */
export function nextBoss(g: Game): BossDef | null {
  for (const b of BOSSES) if (!g.bossesDefeated.has(b.id)) return b;
  return null;
}
