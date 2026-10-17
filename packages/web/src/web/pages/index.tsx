import { useEffect, useMemo, useState } from "react";
import { audio } from "../game/audio";
import { Game, type WorldInfo } from "../game/engine";
import { getAssets } from "../game/assets";
import {
  blankCharacter,
  deleteCharacter,
  deleteWorld,
  listCharacters,
  listWorlds,
  newId,
  readCharacter,
  readWorld,
  writeCharacter,
  type CharacterSave,
  type WorldSave,
} from "../game/save";
import { loadSettings, saveSettings, type Settings } from "../game/state";
import { generateWorld, type World, type WorldSize } from "../game/worldgen";
import { GameView } from "../components/game/game-view";
import { KeyList, SettingsPanel } from "../components/game/panels";
import { Sheet } from "../components/game/ui";
import { LoadingBar, MenuBackdrop } from "../components/menu/backdrop";
import { CharacterCreator } from "../components/menu/character-creator";
import { CharacterList, NewWorldDialog, WorldList } from "../components/menu/library";
import { MODE_ORDER, MODES } from "../game/modes";

type Screen =
  | { kind: "title" }
  | { kind: "characters" }
  | { kind: "worlds"; charId: string }
  | { kind: "loading"; label: string }
  | {
      kind: "game";
      world: World;
      worldSave: WorldSave | null;
      info: WorldInfo;
      character: CharacterSave;
      key: number;
    };

