import { audio } from "./audio";
import { B, blockDef, isLeaf, isSolid, opaque } from "./blocks";
import {
  makeMob,
  nextBoss,
  playerAttack,
  spawnBoss,
  spawnLoop,
  spawnProjectile,
  updateMobs,
  updateProjectiles,
} from "./combat";
import type { BossDef, EventDef } from "./entities";
import { BOSSES, CHEST_TIERS, ENEMY_MAP, EVENTS, NPC_MAP, NPCS } from "./entities";
import { itemDef, ITEMS, RECIPES, type Recipe, type StatBonus } from "./items";
import { drawScene } from "./render";
import { aabb, groundSpot, liquidAt, moveBody, tileDamageAt } from "./physics";
import { randInt } from "./rng";
import type { CharacterSave, WorldSave } from "./save";
import { decodeTiles, encodeTiles, writeCharacter, writeWorld } from "./save";
import { bakeLook } from "./look";
import { modeDef, type ModeDef } from "./modes";
import {
  addToSlots,
  BASE_JUMP,
  BASE_SPEED,
  CHEST_SLOTS,
  countInSlots,
  CYCLE,
  DAY_LENGTH,
  emptyInventory,
  EQUIP_SLOTS,
  GRAVITY,
  HOTBAR,
  MAX_FALL,
  newPlayer,
  PLAYER_H,
  PLAYER_W,
  REACH,
  removeFromSlots,
  type ActiveEvent,
  type Drop,
  type House,
  type Inventory,
  type Mob,
  type Npc,
  type Panel,
  type Particle,
  type PlayerState,
  type Projectile,
  type Settings,
  type Stack,
  type Stats,
  type Toast,
} from "./state";
import { BIOME_LIST, BIOME_NAMES, generateWorld, getTile, layerAt, setTile, TILE, type World } from "./worldgen";
import { generateClassicWorld } from "./worldgen-classic";

export type WorldInfo = { id: string; name: string; creative: boolean; createdAt: number };

export type Input = {
  moveX: number;
  up: boolean;
  down: boolean;
  jumpHeld: boolean;
  jumpEdge: boolean;
  attackHeld: boolean;
  /** world-space point the player is holding (tile targeting), null when not touching */
  aim: { x: number; y: number } | null;
  aimEdge: boolean;
  /** desktop cursor in world space; ranged weapons aim here instead of auto-targeting */
  pointer: { x: number; y: number } | null;
};

export type Hud = {
  hp: number;
  maxHp: number;
  defense: number;
  sel: number;
  hotbar: Stack[];
  selName: string;
  time: number;
  day: number;
  isNight: boolean;
  bossName: string;
  bossHp: number;
  bossMaxHp: number;
  bossTitle: string;
  bossColor: string;
  toasts: Toast[];
  event: { name: string; desc: string; color: string; t: number } | null;
  buffs: { name: string; t: number; color: string }[];
  fps: number;
  depth: number;
  biome: string;
  breath: number;
  dead: boolean;
  tutorial: string | null;
  mining: number;
  version: number;
  nearStation: string | null;
  bosses: number;
  coins: number;
};

const TUTORIAL: { text: string; pc: string; done: (g: Game) => boolean }[] = [
  { text: "Drag the left pad to walk. Tap JUMP to hop.", pc: "Walk with A/D or arrows. Space jumps.", done: (g) => g.tut.moved && g.tut.jumped },
  { text: "Tap a nearby block to mine it. Hold to keep digging.", pc: "Hold left mouse on a nearby block to mine it.", done: (g) => g.tut.mined >= 6 },
  { text: "Walk over drops to collect them. Then open the BAG.", pc: "Walk over drops to collect them. Press E for your bag.", done: (g) => g.tut.opened },
  { text: "Craft a Workbench in CRAFT, then place it from the hotbar.", pc: "Press C to craft a Workbench, select it (1–0 or wheel) and place it.", done: (g) => g.tut.placedBench },
  { text: "Tap an empty spot with a block selected to build.", pc: "Right-click (or left-click) empty space with a block selected to build.", done: (g) => g.tut.placed >= 4 },
  { text: "Tap ATK to swing at monsters. Survive the night!", pc: "Click toward monsters with a weapon to attack. Survive the night!", done: (g) => g.tut.killed >= 1 },
  { text: "Dig deep for ore, craft better gear, then summon a boss.", pc: "Dig deep for ore, craft better gear, then summon a boss (Q uses items).", done: () => false },
];

export class Game {
  world: World;
  player: PlayerState;
  inv: Inventory = emptyInventory();
  mobs: Mob[] = [];
  projectiles: Projectile[] = [];
  particles: Particle[] = [];
  drops: Drop[] = [];
  npcs: Npc[] = [];
  houses: House[] = [];
  boss: Mob | null = null;

  camX = 0;
  camY = 0;
  scale = 3;
  viewW = 800;
  viewH = 400;
  dpr = 1;

  time = 60;
  day = 1;
  isNight = false;
  playtime = 0;
  tier = 0;
  bossesDefeated = new Set<string>();
  discovered = new Set<string>();

  event: ActiveEvent | null = null;
  eventCd = 120;
  spawnTimer = 2;
  ambientCd = 4;
  housingCd = 2;
  autosaveCd = 45;

  settings: Settings;
  panel: Panel = "none";
  chestKey = -1;
  npcTalking: string | null = null;
  npcLine = "";
  station: string | null = null;
  version = 0;

  mining: { tx: number; ty: number; p: number } | null = null;
  input: Input = {
    moveX: 0,
    up: false,
    down: false,
    jumpHeld: false,
    jumpEdge: false,
    attackHeld: false,
    aim: null,
    aimEdge: false,
    pointer: null,
  };

  toasts: Toast[] = [];
  tutorialStep = 0;
  tutorialDone = false;
  tut = {
    moved: false,
    jumped: false,
    mined: 0,
    opened: false,
    placed: 0,
    placedBench: false,
    killed: 0,
  };

  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private last = 0;
  private uidN = 1;
  private fpsAcc = 0;
  private fpsN = 0;
  fps = 60;
  onHud: (h: Hud) => void = () => {};
  light: Float32Array = new Float32Array(0);
  lightW = 0;
  lightH = 0;
  lightX0 = 0;
  lightY0 = 0;
  paused = false;

  info: WorldInfo;
  character: CharacterSave;
  mode: ModeDef;
  sprite: { right: HTMLCanvasElement; left: HTMLCanvasElement };
  worldPlaytime = 0;
  flying = false;
  /** mouse + keyboard layout active (set by the view) */
  desktop = false;
  /** desktop mouse state, written by the view */
  mouse = { screen: null as { x: number; y: number } | null, left: false, leftEdge: false, right: false };

  constructor(canvas: HTMLCanvasElement, world: World, settings: Settings, info: WorldInfo, character: CharacterSave) {
    this.canvas = canvas;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d unavailable");
    this.ctx = ctx;
    this.world = world;
    this.settings = settings;
    this.info = info;
    this.character = character;
    this.mode = modeDef(character.mode);
    this.sprite = bakeLook(character.look);
    this.player = newPlayer(world.spawnX * TILE, world.spawnY * TILE);
    this.resize();
  }

  uid() {
    return this.uidN++;
  }

  /* ------------------------------ setup ----------------------------- */

  giveStarterKit() {
    addToSlots(this.inv.slots, "wood_pick", 1);
    addToSlots(this.inv.slots, "wood_sword", 1);
    addToSlots(this.inv.slots, "torch", 12);
    addToSlots(this.inv.slots, "lesser_salve", 3);
    addToSlots(this.inv.slots, "wood", 30);
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(320, Math.round(rect.width));
    const h = Math.max(240, Math.round(rect.height));
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.dpr = dpr;
    this.viewW = w;
    this.viewH = h;
    const tilesAcross = w < 520 ? 24 : w < 900 ? 30 : 38;
    const byW = w / (tilesAcross * TILE);
    const byH = h / (17 * TILE);
    this.scale = Math.max(1.25, Math.round(Math.min(byW, byH) * 8) / 8);
  }

