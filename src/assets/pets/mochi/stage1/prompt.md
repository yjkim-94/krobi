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

**Creature** — A small, round, marshmallow-soft kitten with a compact mochi-like body: a
plump, doughy cream-white torso with no visible neck, short stubby legs tucked close to the
body, and a short fluffy tail curled at its side. Fur is rendered as smooth soft-banded fluff
(not individual hair strands), in a muted cream-white base with pale light-beige patches on
the back and tail tip, and pale dusty-pink paw pads, inner ears, and a tiny nose — NOT grey,
NOT orange/ginger, NOT black-and-white tuxedo. Big round dark-brown almond eyes (small per
the eyes rule above, not oversized anime eyes) and small triangular ears. Exactly four legs,
no held prop in this base form.

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

Row 1 — idle (gentle breathing loop), 8 frames left→right.
Keep identical across Row 1 the same creature, colors, edges, overall size, ground
position, and camera; only the body silhouette changes between frames.
Frame 1 — neutral resting. Frame 2 —
exhale, slightly squashed (shorter/wider). Frame 3 — deeper squash. Frame 4 — deepest squash
(lowest, widest). Frame 5 — rising back toward neutral. Frame 6 — inhale, slightly stretched
(taller/narrower). Frame 7 — more stretch. Frame 8 — peak stretch (tallest, narrowest). Make
frame 8 loop back to frame 1 seamlessly.

Row 2 — eat (one continuous eating sequence), 8 frames left→right.
Keep identical across Row 2 the same creature, colors, edges, overall size, ground
position, and camera. Only the mouth, cheeks, eyes, and head-lean change. From Frame 1 on,
the food is already held right at the mouth, touching the face, and shrinks bite by bite; it
is one connected shape with the creature and must NEVER appear as a separate ball floating
beside the body. The food's remaining size must shrink monotonically frame by frame and must
NEVER vanish completely and reappear in a later frame — in every single frame from 1 through
8 some visible remainder of the food must still be touching the mouth/paws (even a small
crumb in Frames 7-8), and it never disappears even partially behind the cheeks or paws.
Frame 1 — food held at the closed mouth, eyeing it. Frame 2 — leans in, mouth starting to open. Frame 3 — mouth wide open, about to bite.
Frame 4 — chomp down, food bitten smaller. Frame 5 — cheeks puffed, chewing a visibly smaller
remaining piece of food still held at the mouth, eyes squint happily. Frame 6 — chewing on
the other side, the same remaining piece now even smaller. Frame 7 — swallow, only a tiny
crumb of food left, eyes soften. Frame 8 — mouth closed, last crumb finished, satisfied
content smile.

Row 3 — happy (a little bounce in place), 8 frames left→right.
Keep identical across Row 3 the same creature, colors, edges, size, camera, and facing.
Keep all four legs in frame and the creature centered so it does not walk off, and keep any
FX attached to the body.
Frame 1 — standing, happy, tail up. Frame 2 —
crouch, front paws lower, anticipating. Frame 3 — deeper crouch. Frame 4 — spring up, front
paws lift off the ground. Frame 5 — peak of a small hop, most paws off the ground, tail
wagging, tiny sparkles hugging the body. Frame 6 — coming down, paws reaching for the
ground. Frame 7 — landing, slight crouch to absorb. Frame 8 — settle back to standing, tail
wag, big smile.

Row 4 — sad (slow loop), 8 frames left→right.
Keep identical across Row 4 the same creature, colors, edges, size, and camera; only the
droop, eyes, and a tear change.
Frame 1 — drooped, downturned mouth, sad eyes.
Frame 2 — droops a little more. Frame 3 — deeper droop. Frame 4 — deepest droop, a tear
welling at the eye. Frame 5 — tear slides down. Frame 6 — tear drips off. Frame 7 — small
sniff, slight settle. Frame 8 — breath in, slight rise. Loop slowly back to frame 1.

**Never** include: text, UI, logos, watermarks, signatures, multiple creatures per frame,
black keyline outlines, big anime/chibi eyes, gradient/airbrush shading, realistic/3D shading,
neon colors, or a baked ground shadow.
```
