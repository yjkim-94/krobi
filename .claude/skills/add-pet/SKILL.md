---
name: add-pet
description: Use when the user wants to add a new pet, character, or monster to the Krobi app. Runs a short interview, generates Nano Banana image prompts that embed the locked Krobi art style plus per-frame INVARIANTS+MOTION rules, then ingests the returned PNG strips via the Python extractor and writes a standard `src/assets/pets/<id>/` folder (frames + manifest.json) that the app can load.
---

# add-pet — add a new animated monster to Krobi

This skill turns "add a new monster" into a repeatable pipeline:
**interview → generate style-locked prompts → user creates art in Nano Banana → extract → wire as a standard pet folder.**

The image model (Nano Banana) only handles *rough layout + content*; the Python
extractor enforces *exact 64×64, baseline alignment, palette cleanup*. Style
consistency across monsters comes from (a) the locked Style Bible below, always
injected, and (b) attaching an existing sprite as a reference image.

## Scope

- **In scope:** animated creatures with the standard 4-animation set
  (idle / eat / happy / sad), output as `src/assets/pets/<id>/`.
- **Out of scope:** static assets (food/egg/background), evolution chains,
  and editing the app's runtime loader. This skill stops at producing a
  standard, drop-in pet folder.

## Prerequisites

- Extractor: `tools/extract_sprites.py`
- Python env: `tools/venv` (has Pillow + numpy). If missing, create with
  `python3 -m venv tools/venv && tools/venv/bin/pip install Pillow numpy`.

## Workflow

### Step 1 — Interview

Ask the user (group into one or two messages, do not overwhelm):

1. **id** — folder/slug, kebab-case (e.g. `ember-pup`). Becomes `src/assets/pets/<id>/`.
2. **display name** — shown in-game.
3. **concept** — shape / colors / motif in one or two sentences
   (e.g. "fire lizard, orange+red, small flame on its back, round chibi body").
4. **style reference** — which existing frame to attach for consistency.
   Default: `src/assets/pets/krobi/idle_0.png`.
5. (optional) **evolution stage note** — free tag for later use.

Animation set is fixed: idle (3) / eat (4) / happy (3) / sad (2) = 12 frames.

### Step 2 — Generate prompts and hand them to the user

For each of the 4 animations, output a ready-to-paste prompt =
**Style Bible + Reference line + that animation's INVARIANTS+MOTION block**
(templates below), with the user's concept substituted into the Style Bible's
`Creature:` line.

Then tell the user, every time:
- Generate on a solid flat magenta `#ff00ff` background, render LARGE / high-res.
- **Attach the chosen reference image** so the creature stays identical.
- Save each result to `src/assets/pets/_incoming/<id>_<anim>.png`
  (e.g. `ember-pup_eat.png`).

### Step 3 — Extract each strip

When the user provides a strip, run (adjust `--names` per animation):

```bash
tools/venv/bin/python tools/extract_sprites.py \
  src/assets/pets/_incoming/<id>_idle.png \
  --out src/assets/pets/<id> --names idle_0,idle_1,idle_2 \
  --size 64 --colors 32 --tol 120 --anchor bottom \
  --preview src/assets/pets/_incoming/<id>_idle_preview.png
```

Names per animation:
- idle: `idle_0,idle_1,idle_2`
- eat: `eat_0,eat_1,eat_2,eat_3`
- happy: `happy_0,happy_1,happy_2`
- sad: `sad_0,sad_1`

### Step 4 — Inspect

`Read` the generated `_preview.png`. Check: correct frame count detected, solid
bodies (no eroded interiors), clean transparent background, consistent size,
bottom-aligned. If a strip looks wrong, tune `--tol` (raise to kill leftover
shadow; lower if creature edges get eaten) and re-run, or ask the user to
regenerate with clearer frame spacing.

### Step 5 — Write the manifest

Create `src/assets/pets/<id>/manifest.json` from the template below (only `id`
changes for the standard 4-animation set).

### Step 6 — Done

