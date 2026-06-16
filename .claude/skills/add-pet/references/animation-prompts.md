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
```
Row 2 — eat (one continuous eating sequence), 8 frames left→right.
Keep identical across Row 2 the same creature, colors, edges, overall size, ground
position, and camera. Only the mouth, cheeks, eyes, and head-lean change. From Frame 1 on,
the food is already held right at the mouth, touching the face, and shrinks bite by bite; it
is one connected shape with the creature and must NEVER appear as a separate ball floating
beside the body.
Frame 1 — food held at the closed mouth, eyeing it. Frame 2 — leans in, mouth starting to open. Frame 3 — mouth wide open, about to bite.
Frame 4 — chomp down, food bitten smaller. Frame 5 — cheeks puffed, chewing, eyes squint
happily. Frame 6 — chewing on the other side. Frame 7 — swallow, eyes soften. Frame 8 —
mouth closed, satisfied content smile.
```

**happy (Row 3 — 8 frames, plays once) — BODY-FORM SPECIFIC**

Do NOT use a single fixed hop here — a machine must not jump like a slime. Map the form's
archetype/branch to a body-form file (table in SKILL.md Step 3), `Read` only that one file
in `motion-by-form/`, and inject ITS invariants + motion as Row 3. Use the `--anchor` that
file specifies at extraction. (Each body-form block is written as a row; label it `Row 3`.)

Common to all forms: motion happens in place (no sideways drift), identity locked, FX
attached to the body, frame 1 ≈ resting pose for a clean return.

**sad (Row 4 — 8 frames, loop)**
```
Row 4 — sad (slow loop), 8 frames left→right.
Keep identical across Row 4 the same creature, colors, edges, size, and camera; only the
droop, eyes, and a tear change.
Frame 1 — drooped, downturned mouth, sad eyes.
Frame 2 — droops a little more. Frame 3 — deeper droop. Frame 4 — deepest droop, a tear
welling at the eye. Frame 5 — tear slides down. Frame 6 — tear drips off. Frame 7 — small
sniff, slight settle. Frame 8 — breath in, slight rise. Loop slowly back to frame 1.
```
