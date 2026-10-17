import { useState } from "react";
import { audio } from "../../game/audio";
import { MODES } from "../../game/modes";
import { MAX_CHARACTERS, MAX_WORLDS, type CharacterSave, type WorldMeta } from "../../game/save";
import { randomSeedText, WORLD_SIZES, type WorldSize } from "../../game/worldgen";
import { Sheet } from "../game/ui";
import { LookPreview } from "./backdrop";

export function fmtTime(sec: number): string {
  const m = Math.floor((sec || 0) / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

function ModeChip({ mode }: { mode: CharacterSave["mode"] }) {
  const d = MODES[mode];
  return (
    <span className="pb-chip" style={{ color: d.color }}>
      {d.name}
    </span>
  );
}

function Shell({
  title,
  sub,
  onBack,
  children,
}: {
  title: string;
  sub?: React.ReactNode;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="pb-lib pb-fade">
      <div className="pb-lib-head">
        <button type="button" className="pb-btn" onClick={onBack}>
          Back
        </button>
        <div style={{ minWidth: 0 }}>
          <div className="pb-h" style={{ fontSize: 15 }}>{title}</div>
          {sub && <div style={{ fontSize: 10, opacity: 0.75, marginTop: 3 }}>{sub}</div>}
        </div>
      </div>
      <div className="pb-scroll pb-lib-body">{children}</div>
    </div>
  );
}

export function Confirm({
  title,
  text,
  action,
  onCancel,
  onConfirm,
}: {
  title: string;
  text: string;
  action: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Sheet title={title} onClose={onCancel}>
      <div style={{ fontSize: 11, lineHeight: 1.6, marginBottom: 12 }}>{text}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="pb-btn" onClick={onCancel}>Cancel</button>
        <button type="button" className="pb-btn pb-btn-danger" onClick={onConfirm}>{action}</button>
      </div>
    </Sheet>
  );
}

export function CharacterList({
  characters,
  worlds,
  onBack,
  onPick,
  onNew,
  onDelete,
}: {
  characters: CharacterSave[];
  worlds: WorldMeta[];
  onBack: () => void;
  onPick: (c: CharacterSave) => void;
  onNew: () => void;
  onDelete: (c: CharacterSave) => void;
}) {
  const [del, setDel] = useState<CharacterSave | null>(null);
  const worldName = (id: string | null) => (id ? worlds.find((w) => w.id === id)?.name : undefined);
  const full = characters.length >= MAX_CHARACTERS;
  return (
    <Shell title="Characters" sub={`${characters.length}/${MAX_CHARACTERS} slots · any character can visit any matching world`} onBack={onBack}>
      <div className="pb-lib-grid">
        {characters.map((c) => {
          const last = worldName(c.lastWorld);
          return (
            <div key={c.id} className="pb-lib-row">
              <button
                type="button"
                className="pb-card"
                disabled={c.dead}
                onClick={() => {
                  audio.sfx("ui");
                  onPick(c);
                }}
              >
                <div style={{ filter: c.dead ? "grayscale(1)" : undefined }}>
                  <LookPreview look={c.look} scale={3} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13 }}>{c.name}</span>
                    <ModeChip mode={c.mode} />
                  </div>
                  <div style={{ fontSize: 9, opacity: 0.7, marginTop: 4, lineHeight: 1.5 }}>
                    {c.dead
                      ? `Fallen forever${worldName(c.diedIn) ? ` in ${worldName(c.diedIn)}` : ""} · kept as a memorial`
                      : `${fmtTime(c.playtime)} played · ${c.deaths} death${c.deaths === 1 ? "" : "s"}${last ? ` · last in ${last}` : ""}`}
                  </div>
                </div>
              </button>
              <button
                type="button"
                className="pb-btn pb-lib-x"
                aria-label={`Delete ${c.name}`}
                onClick={() => setDel(c)}
              >
                X
              </button>
            </div>
          );
        })}
        <button type="button" className="pb-card pb-card-empty" disabled={full} onClick={onNew}>
          {full ? "All 6 slots used — delete a character to make room" : "+ Create character"}
        </button>
      </div>
      {del && (
        <Confirm
          title={`Delete ${del.name}?`}
          text="Their inventory, gear and progress are erased. Worlds they visited are kept."
          action="Delete"
          onCancel={() => setDel(null)}
          onConfirm={() => {
            onDelete(del);
            setDel(null);
          }}
        />
      )}
    </Shell>
  );
}

