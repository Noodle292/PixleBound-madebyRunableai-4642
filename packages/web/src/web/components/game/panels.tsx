import { useState } from "react";
import type { Game } from "../../game/engine";
import { summonFor } from "../../game/engine";
import { BOSSES, NPCS } from "../../game/entities";
import { itemDef, ITEMS, RECIPES, type Recipe } from "../../game/items";
import { countInSlots, EQUIP_LABEL, EQUIP_SLOTS, HOTBAR, sortSlots, type Settings } from "../../game/state";
import { Row, Sheet, Slot, SlotGrid } from "./ui";

const STATION_NAME: Record<string, string> = {
  workbench: "Workbench",
  furnace: "Smeltpit",
  anvil: "Forging Anvil",
  alchemy: "Alchemy Table",
  arcane: "Arcane Forge",
};

function ItemInfo({ id }: { id: string }) {
  const d = itemDef(id);
  const bits: string[] = [];
  if (d.weapon) bits.push(`${d.weapon.damage} dmg · ${d.weapon.kind}`);
  if (d.tool) bits.push(`${d.tool.type} tier ${d.tool.tier} · power ${d.tool.power}`);
  if (d.armor) bits.push(`${d.armor.defense} def · ${d.armor.slot}`);
  if (d.potion?.heal) bits.push(`heals ${d.potion.heal}`);
  if (d.summon) bits.push("summons a boss");
  return (
    <div style={{ fontSize: 11, lineHeight: 1.45 }}>
      <div style={{ color: d.color, fontWeight: 700 }}>{d.name}</div>
      {bits.length > 0 && <div style={{ color: "#5fe0d6" }}>{bits.join(" · ")}</div>}
      <div style={{ opacity: 0.8 }}>{d.desc}</div>
    </div>
  );
}

/* ------------------------------ inventory ----------------------------- */

export function InventoryPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const [pick, setPick] = useState<number | null>(null);
  const inv = game.inv;
  const tap = (i: number) => {
    if (pick === null) {
      if (inv.slots[i]) setPick(i);
      else if (i < HOTBAR) inv.sel = i;
      game.dirty();
      return;
    }
    if (pick !== i) game.moveStack(pick, i, false, false);
    else if (i < HOTBAR) inv.sel = i;
    setPick(null);
    game.dirty();
  };
  const picked = pick !== null ? inv.slots[pick] : null;
  return (
    <Sheet
      title="Bag"
      wide
      onClose={onClose}
      footer={
        <Row>
          <button type="button" className="pb-btn" onClick={() => { sortSlots(inv.slots); setPick(null); game.dirty(); }}>
            Sort
          </button>
          <button type="button" className="pb-btn" disabled={!picked || !(itemDef(picked.id).armor || itemDef(picked.id).accessory)}
            onClick={() => { if (pick !== null) game.quickEquip(pick); setPick(null); }}>
            Equip
          </button>
          <button type="button" className="pb-btn" disabled={pick === null}
            onClick={() => { if (pick !== null) { if (pick < HOTBAR) inv.sel = pick; else game.moveStack(pick, inv.sel, false, false); game.dirty(); } setPick(null); }}>
            Hold
          </button>
          <button type="button" className="pb-btn pb-btn-danger" disabled={pick === null}
            onClick={() => { if (pick !== null) game.dropStack(pick, false); setPick(null); }}>
            Trash
          </button>
        </Row>
      }
    >
      <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>
        Tap an item, then tap another slot to move it. First ten slots are your hotbar.
      </div>
      <SlotGrid slots={inv.slots} cols={10} sel={pick ?? undefined} onSlot={tap} />
      <div style={{ minHeight: 48, margin: "8px 0" }}>{picked && <ItemInfo id={picked.id} />}</div>
      <div className="pb-h" style={{ margin: "6px 0" }}>Equipment</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
        {EQUIP_SLOTS.map((k) => (
          <div key={k} style={{ textAlign: "center" }}>
            <Slot stack={inv.equip[k]} onClick={() => game.unequip(k)} />
            <div style={{ fontSize: 8, opacity: 0.7, marginTop: 2 }}>{EQUIP_LABEL[k]}</div>
          </div>
        ))}
      </div>
      <Stats game={game} />
    </Sheet>
  );
}

