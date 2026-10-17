import { useState } from "react";
import { audio } from "../../game/audio";
import {
  BOOT_COLORS,
  CLOTH_COLORS,
  EYE_COLORS,
  HAIR_COLORS,
  HAIR_STYLES,
  LOOK_PRESETS,
  SKIN_TONES,
  type Look,
} from "../../game/look";
import { MODE_ORDER, MODES, type GameMode } from "../../game/modes";
import { Sheet } from "../game/ui";
import { LookPreview } from "./backdrop";

const NAMES = ["Wren", "Ash", "Juniper", "Corvin", "Maple", "Rook", "Sable", "Fen", "Ivy", "Bram", "Lark", "Tamsin", "Orrin", "Kestrel"];

function Swatches({ colors, value, onPick, label }: { colors: string[]; value: string; onPick: (c: string) => void; label: string }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, opacity: 0.75, marginBottom: 5, letterSpacing: "0.08em" }}>{label}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={`${label} ${c}`}
            className={`pb-swatch${value.toLowerCase() === c.toLowerCase() ? " pb-swatch-sel" : ""}`}
            style={{ background: c }}
            onClick={() => {
              audio.sfx("ui");
              onPick(c);
            }}
          />
        ))}
      </div>
    </div>
  );
}

export function CharacterCreator({
  onCancel,
  onCreate,
}: {
  onCancel: () => void;
  onCreate: (name: string, mode: GameMode, look: Look) => void;
}) {
  const [name, setName] = useState(() => NAMES[Math.floor(Math.random() * NAMES.length)] as string);
  const [look, setLook] = useState<Look>(() => ({ ...(LOOK_PRESETS[0]?.look as Look) }));
  const [mode, setMode] = useState<GameMode>("classic");
  const [facing, setFacing] = useState<"right" | "left">("right");
  const m = MODES[mode];
  const set = <K extends keyof Look>(k: K, v: Look[K]) => setLook((l) => ({ ...l, [k]: v }));

  return (
    <Sheet
      title="New character"
      onClose={onCancel}
      wide
      avoidBadge
      footer={
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="pb-btn" onClick={onCancel}>Cancel</button>
          <button
            type="button"
            className="pb-btn pb-btn-primary"
            style={{ flex: 1 }}
            disabled={!name.trim()}
            onClick={() => onCreate(name, mode, look)}
          >
            Create {name.trim() || "character"} · {m.name}
          </button>
        </div>
      }
    >
      <div className="pb-creator">
        <div className="pb-creator-left">
          <button
            type="button"
            className="pb-creator-stage"
            title="Turn around"
            onClick={() => setFacing((f) => (f === "right" ? "left" : "right"))}
          >
            <LookPreview look={look} scale={7} facing={facing} />
          </button>
          <label style={{ fontSize: 10, opacity: 0.75, letterSpacing: "0.08em" }} htmlFor="pb-name">NAME</label>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              id="pb-name"
              className="pb-input"
              style={{ flex: 1 }}
              value={name}
              maxLength={18}
              onChange={(e) => setName(e.target.value.slice(0, 18))}
            />
            <button
              type="button"
              className="pb-btn"
              onClick={() => setName(NAMES[Math.floor(Math.random() * NAMES.length)] as string)}
            >
              Dice
            </button>
          </div>
          <div style={{ fontSize: 10, opacity: 0.75, letterSpacing: "0.08em", marginTop: 4 }}>PRESETS</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
            {LOOK_PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                className={`pb-card${JSON.stringify(p.look) === JSON.stringify(look) ? " pb-card-sel" : ""}`}
                style={{ flexDirection: "column", gap: 4, padding: "6px 4px" }}
                onClick={() => {
                  audio.sfx("ui");
                  setLook({ ...p.look });
                }}
              >
                <LookPreview look={p.look} scale={2} />
                <span style={{ fontSize: 9 }}>{p.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="pb-creator-right">
          <div style={{ fontSize: 10, opacity: 0.75, marginBottom: 5, letterSpacing: "0.08em" }}>HAIR STYLE</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {HAIR_STYLES.map((h) => (
              <button
                key={h.id}
                type="button"
                className={`pb-card${look.hairStyle === h.id ? " pb-card-sel" : ""}`}
                style={{ width: "auto", padding: "4px 6px", gap: 5 }}
                onClick={() => {
                  audio.sfx("ui");
                  set("hairStyle", h.id);
                }}
              >
                <LookPreview look={{ ...look, hairStyle: h.id }} scale={1.5} />
                <span style={{ fontSize: 9 }}>{h.name}</span>
              </button>
            ))}
          </div>
          <Swatches label="HAIR" colors={HAIR_COLORS} value={look.hair} onPick={(c) => set("hair", c)} />
          <Swatches label="SKIN" colors={SKIN_TONES} value={look.skin} onPick={(c) => set("skin", c)} />
          <Swatches label="EYES" colors={EYE_COLORS} value={look.eyes} onPick={(c) => set("eyes", c)} />
          <Swatches label="SHIRT" colors={CLOTH_COLORS} value={look.shirt} onPick={(c) => set("shirt", c)} />
          <Swatches label="PANTS" colors={CLOTH_COLORS} value={look.pants} onPick={(c) => set("pants", c)} />
          <Swatches label="BOOTS" colors={BOOT_COLORS} value={look.boots} onPick={(c) => set("boots", c)} />
        </div>
      </div>

      <div style={{ fontSize: 10, opacity: 0.75, letterSpacing: "0.08em", margin: "6px 0 5px" }}>
        DIFFICULTY · fixed once the character is made
      </div>
      <div className="pb-mode-grid">
        {MODE_ORDER.map((id) => {
          const d = MODES[id];
          return (
            <button
              key={id}
              type="button"
              className={`pb-card${mode === id ? " pb-card-sel" : ""}`}
              style={{ flexDirection: "column", alignItems: "flex-start", gap: 3, padding: "7px 8px", borderColor: mode === id ? d.color : undefined }}
              onClick={() => {
                audio.sfx("ui");
                setMode(id);
              }}
            >
              <span style={{ color: d.color, fontSize: 12 }}>{d.name}</span>
              <span style={{ fontSize: 9, opacity: 0.7 }}>{d.tag}</span>
            </button>
          );
        })}
      </div>
      <div className="pb-panel" style={{ marginTop: 8, padding: "8px 10px", borderColor: m.color, background: "#141120" }}>
        <div style={{ color: m.color, fontSize: 11, marginBottom: 4 }}>
          {m.name} rules{m.permadeath ? " · permadeath" : ""}
        </div>
        <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10, lineHeight: 1.6 }}>
          {m.rules.map((r) => (
            <li key={r}>{r}</li>
          ))}
          <li style={{ opacity: 0.75 }}>
            {m.creative ? "Plays only in Creative worlds" : "Plays in any Survival world"}
          </li>
        </ul>
      </div>
    </Sheet>
  );
}