  start() {
    this.last = performance.now();
    const loop = (t: number) => {
      this.raf = requestAnimationFrame(loop);
      let dt = (t - this.last) / 1000;
      this.last = t;
      if (dt > 0.1) dt = 0.1;
      if (dt <= 0) return;
      this.fpsAcc += dt;
      this.fpsN++;
      if (this.fpsAcc > 0.5) {
        this.fps = Math.round(this.fpsN / this.fpsAcc);
        this.fpsAcc = 0;
        this.fpsN = 0;
      }
      if (!this.paused && (this.panel === "none" || this.player.dead)) this.update(dt);
      drawScene(this, this.ctx);
      this.pushHud();
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    audio.stopMusic();
  }

  sfx(name: string) {
    audio.sfx(name);
  }

  setMusic(t: "day" | "night" | "boss" | null) {
    audio.setTrack(t);
  }

  /* ------------------------------- hud ------------------------------ */

  pushHud() {
    const st = this.stats();
    const p = this.player;
    const hot = this.inv.slots.slice(0, HOTBAR);
    const sel = this.selected();
    const b = this.boss;
    const ground = this.world.ground[Math.floor((p.x + PLAYER_W / 2) / TILE)] ?? 116;
    const depth = Math.max(0, Math.round((p.y / TILE - ground) * 0.5));
    this.onHud({
      hp: Math.max(0, Math.round(p.hp)),
      maxHp: Math.round(st.maxHp),
      defense: Math.round(st.defense),
      sel: this.inv.sel,
      hotbar: hot,
      selName: sel ? itemDef(sel.id).name : "Fists",
      time: this.time,
      day: this.day,
      isNight: this.isNight,
      bossName: b?.name ?? "",
      bossHp: b?.hp ?? 0,
      bossMaxHp: b?.maxHp ?? 1,
      bossTitle: b?.bossDef?.title ?? "",
      bossColor: b?.bossDef?.color ?? "#fff",
      toasts: this.toasts,
      event: this.event
        ? { name: this.event.def.name, desc: this.event.def.desc, color: this.event.def.color, t: this.event.timer }
        : null,
      buffs: p.buffs.map((x) => ({ name: x.name, t: x.t, color: x.color })),
      fps: this.fps,
      depth,
      biome: this.biomeName(),
      breath: p.breath,
      dead: p.dead,
      tutorial: this.tutorialDone ? null : ((this.desktop ? TUTORIAL[this.tutorialStep]?.pc : TUTORIAL[this.tutorialStep]?.text) ?? null),
      mining: this.mining?.p ?? 0,
      version: this.version,
      nearStation: this.station,
      bosses: this.bossesDefeated.size,
      coins: countInSlots(this.inv.slots, "coin"),
    });
  }

  biomeName(): string {
    const tx = Math.floor((this.player.x + PLAYER_W / 2) / TILE);
    const i = this.world.biome[Math.max(0, Math.min(this.world.w - 1, tx))] ?? 0;
    return BIOME_NAMES[BIOME_LIST[i] ?? "forest"] ?? "Verdant Reach";
  }

  dirty() {
    this.version++;
  }

  toast(text: string, color = "#ffe6a7") {
    this.toasts.push({ text, t: 3.6, color });
    if (this.toasts.length > 4) this.toasts.shift();
  }

  /* ------------------------------ stats ----------------------------- */

  selected(): Stack {
    return this.inv.slots[this.inv.sel] ?? null;
  }

  stats(): Stats {
    const s: Stats = {
      defense: 0,
      speed: 1,
      jump: 1,
      maxHp: 100 + this.player.bonusHp,
      mineSpeed: 1,
      light: 0,
      dmgMult: 1,
      regen: 0,
      doubleJump: 0,
    };
    const apply = (bonus: Partial<StatBonus> | undefined) => {
      if (!bonus) return;
      for (const [k, v] of Object.entries(bonus)) {
        if (typeof v !== "number") continue;
        (s as unknown as Record<string, number>)[k] = ((s as unknown as Record<string, number>)[k] ?? 0) + v;
      }
    };
    for (const slot of EQUIP_SLOTS) {
      const st = this.inv.equip[slot];
      if (!st) continue;
      const d = itemDef(st.id);
      if (d.armor) {
        s.defense += d.armor.defense;
        apply(d.armor.bonus);
      }
      apply(d.accessory);
    }
    for (const b of this.player.buffs) {
      (s as unknown as Record<string, number>)[b.key] = ((s as unknown as Record<string, number>)[b.key] ?? 0) + b.amount;
    }
    s.maxHp = Math.max(20, s.maxHp);
    return s;
  }

  /* ------------------------------ update ---------------------------- */

  update(dt: number) {
    this.playtime += dt;
    this.worldPlaytime += dt;
    this.updateTime(dt);
    this.updatePlayer(dt);
    updateMobs(this, dt);
    updateProjectiles(this, dt);
    this.updateDrops(dt);
    this.updateNpcs(dt);
    this.updateParticles(dt);
    spawnLoop(this, dt);
    if (!this.mode.creative) this.updateEvents(dt);
    this.updateHousing(dt);
    this.updateAmbient(dt);
    this.updateCamera(dt);
    this.computeLight();
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i]!;
      t.t -= dt;
      if (t.t <= 0) this.toasts.splice(i, 1);
    }
    if (!this.tutorialDone) {
      const step = TUTORIAL[this.tutorialStep];
      if (step && step.done(this)) {
        this.tutorialStep++;
        this.sfx("ui");
        if (this.tutorialStep >= TUTORIAL.length - 1) this.tutorialStep = TUTORIAL.length - 1;
      }
    }
    this.autosaveCd -= dt;
    if (this.autosaveCd <= 0) {
      this.autosaveCd = 60;
      this.save(true);
    }
    if (this.boss && (this.boss.hp <= 0 || !this.mobs.includes(this.boss))) this.boss = null;
  }

  updateTime(dt: number) {
    this.time += dt;
    if (this.time >= CYCLE) {
      this.time -= CYCLE;
      this.day++;
      this.toast(`Day ${this.day}`, "#ffe6a7");
    }
    const night = this.time >= DAY_LENGTH;
    if (night !== this.isNight) {
      this.isNight = night;
      this.toast(night ? "Night falls. Monsters stir." : "The sun rises.", night ? "#8f7bd8" : "#ffd98a");
      if (!this.boss) this.setMusic(night ? "night" : "day");
    }
  }

  daylight(): number {
    const t = this.time;
    const dawn = 40;
    if (t < dawn) return t / dawn;
    if (t < DAY_LENGTH - dawn) return 1;
    if (t < DAY_LENGTH) return (DAY_LENGTH - t) / dawn;
    if (t < DAY_LENGTH + dawn) return 0;
    if (t < CYCLE - dawn) return 0;
    return (t - (CYCLE - dawn)) / dawn;
  }

  /* ------------------------------ player ---------------------------- */

  updatePlayer(dt: number) {
    const p = this.player;
    const st = this.stats();
    if (p.maxHp !== st.maxHp) p.maxHp = st.maxHp;

    for (let i = p.buffs.length - 1; i >= 0; i--) {
      const b = p.buffs[i]!;
      b.t -= dt;
      if (b.t <= 0) p.buffs.splice(i, 1);
    }

    if (p.dead) {
      p.respawn -= dt;
      if (this.panel !== "death") {
        this.panel = "death";
        this.dirty();
      }
      return;
    }

    if (p.iframe > 0) p.iframe -= dt;
    if (p.attackCd > 0) p.attackCd -= dt;
    if (p.useCd > 0) p.useCd -= dt;
    if (p.swing > 0) p.swing -= dt;

    const inWater = liquidAt(this.world, p.x + PLAYER_W / 2, p.y + 6) === B.WATER;
    const inLava = liquidAt(this.world, p.x + PLAYER_W / 2, p.y + 6) === B.LAVA;
    const submerged = liquidAt(this.world, p.x + PLAYER_W / 2, p.y + 2) === B.WATER;

    const speed = BASE_SPEED * st.speed * (inWater ? 0.62 : 1);
    const mx = this.input.moveX;
    if (Math.abs(mx) > 0.12) {
      p.vx += (mx * speed - p.vx) * dt * 12;
      p.facing = mx > 0 ? 1 : -1;
      this.tut.moved = true;
    } else {
      p.vx *= p.onGround ? 0.72 : 0.94;
      if (Math.abs(p.vx) < 3) p.vx = 0;
    }

    const jumpPower = BASE_JUMP * st.jump * (inWater ? 0.8 : 1);
    // Creative: jump in mid-air to take off; while flying, jump/up rises and landing ends flight
    if (this.mode.creative && this.input.jumpEdge && (this.flying || !p.onGround)) {
      this.flying = true;
      this.input.jumpEdge = false;
    }
    if (this.input.jumpEdge) {
      if (p.onGround) {
        p.vy = -jumpPower;
        p.airJumps = Math.round(st.doubleJump);
        this.sfx("ui");
        this.tut.jumped = true;
      } else if (inWater) {
        p.vy = -jumpPower * 0.6;
      } else if (p.airJumps > 0) {
        p.airJumps--;
        p.vy = -jumpPower * 0.92;
        this.fxBurst(p.x + PLAYER_W / 2, p.y + PLAYER_H, "#bfe8ff", 8, 90);
        this.sfx("ui");
      }
      this.input.jumpEdge = false;
    }
    if (!this.flying && !this.input.jumpHeld && p.vy < -80) p.vy += 900 * dt;

    if (this.flying && (p.onGround || !this.mode.creative)) this.flying = false;
    if (this.flying) {
      const target = this.input.jumpHeld || this.input.up ? -230 : this.input.down ? 260 : 0;
      p.vy += (target - p.vy) * Math.min(1, dt * 10);
    } else {
      const grav = inWater ? GRAVITY * 0.32 : GRAVITY;
      p.vy = Math.min(inWater ? 180 : MAX_FALL, p.vy + grav * dt);
    }
    if (this.input.down && p.onGround && !this.flying) {
      // drop through platforms
      const tx = Math.floor((p.x + PLAYER_W / 2) / TILE);
      const ty = Math.floor((p.y + PLAYER_H + 2) / TILE);
      if (blockDef(getTile(this.world, tx, ty)).platform) {
        p.y += 6;
        p.onGround = false;
      }
    }

    const prevVy = p.vy;
    const body = { x: p.x, y: p.y, vx: p.vx, vy: p.vy, w: PLAYER_W, h: PLAYER_H, onGround: p.onGround };
    moveBody(this.world, body, dt);
    p.x = body.x;
    p.y = body.y;
    p.vx = body.vx;
    p.vy = body.vy;
    p.onGround = body.onGround;
    if (p.onGround && prevVy > 620) {
      const dmg = Math.round((prevVy - 620) / 14);
      if (dmg > 0) this.hurtPlayer(dmg, 0, 0);
    }

    // environment damage
    if (inLava) {
      if (Math.random() < dt * 4) this.hurtPlayer(9, 0, 0);
    }
    const td = tileDamageAt(this.world, p.x, p.y, PLAYER_W, PLAYER_H);
    if (td > 0 && Math.random() < dt * 2.5) this.hurtPlayer(td * 0.5, 0, 0);

    // drowning
    if (submerged) {
      p.breath -= dt;
      if (p.breath <= 0) {
        p.breath = 0.8;
        this.hurtPlayer(8, 0, 0);
      }
    } else p.breath = Math.min(10, p.breath + dt * 3);

    // regen
    const st2 = st.regen;
    p.regenT += dt;
    if (p.regenT > 1) {
      p.regenT = 0;
      const passive = 0.35 * this.mode.regen + st2;
      if (p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + passive);
    }

    const mouseAttack = this.updateMouse();
    if (this.input.attackHeld || mouseAttack) playerAttack(this);

    this.updateAim(dt);
    this.updateStationNear();

    if (p.hp <= 0) this.killPlayer();
  }

  /** Desktop: left = mine / build / swing at the cursor, right (held) = keep placing. */
  updateMouse(): boolean {
    if (!this.desktop) {
      this.input.pointer = null;
      return false;
    }
    const m = this.mouse;
    this.input.pointer = m.screen ? this.screenToWorld(m.screen.x, m.screen.y) : null;
    const ptr = this.input.pointer;
    let attack = false;
    if ((m.left || m.leftEdge) && ptr) {
      const held = this.selected();
      const d = held ? itemDef(held.id) : null;
      if (d?.weapon) {
        attack = true;
        this.input.aim = null;
        this.input.aimEdge = false;
      } else {
        this.input.aim = { x: ptr.x, y: ptr.y };
        if (m.leftEdge) this.input.aimEdge = true;
        const t = getTile(this.world, Math.floor(ptr.x / TILE), Math.floor(ptr.y / TILE));
        if ((t === B.AIR || blockDef(t).liquid) && d?.block === undefined) attack = true;
      }
    } else if (m.right && ptr) {
      const held = this.selected();
      const tx = Math.floor(ptr.x / TILE), ty = Math.floor(ptr.y / TILE);
      const p = this.player;
      const dist = Math.hypot(ptr.x - (p.x + PLAYER_W / 2), ptr.y - (p.y + PLAYER_H / 2)) / TILE;
      if (held && itemDef(held.id).block !== undefined && dist <= REACH && getTile(this.world, tx, ty) === B.AIR) this.placeSelected(tx, ty);
      this.input.aim = null;
    } else {
      this.input.aim = null;
      this.input.aimEdge = false;
    }
    m.leftEdge = false;
    return attack;
  }

  /** Desktop right-click: use whatever is under the cursor, otherwise the held item. */
  secondaryAction() {
    const p = this.player;
    if (p.dead) return;
    const ptr = this.mouse.screen ? this.screenToWorld(this.mouse.screen.x, this.mouse.screen.y) : null;
    if (ptr) {
      const tx = Math.floor(ptr.x / TILE), ty = Math.floor(ptr.y / TILE);
      const tile = getTile(this.world, tx, ty);
      const tdef = blockDef(tile);
      const dist = Math.hypot(ptr.x - (p.x + PLAYER_W / 2), ptr.y - (p.y + PLAYER_H / 2)) / TILE;
      const npc = this.npcs.find((n) => aabb(ptr.x - 6, ptr.y - 6, 12, 12, n.x, n.y, 14, 20));
      if (dist <= REACH + 0.5 && (tdef.interact || tdef.station || npc)) {
        this.input.aim = ptr;
        this.input.aimEdge = true;
        this.updateAim(0);
        this.input.aim = null;
        this.input.aimEdge = false;
        return;
      }
      const held = this.selected();
      if (held && itemDef(held.id).block !== undefined) {
        if (dist <= REACH && tile === B.AIR) this.placeSelected(tx, ty);
        return;
      }
    }
    this.useItem();
  }

  updateStationNear() {
    const p = this.player;
    const cx = Math.floor((p.x + PLAYER_W / 2) / TILE);
    const cy = Math.floor((p.y + PLAYER_H / 2) / TILE);
    let found: string | null = null;
    for (let y = cy - 3; y <= cy + 3 && !found; y++) {
      for (let x = cx - 4; x <= cx + 4; x++) {
        const d = blockDef(getTile(this.world, x, y));
        if (d.station) {
          found = d.station;
          break;
        }
      }
    }
    if (found !== this.station) {
      this.station = found;
      this.dirty();
    }
  }

  /** Touch shortcut; tap the world for precise targeting. */
  interactNearby() {
    const p = this.player;
    const px = p.x + PLAYER_W / 2;
    const py = p.y + PLAYER_H / 2;
    const npc = this.npcs.find((n) => Math.hypot(n.x - px, n.y - py) < TILE * REACH);
    if (npc) { this.talkTo(npc); return; }
    const cx = Math.floor(px / TILE), cy = Math.floor(py / TILE);
    let best: { x: number; y: number; d: number } | null = null;
    for (let y = cy - 5; y <= cy + 5; y++) {
      for (let x = cx - 5; x <= cx + 5; x++) {
        const b = blockDef(getTile(this.world, x, y));
        if (!b.interact && !b.station) continue;
        const d = Math.hypot(x * TILE + 8 - px, y * TILE + 8 - py);
        if (d <= TILE * REACH && (!best || d < best.d)) best = { x, y, d };
      }
    }
    if (best) {
      this.input.aim = { x: best.x * TILE + 8, y: best.y * TILE + 8 };
      this.input.aimEdge = true;
      this.updateAim(0);
      this.input.aim = null;
    } else this.toast("No door, chest, station or townsfolk in reach.");
  }

  /* --------------------------- mine / place -------------------------- */

  updateAim(dt: number) {
    const aim = this.input.aim;
    if (!aim) {
      if (this.mining) {
        this.mining = null;
      }
      return;
    }
    const p = this.player;
    const px = p.x + PLAYER_W / 2;
    const py = p.y + PLAYER_H / 2;
    const tx = Math.floor(aim.x / TILE);
    const ty = Math.floor(aim.y / TILE);
    const d = Math.hypot(aim.x - px, aim.y - py) / TILE;
    const st = this.stats();
    const reach = REACH + (this.selected()?.id.endsWith("_pick") ? 0.8 : 0);
    if (d > reach) {
      this.mining = null;
      return;
    }
    const tile = getTile(this.world, tx, ty);
    const tdef = blockDef(tile);

    // interact first (single tap)
    if (this.input.aimEdge) {
      this.input.aimEdge = false;
      if (tdef.interact === "chest") {
        this.openChest(tx, ty);
        return;
      }
      if (tdef.interact === "door") {
        setTile(this.world, tx, ty, tile === B.DOOR ? B.DOOR_OPEN : B.DOOR);
        this.sfx("open");
        return;
      }
      if (tdef.station) {
        this.station = tdef.station;
        this.panel = "craft";
        this.sfx("open");
        this.dirty();
        return;
      }
      const npc = this.npcs.find((n) => aabb(aim.x - 6, aim.y - 6, 12, 12, n.x, n.y, 14, 20));
      if (npc) {
        this.talkTo(npc);
        return;
      }
      if (tile === B.AIR || tdef.liquid) {
        const hd0 = this.selected() ? itemDef(this.selected()!.id) : null;
        if (hd0?.weapon) {
          p.facing = aim.x >= px ? 1 : -1;
          playerAttack(this);
          return;
        }
        if (tile === B.AIR && this.placeSelected(tx, ty)) return;
      }
    }

    if (tile === B.AIR || tdef.liquid) {
      this.mining = null;
      // holding on empty space with a block selected keeps building
      const hb = this.selected();
      if (tile === B.AIR && hb && itemDef(hb.id).block !== undefined) this.placeSelected(tx, ty);
      return;
    }

    // mining
    const held = this.selected();
    const hd = held ? itemDef(held.id) : null;
    const tool = hd?.tool;
    let power = 0.45;
    let toolTier = 0;
    if (tool) {
      toolTier = tool.tier;
      power = tool.power;
      const woody = tdef.style === "wood" || tdef.style === "plank" || tdef.style === "leaves";
      if (tool.type === "axe") power *= woody ? 2.2 : 0.5;
      else power *= woody ? 0.8 : 1.15;
    }
    if (this.mode.creative) toolTier = 99;
    if (tdef.tier > toolTier) {
      if (this.mining?.tx !== tx || this.mining?.ty !== ty) {
        this.toast(`${tdef.name} needs a stronger pick.`, "#ff9a5c");
        this.mining = { tx, ty, p: 0 };
      }
      return;
    }
    if (!this.mining || this.mining.tx !== tx || this.mining.ty !== ty) this.mining = { tx, ty, p: 0 };
    const rate = this.mode.creative ? 9 : (power * st.mineSpeed) / Math.max(0.08, tdef.hardness) * 0.55;
    this.mining.p += rate * dt;
    if (Math.random() < dt * 9) {
      this.sfx("mine_tick");
      this.fxBurst(tx * TILE + 8, ty * TILE + 8, tdef.accent ?? tdef.color, 2, 60);
    }
    if (this.mining.p >= 1) {
      this.breakBlock(tx, ty);
      this.mining = null;
    }
  }

  breakBlock(tx: number, ty: number) {
    const tile = getTile(this.world, tx, ty);
    const tdef = blockDef(tile);
    if (tile === B.AIR) return;
    if (tile === B.TREE_TRUNK || tile === B.PALE_TREE_TRUNK) {
      this.chopTree(tx, ty);
      return;
    }
    if (tile === B.CHEST) {
      const key = ty * this.world.w + tx;
      const content = this.world.chests.get(key);
      if (content && content.length) {
        for (const c of content) this.dropItem(tx * TILE + 8, ty * TILE + 8, c.item, c.count);
      }
      this.world.chests.delete(key);
    }
    setTile(this.world, tx, ty, B.AIR);
    if (tdef.drop) this.dropItem(tx * TILE + 8, ty * TILE + 8, tdef.drop, 1);
    this.fxBurst(tx * TILE + 8, ty * TILE + 8, tdef.accent ?? tdef.color, 8, 130);
    this.sfx("mine_break");
    this.tut.mined++;
    // unsupported blocks above fall away (leaves/torch)
    const above = getTile(this.world, tx, ty - 1);
    const ad = blockDef(above);
    if (above !== B.AIR && !ad.solid && !ad.station && ad.drop && above !== B.WATER && above !== B.LAVA) {
      setTile(this.world, tx, ty - 1, B.AIR);
      this.dropItem(tx * TILE + 8, (ty - 1) * TILE + 8, ad.drop, 1);
    }
  }

  /** Fell only natural trunks. Player-built timber stays solid and is mined normally. */
  chopTree(tx: number, ty: number) {
    const trunk = getTile(this.world, tx, ty);
    if (trunk !== B.TREE_TRUNK && trunk !== B.PALE_TREE_TRUNK) return;
    let top = ty, bottom = ty;
    while (top > 0 && getTile(this.world, tx, top - 1) === trunk) top--;
    while (bottom < this.world.h - 1 && getTile(this.world, tx, bottom + 1) === trunk) bottom++;
    const wood = blockDef(trunk).drop!;
    const woodCount = bottom - top + 1;
    for (let y = top; y <= bottom; y++) {
      setTile(this.world, tx, y, B.AIR);
      this.fxBurst(tx * TILE + 8, y * TILE + 8, blockDef(trunk).color, 3, 95);
    }
    let seeds = 0;
    for (let y = Math.max(0, top - 7); y <= bottom + 1; y++) {
      for (let x = tx - 6; x <= tx + 6; x++) {
        if (!isLeaf(getTile(this.world, x, y))) continue;
        // Shared canopies may touch: keep foliage supported by a neighbouring tree.
        let supported = false;
        for (let sy = y - 1; sy <= y + 7 && !supported; sy++) {
          for (let sx = x - 4; sx <= x + 4; sx++) {
            const t = getTile(this.world, sx, sy);
            if (t === B.TREE_TRUNK || t === B.PALE_TREE_TRUNK) { supported = true; break; }
          }
        }
        if (supported) continue;
        setTile(this.world, x, y, B.AIR);
        seeds++;
        this.fxBurst(x * TILE + 8, y * TILE + 8, "#72b650", 1, 80);
      }
    }
    // Drop at the cut, not at the canopy, so all timber is immediately collectible.
    this.dropItem(tx * TILE + 8, ty * TILE + 8, wood, woodCount);
    if (seeds) this.dropItem(tx * TILE + 8, ty * TILE + 8, "seed", Math.max(1, Math.round(seeds / 5)));
    this.tut.mined += woodCount;
    this.sfx("mine_break");
    this.dirty();
  }

  placeSelected(tx: number, ty: number): boolean {
    const held = this.selected();
    if (!held) return false;
    const d = itemDef(held.id);
    if (d.block === undefined) {
      this.useItem();
      return false;
    }
    if (getTile(this.world, tx, ty) !== B.AIR) return false;
    const bdef = blockDef(d.block);
    // need a neighbour so blocks don't float
    const neighbour =
      getTile(this.world, tx + 1, ty) !== B.AIR ||
      getTile(this.world, tx - 1, ty) !== B.AIR ||
      getTile(this.world, tx, ty + 1) !== B.AIR ||
      getTile(this.world, tx, ty - 1) !== B.AIR;
    if (!neighbour) return false;
    if (bdef.solid) {
      const p = this.player;
      if (aabb(tx * TILE, ty * TILE, TILE, TILE, p.x, p.y, PLAYER_W, PLAYER_H)) return false;
      for (const n of this.npcs) if (aabb(tx * TILE, ty * TILE, TILE, TILE, n.x, n.y, 14, 20)) return false;
    }
    if (bdef.station || d.block === B.CHEST || d.block === B.DOOR) {
      // stations/doors need floor support
      if (!isSolid(getTile(this.world, tx, ty + 1)) && d.block !== B.DOOR) return false;
    }
    setTile(this.world, tx, ty, d.block);
    if (d.block === B.CHEST) this.world.chests.set(ty * this.world.w + tx, []);
    if (!this.mode.creative) removeFromSlots(this.inv.slots, held.id, 1);
    this.sfx("place");
    this.tut.placed++;
    if (bdef.station) this.tut.placedBench = true;
    this.dirty();
    return true;
  }

  useItem() {
    const p = this.player;
    if (p.useCd > 0) return;
    const held = this.selected();
    if (!held) return;
    const d = itemDef(held.id);
    if (d.potion) {
      const po = d.potion;
      if (po.heal) {
        if (p.hp >= p.maxHp) return;
        p.hp = Math.min(p.maxHp, p.hp + po.heal);
        this.fxText(p.x + PLAYER_W / 2, p.y - 8, `+${po.heal}`, "#6ee87b");
      }
      if (po.permanentHp) {
        p.bonusHp += po.permanentHp;
        this.toast(`Max health +${po.permanentHp}!`, "#ff6a8a");
        this.sfx("level");
      }
      if (po.buff && po.amount) {
        p.buffs = p.buffs.filter((b) => b.key !== po.buff);
        p.buffs.push({
          key: po.buff,
          amount: po.amount,
          t: po.duration ?? 60,
          name: d.name,
          color: d.color,
        });
      }
      if (!this.mode.creative) removeFromSlots(this.inv.slots, held.id, 1);
      p.useCd = 0.6;
      this.sfx("potion");
      this.dirty();
      return;
    }
    if (d.summon) {
      const bossDef = BOSSES.find((b) => b.id === d.summon);
      if (!bossDef) return;
      if (spawnBoss(this, d.summon)) {
        if (!this.mode.creative) removeFromSlots(this.inv.slots, held.id, 1);
        p.useCd = 1.5;
        this.dirty();
      }
      return;
    }
    if (d.armor || d.accessory) {
      this.quickEquip(this.inv.sel);
    }
  }

  /* ----------------------------- inventory --------------------------- */

  give(id: string, n: number): number {
    if (!ITEMS[id]) return n;
    const left = addToSlots(this.inv.slots, id, n);
    this.dirty();
    return left;
  }

  quickEquip(slotIndex: number) {
    const st = this.inv.slots[slotIndex];
    if (!st) return;
    const d = itemDef(st.id);
    let target: (typeof EQUIP_SLOTS)[number] | null = null;
    if (d.armor) target = d.armor.slot;
    else if (d.accessory) {
      target = (["acc1", "acc2", "acc3"] as const).find((s) => !this.inv.equip[s]) ?? "acc1";
    }
    if (!target) return;
    const prev = this.inv.equip[target];
    this.inv.equip[target] = { id: st.id, n: 1 };
    this.inv.slots[slotIndex] = prev ? { id: prev.id, n: prev.n } : null;
    this.sfx("ui");
    this.dirty();
  }

  unequip(slot: (typeof EQUIP_SLOTS)[number]) {
    const cur = this.inv.equip[slot];
    if (!cur) return;
    const left = addToSlots(this.inv.slots, cur.id, cur.n);
    if (left > 0) return;
    this.inv.equip[slot] = null;
    this.sfx("ui");
    this.dirty();
  }

  moveStack(from: number, to: number, fromChest: boolean, toChest: boolean) {
    const chest = this.chestSlots();
    const src = fromChest ? chest : this.inv.slots;
    const dst = toChest ? chest : this.inv.slots;
    if (!src || !dst) return;
    const a = src[from] ?? null;
    if (!a) return;
    const b = dst[to] ?? null;
    if (b && b.id === a.id) {
      const limit = itemDef(a.id).stack;
      const take = Math.min(limit - b.n, a.n);
      b.n += take;
      a.n -= take;
      if (a.n <= 0) src[from] = null;
    } else {
      dst[to] = a;
      src[from] = b;
    }
    if (fromChest || toChest) this.syncChest();
    this.sfx("ui");
    this.dirty();
  }

  dropStack(index: number, fromChest: boolean) {
    const src = fromChest ? this.chestSlots() : this.inv.slots;
    if (!src) return;
    const s = src[index];
    if (!s) return;
    src[index] = null;
    if (fromChest) this.syncChest();
    this.sfx("ui");
    this.dirty();
  }

  /* ------------------------------ chests ----------------------------- */

  chestCache: Stack[] | null = null;

  chestSlots(): Stack[] | null {
    return this.chestCache;
  }

  openChest(tx: number, ty: number) {
    const key = ty * this.world.w + tx;
    const content = this.world.chests.get(key) ?? [];
    const slots: Stack[] = Array.from({ length: CHEST_SLOTS }, () => null);
    content.forEach((c, i) => {
      if (i < CHEST_SLOTS) slots[i] = { id: c.item, n: c.count };
    });
    this.chestCache = slots;
    this.chestKey = key;
    this.panel = "chest";
    this.sfx("open");
    this.dirty();
  }

  syncChest() {
    if (this.chestKey < 0 || !this.chestCache) return;
    const content = this.chestCache
      .filter((s): s is { id: string; n: number } => !!s)
      .map((s) => ({ item: s.id, count: s.n }));
    this.world.chests.set(this.chestKey, content);
  }

  closeChest() {
    this.syncChest();
    this.chestKey = -1;
    this.chestCache = null;
    this.panel = "none";
    this.dirty();
  }

  quickStash() {
    const chest = this.chestCache;
    if (!chest) return;
    for (let i = 0; i < this.inv.slots.length; i++) {
      const s = this.inv.slots[i];
      if (!s) continue;
      const d = itemDef(s.id);
      if (d.kind !== "material" && d.kind !== "block") continue;
      const left = addToSlots(chest, s.id, s.n);
      if (left === 0) this.inv.slots[i] = null;
      else this.inv.slots[i] = { id: s.id, n: left };
    }
    this.syncChest();
    this.sfx("ui");
    this.dirty();
  }

  /* ----------------------------- crafting ---------------------------- */

  hasStation(station: string): boolean {
    const cx = Math.floor((this.player.x + PLAYER_W / 2) / TILE);
    const cy = Math.floor((this.player.y + PLAYER_H / 2) / TILE);
    for (let y = cy - 3; y <= cy + 3; y++)
      for (let x = cx - 4; x <= cx + 4; x++)
        if (blockDef(getTile(this.world, x, y)).station === station) return true;
    return false;
  }

  canCraft(r: Recipe): boolean {
    if (r.station && !this.hasStation(r.station)) return false;
    for (const ing of r.ing) if (countInSlots(this.inv.slots, ing.item) < ing.count) return false;
    return true;
  }

  craft(r: Recipe) {
    if (!this.canCraft(r)) return;
    for (const ing of r.ing) removeFromSlots(this.inv.slots, ing.item, ing.count);
    const left = addToSlots(this.inv.slots, r.out.item, r.out.count);
    if (left > 0) this.dropItem(this.player.x, this.player.y, r.out.item, left);
    this.sfx("craft");
    this.toast(`Crafted ${itemDef(r.out.item).name}`, "#9ff0a0");
    this.discovered.add(r.out.item);
    this.dirty();
  }

  availableRecipes(): Recipe[] {
    return RECIPES.filter((r) => !r.station || this.hasStation(r.station));
  }

  /* ------------------------------- drops ----------------------------- */

  dropItem(x: number, y: number, id: string, n: number) {
    if (!ITEMS[id] || n <= 0) return;
    const limit = itemDef(id).stack;
    let left = n;
    while (left > 0) {
      const take = Math.min(limit, left);
      left -= take;
      this.drops.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 60,
        vy: -80 - Math.random() * 60,
        id,
        n: take,
        life: 300,
        pick: 0.35,
      });
    }
    if (this.drops.length > 200) this.drops.splice(0, this.drops.length - 200);
  }

  updateDrops(dt: number) {
    const p = this.player;
    const px = p.x + PLAYER_W / 2;
    const py = p.y + PLAYER_H / 2;
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const d = this.drops[i]!;
      d.life -= dt;
      d.pick -= dt;
      if (d.life <= 0) {
        this.drops.splice(i, 1);
        continue;
      }
      d.vy = Math.min(MAX_FALL, d.vy + GRAVITY * 0.7 * dt);
      const body = { x: d.x, y: d.y, vx: d.vx, vy: d.vy, w: 8, h: 8, onGround: false };
      moveBody(this.world, body, dt);
      d.x = body.x;
      d.y = body.y;
      d.vx = body.onGround ? body.vx * 0.82 : body.vx;
      d.vy = body.vy;

      if (d.pick > 0 || p.dead) continue;
      const dist = Math.hypot(px - d.x, py - d.y);
      if (dist < 78) {
        // Pickups fly to the player once in range; attraction must overcome
        // gravity and must not get trapped against the lip of a mined hole.
        const k = Math.min(1, dt * 12);
        d.x += (px - d.x) * k;
        d.y += (py - d.y) * k;
        d.vx = 0;
        d.vy = 0;
      }
      if (dist < 18) {
        const left = addToSlots(this.inv.slots, d.id, d.n);
        if (left === 0) {
          this.sfx(d.id === "coin" ? "coin" : "pickup");
          this.drops.splice(i, 1);
          this.dirty();
        } else if (left < d.n) {
          d.n = left;
          this.dirty();
        }
      }
    }
  }

  /* ------------------------------- damage ---------------------------- */

  hurtPlayer(raw: number, dir: number, knockback: number) {
    const p = this.player;
    if (p.dead || p.iframe > 0 || this.mode.creative) return;
    const st = this.stats();
    const dmg = Math.max(1, Math.round(raw * this.mode.damageTaken - st.defense * 0.55));
    p.hp -= dmg;
    p.iframe = 0.7;
    p.vx += dir * knockback;
    if (knockback > 0) p.vy = Math.min(p.vy, -150);
    this.fxText(p.x + PLAYER_W / 2, p.y - 6, `${dmg}`, "#ff6b6b");
    this.sfx("hurt");
    if (this.settings.vibrate && navigator.vibrate) navigator.vibrate(30);
    if (p.hp <= 0) this.killPlayer();
  }

  killPlayer() {
    const p = this.player;
    if (p.dead) return;
    p.dead = true;
    p.hp = 0;
    p.deaths++;
    p.respawn = this.mode.respawnDelay;
    p.buffs = [];
    this.fxBurst(p.x + PLAYER_W / 2, p.y + PLAYER_H / 2, "#ff5c5c", 30, 220);
    this.sfx("death");
    this.input.attackHeld = false;
    this.input.aim = null;
    if (this.mode.permadeath) {
      // One life: the character is retired at once so quitting cannot undo it.
      this.character = { ...this.character, dead: true, diedIn: this.info.id };
      this.save(true);
    } else {
      // penalty depends on mode: drop a share of carried coins where you fell
      const coins = countInSlots(this.inv.slots, "coin");
      const lose = Math.floor(coins * this.mode.coinLoss);
      if (lose > 0) {
        removeFromSlots(this.inv.slots, "coin", lose);
        this.dropItem(p.x, p.y, "coin", lose);
      }
    }
    this.panel = "death";
    this.dirty();
  }

  respawn() {
    const p = this.player;
    if (this.character.dead) return;
    const spot = groundSpot(this.world, this.world.spawnX, Math.max(2, this.world.spawnY - 8), PLAYER_H, 80);
    p.x = this.world.spawnX * TILE;
    p.y = spot ?? this.world.spawnY * TILE;
    p.vx = 0;
    p.vy = 0;
    p.dead = false;
    p.hp = Math.max(30, Math.round(this.stats().maxHp * this.mode.respawnHp));
    p.iframe = 2;
    p.breath = 10;
    this.panel = "none";
    // bosses despawn when you die
    for (let i = this.mobs.length - 1; i >= 0; i--) if (this.mobs[i]!.boss) this.mobs.splice(i, 1);
    this.boss = null;
    this.setMusic(this.isNight ? "night" : "day");
    this.dirty();
  }

  onBossDefeated(def: BossDef) {
    this.bossesDefeated.add(def.id);
    this.tier = Math.max(this.tier, def.tier);
    this.boss = null;
    this.sfx("boss_die");
    this.toast(`${def.name} defeated!`, def.color);
    this.setMusic(this.isNight ? "night" : "day");
    this.tut.killed++;
    const nb = nextBoss(this);
    if (nb) this.toast(`Next: ${nb.name} — craft ${itemDef(summonFor(nb.id))?.name ?? "its summon"}`, "#ffe6a7");
    this.save(true);
    this.dirty();
  }

  /* -------------------------------- npcs ----------------------------- */

  updateNpcs(dt: number) {
    for (let i = this.npcs.length - 1; i >= 0; i--) {
      const n = this.npcs[i]!;
      n.anim += dt;
      if (n.temp) {
        n.life -= dt;
        if (n.life <= 0) {
          this.npcs.splice(i, 1);
          continue;
        }
      }
      n.idle -= dt;
      if (n.idle <= 0) {
        n.idle = 1.5 + Math.random() * 3;
        const home = n.homeX;
        const dx = home - n.x;
        n.vx = Math.abs(dx) > 90 ? Math.sign(dx) * 42 : (Math.random() - 0.5) * 60;
      }
      if (Math.abs(n.vx) > 2) n.facing = n.vx > 0 ? 1 : -1;
      n.vy = Math.min(MAX_FALL, n.vy + GRAVITY * dt);
      const body = { x: n.x, y: n.y, vx: n.vx, vy: n.vy, w: 14, h: 20, onGround: n.onGround };
      moveBody(this.world, body, dt);
      if (body.onGround && Math.abs(body.vx) < 2 && Math.abs(n.vx) > 2) n.vx = -n.vx;
      n.x = body.x;
      n.y = body.y;
      n.vy = body.vy;
      n.onGround = body.onGround;
      // nudge back home if they fall far away
      if (Math.abs(n.x - n.homeX) > 700) {
        n.x = n.homeX;
        n.y = n.homeY;
      }
    }
  }

  talkTo(n: Npc) {
    this.npcTalking = n.id;
    const lines = n.def.greeting;
    this.npcLine = lines[Math.floor(Math.random() * lines.length)] ?? "...";
    this.panel = "npc";
    this.sfx("open");
    this.dirty();
  }

  npcUnlocked(unlock: string): boolean {
    switch (unlock) {
      case "always":
        return true;
      case "coins50":
        return countInSlots(this.inv.slots, "coin") >= 50;
      case "ore_iron":
        return countInSlots(this.inv.slots, "iron_ore") + countInSlots(this.inv.slots, "iron_bar") >= 1;
      case "boss1":
        return this.bossesDefeated.size >= 1;
      case "boss2":
        return this.bossesDefeated.size >= 2;
      case "boss4":
        return this.bossesDefeated.size >= 4;
      default:
        return false;
    }
  }

  buyFrom(npcId: string, itemId: string, price: number) {
    if (countInSlots(this.inv.slots, "coin") < price) {
      this.toast("Not enough coins.", "#ff9a5c");
      return;
    }
    removeFromSlots(this.inv.slots, "coin", price);
    const left = addToSlots(this.inv.slots, itemId, 1);
    if (left > 0) this.dropItem(this.player.x, this.player.y, itemId, left);
    this.sfx("coin");
    this.toast(`Bought ${itemDef(itemId).name}`, "#9ff0a0");
    void npcId;
    this.dirty();
  }

  sellTo(index: number) {
    const s = this.inv.slots[index];
    if (!s) return;
    const d = itemDef(s.id);
    const value = Math.max(1, Math.round((d.value ?? 1) * 0.5));
    removeFromSlots(this.inv.slots, s.id, 1);
    addToSlots(this.inv.slots, "coin", value);
    this.sfx("coin");
    this.dirty();
  }

  healPlayer() {
    const p = this.player;
    p.hp = this.stats().maxHp;
    this.sfx("potion");
    this.toast("Fully healed.", "#6ee87b");
    this.dirty();
  }

  /* ------------------------------ housing ---------------------------- */

  updateHousing(dt: number) {
    this.housingCd -= dt;
    if (this.housingCd > 0) return;
    this.housingCd = 3;
    const homeless = NPCS.filter((n) => !this.npcs.some((x) => x.id === n.id) && this.npcUnlocked(n.unlock));
    if (!homeless.length) return;
    const house = this.findHouseNearPlayer();
    if (!house) return;
    if (this.houses.some((h) => Math.abs(h.x - house.x) < 4 && Math.abs(h.y - house.y) < 4 && h.owner)) return;
    const def = homeless[0]!;
    const spot = groundSpot(this.world, house.x, house.y, 20, 20) ?? house.y * TILE;
    this.npcs.push({
      id: def.id,
      def,
      x: house.x * TILE,
      y: spot,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      homeX: house.x * TILE,
      homeY: spot,
      idle: 1,
      temp: false,
      life: 0,
      anim: 0,
    });
    this.houses.push({ ...house, owner: def.id });
    this.toast(`${def.name} moved in! (${def.role})`, "#9fe0ff");
    this.sfx("level");
    this.dirty();
  }

  /** Flood fill from lit interiors near the player looking for a valid home. */
  findHouseNearPlayer(): House | null {
    const w = this.world;
    const px = Math.floor((this.player.x + PLAYER_W / 2) / TILE);
    const py = Math.floor((this.player.y + PLAYER_H / 2) / TILE);
    const seeds: [number, number][] = [];
    for (let y = py - 14; y <= py + 10; y++) {
      for (let x = px - 24; x <= px + 24; x++) {
        if (getTile(w, x, y) === B.TORCH) seeds.push([x, y]);
      }
    }
    for (const [sx, sy] of seeds) {
      const seen = new Set<number>();
      const stack: [number, number][] = [[sx, sy]];
      let ok = true;
      let hasDoor = false;
      let hasFurniture = false;
      let minX = sx;
      let maxX = sx;
      let minY = sy;
      let maxY = sy;
      while (stack.length) {
        const [x, y] = stack.pop()!;
        const key = y * w.w + x;
        if (seen.has(key)) continue;
        seen.add(key);
        if (seen.size > 400) {
          ok = false;
          break;
        }
        if (x < 1 || y < 1 || x >= w.w - 1 || y >= w.h - 1) {
          ok = false;
          break;
        }
        const t = getTile(w, x, y);
        const d = blockDef(t);
        if (t === B.DOOR || t === B.DOOR_OPEN) {
          hasDoor = true;
          continue;
        }
        if (d.solid) continue;
        if (t === B.TABLE || t === B.CHAIR || d.station) hasFurniture = true;
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      const area = seen.size;
      if (ok && hasDoor && hasFurniture && area >= 28 && maxY - minY >= 3 && maxX - minX >= 4) {
        return { x: Math.round((minX + maxX) / 2), y: minY, w: maxX - minX + 1, h: maxY - minY + 1, owner: null };
      }
    }
    return null;
  }

  /* ------------------------------- events ---------------------------- */

  updateEvents(dt: number) {
    if (this.event) {
      this.event.t += dt;
      this.event.timer -= dt;
      this.runEventTick(this.event.def, dt);
      if (this.event.timer <= 0) {
        this.toast(`${this.event.def.name} has passed.`, this.event.def.color);
        this.event = null;
      }
      return;
    }
    this.eventCd -= dt;
    if (this.eventCd > 0) return;
    this.eventCd = 150 + Math.random() * 180;
    const pool = EVENTS.filter((e) => {
      if ((e.minTier ?? 0) > this.tier) return false;
      if (e.night && !this.isNight) return false;
      if (e.day && this.isNight) return false;
      return true;
    });
    if (!pool.length) return;
    const def = pool[Math.floor(Math.random() * pool.length)]!;
    this.startEvent(def);
  }

  startEvent(def: EventDef) {
    this.event = { def, t: 0, timer: def.duration };
    this.toast(`${def.name}: ${def.desc}`, def.color);
    this.sfx("event");
    if (def.id === "trader") this.spawnTrader();
    if (def.id === "cache_bloom") this.spawnCaches();
  }

  runEventTick(def: EventDef, dt: number) {
    const p = this.player;
    switch (def.id) {
      case "starfall": {
        if (Math.random() < dt * 1.4) {
          const x = p.x + (Math.random() - 0.5) * 900;
          spawnProjectile(this, {
            x,
            y: Math.max(0, p.y - 520),
            vx: (Math.random() - 0.5) * 40,
            vy: 300,
            dmg: 18,
            friendly: false,
            spec: { speed: 18, gravity: 260, look: "star", size: 12, color: "#ffd76e", life: 8 },
            dropOnHit: "starstone_ore",
          });
        }
        break;
      }
      case "crystal_squall": {
        if (Math.random() < dt * 0.5) {
          const def2 = ENEMY_MAP["crystal_golem"];
          if (def2) {
            const tx = Math.floor((p.x + (Math.random() < 0.5 ? -1 : 1) * 380) / TILE);
            const spot = groundSpot(this.world, tx, Math.floor(p.y / TILE) - 6, def2.h, 24);
            if (spot !== null) this.mobs.push(makeMob(this, def2, tx * TILE, spot));
          }
        }
        if (this.settings.quality !== "low" && Math.random() < dt * 30) {
          this.particles.push({
            x: p.x + (Math.random() - 0.5) * this.viewW,
            y: p.y - 300 + Math.random() * 200,
            vx: -20,
            vy: 90,
            life: 4,
            max: 4,
            color: "#8ff0ea",
            size: 3,
            grav: 0,
          });
        }
        break;
      }
      case "migration": {
        if (Math.random() < dt * 0.35) {
          const def2 = ENEMY_MAP["frost_wisp"] ?? ENEMY_MAP["shade_bat"];
          if (def2) {
            const mob = makeMob(this, def2, p.x + (Math.random() < 0.5 ? -420 : 420), p.y - 120);
            mob.hp = Math.round(mob.hp * 1.6);
            mob.maxHp = mob.hp;
            this.mobs.push(mob);
          }
        }
        break;
      }
      default:
        break;
    }
  }

  spawnTrader() {
    const def = NPC_MAP["merchant"];
    if (!def) return;
    if (this.npcs.some((n) => n.temp)) return;
    const p = this.player;
    const tx = Math.floor(p.x / TILE) + 8;
    const spot = groundSpot(this.world, tx, Math.floor(p.y / TILE) - 6, 20, 30);
    if (spot === null) return;
    this.npcs.push({
      id: "trader_temp",
      def: { ...def, name: "Wandering Trader", greeting: ["Passing through. Buy something, quick."] },
      x: tx * TILE,
      y: spot,
      vx: 0,
      vy: 0,
      facing: 1,
      onGround: false,
      homeX: tx * TILE,
      homeY: spot,
      idle: 1,
      temp: true,
      life: 120,
      anim: 0,
    });
  }

  spawnCaches() {
    const p = this.player;
    const tier = Math.min(CHEST_TIERS.length - 1, Math.max(0, this.tier - 1));
    for (let k = 0; k < 3; k++) {
      const tx = Math.floor(p.x / TILE) + randInt(Math.random, -30, 30);
      const ty = (this.world.surface[Math.max(1, Math.min(this.world.w - 2, tx))] ?? 100) - 1;
      if (getTile(this.world, tx, ty) !== B.AIR) continue;
      setTile(this.world, tx, ty, B.CHEST);
      const t = CHEST_TIERS[tier]!;
      const content = t.entries
        .filter(() => Math.random() < 0.5)
        .map((e) => ({ item: e.item, count: randInt(Math.random, e.min, e.max) }))
        .filter((c) => c.count > 0);
      this.world.chests.set(ty * this.world.w + tx, content);
      this.fxBurst(tx * TILE + 8, ty * TILE + 8, "#7fbf4a", 14, 150);
    }
  }

  updateAmbient(dt: number) {
    this.ambientCd -= dt;
    if (this.ambientCd > 0) return;
    this.ambientCd = 6 + Math.random() * 10;
    const ty = Math.floor(this.player.y / TILE);
    const layer = layerAt(this.world, ty, Math.floor(this.player.x / TILE));
    if (layer === "surface") this.sfx("ambient_wind");
    else this.sfx("ambient_drip");
  }

  /* ----------------------------- particles --------------------------- */

  updateParticles(dt: number) {
    const cap = this.settings.quality === "low" ? 120 : this.settings.quality === "medium" ? 260 : 420;
    if (this.particles.length > cap) this.particles.splice(0, this.particles.length - cap);
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!;
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  fxBurst(x: number, y: number, color: string, n: number, spread: number) {
    if (this.settings.quality === "low") n = Math.ceil(n / 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = Math.random() * spread;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - 40,
        life: 0.3 + Math.random() * 0.5,
        max: 0.8,
        color,
        size: 2 + Math.random() * 2,
        grav: 420,
      });
    }
  }

  fxText(x: number, y: number, text: string, color: string, crit = false) {
    this.particles.push({
      x,
      y,
      vx: (Math.random() - 0.5) * 20,
      vy: -70,
      life: 0.85,
      max: 0.85,
      color,
      size: crit ? 12 : 9,
      grav: 90,
      text,
      crit,
    });
  }

  /* ------------------------------ camera ----------------------------- */

  updateCamera(dt: number) {
    const p = this.player;
    const tw = this.viewW / this.scale;
    const th = this.viewH / this.scale;
    const tx = p.x + PLAYER_W / 2 - tw / 2 + p.vx * 0.12;
    const ty = p.y + PLAYER_H / 2 - th / 2 + p.vy * 0.05;
    const k = 1 - Math.pow(0.0015, dt);
    this.camX += (tx - this.camX) * k;
    this.camY += (ty - this.camY) * k;
    this.camX = Math.max(0, Math.min(this.world.w * TILE - tw, this.camX));
    this.camY = Math.max(0, Math.min(this.world.h * TILE - th, this.camY));
  }

  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return { x: this.camX + sx / this.scale, y: this.camY + sy / this.scale };
  }

  /* ----------------------------- lighting ---------------------------- */

  computeLight() {
    const w = this.world;
    const tw = Math.ceil(this.viewW / this.scale / TILE) + 4;
    const th = Math.ceil(this.viewH / this.scale / TILE) + 4;
    const x0 = Math.floor(this.camX / TILE) - 2;
    const y0 = Math.floor(this.camY / TILE) - 2;
    if (this.lightW !== tw || this.lightH !== th) {
      this.light = new Float32Array(tw * th);
      this.lightW = tw;
      this.lightH = th;
    }
    this.lightX0 = x0;
    this.lightY0 = y0;
    const L = this.light;
    L.fill(0);
    const sun = this.daylight();
    const st = this.stats();
    const held = this.selected();
    const heldLight = held && itemDef(held.id).id === "torch" ? 0.4 : 0;
    const playerLight = Math.min(1, 0.42 + st.light + heldLight);

    for (let y = 0; y < th; y++) {
      const wy = y0 + y;
      for (let x = 0; x < tw; x++) {
        const wx = x0 + x;
        const i = y * tw + x;
        if (wx < 0 || wy < 0 || wx >= w.w || wy >= w.h) {
          L[i] = 0;
          continue;
        }
        const surf = w.surface[wx] ?? 0;
        const t = w.tiles[wy * w.w + wx] ?? 0;
        if (!opaque(t)) {
          // open sky: air above the main landmass is daylit, even when a
          // floating island or tree canopy sits overhead
          if (wy < Math.max(surf, w.ground[wx] ?? 0)) L[i] = sun;
        }
        const bl = blockDef(t).light ?? 0;
        if (bl > 0) L[i] = Math.max(L[i]!, bl);
      }
    }
    // player + mob glow
    const addPoint = (wx: number, wy: number, str: number, rad: number) => {
      const cx = Math.round(wx / TILE) - x0;
      const cy = Math.round(wy / TILE) - y0;
      for (let y = cy - rad; y <= cy + rad; y++) {
        if (y < 0 || y >= th) continue;
        for (let x = cx - rad; x <= cx + rad; x++) {
          if (x < 0 || x >= tw) continue;
          const d = Math.hypot(x - cx, y - cy);
          if (d > rad) continue;
          const i = y * tw + x;
          L[i] = Math.max(L[i]!, str * (1 - d / rad));
        }
      }
    };
    addPoint(this.player.x + PLAYER_W / 2, this.player.y + PLAYER_H / 2, playerLight, 6);
    for (const m of this.mobs) {
      if (m.boss) addPoint(m.x + m.w / 2, m.y + m.h / 2, 0.7, 8);
    }
    for (const pr of this.projectiles) addPoint(pr.x, pr.y, 0.45, 3);

    // propagate
    const decay = (t: number) => (opaque(t) ? 0.24 : 0.085);
    const tileAt = (wx: number, wy: number) =>
      wx < 0 || wy < 0 || wx >= w.w || wy >= w.h ? B.STONE : (w.tiles[wy * w.w + wx] ?? 0);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < th; y++) {
        for (let x = 0; x < tw; x++) {
          const i = y * tw + x;
          const d = decay(tileAt(x0 + x, y0 + y));
          let v = L[i]!;
          if (x > 0) v = Math.max(v, L[i - 1]! - d);
          if (y > 0) v = Math.max(v, L[i - tw]! - d);
          L[i] = v;
        }
      }
      for (let y = th - 1; y >= 0; y--) {
        for (let x = tw - 1; x >= 0; x--) {
          const i = y * tw + x;
          const d = decay(tileAt(x0 + x, y0 + y));
          let v = L[i]!;
          if (x < tw - 1) v = Math.max(v, L[i + 1]! - d);
          if (y < th - 1) v = Math.max(v, L[i + tw]! - d);
          L[i] = v;
        }
      }
    }
  }

  lightAt(tx: number, ty: number): number {
    const x = tx - this.lightX0;
    const y = ty - this.lightY0;
    if (x < 0 || y < 0 || x >= this.lightW || y >= this.lightH) return 0;
    return this.light[y * this.lightW + x] ?? 0;
  }

  /* ------------------------------- save ------------------------------ */

  toWorldSave(): WorldSave {
    this.syncChest();
    const now = Date.now();
    return {
      v: 2,
      id: this.info.id,
      name: this.info.name,
      seedText: this.world.seedText,
      size: this.world.size,
      creative: this.info.creative,
      generatorVersion: this.world.generatorVersion,
      day: this.day,
      bossCount: this.bossesDefeated.size,
      createdAt: this.info.createdAt,
      savedAt: now,
      w: this.world.w,
      h: this.world.h,
      tiles: encodeTiles(this.world.tiles),
      chests: [...this.world.chests.entries()],
      spawnX: this.world.spawnX,
      spawnY: this.world.spawnY,
      npcs: this.npcs
        .filter((n) => !n.temp)
        .map((n) => ({ id: n.id, x: n.x, y: n.y, homeX: n.homeX, homeY: n.homeY })),
      houses: this.houses,
      time: this.time,
      bosses: [...this.bossesDefeated],
      playtime: this.worldPlaytime,
    };
  }

  toCharacterSave(): CharacterSave {
    const c = this.character;
    const p = this.player;
    const positions = { ...c.positions };
    if (!p.dead) positions[this.info.id] = { x: p.x, y: p.y };
    return {
      ...c,
      savedAt: Date.now(),
      hp: p.dead ? (this.mode.permadeath ? 0 : Math.round(this.stats().maxHp * this.mode.respawnHp)) : p.hp,
      bonusHp: p.bonusHp,
      deaths: p.deaths,
      dead: c.dead,
      playtime: this.playtime,
      inv: {
        slots: this.inv.slots.map((s) => (s ? { id: s.id, n: s.n } : null)),
        equip: Object.fromEntries(EQUIP_SLOTS.map((k) => [k, this.inv.equip[k]])) as Record<string, Stack>,
        sel: this.inv.sel,
      },
      tutorial: this.tutorialDone || this.tutorialStep >= TUTORIAL.length - 1,
      discovered: [...this.discovered],
      positions,
      lastWorld: this.info.id,
    };
  }

  save(silent = false): boolean {
    const cres = writeCharacter(this.toCharacterSave());
    const wres = cres.ok ? writeWorld(this.toWorldSave()) : cres;
    if (wres.ok) {
      if (!silent) this.toast("Game saved.", "#9ff0a0");
    } else {
      this.toast(`Save failed: ${wres.error ?? "unknown"}`, "#ff6b6b");
    }
    return wres.ok;
  }

  static worldFromSave(data: WorldSave): World {
    const classic = (data.generatorVersion ?? 1) <= 2;
    const world = classic ? generateClassicWorld(data.seedText) : generateWorld(data.seedText, { size: data.size });
    world.chests = new Map(data.chests);
    if (data.w === world.w && data.h === world.h) {
      const tiles = decodeTiles(data.tiles, world.w * world.h);
      if ((data.generatorVersion ?? 1) < 2) {
        const legacy = generateClassicWorld(data.seedText, true);
        // Upgrade only untouched generated trees; never turn player timber builds into trees.
        for (let i = 0; i < tiles.length; i++) {
          const fresh = world.tiles[i];
          if ((fresh === B.TREE_TRUNK || fresh === B.PALE_TREE_TRUNK) && tiles[i] === legacy.tiles[i])
            tiles[i] = fresh;
        }
        // Remove untouched old surface barriers. Leave player-edited ruins/homes
        // and chests with changed contents alone, so upgrades cannot erase builds.
        for (const room of legacy.surfaceRuins) {
          const nearHome = (data.houses ?? []).some((home) =>
            Math.abs(home.x - (room.x + room.w / 2)) < home.w + room.w &&
            Math.abs(home.y - room.y) < home.h + room.h);
          if (nearHome) continue;
          let untouched = true;
          for (let y = room.y; y < room.y + room.h && untouched; y++) {
            for (let x = room.x; x < room.x + room.w; x++) {
              const key = y * world.w + x;
              if (tiles[key] !== legacy.tiles[key]) { untouched = false; break; }
              if (legacy.chests.has(key) && JSON.stringify(world.chests.get(key)) !== JSON.stringify(legacy.chests.get(key))) {
                untouched = false; break;
              }
            }
          }
          if (!untouched) continue;
          for (let y = room.y; y < room.y + room.h; y++) {
            for (let x = room.x; x < room.x + room.w; x++) {
              const key = y * world.w + x;
              tiles[key] = world.tiles[key]!;
              if (legacy.chests.has(key)) world.chests.delete(key);
            }
          }
        }
      }
      world.tiles.set(tiles);
      for (let x = 0; x < world.w; x++) {
        let y = 0;
        while (y < world.h - 1 && !opaque(world.tiles[y * world.w + x] ?? 0)) y++;
        world.surface[x] = y;
      }
    }
    world.spawnX = data.spawnX;
    world.spawnY = data.spawnY;
    return world;
  }

  applyWorld(data: WorldSave) {
    this.time = data.time;
    this.day = data.day;
    this.isNight = this.time >= DAY_LENGTH;
    this.worldPlaytime = data.playtime ?? 0;
    this.bossesDefeated = new Set(data.bosses ?? []);
    this.tier = 0;
    for (const id of this.bossesDefeated) {
      const b = BOSSES.find((x) => x.id === id);
      if (b) this.tier = Math.max(this.tier, b.tier);
    }
    this.houses = data.houses ?? [];
    this.npcs = (data.npcs ?? [])
      .map((n) => {
        const def = NPC_MAP[n.id];
        if (!def) return null;
        const npc: Npc = {
          id: n.id,
          def,
          x: n.x,
          y: n.y,
          vx: 0,
          vy: 0,
          facing: 1,
          onGround: false,
          homeX: n.homeX,
          homeY: n.homeY,
          idle: 1,
          temp: false,
          life: 0,
          anim: 0,
        };
        return npc;
      })
      .filter((n): n is Npc => !!n);
    this.dirty();
  }

  /** Character state; call after applyWorld so the stored position for this world wins. */
  applyCharacter(c: CharacterSave) {
    const p = this.player;
    p.bonusHp = c.bonusHp;
    p.deaths = c.deaths;
    this.playtime = c.playtime ?? 0;
    if (c.inv) {
      this.inv.slots = c.inv.slots.map((s) => (s && ITEMS[s.id] ? { id: s.id, n: s.n } : null));
      for (const k of EQUIP_SLOTS) {
        const v = c.inv.equip[k];
        this.inv.equip[k] = v && ITEMS[v.id] ? { id: v.id, n: v.n } : null;
      }
      this.inv.sel = c.inv.sel ?? 0;
    } else {
      this.giveStarterKit();
    }
    p.hp = Math.max(1, Math.min(c.hp || 100, this.stats().maxHp));
    this.discovered = new Set(c.discovered ?? []);
    if (c.tutorial || this.mode.creative) {
      this.tutorialDone = true;
      this.tutorialStep = TUTORIAL.length - 1;
    }
    const pos = c.positions[this.info.id];
    if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y)) {
      p.x = Math.max(0, Math.min(this.world.w * TILE - PLAYER_W, pos.x));
      p.y = Math.max(0, Math.min(this.world.h * TILE - PLAYER_H, pos.y));
    } else {
      const spot = groundSpot(this.world, this.world.spawnX, Math.max(2, this.world.spawnY - 8), PLAYER_H, 80);
      p.x = this.world.spawnX * TILE;
      p.y = spot ?? this.world.spawnY * TILE;
    }
    this.camX = p.x - this.viewW / this.scale / 2;
    this.camY = p.y - this.viewH / this.scale / 2;
    this.dirty();
  }

  skipTutorial() {
    this.tutorialDone = true;
    this.dirty();
  }
}

export function summonFor(bossId: string): string {
  const order = [
    "bramble_totem",
    "sunbaked_idol",
    "hive_pheromone",
    "frozen_horn",
    "spore_censer",
    "prism_lattice",
    "void_sigil",
    "aether_beacon",
  ];
  const i = BOSSES.findIndex((b) => b.id === bossId);
  return order[i] ?? "bramble_totem";
}