function Stats({ game }: { game: Game }) {
  const s = game.stats();
  return (
    <div style={{ fontSize: 10, marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, opacity: 0.85 }}>
      <span>HP {Math.round(game.player.hp)}/{Math.round(s.maxHp)}</span>
      <span>DEF {Math.round(s.defense)}</span>
      <span>SPD {s.speed.toFixed(2)}x</span>
      <span>DMG {s.dmgMult.toFixed(2)}x</span>
      <span>MINE {s.mineSpeed.toFixed(2)}x</span>
      <span>BOSSES {game.bossesDefeated.size}/{BOSSES.length}</span>
    </div>
  );
}

/* ------------------------------- crafting ----------------------------- */

export function CraftPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const [onlyCan, setOnlyCan] = useState(false);
  const [sel, setSel] = useState<Recipe | null>(null);
  const st = game.station;
  const list = game.availableRecipes().filter((r) => !onlyCan || game.canCraft(r));
  const locked = [...new Set(RECIPES.map((r) => r.station).filter((s): s is string => !!s && !game.hasStation(s)))];
  return (
    <Sheet
      title={st ? `Craft · ${STATION_NAME[st] ?? st}` : "Craft · By hand"}
      wide
      onClose={onClose}
      footer={
        <Row>
          <button type="button" className="pb-btn" onClick={() => setOnlyCan(!onlyCan)}>
            {onlyCan ? "Show all" : "Craftable only"}
          </button>
          <button type="button" className="pb-btn pb-btn-primary" disabled={!sel || !game.canCraft(sel)}
            onClick={() => sel && game.craft(sel)}>
            Craft
          </button>
        </Row>
      }
    >
      <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>
        Stand near a station to unlock more recipes. Nearby stations: {locked.length ? `${locked.map((s) => STATION_NAME[s] ?? s).join(", ")} not in range` : "all"}.
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(46px, 1fr))", gap: 4 }}>
        {list.map((r) => {
          const can = game.canCraft(r);
          return (
            <div key={r.id} style={{ opacity: can ? 1 : 0.42 }}>
              <Slot stack={{ id: r.out.item, n: r.out.count }} selected={sel?.id === r.id} onClick={() => setSel(r)} />
            </div>
          );
        })}
      </div>
      {list.length === 0 && <div style={{ fontSize: 11, opacity: 0.7 }}>Nothing craftable yet — gather more materials.</div>}
      {sel && (
        <div className="pb-panel" style={{ marginTop: 10, padding: 8 }}>
          <ItemInfo id={sel.out.item} />
          <div style={{ marginTop: 6, display: "flex", flexWrap: "wrap", gap: 8 }}>
            {sel.ing.map((ing) => {
              const have = countInSlots(game.inv.slots, ing.item);
              return (
                <div key={ing.item} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                  <Slot stack={{ id: ing.item, n: 1 }} size={28} />
                  <span style={{ color: have >= ing.count ? "#68d05a" : "#e0435f" }}>
                    {itemDef(ing.item).name} {have}/{ing.count}
                  </span>
                </div>
              );
            })}
          </div>
          {sel.station && <div style={{ fontSize: 10, marginTop: 4, color: "#f0b64a" }}>Needs: {STATION_NAME[sel.station] ?? sel.station}</div>}
        </div>
      )}
    </Sheet>
  );
}

/* -------------------------------- chest ------------------------------- */

