---
name: add-pet
description: Use when the user wants to add a new pet, character, or monster to the Krobi app. Runs an interview, checks the catalog for concept collisions, generates Nano Banana image prompts that inject the locked style rules from pet_design.md plus per-frame INVARIANTS+MOTION (with numbered storyboard ordering and previous-stage reference for evolutions), ingests the returned PNG strips via the Python extractor, and writes the form-folder structure (frames + manifest.json per form), species.json (3-stage evolution tree), and a catalog.json entry the app can load.
---

# add-pet — add a new 3-stage evolving monster to Krobi

This skill turns "add a new monster" into a repeatable pipeline:
**interview → catalog dedup → generate style-locked prompts → user creates art in
Nano Banana → extract → pack into one sheet → write form folders + species.json + catalog entry.**

The image model (Nano Banana) only handles *rough layout + content*; the Python
extractor enforces *exact size, baseline alignment, palette cleanup*. Style
consistency comes from (a) the locked rules in `src/assets/pets/pet_design.md`,
always injected, and (b) attaching a reference image (style sibling, or the
previous evolution stage).

## Evolution model (per species: 7 forms)

```
stage1 (유년기, no branch)
  ├─ stage2-<A> ─→ stage3-<A>
  ├─ stage2-<B> ─→ stage3-<B>
  └─ stage2-<C> ─→ stage3-<C>
```

- One form = the standard 4-animation set (idle 8 / eat 8 / happy 8 / sad 8 = 32 frames).
  All forms follow this, including krobi (krobi/stage1 will be regenerated in the new
  style at 8 frames per action).
- Branch styles (A/B/C) come from a pool: beast, humanoid, machine, spirit, morph,
  human, angel, demon, dragon, plant, … and MUST fit the species archetype
  (slime → not angel/plant). These 3 are the species' `branchWhitelist`.
- Authoring all 7 forms is the full job; a single playthrough only shows
  stage1 → one stage2 → one stage3.

## Scope

- **In scope:** producing the per-species folder structure under
  `src/assets/pets/<species>/`, with form folders (one `sheet.png` + manifest.json),
  `species.json` (evolution tree), and a `catalog.json` entry.
- **Out of scope:** the work-tracking runtime that drives which branch is reached,
  evolution transition FX, and the app's multi-form runtime loader. Branch
  conditions in species.json stay abstract (`stat >= threshold`, placeholder).

## Prerequisites

- Extractor: `tools/extract_sprites.py`
- Sheet packer: `tools/pack_sheet.py` (merges per-frame PNGs into one `sheet.png` and
  rewrites the manifest with cell indices + `sheet`/`columns`).
- Python env: `tools/venv` (Pillow + numpy). If missing:
  `python3 -m venv tools/venv && tools/venv/bin/pip install Pillow numpy`.
- Locked style rules: `src/assets/pets/pet_design.md` (always injected).
- Visual style anchor: `src/assets/pets/style_ref_roster.png` (HD-2D roster). Use it to
  eyeball the target style; do NOT attach it to prompts (it is humanoid and biases
  generations toward humans — conflicts with the evolution continuity rule).
- Catalog: `src/assets/pets/catalog.json` (read before interview, append after).

## Workflow

### Step 1 — Read the catalog, then interview

First `Read` `src/assets/pets/catalog.json`. Then ask the user (group into one or
two messages):

1. **species id** — kebab-case slug → `src/assets/pets/<species>/`.
2. **display name** — shown in-game.
3. **archetype** — base body family (slime / beast / dragon / …).
4. **concept** — stage1 (유년기) shape / colors / motif in one or two sentences.
5. **branch whitelist (3 styles)** — reachable styles that FIT the archetype.
6. **style reference** — an existing frame for consistency.
   Default: `src/assets/pets/krobi/stage1/idle_0.png`.

**Collision check:** compare the new concept / motifs / colors / archetype against
every entry in catalog.json. If they overlap, tell the user and ask them to
differentiate before continuing.

### Step 2 — Decide form generation order

Author forms in this order (a stage2/3 form needs its parent finished first, to
attach as reference):

```
stage1 → stage2-<A> → stage2-<B> → stage2-<C> → stage3-<A> → stage3-<B> → stage3-<C>
```

It is fine to do this incrementally across sessions; stage1 alone is a valid
checkpoint.

### Step 3 — Generate prompts for the current form

`Read` `src/assets/pets/pet_design.md` and inject it verbatim. For each of the 4
animations, output a ready-to-paste prompt =
**pet_design.md rules + Reference line + that animation's INVARIANTS+MOTION block**
(blocks below), with the form's concept substituted into the Style Bible's
`Creature:` line.

Per-form reference image:
- **stage1:** the chosen style reference (default krobi stage1 idle_0).
- **stage2-X:** that species' `stage1/idle_0.png`.
- **stage3-X:** that species' `stage2-X/idle_0.png`.

