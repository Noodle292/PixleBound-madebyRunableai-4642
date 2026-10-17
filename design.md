# Pixelbound — Design Direction

A 2D pixel-art sandbox survival game for phone browsers. Everything visual is
generated at runtime (no image files); everything audible is synthesised with
WebAudio (no sample files). 100% original blocks, creatures, bosses and names.

## Visual language

**Mood:** dusk-lit adventure. Warm torchlight against cold cave dark. Readable
at arm's length on a 5" screen — chunky pixels, high contrast, no thin strokes.

**Canvas layer (the world)**
- 16px tile grid, nearest-neighbour upscaled 2–4x depending on screen width.
- Procedural block textures (noise/brick/ore/grass/fungal styles) baked once.
- Per-tile light grid composited as a dark overlay — caves are genuinely dark
  and torches matter.
- Parallax hill silhouettes, gradient sky that lerps day→night, sun/moon arc.

**UI layer (React over the canvas)**
- Pixel-panel chrome: 2px hard borders, no rounded corners, no blur, no shadows
  softer than a 2px offset block shadow.
- Monospace type only (`ui-monospace`), uppercase for labels, letter-spaced.
- Everything is a big touch target: min 44px, controls scale via settings.

## Palette

| Role | Hex | Use |
|---|---|---|
| Ink | `#0b0910` | panel fills, lighting overlay |
| Slate | `#1b1826` | panel body, slot wells |
| Stone | `#3a3450` | borders, dividers |
| Bone | `#e8e2d2` | primary text |
| Ember | `#f0b64a` | brand accent, torch light, headings |
| Rust | `#e0435f` | health, damage, danger |
| Moss | `#68d05a` | heal, success, craftable |
| Glass | `#5fe0d6` | mana-ish / crystal / info |
| Void | `#b57bff` | late-game / arcane / rare |

## Type scale
- Title `clamp(28px, 9vw, 56px)` — Ember, 2px ink drop-shadow.
- Panel heading 13px uppercase, `0.18em` tracking.
- Body/labels 11px. Counters 9px.

## Layout rules (phone-first)
- Game canvas is fullscreen, fixed, `touch-action: none`, no scroll anywhere.
- Left thumb: 132px virtual joystick. Right thumb: JUMP + ATK stacked, plus a
  compact button column (BAG, CRAFT, USE).
- Hotbar: 10 slots, horizontally scrollable strip pinned bottom-centre above
  the controls; selected slot gets an Ember border.
- HUD top-left: hearts bar + defense + depth/biome. Top-right: clock, day count,
  FPS (debug), menu button. Boss bar spans the top-centre when a boss is live.
- Panels are bottom-sheets on portrait, centred modals on landscape, always with
  a large X and a tap-outside-to-close backdrop.
- `env(safe-area-inset-*)` respected so nothing hides under a notch.

## Motion
- No CSS transitions longer than 120ms; the game loop owns the motion.
- Damage numbers float and fade in-canvas; toasts slide 8px and fade in the DOM.