export function ChestPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const chest = game.chestSlots() ?? [];
  const take = (i: number) => {
    const s = chest[i];
    if (!s) return;
    const left = game.give(s.id, s.n);
    chest[i] = left > 0 ? { id: s.id, n: left } : null;
    game.syncChest();
    game.sfx("pickup");
    game.dirty();
  };
  const put = (i: number) => {
    const s = game.inv.slots[i];
    if (!s) return;
    const idx = chest.findIndex((c) => !c || (c.id === s.id && c.n < itemDef(s.id).stack));
    if (idx < 0) return;
    game.moveStack(i, idx, false, true);
  };
  return (
    <Sheet
      title="Strongbox"
      wide
      onClose={onClose}
      footer={
        <Row>
          <button type="button" className="pb-btn" onClick={() => game.quickStash()}>Stash materials</button>
          <button type="button" className="pb-btn pb-btn-primary" onClick={() => chest.forEach((_, i) => take(i))}>Take all</button>
        </Row>
      }
    >
      <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>Tap to take. Tap your items below to store.</div>
      <SlotGrid slots={chest} cols={10} onSlot={take} />
      <div className="pb-h" style={{ margin: "10px 0 6px" }}>Your bag</div>
      <SlotGrid slots={game.inv.slots} cols={10} onSlot={put} />
    </Sheet>
  );
}

/* --------------------------------- npc -------------------------------- */

export function NpcPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const npc = game.npcs.find((n) => n.id === game.npcTalking);
  if (!npc) return null;
  const d = npc.def;
  const coins = countInSlots(game.inv.slots, "coin");
  return (
    <Sheet title={`${d.name} · ${d.role}`} wide onClose={onClose}>
      <div className="pb-panel" style={{ padding: 8, fontSize: 11, marginBottom: 8 }}>“{game.npcLine}”</div>
      <Row>
        <button type="button" className={`pb-btn${tab === "buy" ? " pb-btn-primary" : ""}`} onClick={() => setTab("buy")}>Buy</button>
        <button type="button" className={`pb-btn${tab === "sell" ? " pb-btn-primary" : ""}`} onClick={() => setTab("sell")}>Sell</button>
        {d.heals && <button type="button" className="pb-btn" onClick={() => game.healPlayer()}>Heal me</button>}
        <span style={{ marginLeft: "auto", fontSize: 11, color: "#f0b64a" }}>{coins} coins</span>
      </Row>
      <div style={{ marginTop: 8 }}>
        {tab === "buy" ? (
          d.shop.length === 0 ? (
            <div style={{ fontSize: 11, opacity: 0.7 }}>Nothing for sale.</div>
          ) : (
            d.shop.map((s) => (
              <div key={s.item} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <Slot stack={{ id: s.item, n: 1 }} size={34} />
                <div style={{ flex: 1, fontSize: 11 }}>{itemDef(s.item).name}</div>
                <button type="button" className="pb-btn" disabled={coins < s.price} onClick={() => game.buyFrom(d.id, s.item, s.price)}>
                  {s.price}c
                </button>
              </div>
            ))
          )
        ) : (
          <>
            <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>Tap an item to sell one for half its value.</div>
            <SlotGrid slots={game.inv.slots} cols={10} onSlot={(i) => { if (game.inv.slots[i]?.id !== "coin") game.sellTo(i); }} />
          </>
        )}
      </div>
    </Sheet>
  );
}

/* ------------------------------ game menu ----------------------------- */

