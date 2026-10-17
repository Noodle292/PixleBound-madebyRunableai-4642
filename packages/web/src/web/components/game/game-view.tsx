import { useCallback, useEffect, useRef, useState } from "react";
import { audio } from "../../game/audio";
import { Game, type Hud, type WorldInfo } from "../../game/engine";
import type { CharacterSave, WorldSave } from "../../game/save";
import { HOTBAR, saveSettings, type Settings } from "../../game/state";
import type { World } from "../../game/worldgen";
import { TouchControls } from "./controls";
import { DeathScreen } from "./death-screen";
import { HudView } from "./hud";
import { CatalogPanel, ChestPanel, CraftPanel, GameMenu, InventoryPanel, NpcPanel, SettingsPanel } from "./panels";
import { useDesktopMode } from "./use-input-mode";
import { useGameKeyboard } from "./use-keyboard";

export function GameView({
  world,
  worldSave,
  info,
  character,
  settings,
  onSettings,
  onQuit,
}: {
  world: World;
  worldSave: WorldSave | null;
  info: WorldInfo;
  character: CharacterSave;
  settings: Settings;
  onSettings: (s: Settings) => void;
  onQuit: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [game, setGame] = useState<Game | null>(null);
  const [hud, setHud] = useState<Hud | null>(null);
  const [menu, setMenu] = useState<"none" | "pause" | "settings">("none");
  const lastPush = useRef(0);
  const lastVer = useRef(-1);
  const desktop = useDesktopMode(settings.controls);

  // boot the engine once
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = new Game(canvas, world, settings, info, character);
    if (worldSave) g.applyWorld(worldSave);
    g.applyCharacter(character);
    g.save(true);
    g.onHud = (h) => {
      const now = performance.now();
      if (h.version !== lastVer.current || now - lastPush.current > 110) {
        lastVer.current = h.version;
        lastPush.current = now;
        setHud({ ...h, toasts: h.toasts.map((t) => ({ ...t })), hotbar: h.hotbar.map((s) => (s ? { ...s } : null)) });
      }
    };
    g.setMusic(g.isNight ? "night" : "day");
    g.start();
    setGame(g);
    if (import.meta.env.DEV) (window as unknown as { __pb?: Game }).__pb = g;

    const onResize = () => g.resize();
    const onVis = () => {
      if (document.hidden) {
        g.save(true);
        g.paused = true;
      } else g.paused = false;
    };
    const onUnload = () => g.save(true);
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("pagehide", onUnload);
    return () => {
      g.save(true);
      g.stop();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("pagehide", onUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!game) return;
    game.settings = settings;
    game.paused = menu !== "none";
    if (menu !== "none") {
      game.mouse.left = false;
      game.mouse.right = false;
    }
  }, [game, settings, menu]);

  useEffect(() => {
    if (!game) return;
    game.desktop = desktop;
    game.dirty();
    if (!desktop) game.mouse.screen = null;
    game.resize();
  }, [game, desktop]);

  const openPanel = useCallback(
    (p: "inventory" | "craft") => {
      if (!game || game.player.dead) return;
      if (game.panel === "chest") game.closeChest();
      game.panel = game.panel === p ? "none" : p;
      if (p === "inventory") game.tut.opened = true;
      game.input.aim = null;
      game.mouse.left = false;
      game.mouse.right = false;
      game.sfx("open");
      game.dirty();
    },
    [game],
  );

  const closePanel = useCallback(() => {
    if (!game) return;
    if (game.panel === "chest") game.closeChest();
    else if (game.panel !== "death") game.panel = "none";
    game.npcTalking = null;
    game.sfx("ui");
    game.dirty();
  }, [game]);

  useGameKeyboard(game, {
    menuOpen: menu !== "none",
    onPanel: openPanel,
    onEscape: () => {
      if (!game) return;
      if (menu === "settings") setMenu("pause");
      else if (menu === "pause") setMenu("none");
      else if (game.panel === "death") return;
      else if (game.panel !== "none") closePanel();
      else setMenu("pause");
    },
  });

  // mouse wheel cycles the hotbar (native listener: React wheel handlers are passive)
  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !game) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (game.panel !== "none" || game.paused) return;
      acc += e.deltaY;
      if (Math.abs(acc) < 40 && e.deltaMode === 0) return;
      const dir = acc > 0 ? 1 : -1;
      acc = 0;
      game.inv.sel = (game.inv.sel + dir + HOTBAR) % HOTBAR;
      game.mining = null;
      game.dirty();
    };
    c.addEventListener("wheel", onWheel, { passive: false });
    return () => c.removeEventListener("wheel", onWheel);
  }, [game]);

  // world pointer: mouse = desktop aiming, touch = tap/hold to mine, build, interact
  const aimPointer = useRef<number | null>(null);
  const localPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onCanvasDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!game) return;
    audio.resume();
    e.preventDefault();
    e.currentTarget.focus({ preventScroll: true });
    if (game.panel !== "none" || menu !== "none") return;
    if (e.pointerType === "mouse") {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      game.mouse.screen = localPos(e);
      if (e.button === 0) {
        game.mouse.left = true;
        game.mouse.leftEdge = true;
      } else if (e.button === 2) {
        game.mouse.right = true;
        game.secondaryAction();
      }
      return;
    }
    e.currentTarget.setPointerCapture?.(e.pointerId);
    aimPointer.current = e.pointerId;
    game.input.aim = game.screenToWorld(localPos(e).x, localPos(e).y);
    game.input.aimEdge = true;
  };
  const onCanvasMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!game) return;
    if (e.pointerType === "mouse") {
      game.mouse.screen = localPos(e);
      return;
    }
    if (aimPointer.current !== e.pointerId) return;
    const p = localPos(e);
    game.input.aim = game.screenToWorld(p.x, p.y);
  };
  const onCanvasUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!game) return;
    if (e.pointerType === "mouse") {
      if (e.button === 0 || e.type === "pointercancel") game.mouse.left = false;
      if (e.button === 2 || e.type === "pointercancel") game.mouse.right = false;
      if (e.buttons === 0) {
        game.mouse.left = false;
        game.mouse.right = false;
      }
      return;
    }
    if (aimPointer.current !== e.pointerId) return;
    // Dispatch a short tap before clearing it if no animation frame saw it.
    if (game.input.aimEdge && game.input.aim) game.updateAim(0);
    aimPointer.current = null;
    game.input.aim = null;
    game.input.aimEdge = false;
  };
  const onCanvasLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!game || e.pointerType !== "mouse") return;
    if (e.buttons === 0) game.mouse.screen = null;
  };

  const panel = game?.panel ?? "none";
  const scale = Math.min(settings.controlScale, ((hud ? window.innerWidth : 844) - 28) / 330);

  return (
    <div className="pb-root" style={desktop ? { cursor: panel === "none" && menu === "none" ? "crosshair" : "default" } : undefined}>
      <canvas
        ref={canvasRef}
        className="pb-canvas"
        tabIndex={0}
        aria-label="Game world"
        style={{ outline: "none" }}
        onPointerDown={onCanvasDown}
        onPointerMove={onCanvasMove}
        onPointerUp={onCanvasUp}
        onPointerCancel={onCanvasUp}
        onPointerLeave={onCanvasLeave}
        onContextMenu={(e) => e.preventDefault()}
      />
      {game && hud && (
        <>
          <HudView
            hud={hud}
            game={game}
            scale={scale}
            desktop={desktop}
            onSkipTutorial={() => game.skipTutorial()}
            onBag={() => openPanel("inventory")}
            onCraft={() => openPanel("craft")}
            onMenu={() => setMenu("pause")}
          />
          {!desktop && panel === "none" && menu === "none" && !hud.dead && (
            <TouchControls
              game={game}
              scale={scale}
              lefty={settings.lefty}
              onBag={() => openPanel("inventory")}
              onCraft={() => openPanel("craft")}
              onMenu={() => setMenu("pause")}
            />
          )}
          {panel === "inventory" && <InventoryPanel game={game} onClose={closePanel} />}
          {panel === "craft" && (game.mode.creative ? <CatalogPanel game={game} onClose={closePanel} /> : <CraftPanel game={game} onClose={closePanel} />)}
          {panel === "chest" && <ChestPanel game={game} onClose={closePanel} />}
          {panel === "npc" && <NpcPanel game={game} onClose={closePanel} />}
          {panel === "death" && <DeathScreen game={game} onQuit={onQuit} />}
          {menu === "pause" && (
            <GameMenu game={game} desktop={desktop} onClose={() => setMenu("none")} onSettings={() => setMenu("settings")} onQuit={onQuit} />
          )}
          {menu === "settings" && (
            <SettingsPanel
              settings={settings}
              onChange={(s) => {
                saveSettings(s);
                audio.setSettings({ master: s.master, music: s.music, sfx: s.sfx });
                onSettings(s);
              }}
              onClose={() => setMenu("pause")}
            />
          )}
        </>
      )}
    </div>
  );
}
