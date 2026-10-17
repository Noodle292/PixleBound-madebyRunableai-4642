import { useEffect, useState } from "react";
import type { Settings } from "../../game/state";

function prefersDesktop(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/**
 * Picks the control layout. "auto" starts from the primary pointer and then follows
 * whatever the player actually uses: a finger on the screen switches to touch,
 * mouse movement or a key press switches back to mouse + keyboard.
 */
export function useDesktopMode(setting: Settings["controls"]): boolean {
  const [auto, setAuto] = useState(prefersDesktop);

  useEffect(() => {
    if (setting !== "auto") return;
    const onPointer = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.pointerType === "pen") setAuto(false);
      else if (e.pointerType === "mouse") setAuto(true);
    };
    const onMove = (e: PointerEvent) => {
      // ignore the synthetic mouse moves browsers fire after a tap
      if (e.pointerType === "mouse" && (Math.abs(e.movementX) + Math.abs(e.movementY) > 0)) setAuto(true);
    };
    const onKey = (e: KeyboardEvent) => {
      if (!e.repeat && e.code !== "Unidentified") setAuto(true);
    };
    window.addEventListener("pointerdown", onPointer, true);
    window.addEventListener("pointermove", onMove, true);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onPointer, true);
      window.removeEventListener("pointermove", onMove, true);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [setting]);

  if (setting === "desktop") return true;
  if (setting === "touch") return false;
  return auto;
}