The folder `src/assets/pets/<id>/` now matches the app's pet contract (12 frames
+ manifest.json). When the app's multi-pet loader exists, dropping this folder is
enough; for now it is a standard, ready asset. Commit the frames + manifest.

---

## Style Bible (always inject into every prompt)

```
HD pixel art, simplified "simple HD" (Octopath-Traveler-like).
Chibi proportions, big expressive eyes, cute friendly monster, clear silhouette.
~32-color palette, soft cell shading (max 1-2 shadow tones), subtle thin outline,
clean deliberate pixel clusters.
Solid flat magenta #ff00ff background only (for keying). Render LARGE / high-res.
64x64 target feel, creature centered.
Creature: <<<USER CONCEPT HERE>>>
Do NOT: text, UI, multiple creatures per frame, gradient overload, realistic/3D
shading, baked ground shadow.
```

Reference line (always include):

```
[REFERENCE] Use the attached image as the EXACT same art style, palette, outline
weight, and chibi proportions. Keep identity consistent; only the creature concept
and the per-frame motion change.
```

## Animation prompt blocks (INVARIANTS + MOTION)

Each strip is horizontal, frames left→right, evenly spaced, equal cell size, same
baseline. INVARIANTS lock what must not change; MOTION describes the per-frame
deltas as one continuous cycle.

**idle (3 frames, breathing loop)**
```
[FRAME STRIP] 3 frames, evenly spaced, same baseline.
[INVARIANTS — identical in all 3] same creature, colors, outline, overall size,
ground position, camera. Only the body silhouette changes per MOTION.
[MOTION — gentle breathing] F1: neutral resting. F2: squashed slightly shorter and
wider. F3: stretched slightly taller and narrower. One smooth breathing cycle.
```

**eat (4 frames, plays once)**
```
[FRAME STRIP] 4 frames, evenly spaced, same baseline.
[INVARIANTS — identical in all 4] same creature, colors, outline, overall size,
ground position, camera. Only mouth/cheeks/eyes change per MOTION.
[MOTION — eating] F1: mouth closed, neutral happy. F2: mouth open wide (bite).
F3: cheeks puffed, chewing, eyes squinting happily. F4: mouth closed, satisfied
content smile. One continuous eating cycle.
```

**happy (3 frames, plays once)**
```
[FRAME STRIP] 3 frames, evenly spaced, same baseline.
[INVARIANTS — identical in all 3] same creature, colors, outline, size, camera.
Only pose/vertical position and small sparkle FX change per MOTION.
[MOTION — happy hop] F1: crouch/squash preparing to jump. F2: airborne stretch with
small sparkles around it. F3: landing squash, big smile. One joyful hop.
```

**sad (2 frames, loop)**
```
[FRAME STRIP] 2 frames, evenly spaced, same baseline.
[INVARIANTS — identical in both] same creature, colors, outline, size, camera.
Only droop and eyes change per MOTION.
[MOTION — sad idle] F1: drooped, downturned mouth, sad eyes. F2: droops a little more,
a tear welling. Slow sad loop.
```

## manifest.json template

```json
{
  "id": "<id>",
  "frameSize": 64,
  "displayScale": 2,
  "animations": {
    "idle":  { "frames": ["idle_0", "idle_1", "idle_0", "idle_2"], "fps": 4, "loop": true },
    "eat":   { "frames": ["eat_0", "eat_1", "eat_2", "eat_3"], "fps": 8, "loop": false, "then": "idle" },
    "happy": { "frames": ["happy_0", "happy_1", "happy_2"], "fps": 8, "loop": false, "then": "idle" },
    "sad":   { "frames": ["sad_0", "sad_1"], "fps": 2, "loop": true }
  }
}
```

## Notes

- Keep well-saved sprite sheets: any existing monster's frames make an excellent
  reference image for the next one — consistency is much better with a reference
  than with text alone.
- Simpler, rounder creatures reproduce best. The more complex/humanoid the form,
  the more hand-cleanup it may need.
- Related design docs: `docs/superpowers/specs/2026-06-16-krobi-pet-art-pipeline-design.md`,
  `docs/superpowers/plans/2026-06-16-krobi-pet-art-animation.md`.
```
