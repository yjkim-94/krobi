# add-pet — animation prompt blocks

## Animation prompt blocks (invariants + motion)

A form's prompt is ONE paste-ready prompt that generates the whole **4-row × 8-column sheet**
(idle / eat / happy / sad) in a single image. Assemble it as: Style Bible (§1) + Reference
line + Sheet discipline (§4) + the **Sheet layout** block below + the four row blocks
(idle, eat, the body-form happy, sad) in that order + the closing `**Never** include` line.

Each row block states what to keep identical across that row's 8 frames (the invariants),
then gives the per-frame motion as a numbered storyboard (causal order — see pet_design.md
§2). The sheet geometry / extraction-safety rules and the strict background come from §4
(Sheet discipline); the row blocks carry ONLY invariants + motion.

### Sheet layout (lead the four row blocks with this)
```
Produce ONE sprite sheet as a single image: a strict 4-row × 8-column grid, 32 frames in
total, read left→right within each row and top→bottom across rows. Every row must contain all
8 frames at the SAME even horizontal spacing and with its columns aligned to the other rows —
no row may be sparser, bunched to one side, or have empty cells or gaps mid-row. Every frame
shows the SAME creature at the SAME size and style; each row is one 8-frame animation. Rows,
in order: Row 1 = idle, Row 2 = eat, Row 3 = happy, Row 4 = sad.
```

**idle (Row 1 — 8 frames, breathing loop)**
```
Row 1 — idle (gentle breathing loop), 8 frames left→right.
Keep identical across Row 1 the same creature, colors, edges, overall size, ground
position, and camera; only the body silhouette changes between frames.
Frame 1 — neutral resting. Frame 2 —
exhale, slightly squashed (shorter/wider). Frame 3 — deeper squash. Frame 4 — deepest squash
(lowest, widest). Frame 5 — rising back toward neutral. Frame 6 — inhale, slightly stretched
(taller/narrower). Frame 7 — more stretch. Frame 8 — peak stretch (tallest, narrowest). Make
frame 8 loop back to frame 1 seamlessly.
```

**eat (Row 2 — 8 frames, plays once)**

Name the food as a single concrete shape (a round cookie/berry/dumpling — not just "food")
so the model can't redesign it frame to frame; substitute that shape into `<FOOD>` below.

```
Row 2 — eat (one continuous eating sequence), 8 frames left→right.
Keep identical across Row 2 the same creature, colors, edges, overall size, ground
position, and camera. Only the mouth, cheeks, eyes, and head-lean change. If this creature is
a quadruped, it sits up on its haunches with its two hind legs/paws planted on the ground
supporting its weight, and holds the food in its two front paws, lifted to the mouth like
hands. Keep exactly the same total number of legs as the reference in every frame — never
invent an extra front limb or paw — and keep both hind paws grounded and visible throughout.
The food is never floating unsupported in empty space; it stays either touching the front
paws or touching the mouth in every frame. The food is a single
<FOOD>; it is one connected shape with the creature and must NEVER appear as a separate ball
floating beside the body, detached from both the paws and the mouth. Every
bite is taken from the SAME edge of the food (the edge nearest the mouth), so the missing
wedge is a single contiguous notch that only ever grows larger from frame to frame — never a
new bite on a different edge, never the food regaining a part already bitten off, and never
jumping back to a fuller shape after a bite has been taken. The food's remaining size and
shape must change monotonically and continuously frame by frame from that one notch, and must
NEVER vanish completely and reappear in a later frame — in every frame from 1 through 8 some
visible remainder must still be touching the mouth/paws (even a small crumb in Frames 7-8),
never disappearing even partially behind the cheeks or paws.
Frame 1 — whole food held at the closed mouth, eyeing it. Frame 2 — leans in, mouth starting
to open, food still whole. Frame 3 — mouth wide open, about to bite, food still whole.
Frame 4 — chomp down, a single small bite notch taken out of the edge nearest the mouth.
Frame 5 — cheeks puffed, chewing, the SAME notch now bitten deeper/larger (no new notch, no
regrowth), eyes squint happily. Frame 6 — chewing on the other side, the same notch
continuing to grow, food now roughly half its original size. Frame 7 — swallow, only a small
crumb of the food left (continuing the same notch), eyes soften. Frame 8 — mouth closed, last
tiny crumb finished, satisfied content smile.
```

**happy (Row 3 — 8 frames, plays once) — BODY-FORM SPECIFIC**

Do NOT use a single fixed hop here — a machine must not jump like a slime. Map the form's
archetype/branch to a body-form file (table in SKILL.md Step 3), `Read` only that one file
in `motion-by-form/`, and inject ITS invariants + motion as Row 3. Use the `--anchor` that
file specifies at extraction. (Each body-form block is written as a row; label it `Row 3`.)

Common to all forms: motion happens in place (no sideways drift), identity locked, FX
attached to the body, frame 1 ≈ resting pose for a clean return, and the pose-to-pose arc is
one continuous physical motion — never snap mid-arc back to an earlier pose, skip the
crouch/peak/landing sequence, or jump to a different phase out of order.

**sad (Row 4 — 8 frames, loop)**
```
Row 4 — sad (slow loop), 8 frames left→right.
Keep identical across Row 4 the same creature, colors, edges, size, and camera; only the
droop, eyes, and a tear change. The tear forms at a single fixed point under one eye and only
ever moves straight down from that point, traveling progressively further down each frame it
is visible — never resetting to the eye, never jumping sideways, and never two tears at once.
Frame 1 — drooped, downturned mouth, sad eyes.
Frame 2 — droops a little more. Frame 3 — deeper droop. Frame 4 — deepest droop, a tear
welling at the eye (not yet falling). Frame 5 — the same tear now a short distance below the
eye. Frame 6 — the same tear further down, dripping off the chin. Frame 7 — tear gone, small
sniff, slight settle. Frame 8 — breath in, slight rise. Loop slowly back to frame 1.
```
