# add-pet — animation prompt blocks

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
