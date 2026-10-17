import { useEffect, useRef } from "react";
import type { Game } from "../../game/engine";
import { itemDef } from "../../game/items";
import { PLAYER_H, PLAYER_W } from "../../game/state";

/** Virtual joystick + action buttons. Writes straight into game.input. */
export function TouchControls({
  game,
  scale,
  lefty,
  onBag,
  onCraft,
  onMenu,
}: {
  game: Game;
  scale: number;
  lefty: boolean;
  onBag: () => void;
  onCraft: () => void;
  onMenu: () => void;
}) {
  const knob = useRef<HTMLDivElement | null>(null);
  const padRef = useRef<HTMLDivElement | null>(null);
  const active = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      game.input.moveX = 0;
      game.input.up = false;
      game.input.down = false;
    };
  }, [game]);

  const padSize = Math.round(132 * scale);
  const btn = Math.round(68 * scale);
  const small = Math.round(46 * scale);

  const setKnob = (dx: number, dy: number) => {
    if (knob.current) knob.current.style.transform = `translate(${dx}px, ${dy}px)`;
  };

  const handle = (e: React.PointerEvent) => {
    const pad = padRef.current;
    if (!pad) return;
    const r = pad.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = r.width / 2 - 6;
    const d = Math.hypot(dx, dy);
    if (d > max) {
      dx = (dx / d) * max;
      dy = (dy / d) * max;
    }
    setKnob(dx, dy);
    const nx = dx / max;
    const ny = dy / max;
    game.input.moveX = Math.abs(nx) < 0.18 ? 0 : Math.max(-1, Math.min(1, nx * 1.35));
    game.input.up = ny < -0.55;
    game.input.down = ny > 0.55;
  };

  const release = () => {
    active.current = null;
    setKnob(0, 0);
    game.input.moveX = 0;
    game.input.up = false;
    game.input.down = false;
  };

  const side = lefty ? { right: 14 } : { left: 14 };
  const other = lefty ? { left: 14 } : { right: 14 };

  return (
    <>
      {/* joystick */}
      <div
        ref={padRef}
        onPointerDown={(e) => {
          e.preventDefault();
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          active.current = e.pointerId;
          handle(e);
        }}
        onPointerMove={(e) => {
          if (active.current === e.pointerId) handle(e);
        }}
        onPointerUp={release}
        onPointerCancel={release}
        onPointerLeave={() => {
          if (active.current !== null) release();
        }}
        style={{
          position: "absolute",
          bottom: lefty ? "calc(66px + env(safe-area-inset-bottom))" : "calc(12px + env(safe-area-inset-bottom))",
          ...side,
          width: padSize,
          height: padSize,
          borderRadius: "50%",
          border: "2px solid rgba(232,226,210,0.28)",
          background: "rgba(11,9,16,0.34)",
          touchAction: "none",
          zIndex: 20,
        }}
      >
        <div
          ref={knob}
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: padSize * 0.42,
            height: padSize * 0.42,
            marginLeft: -padSize * 0.21,
            marginTop: -padSize * 0.21,
            borderRadius: "50%",
            background: "rgba(240,182,74,0.5)",
            border: "2px solid rgba(240,182,74,0.9)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* action buttons */}
      <div
        style={{
          position: "absolute",
          // right cluster sits above the platform badge in the bottom-right corner
          bottom: lefty ? "calc(12px + env(safe-area-inset-bottom))" : "calc(66px + env(safe-area-inset-bottom))",
          ...other,
          display: "flex",
          alignItems: "flex-end",
          gap: 8,
          flexDirection: lefty ? "row-reverse" : "row",
          zIndex: 20,
        }}
      >
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <RoundBtn
            size={small}
            label="BAG"
            color="#5fe0d6"
            onDown={() => {
              onBag();
            }}
          />
          <RoundBtn
            size={small}
            label="CRAFT"
            color="#b57bff"
            onDown={() => {
              onCraft();
            }}
          />
          <RoundBtn
            size={small}
            label={game.selected() && itemDef(game.selected()!.id).block !== undefined ? "BUILD" : "DIG"}
            color="#f0b64a"
            onDown={() => {
              const p = game.player;
              const held = game.selected();
              const building = held && itemDef(held.id).block !== undefined;
              game.input.aim = {
                x: p.x + PLAYER_W / 2 + p.facing * 32,
                y: p.y + PLAYER_H + (building ? -8 : 8),
              };
              game.input.aimEdge = true;
            }}
            onUp={() => { game.input.aim = null; game.input.aimEdge = false; }}
          />
          <RoundBtn size={small} label="ACT" color="#e8e2d2" onDown={() => game.interactNearby()} />
          <RoundBtn size={small} label="USE" color="#68d05a" onDown={() => game.useItem()} />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <RoundBtn
            size={btn}
            label="JUMP"
            color="#e8e2d2"
            onDown={() => {
              game.input.jumpEdge = true;
              game.input.jumpHeld = true;
            }}
            onUp={() => {
              game.input.jumpHeld = false;
            }}
          />
          <RoundBtn
            size={btn}
            label="ATK"
            color="#e0435f"
            onDown={() => {
              game.input.attackHeld = true;
            }}
            onUp={() => {
              game.input.attackHeld = false;
            }}
          />
        </div>
      </div>

      <button
        type="button"
        className="pb-btn"
        onClick={onMenu}
        style={{
          position: "absolute",
          top: "calc(8px + env(safe-area-inset-top))",
          right: 10,
          zIndex: 21,
          padding: "7px 10px",
        }}
      >
        =
      </button>
    </>
  );
}

function RoundBtn({
  size,
  label,
  color,
  onDown,
  onUp,
}: {
  size: number;
  label: string;
  color: string;
  onDown: () => void;
  onUp?: () => void;
}) {
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        onDown();
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        onUp?.();
      }}
      onPointerCancel={() => onUp?.()}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        border: `2px solid ${color}`,
        background: "rgba(11,9,16,0.5)",
        color,
        font: "inherit",
        fontSize: Math.max(9, Math.round(size * 0.17)),
        letterSpacing: "0.06em",
        fontWeight: 700,
        touchAction: "none",
        padding: 0,
      }}
    >
      {label}
    </button>
  );
}
