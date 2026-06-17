# Multi-pet rendering & layout — design

Date: 2026-06-17

## Context

This is part 2 of the 4-part multi-pet feature (see
`docs/superpowers/specs/2026-06-17-multi-pet-data-model-design.md` for the full
breakdown). Part 1 (merged) added the `AppData` model — owned species, permanent Dex
unlock history, and `slots` (which species are currently displayed). It deliberately
left `src/App.tsx` untouched: the app still renders exactly one hardcoded `krombi` pet,
centered in a window that auto-fits to that one pet's sprite bounds.

This part wires `AppData`/`appDataOps` into the live app and makes the window render
**every** species in `slots` simultaneously, each independently draggable, never
overlapping at rest. It does not add the Dex UI or the new context-menu items
(추가/선택/숨기기) — those are parts 3 and 4. It does change how the *existing* menu
items (밥주기/진화하기/펫상태/크기 조절/초기화) pick their target, since with 2+ pets
on screen "the pet" is no longer well-defined.

## Today's relevant mechanics (for contrast)

- `useWindowDrag` (`src/pet/useWindowDrag.ts`): mousedown+move past a 4px threshold on
  the pet calls `getCurrentWindow().startDragging()` — there is no in-window pet
  coordinate today; "dragging the pet" *is* "dragging the OS window."
- Window size is computed once from the single pet's opaque sprite bounds
  (`fitWindowSize`/`boxSize` in `src/pet/contentBounds.ts`), persisted to the store as
  `window_size`, and only changed afterward via the manual `ResizeOverlay`.
- `petForms.ts` globs sprite manifests for `krombi` only.
- The context menu (`showMenu` in `App.tsx`) always acts on the single hardcoded
  `pet`/`SPECIES`.

## New state: per-pet layout positions

A new store-level field, independent of `AppData` (part 1's shape is not reopened):

```ts
type PetPosition = { speciesId: string; x: number; y: number }; // window-local px, top-left anchored
type LayoutState = { positions: PetPosition[] };
```

- Exactly one `PetPosition` per entry in `AppData.slots`. Kept in sync: `addSlot`
  inserts a position, `hideSlot` removes it (layout-side bookkeeping lives in
  `App.tsx`'s effects, not in `appDataOps.ts` — part 1's pure functions are not
  modified).
- Persisted in the store (same `krobi_data.json`, new key `layout`) so positions
  survive restart.
- **Initial position for a newly-added slot:** placed to the right of the
  current rightmost pet, bottom-anchored, separated by a fixed gap — i.e. new pets
  default into a left-to-right row. This is only the *default for new pets*; it is
  not a constraint enforced afterward.

## Drag interaction

Two distinct drag targets, disambiguated by what's under the pointer at mousedown:

1. **On a pet's sprite** → updates only that pet's `PetPosition` live as the pointer
   moves (window does not move). Overlap with other pets *during* the drag is
   allowed — no live collision blocking, to keep dragging smooth.
2. **On empty window background** (no pet there) → unchanged existing behavior:
   `startDragging()` moves the whole OS window.

In both cases, a release with no movement past the 4px threshold still fires the
existing click behavior (pet → "happy" one-shot; background → no-op).

**On drop** (mouseup after a pet-sprite drag that moved past the threshold): if the
dropped pet's box overlaps any other pet's box, snap it to the nearest position where
it no longer overlaps any pet, searching outward from the drop point. "Nearest" is
by Euclidean distance from the raw drop point to the candidate's top-left.

## Window sizing

The window auto-fits to the union of all pets' boxes (their content bounds at their
current scale, positioned per their `PetPosition`) plus the existing `MARGIN`. It is
recomputed and applied (`setSize`) at exactly these points:

- App load (after positions are resolved/defaulted).
- `addSlot` / `hideSlot` (slot count changed).
- A pet-drag drop whose resolved (post-collision-snap) position falls outside the
  current window bounds — the window **grows** to include it. Dragging never shrinks
  the window automatically.

The existing manual `ResizeOverlay` ("크기 조절") is unchanged and still works at any
time; a user-enlarged window is respected (auto-fit only grows from the *current*
size when needed, it never shrinks a window the user sized manually, and never
shrinks just because a pet moved closer to center).

## Context-menu retargeting

- Each rendered pet tracks its own `speciesId`. Right-clicking a pet sets it as the
  **focused species** (new piece of state in `App.tsx`).
- `밥주기` / `진화하기` / `초기화` / `펫상태` all act on the focused species' entry in
  `AppData.pets` (via `appDataOps.evolveSpecies` / `resetSpecies`, and a new
  per-species feed helper — feeding isn't in `appDataOps.ts` yet since part 1 had no
  such operation; this part adds it there following the same pattern as the others).
- `펫상태` (status panel) shows only the focused species' stats; toggling it
  open/closed is global UI state, not per-species, but its *content* always reflects
  the focused species.
- `크기 조절` stays global (resizes the one shared window), unchanged.
- New items (펫 추가/펫 선택/펫 숨기기) are NOT added in this part — only the
  existing items' targeting logic changes.

## Sprite asset registry, generalized

`src/pet/petForms.ts` globs `assets/pets/krombi/*/manifest.json` only. Add a new file
(parallel structure, not a rewrite of the existing one — `petForms.ts`'s krombi-only
glob is left as-is if anything still imports it directly, but `App.tsx` switches to
the new lookup) that globs `assets/pets/*/*/manifest.json` and indexes by
`(speciesId, form)`, mirroring `speciesRegistry.ts`'s pattern from part 1.

## Rendering structure

`App.tsx` currently renders one `<Pet>` centered via flexbox. It changes to:
- Iterate `AppData.slots`, looking up each species' `SpeciesProgress` (for animation
  state) and `PetPosition` (for placement).
- Render each as an absolutely-positioned `<Pet>` at its `(x, y)`, each wrapped in its
  own drag/click handlers (item 1 above) and its own sprite/manifest load effect
  (currently a single `useEffect` keyed on one `activeSheetUrl` — becomes one per
  slot).
- The dragged pet renders on top (highest z-index) while dragging; otherwise z-order
  doesn't matter (pets never overlap at rest).

## Out of scope (handled in later parts)

- Dex (도감) UI (part 3).
- New context-menu items 펫 추가/펫 선택/펫 숨기기 (part 4) — this part only changes
  how existing items pick their target.
- Per-pet evolution FX polish beyond reusing the existing single-pet `EvolutionFx`/
  `EvolveReadyFx` components against the focused species.
