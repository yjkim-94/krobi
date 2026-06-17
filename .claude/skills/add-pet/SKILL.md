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

## References

- Animation prompt blocks (INVARIANTS + MOTION): `references/animation-prompts.md`
- File templates (manifest / species.json / catalog.json): `references/templates.md`

## Evolution model (per species: 7 forms)

```
stage1 (유년기, no branch)
  ├─ stage2-<A> ─→ stage3-<A>
  ├─ stage2-<B> ─→ stage3-<B>
  └─ stage2-<C> ─→ stage3-<C>
```

- One form = the standard 4-animation set (idle 8 / eat 8 / happy 8 / sad 8 = 32 frames).
  Every form of every species follows this standard.
- The three branches are **fixed to the user tendencies**: `maker` (생산·창작),
  `sage` (탐구·학습), `wild` (유희·감상). They are NOT picked from a free style pool.
- **Identity-variation rule:** stage2/3 of each branch MUST be a variation of the stage1
  identity (same material / element / silhouette lineage), specialized toward the branch:
  `maker` forges/builds/shapes, `sage` illuminates/refines/knows, `wild` runs untamed/fierce.
  No genre jumps (a lava slime never becomes a machine). Example (krombi): maker →
  마그마 대장장이→용암 골렘, sage → 도깨비불→지혜의 등불 정령, wild → 불꽃 야수→화염 정령.
- **Stage-intensity cadence:** the two evolutions are NOT equal steps.
  - **stage2 = moderate** — clearly still the stage1 body, with added ornament/appendages and
    the branch's signature prop (e.g. the blob grows stubby arms + a hammer). Gradual.
  - **stage3 = dramatic** — the climactic FINAL form: a substantially TRANSFORMED, larger,
    more imposing silhouette with new signature structures (not just a scaled-up stage2),
    while strictly preserving the species' core identity — same element/material, **same
    palette**, and the branch's signature prop. Push the silhouette change hard here; only the
    no-genre-jump and identity/palette locks constrain it.
- Authoring all 7 forms is the full job; a single playthrough only shows
  stage1 → one stage2 → one stage3.

## Scope

- **In scope:** producing the per-species folder structure under
  `src/assets/pets/<species>/`, with form folders (one `sheet.png` + manifest.json),
  `species.json` (evolution tree), and a `catalog.json` entry.
- **Out of scope:** the work-tracking runtime that drives which branch is reached,
  evolution transition FX, and the app's multi-form runtime loader.
  Evolution in species.json is expressed as `expToEvolve` per form (EXP threshold) with the
  branch resolved from the dominant tendency at the first evolution; the live runtime drives it.

## Prerequisites

- **One-step builder: `tools/build_form.py`** (extract → draft manifest → pack in one
  command; the standard path for Steps 4/6/7). Pass `--no-pack` to stop at the preview for
  the Step 5 gate, then re-run without it to finalize.
- Extractor: `tools/extract_sprites.py` (frame splitting only — what the builder calls).
- Sheet packer: `tools/pack_sheet.py` (merges per-frame PNGs into one `sheet.png` and
  rewrites the manifest with cell indices + `sheet`/`columns` — what the builder calls).
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
5. **branch themes (maker / sage / wild)** — after the stage1 concept is set, YOU propose
   three evolved themes, one per fixed tendency (`maker` 생산·창작 / `sage` 탐구·학습 /
   `wild` 유희·감상), each a variation of the stage1 identity (per the Identity-variation
   rule), folding in any extra concept the user gives. The user confirms/adjusts before
   catalog + prompts are generated.
6. **style reference** — an existing frame for consistency.
   Default: a frame from the base species' `stage1` (e.g. `src/assets/pets/krombi/stage1/`).

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

`Read` `src/assets/pets/pet_design.md` and inject it verbatim. Output ONE ready-to-paste
full-sheet prompt that generates the whole **4-row × 8-column sheet** (idle / eat / happy /
sad) in a single image =
**the Sheet layout block + pet_design.md §1 Style Bible + Reference line + §4 Sheet discipline
(all verbatim) + the four row blocks (idle, eat, the body-form happy, sad) + the closing
`**Never** include` line** (blocks in `references/animation-prompts.md`), with the form's
concept substituted into the Style Bible's `**Creature**` line.

