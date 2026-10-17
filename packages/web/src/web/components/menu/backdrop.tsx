import { useEffect, useRef, useState } from "react";
import { getAssets } from "../../game/assets";
import { bakeLook, DEFAULT_LOOK, type Look } from "../../game/look";

export function LoadingBar() {
  const [p, setP] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setP((v) => (v + 0.07) % 1), 50);
    return () => window.clearInterval(id);
  }, []);
  return (
    <div style={{ width: 200, height: 12, border: "2px solid #3a3450", background: "#120f1c", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, bottom: 0, left: `${p * 100 - 30}%`, width: "30%", background: "#f0b64a" }} />
    </div>
  );
}

/** Crisp pixel portrait of a character look. */
export function LookPreview({ look, scale = 3, facing = "right" }: { look: Look; scale?: number; facing?: "right" | "left" }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const spr = bakeLook(look)[facing];
    c.width = spr.width;
    c.height = spr.height;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    ctx.drawImage(spr, 0, 0);
  }, [look, facing]);
  return (
    <canvas
      ref={ref}
      style={{ width: 12 * scale, height: 16 * scale, imageRendering: "pixelated", display: "block", flex: "0 0 auto" }}
      aria-hidden
    />
  );
}

/** Animated pixel landscape behind the menus, drawn from the same block textures as the game. */
export function MenuBackdrop({ look }: { look?: Look }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const lookRef = useRef<Look>(look ?? DEFAULT_LOOK);
  lookRef.current = look ?? DEFAULT_LOOK;
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    let t = 0;
    let last = performance.now();
    const A = getAssets();
    const grass = A.blockTex.get(1);
    const dirt = A.blockTex.get(2);
    const stone = A.blockTex.get(3);
    const log = A.blockTex.get(7);
    const leaves = A.blockTex.get(8);
    const torch = A.prop.get("torch");
    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      t += Math.min(0.1, (now - last) / 1000);
      last = now;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
        c.width = Math.round(w * dpr);
        c.height = Math.round(h * dpr);
      }
      const s = Math.max(2, Math.round(Math.min(w, h) / 200)) * dpr;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.imageSmoothingEnabled = false;
      const g = ctx.createLinearGradient(0, 0, 0, c.height);
      g.addColorStop(0, "#141433");
      g.addColorStop(0.6, "#3b2a55");
      g.addColorStop(1, "#8a4a52");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "rgba(255,250,230,0.8)";
      for (let i = 0; i < 70; i++) {
        const x = ((i * 97.13) % 1) * c.width + ((i * 7919) % c.width);
        const y = (i * 3571) % Math.floor(c.height * 0.5);
        if (Math.sin(t * 2 + i) > -0.3) ctx.fillRect(x % c.width, y, dpr * 1.5, dpr * 1.5);
      }
      const hill = (k: number, col: string, base: number, amp: number) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.moveTo(0, c.height);
        for (let x = 0; x <= c.width; x += 6 * dpr) {
          const u = (x / dpr + t * 14 * k) / 70;
          ctx.lineTo(x, c.height * base - (Math.sin(u) * 0.6 + Math.sin(u * 0.37 + 1) * 0.4) * amp * dpr);
        }
        ctx.lineTo(c.width, c.height);
        ctx.fill();
      };
      hill(0.4, "#2a2342", 0.62, 34);
      hill(0.7, "#1d1a30", 0.7, 22);
      const tile = 16 * s;
      const off = (t * 22 * dpr) % tile;
      const rows = 5;
      const groundY = c.height - rows * tile;
      const cols = Math.ceil(c.width / tile) + 2;
      const playerX = c.width * 0.3;
      let playerBump = 0;
      for (let i = 0; i < cols; i++) {
        const x = i * tile - off;
        const worldCol = i + Math.floor((t * 22 * dpr) / tile);
        // gentle, one-step terrain: a raised run every so often, never a lone pillar
        const bump = Math.sin(worldCol * 0.31) > 0.55 ? 1 : 0;
        if (playerX + tile * 0.4 >= x && playerX + tile * 0.4 < x + tile) playerBump = bump;
        for (let r = 0; r < rows + bump; r++) {
          const y = groundY + (r - bump) * tile;
          const tex = r === 0 ? grass : r < 3 ? dirt : stone;
          if (tex) ctx.drawImage(tex, x, y, tile, tile);
        }
        if (worldCol % 9 === 0 && log && leaves) {
          const ty = groundY - bump * tile;
          for (let k = 1; k <= 4; k++) ctx.drawImage(log, x, ty - k * tile, tile, tile);
          for (let dx = -1; dx <= 1; dx++) for (let dy = 5; dy <= 6; dy++) ctx.drawImage(leaves, x + dx * tile, ty - dy * tile, tile, tile);
        }
        if (worldCol % 13 === 5 && torch) {
          const ty = groundY - bump * tile;
          ctx.drawImage(torch, x + tile * 0.3, ty - tile, tile * 0.4, tile * 0.65);
          const gr = ctx.createRadialGradient(x + tile / 2, ty - tile * 0.8, 1, x + tile / 2, ty - tile * 0.8, tile * 2.5);
          gr.addColorStop(0, "rgba(255,190,90,0.35)");
          gr.addColorStop(1, "rgba(255,190,90,0)");
          ctx.fillStyle = gr;
          ctx.fillRect(x - tile * 2, ty - tile * 3.3, tile * 5, tile * 5);
        }
      }
      const pl = bakeLook(lookRef.current).right;
      const bob = Math.abs(Math.sin(t * 9)) * s;
      const ps = s * 1.25;
      ctx.drawImage(pl, playerX, groundY - playerBump * tile - pl.height * ps - bob, pl.width * ps, pl.height * ps);
      const v = ctx.createRadialGradient(c.width / 2, c.height / 2, c.height * 0.2, c.width / 2, c.height / 2, c.height * 0.9);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,0.55)");
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, c.width, c.height);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="pb-canvas" />;
}
