import type { Game } from "../../game/engine";

export function DeathScreen({ game, onQuit }: { game: Game; onQuit: () => void }) {
  const p = game.player;
  const mode = game.mode;
  const ready = p.respawn <= 0;
  const permanent = game.character.dead;
  const penalty =
    mode.coinLoss >= 1
      ? "All your coins were dropped where you fell."
      : mode.coinLoss > 0
        ? "Half your coins were dropped where you fell."
        : "You keep all your coins.";
  return (
    <div
      className="pb-fade"
      style={{
        position: "absolute",
        inset: 0,
        background: permanent ? "rgba(12,2,16,0.82)" : "rgba(40,4,12,0.6)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 14,
        zIndex: 45,
        textAlign: "center",
        padding: 20,
      }}
    >
      <div className="pb-title" style={{ color: permanent ? mode.color : "#e0435f", fontSize: "clamp(26px, 8vw, 48px)" }}>
        {permanent ? "FALLEN FOREVER" : "YOU FELL"}
      </div>
      {permanent ? (
        <div style={{ fontSize: 11, opacity: 0.9, maxWidth: 340, lineHeight: 1.6 }}>
          {game.character.name} played on {mode.name} and had one life. The character is retired and stays in your
          list as a memorial. Your world “{game.info.name}” and everything built in it are kept.
        </div>
      ) : (
        <div style={{ fontSize: 11, opacity: 0.85, maxWidth: 300 }}>
          {penalty} Your world, items and progress are safe.
        </div>
      )}
      {permanent ? (
        <button type="button" className="pb-btn pb-btn-primary" onClick={onQuit} style={{ minWidth: 180 }}>
          Back to menu
        </button>
      ) : (
        <button type="button" className="pb-btn pb-btn-primary" disabled={!ready} onClick={() => game.respawn()} style={{ minWidth: 160 }}>
          {ready ? "Respawn" : `Respawn in ${Math.ceil(p.respawn)}`}
        </button>
      )}
    </div>
  );
}