Always tell the user:
- Generate on solid flat magenta `#ff00ff`, render LARGE / high-res.
- **Attach the per-form reference image** above so identity/silhouette stays consistent.
- For sequential actions, keep the numbered storyboard order (pet_design.md §2).
- Save each result to `src/assets/pets/_incoming/<species>_<form>_<anim>.png`
  (e.g. `ember-pup_stage2-dragon_eat.png`).

### Step 4 — Extract each strip into the form folder

`--size` = that form's frameSize from species.json (stage1/2 = 64, stage3 = 96 in
the krobi example; adjust per species). Example:

```bash
tools/venv/bin/python tools/extract_sprites.py \
  src/assets/pets/_incoming/<species>_<form>_idle.png \
  --out src/assets/pets/<species>/<form> --names idle_0,idle_1,idle_2,idle_3,idle_4,idle_5,idle_6,idle_7 \
  --size <frameSize> --colors 32 --tol 120 --anchor bottom \
  --preview src/assets/pets/_incoming/<species>_<form>_idle_preview.png
```

Names per animation (8 frames each):
- idle: `idle_0,idle_1,idle_2,idle_3,idle_4,idle_5,idle_6,idle_7`
- eat: `eat_0,eat_1,eat_2,eat_3,eat_4,eat_5,eat_6,eat_7`
- happy: `happy_0,happy_1,happy_2,happy_3,happy_4,happy_5,happy_6,happy_7`
- sad: `sad_0,sad_1,sad_2,sad_3,sad_4,sad_5,sad_6,sad_7`

### Step 5 — Inspect (gate)

`Read` each `_preview.png`. Check: correct frame count, **correct causal order**
(no reversed sequences, see pet_design.md §2), solid bodies, clean transparent background, consistent
size, bottom-aligned, and identity consistent with the reference. If wrong, tune
`--tol` (raise to kill leftover shadow; lower if edges get eaten) and re-run, or
ask the user to regenerate with clearer spacing / corrected order.

### Step 6 — Write a draft manifest (frames = frame names)

Create `src/assets/pets/<species>/<form>/manifest.json` from the **draft template**
below, with `frames` as the extracted frame file names (the next step rewrites them
to cell indices). Set `id` to `<species>/<form>` and `frameSize` to the form's size.

### Step 7 — Pack into a single sheet

Merge the per-frame PNGs into one `sheet.png` and rewrite the manifest with cell
indices (+ `sheet`/`columns`):

```bash
tools/venv/bin/python tools/pack_sheet.py src/assets/pets/<species>/<form> --columns 8
```

