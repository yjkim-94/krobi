# Krobi pet style rules (LOCKED — single source of truth)

Every pet/form prompt injects this file verbatim. The skill references these rules; it
does not duplicate them.

Visual anchor (reference): `src/assets/pets/style_ref_roster.png` (Octopath / HD-2D
character roster). The Style Bible below is a written transcription of that image's
**rendering technique** (pixel density, palette, outline, shading, deformation). However,
that roster is humanoid, so **do NOT attach it as a prompt reference** (attaching it drags
generations toward humanoid forms, conflicting with the evolution rules). The attached
reference is always a previous frame/stage of the same creature (§2, §3).

## 1. Style Bible

```
Render the creature in HD-2D pixel art, in the "simple HD" JRPG overworld-sprite style
(Octopath Traveler / HD-2D lineage). Follow every direction below exactly.

**Proportions** — Give it a super-deformed mini-heroic build, about 2.5 heads tall for
bipedal forms (sturdier and taller than 1:1 chibi; never realistic): a large head/main mass,
short sturdy limbs, and a compact grounded stance. For non-bipedal creatures (blob,
quadruped), use a compact rounded mass with the same restraint.
**Eyes & face** — Keep the eyes small and simple: 1-3px dark almond/dot eyes with at most a
single 1px highlight. Express emotion through eye shape and brow, not size, and add only a
minimal few-pixel nose/mouth. Do not draw big glossy anime/chibi eyes or large white sclera.
**Outline** — Do not use any black keyline. Outline only selectively, with a darker shade of
the adjacent local color (a dark-teal edge on a teal body, dark-brown on brown cloth). Let
the silhouette read by value contrast against the background, not a black border, and
separate interior forms with shading rather than black lines.
**Palette** — Use a muted, desaturated, earthy palette: warm browns, creams, olive/forest
greens, muted brick reds, slate blue-greys, soft golds. Keep saturation low-to-medium,
slightly grayed and harmonious, with a small coherent palette per creature (~12-24 colors).
Do not use neon, pure-saturated primaries, gradients, or airbrush.
**Shading** — Use soft banded cel shading: per material, a base tone plus one shadow and an
occasional single highlight (2-3 value steps), with light coming consistently from the
upper-left. Add tiny specular dots only on metal or wet surfaces. Do not use smooth gradients
or 3D/realistic rendering.
**Pixels** — Use clean, deliberate pixel clusters with crisp readable edges and minimal hand
antialiasing at key curves only. Do not dither or leave stray/noisy pixels. Render large, but
design it to read cleanly when downscaled to ~64px.
**Canvas** — Place the creature centered on a solid flat magenta #ff00ff background (for
keying), with no baked ground shadow.

**Creature** — <<<USER CONCEPT HERE>>>

**Never** include: text, UI, logos, watermarks, signatures, multiple creatures per frame,
black keyline outlines, big anime/chibi eyes, gradient/airbrush shading, realistic/3D shading,
neon colors, or a baked ground shadow.
```

Reference line (always include when attaching a previous frame/stage):

```
**Reference** — Match the attached image's exact art style: pixel density, muted earthy
palette, selective colored (never black) outline, soft banded cel shading, and mini-heroic
deformation with small simple eyes. Keep this creature's identity consistent; only the
per-frame motion (and, for evolutions, gradual added detail) changes.
```

## 2. Frame count / order rules

- Frames per action (standard): **8 frames for every action** (idle/eat/happy/sad = 8 each
  = 32 frames/form). More frames make the motion smoother. **Every form of every species
  follows this standard.**
- Describe multi-frame continuous actions as a **numbered storyboard** and enforce causal
  order. e.g. "F1 draw the sword from its sheath → F2 raise it overhead → F3 swing down."
  (Never produce a causally reversed order, such as slashing before drawing.)
- When generating a sequential-action strip, **attach the previous frame as reference** to
  keep pose continuity.

## 3. Evolution continuity rules (evolution formula)

- Each evolution form (stage2/stage3) prompt **attaches the previous stage's frame as
  reference** and preserves silhouette/identity.
- No abrupt form changes: a slime suddenly becoming human/machine/angel/plant is unnatural.
- Allowed: **gradual additions of ornament/size/appendages.**
  e.g. a slime keeps its shape while gaining a cape → then a crown.
  e.g. a small demon's horns grow and flames begin to float behind it.
- Reachable styles are limited by the species' `branchWhitelist` (species.json). Styles that
  do not fit the archetype (e.g. slime → angel/plant) are not whitelisted.

## 4. Sheet discipline (LOCKED — injected verbatim into every prompt)

This block is the sheet *geometry / extraction-safety* contract. It is style-agnostic, so
it applies to every pet and every form. Inject it verbatim alongside the Style Bible (§1).
The image model ignores a one-line "evenly spaced" note; these explicit rules are what make
a strip cleanly sliceable.

```
Sheet discipline — apply all of this to the whole sheet:
**Grid** — Lay the frames out on a strict, regular grid: the exact number of frames stated in
every row, all rows the same length, filling every cell. Give every cell the same width and
height and the same horizontal pitch (center-to-center spacing) across the whole row, and
align the columns vertically across all rows. Do NOT bunch frames together, do NOT leave empty
cells or large gaps mid-row, and do NOT vary the spacing within a row. Keep equal margins on
all four sides; no frame may touch a canvas edge. The result must look like a machine-cut
grid, ready for automatic frame extraction.
**Column gap (critical, even at peak poses)** — Leave a clearly visible solid-background gap
of at least 15% of the cell width between every adjacent pair of frames in a row, including
frames where the pose is widest (arms raised, parts expanded, peak stretch/squash). Shrink the
creature slightly within its cell if needed so its widest pose never touches or overlaps the
neighboring cell. No two frames may ever be visually connected by touching pixels — each frame
must extract as one fully separate, disconnected blob.
**Size lock** — Draw the creature at the same pixel footprint in every single frame: its width
and height stay within ~10% across all frames. The ONLY allowed shape change is the
squash/stretch described in the motion; never zoom, change camera distance, or make some
frames noticeably bigger or smaller than others.
**Baseline** — Within each row, give every frame the exact same ground baseline; the bottom
contact point must not drift sideways. Grow any squash/stretch from that baseline. Only frames
explicitly described as airborne in the motion may lift off it.
**Bounding box** — Keep the creature within the same imaginary box every frame; no frame is
noticeably larger or smaller, and no body part is cropped.
**Effects** — Do not add detached particles, distant sparkles, or floating decorations. Keep
all FX inside or immediately adjacent to the creature silhouette.
**Single object** — Keep any prop (food, item) touching the creature (at its mouth/hands) in
every frame it appears, so the creature and prop read as one connected silhouette. Never draw
the prop as a separate ball/object sitting in empty space beside the creature.
**Transition** — Make the first and last frame of each action closely match that action's
resting pose, so it loops or returns to idle seamlessly.
**Background (strict)** — Keep every non-creature pixel pure #ff00ff: no gradients, lighting,
glow, vignette, texture, color variation, or baked ground shadow.
```