**Writing the `**Creature**` line per stage** (this is where the stage-intensity cadence is
enforced):
- **stage2** — describe the stage1 body explicitly, then add the branch's ornament/appendages
  + signature prop. Keep it recognizable as stage1 grown a little.
- **stage3** — describe a DRAMATIC final form: a bigger, transformed, more imposing silhouette
  with new signature structures (push the silhouette change). Do NOT write "a slightly bigger
  stage2".
- **Palette lock (every evolution):** image models follow the attached reference's colors more
  than prose, but they still drift — so restate the species' exact palette in the `**Creature**`
  line as a hard constraint and name the wrong-direction colors to avoid (e.g. for a lava
  creature: "hot brick-red/ember lava body with a charcoal-basalt crust — NOT green, mossy,
  tan, or grey stone"). The dramatic stage3 change is in SILHOUETTE/structure, never in element
  or palette.
- **Signature prop:** if the branch has a defining prop (maker's hammer, etc.), mark it
  MANDATORY in every frame so a re-roll can't drop it.
- Some models (e.g. Gemini) stamp a corner logo/watermark; the closing `**Never** include`
  line already forbids `logos, watermarks, signatures`. A corner mark outside the creature
  silhouette is usually dropped by the per-frame content crop anyway.

**happy is body-form specific** — do NOT use a single fixed hop (a machine must not jump
like a slime). Map the form's archetype/branch to a body-form file, `Read` only that one,
and inject ITS invariants + motion as Row 3 (its `--anchor` applies only to the single-strip
fallback; the full-sheet builder in Step 4 uses `preserve`):

| archetype / branch | `motion-by-form/` file | `--anchor` |
|---|---|---|
| slime, ooze, morph, spirit, blob | `blob.md` | preserve |
| beast, ground dragon, quadruped | `quadruped.md` | preserve |
| humanoid, human, demon | `humanoid.md` | bottom |
| flying dragon, angel, winged | `winged.md` | preserve |
| machine, golem | `machine.md` | bottom |

Per-form reference image:
- **stage1:** the chosen style reference (default: a frame from the base species' stage1).
- **stage2-X:** that species' `stage1/idle_0.png`.
- **stage3-X:** that species' `stage2-X/idle_0.png`.

**Persist the prompt — two files:**

1. **Form folder (committed):** Write `src/assets/pets/<species>/<form>/prompt.md` containing
   ONLY the single full-sheet prompt in one self-contained fenced block (Sheet layout block +
   full Style Bible with filled `**Creature**` line + Reference line + §4 Sheet discipline block +
   the four row blocks + the closing `**Never** include` line). No workflow text in this file.
   Write it in English.

2. **Generator input (gitignored):** Write the same prompt as plain text (no fencing, no markdown)
   to `tools/prompts/<species>_<form>.txt`.

**Approval gate:** Show the user the full prompt (the same content written to `prompt.md`)
and the planned command below. Wait for the user to approve or request edits. Do NOT run
the command until they approve. Once approved, run Steps 3 (generation) through 7
(species.json/catalog.json) yourself without further manual handoff — only stop early if
the Step 5 gate fails repeatedly or something is ambiguous enough to need the user's input.

```
tools/venv/bin/python tools/gen_image.py \
  tools/prompts/<species>_<form>.txt \
  --out src/assets/pets/_incoming/<species>_<form>_sheet.png \
  --ref <per-form reference image path from the table above>
```

Requires `OPENAI_API_KEY` set in `tools/.env` (gitignored) or the environment.
Omit `--ref` for stage1 (no reference image chosen yet). Run it yourself; proceed straight
to Step 4 once the PNG appears in `_incoming/`.

### Step 4 — Build the form folder (extract → manifest → pack)

`tools/build_form.py` does all three in one command: it extracts the 32 frames, writes the
draft manifest (standard idle/eat/happy/sad set), and packs `sheet.png` + the index manifest.
`--size` = the form's frameSize from species.json (stage1/2 = 64, stage3 = 96 in the krombi
example). It defaults to the full-sheet grid (`--rows 4 --cols 8`) and `--anchor preserve`,
and infers `id` as `<species>/<form>` from `--out`.

**Recommended (keeps the Step 5 gate):** build with `--no-pack` first, inspect the preview,
then re-run without `--no-pack` to finalize (re-extracts + packs):

```bash
# 1) extract + draft manifest + preview (stops before packing)
tools/venv/bin/python tools/build_form.py \
  src/assets/pets/_incoming/<species>_<form>_sheet.png \
  --out src/assets/pets/<species>/<form> --size <frameSize> --no-pack
# 2) after the preview passes Step 5:
tools/venv/bin/python tools/build_form.py \
  src/assets/pets/_incoming/<species>_<form>_sheet.png \
  --out src/assets/pets/<species>/<form> --size <frameSize>
```

The packed result is `sheet.png` + index `manifest.json` (individual frame PNGs deleted) —
the form's drop-in asset (see the packed example in `references/templates.md`).

**Why grid + preserve (the builder's defaults):** grid mode (`--rows`/`--cols`) splits each
row at only the largest `cols-1` gaps, so detached auxiliary FX (sparkles, flames, lightning,
ice, mist, radiance/glow) stay merged into their frame instead of being split off. Auto mode
would fragment such FX. `--anchor preserve` keeps the happy row's airborne lift and is safe
for the in-place rows (zero lift behaves like `bottom`). Tune `--tol` if the gate fails (raise
to kill leftover shadow; lower if edges get eaten). The builder just calls
`extract_sprites.py` then `pack_sheet.py`; run those directly only for the single-strip
fallback (regenerating one row alone → `extract_sprites.py … --rows 1 --cols 8`, then
`pack_sheet.py`).

### Step 5 — Inspect (gate)

`Read` the `_preview.png` (written next to the incoming sheet). Check: correct frame count,
**correct causal order** (no reversed sequences, see pet_design.md §2), solid bodies, clean
transparent background, and the §4 Sheet discipline contract: **scale variation ≤10%, fixed
baseline (no sideways drift), FX not detached, any food/prop attached (not a separate blob),
and frame 1 ≈ frame 8 resting pose**, and identity consistent with the reference. If wrong,
tune `--tol` and re-run yourself first. Only fall back to asking the user to regenerate
(clearer spacing / corrected order / wrong body-form motion) if a couple of `--tol` retries
don't fix it. When it passes, finalize with Step 4 step 2
(without `--no-pack`).

### Step 6 — Write/update species.json and catalog.json

- `src/assets/pets/<species>/species.json` — from the species.json template in
  `references/templates.md`. Fill `forms` with every form you intend (declare the tree
  even if some art is pending). Use `expToEvolve` per form (stage3 omits it); branch keys
  are always `maker`/`sage`/`wild`.
- Append the species to `src/assets/pets/catalog.json` (`branches` lists the branch keys
  `maker`/`sage`/`wild`). Use the catalog.json entry template in `references/templates.md`.
  The file is `{ "species": [ … ] }`; push the new entry into the `species` array.
  Skip if the entry already exists.

### Step 7 — Done

The species folder now matches the app's contract. Commit each form's `sheet.png` +
manifest.json + species.json + catalog.json.

---

## Notes

- `expToEvolve` numbers are provisional and tuned by the runtime spec; stage3 forms omit it
  (terminal).
- Existing frames make excellent reference images. Evolutions MUST attach the
  previous stage; consistency from a reference beats text alone.
- Simpler, rounder creatures reproduce best; complex/humanoid forms need more
  hand-cleanup.
- Related: `src/assets/pets/pet_design.md`,
  `docs/superpowers/specs/2026-06-16-krobi-pet-evolution-pipeline-design.md`.