export function WorldList({
  character,
  worlds,
  onBack,
  onPick,
  onNew,
  onDelete,
}: {
  character: CharacterSave;
  worlds: WorldMeta[];
  onBack: () => void;
  onPick: (w: WorldMeta) => void;
  onNew: () => void;
  onDelete: (w: WorldMeta) => void;
}) {
  const [del, setDel] = useState<WorldMeta | null>(null);
  const creative = character.mode === "creative";
  const sorted = [...worlds].sort((a, b) => Number(b.creative === creative) - Number(a.creative === creative) || b.savedAt - a.savedAt);
  const full = worlds.length >= MAX_WORLDS;
  return (
    <Shell
      title={`Worlds · ${character.name}`}
      sub={
        <>
          <ModeChip mode={character.mode} /> {worlds.length}/{MAX_WORLDS} slots ·{" "}
          {creative ? "Creative characters play in Creative worlds" : "Survival characters play in Survival worlds"}
        </>
      }
      onBack={onBack}
    >
      <div className="pb-lib-grid">
        {sorted.map((w) => {
          const ok = w.creative === creative;
          const here = !!character.positions[w.id];
          return (
            <div key={w.id} className="pb-lib-row">
              <button
                type="button"
                className="pb-card"
                disabled={!ok}
                onClick={() => {
                  audio.sfx("ui");
                  onPick(w);
                }}
              >
                <div className="pb-world-ico" style={{ background: w.creative ? "#3c2d5c" : "#2c4a2a" }}>
                  {w.creative ? "C" : w.size[0]?.toUpperCase()}
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13 }}>{w.name}</span>
                    <span className="pb-chip" style={{ color: w.creative ? "#b57bff" : "#68d05a" }}>
                      {w.creative ? "Creative" : "Survival"}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, opacity: 0.7, marginTop: 4, lineHeight: 1.5 }}>
                    {ok
                      ? `${WORLD_SIZES[w.size]?.label ?? "Medium"} · seed “${w.seedText}” · day ${w.day} · ${w.bossCount}/8 bosses${here ? " · visited" : ""}`
                      : w.creative
                        ? "Creative world — only Creative characters can enter"
                        : "Survival world — Creative characters can't enter (keeps creative items out)"}
                  </div>
                </div>
              </button>
              <button type="button" className="pb-btn pb-lib-x" aria-label={`Delete ${w.name}`} onClick={() => setDel(w)}>
                X
              </button>
            </div>
          );
        })}
        <button type="button" className="pb-card pb-card-empty" disabled={full} onClick={onNew}>
          {full ? "All 6 slots used — delete a world to make room" : `+ New ${creative ? "Creative" : "Survival"} world`}
        </button>
      </div>
      {del && (
        <Confirm
          title={`Delete ${del.name}?`}
          text="The world, its builds, chests and townsfolk are erased for every character. Characters keep their inventories."
          action="Delete world"
          onCancel={() => setDel(null)}
          onConfirm={() => {
            onDelete(del);
            setDel(null);
          }}
        />
      )}
    </Shell>
  );
}

export function NewWorldDialog({
  creative,
  onCancel,
  onCreate,
}: {
  creative: boolean;
  onCancel: () => void;
  onCreate: (name: string, seed: string, size: WorldSize) => void;
}) {
  const [seed, setSeed] = useState(() => randomSeedText());
  const [name, setName] = useState("");
  const [size, setSize] = useState<WorldSize>("medium");
  const finalName = name.trim() || seed.trim() || "New world";
  return (
    <Sheet title={`New ${creative ? "Creative" : "Survival"} world`} onClose={onCancel} avoidBadge>
      <label style={{ fontSize: 10, display: "block", marginBottom: 5, opacity: 0.8 }} htmlFor="pb-wname">NAME</label>
      <input
        id="pb-wname"
        className="pb-input"
        style={{ width: "100%", marginBottom: 10 }}
        placeholder={seed || "New world"}
        value={name}
        maxLength={24}
        onChange={(e) => setName(e.target.value.slice(0, 24))}
      />
      <label style={{ fontSize: 10, display: "block", marginBottom: 5, opacity: 0.8 }} htmlFor="pb-seed">
        SEED — same seed, same world
      </label>
      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <input id="pb-seed" className="pb-input" style={{ flex: 1 }} value={seed} onChange={(e) => setSeed(e.target.value.slice(0, 32))} />
        <button type="button" className="pb-btn" onClick={() => setSeed(randomSeedText())}>Dice</button>
      </div>
      <div style={{ fontSize: 10, marginBottom: 5, opacity: 0.8 }}>SIZE</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginBottom: 10 }}>
        {(Object.keys(WORLD_SIZES) as WorldSize[]).map((k) => (
          <button
            key={k}
            type="button"
            className={`pb-card${size === k ? " pb-card-sel" : ""}`}
            style={{ flexDirection: "column", alignItems: "flex-start", gap: 3, padding: "6px 8px" }}
            onClick={() => setSize(k)}
          >
            <span style={{ fontSize: 12 }}>{WORLD_SIZES[k].label}</span>
            <span style={{ fontSize: 9, opacity: 0.7 }}>{WORLD_SIZES[k].desc}</span>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10, opacity: 0.7, lineHeight: 1.5, marginBottom: 10 }}>
        {creative
          ? "Creative world: only Creative characters can enter, so catalogue items never reach survival play."
          : "Survival world: Journey, Classic, Extreme, Hardcore and Death characters can all share it."}
      </div>
      <button
        type="button"
        className="pb-btn pb-btn-primary"
        style={{ width: "100%" }}
        onClick={() => onCreate(finalName, seed.trim() || randomSeedText(), size)}
      >
        Generate “{finalName}”
      </button>
    </Sheet>
  );
}
