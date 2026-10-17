import type { Game, Hud } from "../../game/engine";
import { itemIconUrl } from "../../game/assets";
import { Bar } from "./ui";

function clock(t: number): string {
  // 0..1000 cycle; day 0..600 maps 6:00 → 18:00, night 600..1000 maps 18:00 → 6:00
  const hours = t < 600 ? 6 + (t / 600) * 12 : 18 + ((t - 600) / 400) * 12;
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function HudView({
  hud,
  game,
  scale,
  desktop,
  onSkipTutorial,
  onBag,
  onCraft,
  onMenu,
}: {
  hud: Hud;
  game: Game;
  scale: number;
  desktop: boolean;
  onSkipTutorial: () => void;
  onBag: () => void;
  onCraft: () => void;
  onMenu: () => void;
}) {
  const vw = window.innerWidth;
  const ctrlW = Math.round(150 * scale) + Math.round(200 * scale);
  const wide = desktop || vw - ctrlW - 24 >= 10 * 34;
  const slot = desktop
    ? Math.max(30, Math.min(46, Math.floor((vw - 260) / 10.6)))
    : wide
      ? Math.max(28, Math.min(42, Math.floor((vw - ctrlW - 40) / 10.4)))
      : Math.round(Math.min(44, Math.max(30, (vw - 24) / 10.6)));
  const hotbarBottom = wide ? "calc(10px + env(safe-area-inset-bottom))" : `calc(${Math.round(160 * scale + 66)}px + env(safe-area-inset-bottom))`;
  const tipBottom = wide
    ? `calc(${slot + 36}px + env(safe-area-inset-bottom))`
    : `calc(${slot + 30 + Math.round(160 * scale + 66)}px + env(safe-area-inset-bottom))`;
  const mode = game.mode;
  return (
    <>
      {/* top-left: vitals */}
      <div
        style={{
          position: "absolute",
          top: "calc(8px + env(safe-area-inset-top))",
          left: 10,
          width: "min(210px, 42vw)",
          zIndex: 15,
          pointerEvents: "none",
          fontSize: 10,
        }}
      >
        <div style={{ marginBottom: 3, textShadow: "1px 1px 0 #000", display: "flex", gap: 5, alignItems: "center", whiteSpace: "nowrap", overflow: "hidden" }}>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{game.character.name}</span>
          <span className="pb-chip" style={{ color: mode.color }}>{mode.name}</span>
          {game.flying && <span className="pb-chip" style={{ color: "#5ec8ff" }}>Flying</span>}
        </div>
        <Bar value={hud.hp} max={hud.maxHp} color="#e0435f" height={14} label={`${hud.hp} / ${hud.maxHp}`} />
        {hud.breath < 9.9 && (
          <div style={{ marginTop: 3 }}>
            <Bar value={hud.breath} max={10} color="#5fb8ff" height={8} />
          </div>
        )}
        <div style={{ marginTop: 4, textShadow: "1px 1px 0 #000", lineHeight: 1.5 }}>
          DEF {hud.defense} · {hud.coins}c<br />
          {hud.biome} · {hud.depth > 0 ? `${hud.depth}m deep` : "surface"}
        </div>
        {hud.buffs.length > 0 && (
          <div style={{ marginTop: 3, display: "flex", gap: 4, flexWrap: "wrap" }}>
            {hud.buffs.map((b) => (
              <span key={b.name} style={{ border: `1px solid ${b.color}`, padding: "1px 4px", color: b.color, background: "rgba(0,0,0,0.5)" }}>
                {b.name} {Math.ceil(b.t)}s
              </span>
            ))}
          </div>
        )}
      </div>

      {/* top-right: clock */}
      <div
        style={{
          position: "absolute",
          top: "calc(10px + env(safe-area-inset-top))",
          right: desktop ? 92 : 52,
          zIndex: 15,
          pointerEvents: "none",
          textAlign: "right",
          fontSize: 10,
          textShadow: "1px 1px 0 #000",
          lineHeight: 1.5,
        }}
      >
        <span style={{ color: hud.isNight ? "#9fb4ff" : "#f0b64a" }}>{hud.isNight ? "☾" : "☀"} {clock(hud.time)}</span> · Day {hud.day}
        <br />
        <span style={{ opacity: 0.6 }}>{hud.fps} fps</span>
      </div>

      {/* boss bar */}
      {hud.bossName && (
        <div
          style={{
            position: "absolute",
            top: "calc(52px + env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            width: "min(420px, 70vw)",
            zIndex: 16,
            pointerEvents: "none",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 11, color: hud.bossColor, textShadow: "1px 1px 0 #000", letterSpacing: "0.12em" }}>
            {hud.bossName.toUpperCase()} <span style={{ opacity: 0.7 }}>— {hud.bossTitle}</span>
          </div>
          <Bar value={hud.bossHp} max={hud.bossMaxHp} color={hud.bossColor} height={12} label={`${Math.max(0, Math.round(hud.bossHp))}`} />
        </div>
      )}

      {/* event banner */}
      {hud.event && !hud.bossName && (
        <div
          style={{
            position: "absolute",
            top: "calc(54px + env(safe-area-inset-top))",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 16,
            pointerEvents: "none",
            fontSize: 10,
            textAlign: "center",
            color: hud.event.color,
            textShadow: "1px 1px 0 #000",
            background: "rgba(11,9,16,0.6)",
            border: `1px solid ${hud.event.color}`,
            padding: "3px 8px",
            maxWidth: "70vw",
          }}
        >
          <b>{hud.event.name.toUpperCase()}</b> · {Math.ceil(hud.event.t)}s
          <div style={{ opacity: 0.85 }}>{hud.event.desc}</div>
        </div>
      )}

      {/* toasts */}
      <div
        style={{
          position: "absolute",
          top: "calc(96px + env(safe-area-inset-top))",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 17,
          pointerEvents: "none",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 3,
          width: "80vw",
        }}
      >
        {hud.toasts.map((t, i) => (
          <div
            key={`${t.text}-${i}`}
            style={{
              fontSize: 11,
              color: t.color,
              background: "rgba(11,9,16,0.72)",
              padding: "3px 8px",
              border: "1px solid #3a3450",
              opacity: Math.min(1, t.t),
              textAlign: "center",
            }}
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* tutorial */}
      {hud.tutorial && (
        <div
          className="pb-panel"
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            bottom: tipBottom,
            zIndex: 18,
            fontSize: 11,
            padding: "6px 8px",
            display: "flex",
            gap: 8,
            alignItems: "center",
            width: "min(520px, 86vw)",
          }}
        >
          <span style={{ color: "#f0b64a" }}>TIP</span>
          <span>{hud.tutorial}</span>
          <button type="button" className="pb-btn" style={{ padding: "4px 8px", fontSize: 9 }} onClick={onSkipTutorial}>
            Skip
          </button>
        </div>
      )}

      {/* hotbar */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          bottom: hotbarBottom,
          zIndex: 19,
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: 10, textShadow: "1px 1px 0 #000", marginBottom: 3 }}>{hud.selName}</div>
        <div style={{ display: "flex", gap: 3, background: "rgba(11,9,16,0.55)", padding: 3, border: "2px solid #2c2740" }}>
          {hud.hotbar.map((s, i) => (
            <button
              key={i}
              type="button"
              className={`pb-slot${hud.sel === i ? " pb-slot-sel" : ""}`}
              style={{ width: slot, height: slot, aspectRatio: "auto" }}
              onPointerDown={(e) => {
                e.preventDefault();
                if (game.inv.sel === i && s) game.useItem();
                game.inv.sel = i;
                game.mining = null;
                game.sfx("ui");
                game.dirty();
              }}
            >
              {s && <img src={itemIconUrl(s.id)} alt="" draggable={false} />}
              {s && s.n > 1 && <span className="pb-slot-n">{s.n}</span>}
              {desktop && <span style={{ position: "absolute", left: 2, top: 1, fontSize: 8, opacity: 0.55, pointerEvents: "none" }}>{(i + 1) % 10}</span>}
            </button>
          ))}
          {desktop && (
            <div style={{ display: "flex", gap: 3, marginLeft: 4 }}>
              <button type="button" className="pb-btn" style={{ padding: "0 8px", height: slot, fontSize: 9 }} onClick={onBag} title="Bag (E)">
                Bag <span className="pb-kbd">E</span>
              </button>
              <button type="button" className="pb-btn" style={{ padding: "0 8px", height: slot, fontSize: 9 }} onClick={onCraft} title={mode.creative ? "Catalogue (C)" : "Craft (C)"}>
                {mode.creative ? "Items" : "Craft"} <span className="pb-kbd">C</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {desktop && (
        <button
          type="button"
          className="pb-btn"
          onClick={onMenu}
          title="Menu (Esc)"
          style={{ position: "absolute", top: "calc(8px + env(safe-area-inset-top))", right: 10, zIndex: 21, padding: "7px 10px" }}
        >
          = <span className="pb-kbd" style={{ marginLeft: 4 }}>Esc</span>
        </button>
      )}

      {/* mining progress */}
      {hud.mining > 0 && (
        <div
          style={{
            position: "absolute",
            left: "50%",
            transform: "translateX(-50%)",
            top: "58%",
            width: 80,
            zIndex: 14,
            pointerEvents: "none",
          }}
        >
          <Bar value={hud.mining} max={1} color="#f0b64a" height={7} />
        </div>
      )}
    </>
  );
}
