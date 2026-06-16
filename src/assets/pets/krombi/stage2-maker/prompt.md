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

**Creature** — krombi maker evolution (stage2), a "magma blacksmith". Keep the SAME molten
lava blob from stage1 as the core body — a round, grounded brick-red to ember-orange blob with
a dark cracked basalt/magma crust, soft gold-orange glowing lava cracks (muted, NOT neon), and
a few tiny ember flecks. It is now slightly sturdier and has gained simple forge ornament: two
short stubby cooled-basalt arms have sprouted, one stubby hand gripping a small stone smith's
hammer held close against the body (part of the silhouette, never floating). A few cooled
dark-rock plates crust its shoulders and brow like a tiny forge apron, and one or two soft gold
sparks cling to the body. Still unmistakably the round lava blob from stage1 — only the stubby
arms, the small hammer, and a little rock-plate ornament are added; do NOT turn it into a
humanoid or change the round slime silhouette.

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
and camera; only the body silhouette changes between frames.
Frame 1 — neutral resting. Frame 2 — exhale, slightly squashed (shorter/wider). Frame 3 —
deeper squash. Frame 4 — deepest squash (lowest, widest). Frame 5 — rising back toward
neutral. Frame 6 — inhale, slightly stretched (taller/narrower). Frame 7 — more stretch.
Frame 8 — peak stretch (tallest, narrowest). Frame 8 returns to the Frame 1 pose so the row
loops seamlessly.

Row 2 — eat (one continuous eating sequence), 8 frames left→right.
Keep identical across Row 2 the same creature, colors, edges, overall size, ground position,
and camera. Only the mouth, cheeks, eyes, and head-lean change; the hammer stays held against
the body. From Frame 1 on, the food is already held right at the mouth, touching the face, and
shrinks bite by bite; it is one connected shape with the creature and must NEVER appear as a
separate ball floating beside the body.
Frame 1 — food held at the closed mouth, eyeing it. Frame 2 — leans toward the food, mouth
starting to open. Frame 3 — mouth wide open over the food, about to bite. Frame 4 — chomp
down, food bitten smaller. Frame 5 — cheeks puffed, chewing, eyes squint happily. Frame 6 —
chewing on the other side. Frame 7 — swallow, eyes soften. Frame 8 — mouth closed, satisfied
content smile.

Row 3 — happy (one clean vertical hop in place), 8 frames left→right.
Keep identical across Row 3 the same creature, colors, edges, size, camera, and facing
(front-facing, upright). The body must never turn, tilt, lean left/right, or rotate — only
its vertical position and vertical squash/stretch change. Keep the round blob's grounded
weight and do not over-stretch it into a tall egg/oval (moderate stretch only). Keep the
hammer and any small sparkle FX attached to the body.
The body axis stays vertical, with no sideways drift or turning: Frame 1 — resting, happy.
Frame 2 — squash down (shorter/wider), anticipating. Frame 3 — deeper squash. Frame 4 — push
off, stretching up (taller/narrower, but still clearly a round blob — moderate stretch).
Frame 5 — airborne peak, lifted just off the ground, small sparkles hugging the body. Frame 6
— starting to fall, still upright. Frame 7 — falling back toward neutral. Frame 8 — landing
squash (shorter/wider), big smile.

Row 4 — sad (slow loop), 8 frames left→right.
Keep identical across Row 4 the same creature, colors, edges, size, and camera; only the
droop, eyes, and a tear change.
Frame 1 — drooped, downturned mouth, sad eyes. Frame 2 — droops a little more. Frame 3 —
deeper droop. Frame 4 — deepest droop, a tear welling at the eye. Frame 5 — tear slides down.
Frame 6 — tear drips off. Frame 7 — small sniff, slight settle. Frame 8 — breath in, slight
rise. Loop slowly back to frame 1.

**Never** include: text, UI, multiple creatures per frame, black keyline outlines, big
anime/chibi eyes, gradient/airbrush shading, realistic/3D shading, neon colors, or a baked
ground shadow.
```
