# Pixelbound — expansion (worlds, characters, modes, PC controls, worldgen v3)

## Decisions
- Library: up to 6 worlds + 6 characters in localStorage (`pixelbound.v2.*`). Legacy `pixelbound.save.v1` migrates once into 1 world + 1 character; old key is kept.
- Worlds carry a type: Survival or Creative. Creative characters only enter Creative worlds, all other modes only Survival worlds (no creative item leakage).
- Character position is stored per world on the character.
- Modes: Journey, Classic, Extreme, Hardcore, Death, Creative (rules in `game/modes.ts`).
- Old saves (generatorVersion <= 2) keep their terrain via `worldgen-classic.ts`; new worlds use v3 generator with size S/M/L.

## Progress
- [x] worldgen v3 written
- [ ] compile fix + save library
- [ ] modes in engine
- [ ] appearance + character creator
- [ ] menu screens (characters, worlds)
- [ ] PC controls (keyboard/mouse, hide touch overlay)
- [ ] worldgen numeric QA + screenshots
- [ ] build, deliver

## Continuation 4 — lighting fix (done)
- [x] Darkness under floating islands / tall trees: sunlight, cave backdrop, sky `under` and parallax now key off max(surface, ground) instead of first-opaque `surface`.
- [x] QA light.py / light2.py / light3.py: portrait + desktop daytime under island columns fully lit, caves still dark, no errors.
- [x] tsc + build clean.
- [ ] qa/trees.py still uses the removed "New world" menu flow (worldgen import updated only).