This deletes the individual frame PNGs, leaving just `sheet.png` + `manifest.json`
(the form's drop-in asset). See the packed example below.

### Step 8 — Write/update species.json and catalog.json

- `src/assets/pets/<species>/species.json` — from the template below. Fill `forms`
  with every form you intend (declare the tree even if some art is pending). Keep
  `condition.stat`/`gte` as abstract placeholders.
- Append the species to `src/assets/pets/catalog.json` (`branches` mirrors
  `branchWhitelist`). The file is `{ "species": [ … ] }`; push the new entry into the
  `species` array. Skip if the entry already exists.

### Step 9 — Done

The species folder now matches the app's contract. Commit each form's `sheet.png` +
manifest.json + species.json + catalog.json.

---

## Animation prompt blocks (INVARIANTS + MOTION)

Each strip is horizontal, frames left→right, evenly spaced, equal cell size, same
baseline. INVARIANTS lock what must not change; MOTION is the per-frame storyboard
(numbered, causal order — see pet_design.md §2).

**idle (8 frames, breathing loop)**
```
[FRAME STRIP] 8 frames, evenly spaced, same baseline.
[INVARIANTS — identical in all 8] same creature, colors, edges, overall size,
ground position, camera. Only the body silhouette changes per MOTION.
[MOTION — gentle breathing, one smooth loop] F1: neutral resting. F2: exhale, slightly
squashed (shorter/wider). F3: deeper squash. F4: deepest squash (lowest, widest). F5:
rising back toward neutral. F6: inhale, slightly stretched (taller/narrower). F7: more
stretch. F8: peak stretch (tallest, narrowest). Loops back to F1 seamlessly.
```

**eat (8 frames, plays once)**
```
[FRAME STRIP] 8 frames, evenly spaced, same baseline.
[INVARIANTS — identical in all 8] same creature, colors, edges, overall size,
ground position, camera. Only mouth/cheeks/eyes/head-lean (and the food shrinking) change.
[MOTION — eating, one continuous sequence] F1: mouth closed, notices food. F2: leans in,
mouth starting to open. F3: mouth wide open about to bite. F4: chomp down, food bitten
smaller. F5: cheeks puffed, chewing, eyes squint happily. F6: chewing (other side). F7:
swallow, eyes soften. F8: mouth closed, satisfied content smile.
```

**happy (8 frames, plays once)**
```
[FRAME STRIP] 8 frames, evenly spaced, same baseline.
[INVARIANTS — identical in all 8] same creature, colors, edges, size, camera.
Only pose/vertical position and small sparkle FX change per MOTION.
[MOTION — one joyful hop] F1: neutral, happy. F2: crouch/squash, anticipating. F3: deeper
crouch. F4: push off, body stretching upward. F5: airborne peak, stretched, small sparkles
around it. F6: starting to descend. F7: descending faster. F8: landing squash, big smile.
```

**sad (8 frames, loop)**
```
[FRAME STRIP] 8 frames, evenly spaced, same baseline.
[INVARIANTS — identical in all 8] same creature, colors, edges, size, camera.
Only droop, eyes, and a tear change per MOTION.
[MOTION — slow sad loop] F1: drooped, downturned mouth, sad eyes. F2: droops a little
more. F3: deeper droop. F4: deepest droop, a tear welling at the eye. F5: tear slides
down. F6: tear drips off. F7: small sniff, slight settle. F8: breath in, slight rise.
Loops back to F1 slowly.
```

## manifest.json draft template (per form — before packing)

`frames` are frame file names; `pack_sheet.py` rewrites them to cell indices and adds
`sheet` + `columns`.

```json
{
  "id": "<species>/<form>",
  "frameSize": 64,
  "displayScale": 2,
  "animations": {
    "idle":  { "frames": ["idle_0", "idle_1", "idle_2", "idle_3", "idle_4", "idle_5", "idle_6", "idle_7"], "fps": 8, "loop": true },
    "eat":   { "frames": ["eat_0", "eat_1", "eat_2", "eat_3", "eat_4", "eat_5", "eat_6", "eat_7"], "fps": 10, "loop": false, "then": "idle" },
    "happy": { "frames": ["happy_0", "happy_1", "happy_2", "happy_3", "happy_4", "happy_5", "happy_6", "happy_7"], "fps": 10, "loop": false, "then": "idle" },
    "sad":   { "frames": ["sad_0", "sad_1", "sad_2", "sad_3", "sad_4", "sad_5", "sad_6", "sad_7"], "fps": 4, "loop": true }
  }
}
```

After `pack_sheet.py` (columns 8 → 4 rows), the manifest is index-based:

```json
{
  "id": "<species>/<form>",
  "frameSize": 64,
  "displayScale": 2,
  "sheet": "sheet.png",
  "columns": 8,
  "animations": {
    "idle":  { "frames": [0, 1, 2, 3, 4, 5, 6, 7], "fps": 8, "loop": true },
    "eat":   { "frames": [8, 9, 10, 11, 12, 13, 14, 15], "fps": 10, "loop": false, "then": "idle" },
    "happy": { "frames": [16, 17, 18, 19, 20, 21, 22, 23], "fps": 10, "loop": false, "then": "idle" },
    "sad":   { "frames": [24, 25, 26, 27, 28, 29, 30, 31], "fps": 4, "loop": true }
  }
}
```

## species.json template

```json
{
  "id": "<species>",
  "archetype": "<archetype>",
  "branchWhitelist": ["<A>", "<B>", "<C>"],
  "forms": {
    "stage1":     { "frameSize": 64 },
    "stage2-<A>": { "frameSize": 64, "from": "stage1", "condition": { "stat": "<catA>", "gte": 100 } },
    "stage2-<B>": { "frameSize": 64, "from": "stage1", "condition": { "stat": "<catB>", "gte": 100 } },
    "stage2-<C>": { "frameSize": 64, "from": "stage1", "condition": { "stat": "<catC>", "gte": 100 } },
    "stage3-<A>": { "frameSize": 96, "from": "stage2-<A>", "condition": { "stat": "<catA>", "gte": 300 } },
    "stage3-<B>": { "frameSize": 96, "from": "stage2-<B>", "condition": { "stat": "<catB>", "gte": 300 } },
    "stage3-<C>": { "frameSize": 96, "from": "stage2-<C>", "condition": { "stat": "<catC>", "gte": 300 } }
  }
}
```

## catalog.json entry template

```json
{
  "id": "<species>",
  "displayName": "<name>",
  "archetype": "<archetype>",
  "concept": "<one-line concept>",
  "claimedMotifs": ["<motif>", "..."],
  "claimedColors": ["<color>", "..."],
  "branches": ["<A>", "<B>", "<C>"]
}
```

## Notes

- `condition.stat` values are placeholders until the work-tracking spec finalizes them;
  the threshold numbers are provisional too.
- Existing frames make excellent reference images. Evolutions MUST attach the
  previous stage; consistency from a reference beats text alone.
- Simpler, rounder creatures reproduce best; complex/humanoid forms need more
  hand-cleanup.
- Related: `src/assets/pets/pet_design.md`,
  `docs/superpowers/specs/2026-06-16-krobi-pet-evolution-pipeline-design.md`.
