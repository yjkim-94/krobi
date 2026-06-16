# Krobi — stage1 generation prompts

Ready-to-paste prompts for regenerating krobi's stage1 (youngling) sprites in Nano Banana.
Generate **one horizontal strip per animation** (idle / eat / happy / sad). Each prompt =
the **shared header** below + that animation's **INVARIANTS + MOTION** block. Paste header
+ one block at a time.

## Generation settings (apply to every animation)

- Background: solid flat magenta `#ff00ff` only (for keying), creature centered.
- One horizontal strip of **8 frames**, left→right, evenly spaced, same baseline.
- Render LARGE / high-res (designed to read cleanly when downscaled to ~64 px).
- **Padding (important):** leave clear margin around the whole strip — **no frame may
  touch the top/bottom/left/right canvas edge.** Keep even spacing between frames and a
  visible gap at both ends. (Frames touching an edge get clipped during extraction — this
  is what cut off the first/last sad frames before.)
- **Reference image:** stage1 has no parent stage. Generate **idle first**; then attach one
  idle frame (crop a single cell from `src/assets/pets/krobi/stage1/sheet.png`, top-left =
  idle frame 0) as the reference for eat / happy / sad so identity stays consistent.
- Save each result to `src/assets/pets/_incoming/krobi_stage1_<anim>.png`.

## Shared header (prepend to every animation block)

```
HD-2D pixel art, "simple HD" JRPG overworld-sprite style (Octopath Traveler / HD-2D lineage).

[PROPORTIONS] Super-deformed mini-heroic build. For this non-bipedal blob creature,
a compact rounded mass with restraint; never realistic.
[FACE/EYES] Small simple eyes: 1-3 px dark almond/dot eyes with at most a single 1px
highlight; expressive via shape and brow, NOT via size. Minimal few-pixel mouth.
NO big glossy anime/chibi eyes, no large white sclera.
[OUTLINE] NO black keyline. Selective/colored outlining only: edge pixels are a darker
shade of the adjacent LOCAL color (dark-teal edge on a teal body). The silhouette reads
by value contrast against the background, not a black border. Separate interior forms
with shading, not black lines.
[PALETTE] Muted, desaturated, earthy palette, slightly grayed and harmonious. Small
coherent palette (~12-24 colors total). NO neon, no pure-saturated primaries, no
gradients/airbrush.
[SHADING] Soft banded cel shading: per material a base tone + 1 shadow + occasional
1 highlight (2-3 value steps). Consistent light from upper-left. Tiny specular dots
only on wet surfaces. NO smooth gradients, no 3D/realistic rendering.
[PIXELS] Clean, deliberate pixel clusters; crisp readable edges; minimal hand
antialiasing at key curves only; NO dithering, no stray/noisy pixels. Render LARGE
but designed to read cleanly when downscaled to ~64 px.
[CANVAS] Solid flat magenta #ff00ff background only (for keying), creature centered,
no baked ground shadow. Leave clear padding around the whole strip; no frame touches
any canvas edge.

Creature: Krobi (크로비), a stage-1 youngling slime — a small, compact round blob slime.
Glossy wet body in muted desaturated teal with a soft mint-green top highlight and a
couple of tiny water-droplet specular dots; selective dark-teal colored edge (no black
outline). Small simple dark dot eyes (no white sclera) and a tiny mouth; expression via
brow/shape. ~12-16 color teal/mint palette, slightly grayed.

[REFERENCE] Match the attached image's EXACT art style: pixel density, muted earthy
palette, selective colored (NO black) outline, soft banded cel shading, and mini-heroic
deformation with small simple eyes. Keep this creature's identity consistent; only the
per-frame motion changes.

Do NOT: text, UI, multiple creatures per frame, black keyline outline, big anime/chibi
eyes, gradient/airbrush shading, realistic/3D shading, neon colors, baked ground shadow.
```

## idle (8 frames, breathing loop)

```
[FRAME STRIP] 8 frames, evenly spaced, same baseline.
[INVARIANTS — identical in all 8] same creature, colors, edges, overall size,
ground position, camera. Only the body silhouette changes per MOTION.
[MOTION — gentle breathing, one smooth loop] F1: neutral resting. F2: exhale, slightly
squashed (shorter/wider). F3: deeper squash. F4: deepest squash (lowest, widest). F5:
rising back toward neutral. F6: inhale, slightly stretched (taller/narrower). F7: more
stretch. F8: peak stretch (tallest, narrowest). Loops back to F1 seamlessly.
```

## eat (8 frames, plays once)

```
[FRAME STRIP] 8 frames, evenly spaced, same baseline.
[INVARIANTS — identical in all 8] same creature, colors, edges, overall size,
ground position, camera. Only mouth/cheeks/eyes/head-lean (and the food shrinking) change.
[MOTION — eating, one continuous sequence] F1: mouth closed, notices food. F2: leans in,
mouth starting to open. F3: mouth wide open about to bite. F4: chomp down, food bitten
smaller. F5: cheeks puffed, chewing, eyes squint happily. F6: chewing (other side). F7:
swallow, eyes soften. F8: mouth closed, satisfied content smile.
```

## happy (8 frames, plays once)

```
[FRAME STRIP] 8 frames, evenly spaced, same baseline.
[INVARIANTS — identical in all 8] same creature, colors, edges, size, camera.
Only pose/vertical position and small sparkle FX change per MOTION.
[MOTION — one joyful hop] F1: neutral, happy. F2: crouch/squash, anticipating. F3: deeper
crouch. F4: push off, body stretching upward. F5: airborne peak, stretched, small sparkles
around it. F6: starting to descend. F7: descending faster. F8: landing squash, big smile.
```

## sad (8 frames, loop)

```
[FRAME STRIP] 8 frames, evenly spaced, same baseline.
[INVARIANTS — identical in all 8] same creature, colors, edges, size, camera.
Only droop, eyes, and a tear change per MOTION.
[MOTION — slow sad loop] F1: drooped, downturned mouth, sad eyes. F2: droops a little
more. F3: deeper droop. F4: deepest droop, a tear welling at the eye. F5: tear slides
down. F6: tear drips off. F7: small sniff, slight settle. F8: breath in, slight rise.
Loops back to F1 slowly.
```

## Extract & pack (after generating all 4 strips)

Extract each strip (repeat for idle / eat / happy / sad), bottom-anchored at 64 px:

```bash
tools/venv/bin/python tools/extract_sprites.py \
  src/assets/pets/_incoming/krobi_stage1_idle.png \
  --out src/assets/pets/krobi/stage1 --names idle_0,idle_1,idle_2,idle_3,idle_4,idle_5,idle_6,idle_7 \
  --size 64 --colors 32 --tol 120 --anchor bottom \
  --preview src/assets/pets/_incoming/krobi_stage1_idle_preview.png
```

Frame names per animation: `idle_0..idle_7`, `eat_0..eat_7`, `happy_0..happy_7`, `sad_0..sad_7`.

Then merge the per-frame PNGs into one sheet + index-based manifest:

```bash
tools/venv/bin/python tools/pack_sheet.py src/assets/pets/krobi/stage1 --columns 8
```

This produces `sheet.png` (32 cells: idle 0–7, eat 8–15, happy 16–23, sad 24–31) and a
`manifest.json` with matching cell indices.
