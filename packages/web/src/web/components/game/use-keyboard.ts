import { useEffect, useRef } from "react";
import type { Game } from "../../game/engine";
import { HOTBAR } from "../../game/state";

type Handlers = {
  /** true while a pause/settings sheet covers the game */
  menuOpen: boolean;
  onPanel: (p: "inventory" | "craft") => void;
  onEscape: () => void;
};

const LEFT = new Set(["KeyA", "ArrowLeft"]);
const RIGHT = new Set(["KeyD", "ArrowRight"]);
const JUMP = new Set(["Space", "KeyW", "ArrowUp"]);
const DOWN = new Set(["KeyS", "ArrowDown"]);
/** keys whose browser default (scroll, focus move, button click) must not fire in-game */
const CAPTURE = new Set(["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Tab"]);

function isTyping(t: EventTarget | null): boolean {
  const el = t as HTMLElement | null;
  if (!el || !el.tagName) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

/** Keyboard controls. Uses KeyboardEvent.code so layouts and Shift/Caps don't break movement. */
export function useGameKeyboard(game: Game | null, handlers: Handlers) {
  const h = useRef(handlers);
  h.current = handlers;

  useEffect(() => {
    if (!game) return;
    const held = new Set<string>();
    const any = (set: Set<string>) => [...set].some((k) => held.has(k));

    let had = false;
    const sync = () => {
      // leave touch input alone unless the keyboard is (or just was) driving
      if (held.size === 0 && !had) return;
      had = held.size > 0;
      const blocked = h.current.menuOpen || game.panel !== "none";
      if (blocked) {
        game.input.moveX = 0;
        game.input.down = false;
        game.input.up = false;
        game.input.jumpHeld = false;
        game.input.attackHeld = false;
        return;
      }
      game.input.moveX = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
      game.input.down = any(DOWN);
      game.input.up = any(JUMP);
      game.input.jumpHeld = any(JUMP);
      game.input.attackHeld = held.has("KeyF");
    };

    const clear = () => {
      held.clear();
      game.input.moveX = 0;
      game.input.down = false;
      game.input.up = false;
      game.input.jumpHeld = false;
      game.input.jumpEdge = false;
      game.input.attackHeld = false;
      game.mouse.left = false;
      game.mouse.right = false;
    };

    const down = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const code = e.code;
      if (CAPTURE.has(code)) e.preventDefault();
      // a focused HUD button would otherwise be "clicked" by Space/Enter
      const active = document.activeElement as HTMLElement | null;
      if (active && active.tagName === "BUTTON" && (code === "Space" || code === "Enter") && game.panel === "none" && !h.current.menuOpen) {
        active.blur();
        e.preventDefault();
      }
      if (code === "Escape") {
        e.preventDefault();
        if (!e.repeat) h.current.onEscape();
        clear();
        return;
      }
      const wasHeld = held.has(code);
      held.add(code);
      const free = !h.current.menuOpen && (game.panel === "none" || game.panel === "inventory" || game.panel === "craft");
      if (!wasHeld && free) {
        if (code === "KeyE" || code === "KeyI" || code === "Tab") h.current.onPanel("inventory");
        else if (code === "KeyC") h.current.onPanel("craft");
      }
      if (!h.current.menuOpen && game.panel === "none" && !game.player.dead) {
        if (JUMP.has(code) && !wasHeld) game.input.jumpEdge = true;
        if (!wasHeld) {
          if (code === "KeyQ") game.useItem();
          else if (code === "KeyR") game.interactNearby();
          else if (code.startsWith("Digit")) {
            const n = Number(code.slice(5));
            if (Number.isFinite(n)) {
              game.inv.sel = n === 0 ? HOTBAR - 1 : n - 1;
              game.mining = null;
              game.dirty();
            }
          }
        }
      }
      sync();
    };

    const up = (e: KeyboardEvent) => {
      held.delete(e.code);
      if (CAPTURE.has(e.code) && !isTyping(e.target)) e.preventDefault();
      sync();
    };

    const onVis = () => {
      if (document.hidden) clear();
    };

    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", onVis);
    // re-evaluate held keys whenever a panel or menu opens/closes
    const id = window.setInterval(sync, 120);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVis);
      window.clearInterval(id);
      clear();
    };
  }, [game]);
}
