```
Produce ONE sprite sheet as a single image: a strict 4-row × 8-column grid, 32 frames in
total, read left→right within each row and top→bottom across rows. Every row must contain all
8 frames at the SAME even horizontal spacing and with its columns aligned to the other rows —
no row may be sparser, bunched to one side, or have empty cells or gaps mid-row. Every frame
shows the SAME creature at the SAME size and style; each row is one 8-frame animation. Rows,
in order: Row 1 = idle, Row 2 = eat, Row 3 = happy, Row 4 = sad.

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

**Creature** — krombi maker evolution (stage3), a towering "lava forge-golem" — the dramatic
final form of the stage2 magma blacksmith. Same lava creature line and palette (muted
brick-red to ember-orange with soft gold-orange glowing magma cracks, NOT neon), but now a
massive, imposing, mountain-like forge-golem with a clearly TRANSFORMED, bigger silhouette
(not just a scaled-up stage2). Key dramatic features: a glowing exposed molten-lava CORE set
into its chest like an open furnace, the brightest focal point of the body; heavy, thick,
ASYMMETRIC cooled-basalt rock-plate armor slabs built up over the shoulders, back and arms
(one side bulkier than the other); a small anvil-and-forge structure fused onto its broad back
like a shell. **Exactly two arms, never more:** the RIGHT arm/hand permanently grips a single
OVERSIZED smith's hammer — a long charcoal-basalt handle topped with a massive blocky
stone-and-magma hammer-head (nearly as big as its torso), with glowing magma cracks running
through the hammer-head to match the body. The hammer-head must be a clearly distinct
rectangular/mallet shape — NOT a rounded fist, NOT another rock-plate lump, and NOT absent.
The right arm/hand never lets go of the hammer and never lifts it overhead; across every
frame in every row it stays low, planted on the ground beside the creature or held close
against the body, as one connected silhouette (never floating). The LEFT arm/hand is the only
free limb — it is the one that moves, gestures, holds food, or rises for any "raised arm"
expression. Never draw a third arm/hand, and never show the hammer floating without a hand on
the handle.
**The hammer is a MANDATORY signature prop: draw it explicitly in EVERY one of the 32 frames,
in all four rows (idle, eat, happy, sad), always gripped by the right hand — re-check each row
before finalizing that the hammer is visibly present and held, and that there are only two
arms total.**
**Palette lock (critical)** — the body MUST be hot brick-red to ember-orange molten lava with
bright gold-orange glowing magma cracks; the only dark element is a charcoal/black-basalt rock
crust. Do NOT make the body green, olive, mossy, sandy, tan, grey, beige, or plain dull stone
— it is a glowing LAVA creature, matching the red/ember palette of the attached stage2
reference, not a mossy stone golem.
Sturdy, grounded, broad-shouldered stance, noticeably taller and heavier than stage2. It must
still read as the same lava blacksmith line (red lava body + charcoal rock crust + magma
cracks + hammer), only far more powerful and evolved. Do NOT make it a metal machine, a
dragon, or a realistic humanoid.

**Reference** — Match the attached image's exact art style: pixel density, muted earthy
palette, selective colored (never black) outline, soft banded cel shading, and mini-heroic
deformation with small simple eyes. Keep this creature's identity consistent; only the
per-frame motion (and, for evolutions, gradual added detail) changes.

Sheet discipline — apply all of this to the whole sheet:
**Grid** — Lay the frames out on a strict, regular grid: exactly 8 frames in every row and
exactly 4 rows, filling all 32 cells. Give every cell the same width and height and the same
horizontal pitch (center-to-center spacing) across the whole row, and align the columns
vertically across all four rows. Do NOT bunch frames together, do NOT leave empty cells or
large gaps mid-row, and do NOT vary the spacing within a row. Keep equal margins on all four
sides; no frame may touch a canvas edge. The result must look like a machine-cut grid, ready
for automatic frame extraction.
**Column gap (critical, even at peak poses)** — Leave a clearly visible solid-background gap
of at least 15% of the cell width between every adjacent pair of frames in a row, including
frames where the creature's pose is widest (arms raised, parts expanded/raised, peak stretch).
Shrink the creature slightly within its cell if needed so its widest pose never touches or
overlaps the neighboring cell. No two frames may ever be visually connected by touching pixels.
**Size lock** — Draw the creature at the same pixel footprint in every single one of the 32
frames: its width and height stay within ~10% across all frames. The ONLY allowed shape change
is the squash/stretch described in the motion; never zoom, change camera distance, or make
some frames noticeably bigger or smaller than others.
**Baseline** — Within each row, give every frame the exact same ground baseline; the bottom
contact point must not drift sideways. Grow any squash/stretch from that baseline. Only frames
explicitly described as airborne in the motion may lift off it.
**Bounding box** — Keep the creature within the same imaginary box every frame; no frame is
noticeably larger or smaller, and no body part is cropped.
**Effects** — Do not add detached particles, distant sparkles, or floating decorations. Keep
all FX inside or immediately adjacent to the creature silhouette.
**Single object** — Keep any prop (the hammer, food) touching the creature (at its hand/mouth)
in every frame it appears, so the creature and prop read as one connected silhouette. Never
draw the prop as a separate object sitting in empty space beside the creature.
**Transition** — Make the first and last frame of each row closely match that animation's
resting pose, so it loops or returns to idle seamlessly.
**Background (strict)** — Keep every non-creature pixel pure #ff00ff: no gradients, lighting,
glow, vignette, texture, color variation, or baked ground shadow.

Row 1 — idle (gentle breathing loop), 8 frames left→right.
Keep identical across Row 1 the same creature, colors, edges, overall size, ground position,
and camera; only the body silhouette changes between frames. The oversized hammer stays
gripped/planted against the body in every frame of this row, clearly visible.
Frame 1 — neutral resting. Frame 2 — exhale, slightly squashed (shorter/wider). Frame 3 —
deeper squash. Frame 4 — deepest squash (lowest, widest). Frame 5 — rising back toward
neutral. Frame 6 — inhale, slightly stretched (taller/narrower). Frame 7 — more stretch.
Frame 8 — peak stretch (tallest, narrowest). Frame 8 returns to the Frame 1 pose so the row
loops seamlessly.

Row 2 — eat (one continuous eating sequence), 8 frames left→right.
Keep identical across Row 2 the same creature, colors, edges, overall size, ground position,
and camera. The RIGHT hand keeps gripping the hammer, low and still, exactly as in Row 1 —
it never moves to help with eating. The food is held by the LEFT (free) hand only, brought up
to the mouth; only the mouth, cheeks, eyes, head-lean, and left hand/food change. Never draw a
third hand to hold the food. From Frame 1 on, the food is already held right at the mouth,
touching the face, and shrinks bite by bite; it is one connected shape with the creature and
must NEVER appear as a separate ball floating beside the body.
Frame 1 — food held at the closed mouth, eyeing it. Frame 2 — leans toward the food, mouth
starting to open. Frame 3 — mouth wide open over the food, about to bite. Frame 4 — chomp
down, food bitten smaller. Frame 5 — cheeks puffed, chewing, eyes squint happily. Frame 6 —
chewing on the other side. Frame 7 — swallow, eyes soften. Frame 8 — mouth closed, satisfied
content smile.

Row 3 — happy (a parts-jitter with a light pulse in place), 8 frames left→right.
Keep identical across Row 3 the same creature, colors, edges, size, camera, and facing.
Keep the chassis grounded on the baseline and show joy by shifting parts and pulsing the magma
cracks' glow, not by jumping, and keep the FX (glints/glow pulses) on the body surface. The
RIGHT hand keeps gripping the hammer, low and still, exactly as in Row 1 — it never raises or
lets go. Only the LEFT (free) hand, the rock-plates, and the magma glow may move/expand; never
draw a third hand and never show both arms raised.
Frame 1 — idle, magma glow low. Frame 2 — rock plates perk up, glow brightens a step. Frame 3
— small upward part-shift, glow brighter. Frame 4 — peak: LEFT arm/plates raised and expanded
(right arm/hammer stays low and gripped), magma cracks at their brightest pulse, tiny glints
hugging the surface. Frame 5 — hold the bright pulse. Frame 6 — parts easing back, glow
dimming a step. Frame 7 — settling. Frame 8 — back to idle parts/glow (matching frame 1).

Row 4 — sad (slow loop), 8 frames left→right.
Keep identical across Row 4 the same creature, colors, edges, size, and camera; only the
droop, eyes, and a tear change. The oversized hammer stays gripped/planted against the body in
every frame of this row, clearly visible.
Frame 1 — drooped, downturned mouth, sad eyes. Frame 2 — droops a little more. Frame 3 —
deeper droop. Frame 4 — deepest droop, a tear welling at the eye. Frame 5 — tear slides down.
Frame 6 — tear drips off. Frame 7 — small sniff, slight settle. Frame 8 — breath in, slight
rise. Loop slowly back to frame 1.

**Never** include: text, UI, logos, watermarks, signatures, multiple creatures per frame,
black keyline outlines, big anime/chibi eyes, gradient/airbrush shading, realistic/3D shading,
neon colors, or a baked ground shadow.
```