export function GameMenu({
  game,
  desktop,
  onClose,
  onSettings,
  onQuit,
}: {
  game: Game;
  desktop: boolean;
  onClose: () => void;
  onSettings: () => void;
  onQuit: () => void;
}) {
  const nb = BOSSES.find((b) => !game.bossesDefeated.has(b.id));
  return (
    <Sheet title="Paused" onClose={onClose}>
      <div style={{ display: "grid", gap: 8 }}>
        <button type="button" className="pb-btn pb-btn-primary" onClick={onClose}>Resume</button>
        <button type="button" className="pb-btn" onClick={() => game.save()}>Save game</button>
        <button type="button" className="pb-btn" onClick={onSettings}>Settings</button>
        <button type="button" className="pb-btn" onClick={() => { game.save(true); onQuit(); }}>Save &amp; quit to menu</button>
      </div>
      <div className="pb-h" style={{ margin: "14px 0 6px" }}>Progress</div>
      <div style={{ fontSize: 11, lineHeight: 1.6 }}>
        {game.character.name} · <span style={{ color: game.mode.color }}>{game.mode.name}</span> · deaths {game.player.deaths}<br />
        World “{game.info.name}” · Day {game.day} · Seed “{game.world.seedText}”<br />
        Bosses defeated: {game.bossesDefeated.size}/{BOSSES.length}<br />
        {nb ? <>Next boss: <b style={{ color: nb.color }}>{nb.name}</b> — craft {itemDef(summonFor(nb.id)).name} and USE it.</> : "Every guardian has fallen. The world is yours."}
      </div>
      {desktop && (
        <>
          <div className="pb-h" style={{ margin: "14px 0 6px" }}>Controls</div>
          <KeyList />
        </>
      )}
      <div className="pb-h" style={{ margin: "14px 0 6px" }}>Townsfolk</div>
      <div style={{ fontSize: 10, lineHeight: 1.6 }}>
        {NPCS.map((n) => {
          const here = game.npcs.some((x) => x.id === n.id && !x.temp);
          return (
            <div key={n.id}>
              <span style={{ color: here ? "#68d05a" : "#8a849c" }}>{here ? "●" : "○"}</span> {n.name} ({n.role}) — {here ? "moved in" : n.requirement}
            </div>
          );
        })}
        <div style={{ opacity: 0.7, marginTop: 4 }}>Houses need walls, a door, a torch, and a table/chair or station.</div>
      </div>
    </Sheet>
  );
}

/* ------------------------------- settings ----------------------------- */

export function SettingsPanel({
  settings,
  onChange,
  onClose,
}: {
  settings: Settings;
  onChange: (s: Settings) => void;
  onClose: () => void;
}) {
  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => onChange({ ...settings, [k]: v });
  const slider = (label: string, k: "master" | "music" | "sfx" | "controlScale", min: number, max: number) => (
    <label style={{ display: "block", fontSize: 11, marginBottom: 10 }}>
      {label} · {k === "controlScale" ? `${settings[k].toFixed(2)}x` : `${Math.round(settings[k] * 100)}%`}
      <input className="pb-range" type="range" min={min} max={max} step={0.05} value={settings[k]}
        onChange={(e) => set(k, Number(e.target.value))} />
    </label>
  );
  return (
    <Sheet title="Settings" onClose={onClose}>
      {slider("Master volume", "master", 0, 1)}
      {slider("Music", "music", 0, 1)}
      {slider("Effects", "sfx", 0, 1)}
      {slider("Control size", "controlScale", 0.7, 1.4)}
      <div style={{ fontSize: 11, marginBottom: 6 }}>Graphics</div>
      <Row>
        {(["low", "medium", "high"] as const).map((q) => (
          <button key={q} type="button" className={`pb-btn${settings.quality === q ? " pb-btn-primary" : ""}`} onClick={() => set("quality", q)}>
            {q}
          </button>
        ))}
      </Row>
      <div style={{ height: 10 }} />
      <Row>
        <button type="button" className={`pb-btn${settings.vibrate ? " pb-btn-primary" : ""}`} onClick={() => set("vibrate", !settings.vibrate)}>
          Vibration {settings.vibrate ? "on" : "off"}
        </button>
        <button type="button" className={`pb-btn${settings.lefty ? " pb-btn-primary" : ""}`} onClick={() => set("lefty", !settings.lefty)}>
          Swap sides
        </button>
      </Row>
      <div style={{ fontSize: 11, margin: "12px 0 6px" }}>Controls</div>
      <Row>
        {([["auto", "Auto"], ["touch", "Touch"], ["desktop", "Mouse + keys"]] as const).map(([k, label]) => (
          <button key={k} type="button" className={`pb-btn${settings.controls === k ? " pb-btn-primary" : ""}`} onClick={() => set("controls", k)}>
            {label}
          </button>
        ))}
      </Row>
      <div style={{ fontSize: 11, margin: "12px 0 6px" }}>Controls</div>
      <Row>
        {([["auto", "Auto"], ["desktop", "Mouse + keys"], ["touch", "Touch"]] as const).map(([k, label]) => (
          <button key={k} type="button" className={`pb-btn${settings.controls === k ? " pb-btn-primary" : ""}`} onClick={() => set("controls", k)}>
            {label}
          </button>
        ))}
      </Row>
    </Sheet>
  );
}

