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
HD-2D pixel art, "simple HD" JRPG overworld-sprite style (Octopath Traveler / HD-2D lineage).

[PROPORTIONS] Super-deformed mini-heroic build, ~2.5 heads tall for bipedal forms
(sturdier and taller than 1:1 chibi; never realistic). Large head/main mass, short
sturdy limbs, compact grounded stance. For non-bipedal creatures (blob, quadruped),
a compact rounded mass with the same restraint.
[FACE/EYES] Small simple eyes: 1-3 px dark almond/dot eyes with at most a single 1px
highlight; expressive via shape and brow, NOT via size. Minimal few-pixel nose/mouth.
NO big glossy anime/chibi eyes, no large white sclera.
[OUTLINE] NO black keyline. Selective/colored outlining only: edge pixels are a darker
shade of the adjacent LOCAL color (dark-teal edge on a teal body, dark-brown on brown
cloth). The silhouette reads by value contrast against the background, not a black
border. Separate interior forms with shading, not black lines.
[PALETTE] Muted, desaturated, earthy palette: warm browns, creams, olive/forest greens,
muted brick reds, slate blue-greys, soft golds. Low-to-medium saturation, slightly
grayed and harmonious. Small coherent palette per creature (~12-24 colors total).
NO neon, no pure-saturated primaries, no gradients/airbrush.
[SHADING] Soft banded cel shading: per material a base tone + 1 shadow + occasional
1 highlight (2-3 value steps). Consistent light from upper-left. Tiny specular dots
only on metal/wet surfaces. NO smooth gradients, no 3D/realistic rendering.
[PIXELS] Clean, deliberate pixel clusters; crisp readable edges; minimal hand
antialiasing at key curves only; NO dithering, no stray/noisy pixels. Render LARGE
but designed to read cleanly when downscaled to ~64 px.
[CANVAS] Solid flat magenta #ff00ff background only (for keying), creature centered,
no baked ground shadow.

Creature: <<<USER CONCEPT HERE>>>

Do NOT: text, UI, multiple creatures per frame, black keyline outline, big anime/chibi
eyes, gradient/airbrush shading, realistic/3D shading, neon colors, baked ground shadow.
```

Reference line (always include when attaching a previous frame/stage):

```
[REFERENCE] Match the attached image's EXACT art style: pixel density, muted earthy
palette, selective colored (NO black) outline, soft banded cel shading, and mini-heroic
deformation with small simple eyes. Keep this creature's identity consistent; only the
per-frame motion (and, for evolutions, gradual added detail) changes.
```

## 2. Frame count / order rules

- Frames per action (standard): **8 frames for every action** (idle/eat/happy/sad = 8 each
  = 32 frames/form). More frames make the motion smoother. **Every form follows this
  standard** (the existing `krobi/stage1` is also regenerated in the new style at 8 frames).
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