function Index() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings());
  const [screen, setScreen] = useState<Screen>({ kind: "title" });
  const [dialog, setDialog] = useState<"none" | "settings" | "about" | "creator" | "newWorld">("none");
  const [chars, setChars] = useState(() => listCharacters());
  const [worlds, setWorlds] = useState(() => listWorlds());
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => {
    setChars(listCharacters());
    setWorlds(listWorlds());
  };

  useEffect(() => {
    audio.setSettings({ master: settings.master, music: settings.music, sfx: settings.sfx });
  }, [settings]);

  useEffect(() => {
    document.title = "Pixelbound";
  }, []);

  const recent = chars.find((c) => !c.dead) ?? null;
  const backdropLook = (screen.kind === "worlds" ? chars.find((c) => c.id === screen.charId) : recent)?.look;
  const cont = useMemo(() => {
    if (!recent?.lastWorld) return null;
    const w = worlds.find((x) => x.id === recent.lastWorld);
    if (!w || w.creative !== (recent.mode === "creative")) return null;
    return { c: recent, w };
  }, [recent, worlds]);

  const run = (label: string, fn: () => Screen, back: Screen) => {
    audio.resume();
    audio.sfx("ui");
    setErr(null);
    setDialog("none");
    setScreen({ kind: "loading", label });
    // let the loading frame paint before heavy generation
    window.setTimeout(() => {
      try {
        getAssets();
        setScreen(fn());
      } catch (e) {
        console.error(e);
        setErr(e instanceof Error ? e.message : "Something went wrong");
        refresh();
        setScreen(back);
      }
    }, 60);
  };

  const enterWorld = (charId: string, worldId: string) => {
    run("Loading world…", () => {
      const character = readCharacter(charId);
      if (!character) throw new Error("That character no longer exists.");
      if (character.dead) throw new Error(`${character.name} has fallen and can't play again.`);
      const ws = readWorld(worldId);
      if (!ws) throw new Error("That world's save is missing or damaged.");
      if (ws.creative !== (character.mode === "creative"))
        throw new Error(ws.creative ? "Only Creative characters can enter Creative worlds." : "Creative characters can't enter Survival worlds.");
      const world = Game.worldFromSave(ws);
      const info: WorldInfo = { id: ws.id, name: ws.name, creative: ws.creative, createdAt: ws.createdAt };
      return { kind: "game", world, worldSave: ws, info, character, key: Date.now() };
    }, { kind: "worlds", charId });
  };

  const createWorld = (charId: string, name: string, seed: string, size: WorldSize) => {
    run(`Generating “${name}”…`, () => {
      const character = readCharacter(charId);
      if (!character || character.dead) throw new Error("Pick a living character first.");
      if (listWorlds().length >= 6) throw new Error("All 6 world slots are used.");
      const world = generateWorld(seed, { size });
      const info: WorldInfo = { id: newId("w"), name, creative: character.mode === "creative", createdAt: Date.now() };
      return { kind: "game", world, worldSave: null, info, character, key: Date.now() };
    }, { kind: "worlds", charId });
  };

  if (screen.kind === "game") {
    return (
      <GameView
        key={screen.key}
        world={screen.world}
        worldSave={screen.worldSave}
        info={screen.info}
        character={screen.character}
        settings={settings}
        onSettings={setSettings}
        onQuit={() => {
          audio.stopMusic();
          refresh();
          const c = readCharacter(screen.character.id);
          setScreen(c && !c.dead ? { kind: "worlds", charId: c.id } : { kind: "characters" });
        }}
      />
    );
  }

  const worldsChar = screen.kind === "worlds" ? chars.find((c) => c.id === screen.charId) : undefined;

  return (
    <div className="pb-root" style={{ overflow: "hidden" }}>
      <MenuBackdrop look={backdropLook} />

      {(screen.kind === "title" || screen.kind === "loading") && (
        <div className="pb-title-wrap">
          {screen.kind === "loading" ? (
            <>
              <div className="pb-title">PIXELBOUND</div>
              <div style={{ fontSize: 12, letterSpacing: "0.14em" }}>{screen.label}</div>
              <LoadingBar />
            </>
          ) : (
            <>
              <div>
                <div className="pb-title">PIXELBOUND</div>
                <div style={{ fontSize: 11, letterSpacing: "0.3em", marginTop: 8, opacity: 0.85 }}>
                  DIG · BUILD · SURVIVE · CONQUER
                </div>
              </div>
              <div style={{ display: "grid", gap: 8, width: "min(290px, 80vw)" }}>
                {cont && (
                  <button type="button" className="pb-btn pb-btn-primary" onClick={() => enterWorld(cont.c.id, cont.w.id)}>
                    Continue
                    <div style={{ fontSize: 9, opacity: 0.75, marginTop: 3, textTransform: "none", letterSpacing: 0 }}>
                      {cont.c.name} ({MODES[cont.c.mode].name}) in “{cont.w.name}” · day {cont.w.day}
                    </div>
                  </button>
                )}
                <button
                  type="button"
                  className={`pb-btn${cont ? "" : " pb-btn-primary"}`}
                  onClick={() => {
                    audio.resume();
                    audio.sfx("ui");
                    refresh();
                    setScreen({ kind: "characters" });
                    if (listCharacters().length === 0) setDialog("creator");
                  }}
                >
                  {chars.length ? "Characters & worlds" : "Play"}
                </button>
                <button type="button" className="pb-btn" onClick={() => setDialog("settings")}>
                  Settings
                </button>
                <button type="button" className="pb-btn" onClick={() => setDialog("about")}>
                  How to play
                </button>
              </div>
              {err && <div style={{ color: "#e0435f", fontSize: 11 }}>{err}</div>}
              <div style={{ fontSize: 9, opacity: 0.5 }}>Up to 6 characters and 6 worlds · progress autosaves on this device</div>
            </>
          )}
        </div>
      )}

      {screen.kind === "characters" && (
        <CharacterList
          characters={chars}
          worlds={worlds}
          onBack={() => setScreen({ kind: "title" })}
          onNew={() => setDialog("creator")}
          onPick={(c) => {
            setErr(null);
            setScreen({ kind: "worlds", charId: c.id });
          }}
          onDelete={(c) => {
            deleteCharacter(c.id);
            refresh();
          }}
        />
      )}

      {screen.kind === "worlds" && worldsChar && (
        <WorldList
          character={worldsChar}
          worlds={worlds}
          onBack={() => setScreen({ kind: "characters" })}
          onNew={() => setDialog("newWorld")}
          onPick={(w) => enterWorld(worldsChar.id, w.id)}
          onDelete={(w) => {
            deleteWorld(w.id);
            refresh();
          }}
        />
      )}

      {err && screen.kind !== "title" && screen.kind !== "loading" && (
        <div className="pb-err" onClick={() => setErr(null)}>{err}</div>
      )}

      {dialog === "creator" && (
        <CharacterCreator
          onCancel={() => setDialog("none")}
          onCreate={(name, mode, look) => {
            const c = blankCharacter(name, mode, look);
            const res = writeCharacter(c);
            setDialog("none");
            refresh();
            if (!res.ok) {
              setErr(`Couldn't save: ${res.error ?? "unknown error"}`);
              return;
            }
            audio.sfx("ui");
            setScreen({ kind: "worlds", charId: c.id });
          }}
        />
      )}

      {dialog === "newWorld" && worldsChar && (
        <NewWorldDialog
          creative={worldsChar.mode === "creative"}
          onCancel={() => setDialog("none")}
          onCreate={(name, seed, size) => createWorld(worldsChar.id, name, seed, size)}
        />
      )}

      {dialog === "settings" && (
        <SettingsPanel
          settings={settings}
          onChange={(s) => {
            saveSettings(s);
            setSettings(s);
          }}
          onClose={() => setDialog("none")}
        />
      )}

      {dialog === "about" && (
        <Sheet title="How to play" onClose={() => setDialog("none")} wide>
          <div style={{ fontSize: 11, lineHeight: 1.65 }}>
            <div className="pb-h" style={{ fontSize: 11, marginBottom: 6 }}>Mouse + keyboard</div>
            <KeyList />
            <div className="pb-h" style={{ fontSize: 11, margin: "12px 0 6px" }}>Touch</div>
            <b style={{ color: "#f0b64a" }}>Move</b> with the left pad. Push up/down to climb out of water or drop through platforms.<br />
            <b style={{ color: "#f0b64a" }}>Tap</b> a block near you to mine it — hold to keep digging. Tap empty space with a block selected to build.<br />
            <b style={{ color: "#f0b64a" }}>ATK</b> swings or fires your held weapon. <b style={{ color: "#f0b64a" }}>USE</b> drinks potions, equips armor, and activates boss summons.<br />
            <div className="pb-h" style={{ fontSize: 11, margin: "12px 0 6px" }}>Progress</div>
            Craft near a Workbench, Smeltpit, Anvil, Alchemy Table or Arcane Forge. Wood → copper → iron → first boss → deeper ores → eight guardians.
            Townsfolk move into enclosed rooms with a door, a torch, and furniture.
            <div className="pb-h" style={{ fontSize: 11, margin: "12px 0 6px" }}>Modes</div>
            {MODE_ORDER.map((id) => (
              <div key={id} style={{ marginBottom: 4 }}>
                <b style={{ color: MODES[id].color }}>{MODES[id].name}</b> — {MODES[id].rules.join(" · ")}
              </div>
            ))}
          </div>
        </Sheet>
      )}
    </div>
  );
}

export default Index;
