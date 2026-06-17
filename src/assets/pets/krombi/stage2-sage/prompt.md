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

**Creature** — krombi sage evolution (stage2), a budding "will-o'-wisp magma sprite" — a
MODERATE evolution of the stage1 molten lava blob. Still clearly the same round, grounded,
LIMBLESS blob body (no arms, no hands — keep it limbless exactly like stage1): muted
brick-red to ember-orange body with a dark cracked basalt/magma crust and soft gold-orange
glowing lava cracks (muted and earthy, NOT neon), matching the attached stage1 reference
exactly. The new sage ornament: a single upright ember-wisp flame — a soft gold-white,
hotter-than-the-body flame-wick shaped like a small candle flame — fused growing directly out
of the top of its head, gently flickering. Two or three smaller matching ember-wisp flecks of
the same gold-white flame are fused directly onto its back/shoulders (never separate floating
particles — each flame-fleck touches and grows out of the body surface). A faint glowing
rune-like mark (a simple closed-eye or spiral glyph) glows softly on its forehead, hinting at
emerging insight.
**Palette lock (critical)** — the body stays hot brick-red to ember-orange lava with a
charcoal-basalt crust and gold-orange cracks, exactly like stage1; the NEW wisp-flame and
forehead rune are a hotter gold-white (still warm, NOT blue, NOT green, NOT purple — every
added color stays within the brick-red/ember-orange/gold family). Do NOT make the body or the
new flame green, mossy, tan, grey, or any cool hue — it is a glowing LAVA + FIRE creature only.
**Signature feature (mandatory):** the head-top wisp-flame and forehead rune-mark are this
form's signature features — draw them explicitly in EVERY one of the 32 frames, in all four
rows (idle, eat, happy, sad), always fused to the body (never floating away, never absent).
Because the creature is limbless, there is no held prop and no arm/hand to manage — only the
flame and rune need to stay visibly present throughout.
Still a single round, grounded, limbless blob silhouette — only slightly larger than stage1,
with the wisp-flame and rune-mark as the sole added detail. Do NOT add arms, legs, a face
beyond the simple eyes/mouth, or any other new body part.

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
frames where the pose is widest (arms raised, parts expanded, peak stretch/squash). Shrink the
creature slightly within its cell if needed so its widest pose never touches or overlaps the
neighboring cell. No two frames may ever be visually connected by touching pixels — each frame
must extract as one fully separate, disconnected blob.
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
all FX (including the wisp-flame and flame-flecks) inside or immediately adjacent to the
creature silhouette.
**Single object** — Keep any prop (food) touching the creature (at its mouth) in every frame
it appears, so the creature and prop read as one connected silhouette. Never draw the prop as
a separate ball/object sitting in empty space beside the creature.
**Transition** — Make the first and last frame of each row closely match that animation's
resting pose, so it loops or returns to idle seamlessly.
**Background (strict)** — Keep every non-creature pixel pure #ff00ff: no gradients, lighting,
glow, vignette, texture, color variation, or baked ground shadow.

Row 1 — idle (gentle breathing loop), 8 frames left→right.
Keep identical across Row 1 the same creature, colors, edges, overall size, ground position,
and camera; only the body silhouette changes between frames. The head-top wisp-flame and
forehead rune-mark stay visible, gently flickering, in every frame of this row.
Frame 1 — neutral resting. Frame 2 — exhale, slightly squashed (shorter/wider). Frame 3 —
deeper squash. Frame 4 — deepest squash (lowest, widest). Frame 5 — rising back toward
neutral. Frame 6 — inhale, slightly stretched (taller/narrower). Frame 7 — more stretch.
Frame 8 — peak stretch (tallest, narrowest). Frame 8 returns to the Frame 1 pose so the row
loops seamlessly.

Row 2 — eat (one continuous eating sequence), 8 frames left→right.
Keep identical across Row 2 the same creature, colors, edges, overall size, ground position,
and camera. Only the mouth, cheeks, eyes, and head-lean change; the head-top wisp-flame and
forehead rune-mark stay visible in every frame. From Frame 1 on, the food is already held
right at the mouth, touching the face, and shrinks bite by bite; it is one connected shape
with the creature and must NEVER appear as a separate ball floating beside the body.
Frame 1 — food held at the closed mouth, eyeing it. Frame 2 — leans toward the food, mouth
starting to open. Frame 3 — mouth wide open over the food, about to bite. Frame 4 — chomp
down, food bitten smaller. Frame 5 — cheeks puffed, chewing, eyes squint happily. Frame 6 —
chewing on the other side. Frame 7 — swallow, eyes soften. Frame 8 — mouth closed, satisfied
content smile.

Row 3 — happy (one clean vertical hop in place), 8 frames left→right.
Keep identical across Row 3 the same creature, colors, edges, size, camera, and facing
(front-facing, upright). The body must never turn, tilt, lean left/right, or rotate — only
its vertical position and vertical squash/stretch change. Keep the round blob's grounded
weight and do not over-stretch it into a tall egg/oval (moderate stretch only). The head-top
wisp-flame and forehead rune-mark stay fused to the body and visible throughout, flaring
slightly brighter at the airborne peak.
The body axis stays vertical, with no sideways drift or turning: Frame 1 — resting, happy.
Frame 2 — squash down (shorter/wider), anticipating. Frame 3 — deeper squash. Frame 4 — push
off, stretching up (taller/narrower, but still clearly a round blob — moderate stretch).
Frame 5 — airborne peak, lifted just off the ground, wisp-flame flaring brighter. Frame 6 —
starting to fall, still upright. Frame 7 — falling back toward neutral. Frame 8 — landing
squash (shorter/wider), big smile.

Row 4 — sad (slow loop), 8 frames left→right.
Keep identical across Row 4 the same creature, colors, edges, size, and camera; only the
droop, eyes, and a tear change. The head-top wisp-flame and forehead rune-mark stay visible
but dim slightly as the creature droops.
Frame 1 — drooped, downturned mouth, sad eyes. Frame 2 — droops a little more. Frame 3 —
deeper droop. Frame 4 — deepest droop, a tear welling at the eye. Frame 5 — tear slides down.
Frame 6 — tear drips off. Frame 7 — small sniff, slight settle. Frame 8 — breath in, slight
rise. Loop slowly back to frame 1.

**Never** include: text, UI, logos, watermarks, signatures, multiple creatures per frame,
black keyline outlines, big anime/chibi eyes, gradient/airbrush shading, realistic/3D shading,
neon colors, or a baked ground shadow.
```