/* ------------------------- creative catalogue ------------------------- */

const CATALOG_TABS: { id: string; label: string; kinds: string[] }[] = [
  { id: "blocks", label: "Blocks", kinds: ["block", "furniture", "station"] },
  { id: "gear", label: "Gear", kinds: ["tool", "weapon", "armor", "accessory"] },
  { id: "items", label: "Items", kinds: ["material", "potion", "summon"] },
];

/** Creative mode replaces crafting: tap any item for a full stack. */
export function CatalogPanel({ game, onClose }: { game: Game; onClose: () => void }) {
  const [tab, setTab] = useState("blocks");
  const [q, setQ] = useState("");
  const kinds = CATALOG_TABS.find((t) => t.id === tab)?.kinds ?? [];
  const needle = q.trim().toLowerCase();
  const ids = Object.keys(ITEMS).filter((id) => {
    const d = itemDef(id);
    if (id === "coin" && !needle) return tab === "items";
    if (needle) return d.name.toLowerCase().includes(needle);
    return kinds.includes(d.kind);
  });
  return (
    <Sheet title="Creative catalogue" wide onClose={onClose}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {CATALOG_TABS.map((t) => (
          <button key={t.id} type="button" className={`pb-btn${tab === t.id && !needle ? " pb-btn-primary" : ""}`} onClick={() => { setTab(t.id); setQ(""); }}>
            {t.label}
          </button>
        ))}
        <input className="pb-input" placeholder="Search items" value={q} onChange={(e) => setQ(e.target.value.slice(0, 24))} style={{ flex: 1, minWidth: 120 }} />
      </div>
      <div style={{ fontSize: 10, opacity: 0.7, marginBottom: 6 }}>Tap an item to add a full stack. Blocks never run out while you build.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(40px, 1fr))", gap: 4 }}>
        {ids.map((id) => (
          <div key={id} title={itemDef(id).name}>
            <Slot
              stack={{ id, n: 1 }}
              onClick={() => {
                const d = itemDef(id);
                const left = game.give(id, d.stack);
                game.toast(left >= d.stack ? "Bag is full." : `+ ${d.name}`, left >= d.stack ? "#ff9a5c" : "#9ff0a0");
                game.sfx("pickup");
              }}
            />
          </div>
        ))}
      </div>
      {ids.length === 0 && <div style={{ fontSize: 11, opacity: 0.7 }}>Nothing matches “{q}”.</div>}
    </Sheet>
  );
}

export const DESKTOP_KEYS: [string, string][] = [
  ["A D / ← →", "Walk"],
  ["Space / W", "Jump · Creative: jump again in mid-air to fly, land to stop"],
  ["S / ↓", "Drop through platforms · fly down"],
  ["Left mouse", "Mine, build or attack at the cursor (hold)"],
  ["Right mouse", "Open chests, doors, stations, talk · place · use item"],
  ["Wheel / 1–0", "Choose hotbar slot"],
  ["E", "Bag"],
  ["C", "Craft (Creative: item catalogue)"],
  ["Q", "Use held item (potions, summons, armor)"],
  ["F", "Attack toward the cursor"],
  ["R", "Interact with the nearest thing"],
  ["Esc", "Close panel · pause menu"],
];

export function KeyList() {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 10px", fontSize: 10, lineHeight: 1.4 }}>
      {DESKTOP_KEYS.map(([k, v]) => (
        <div key={k} style={{ display: "contents" }}>
          <span className="pb-kbd" style={{ justifySelf: "start" }}>{k}</span>
          <span style={{ opacity: 0.85 }}>{v}</span>
        </div>
      ))}
    </div>
  );
}
