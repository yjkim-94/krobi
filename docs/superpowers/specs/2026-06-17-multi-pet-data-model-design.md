# Multi-pet data model — design

Date: 2026-06-17

## Context

This is part 1 of a 4-part feature to support owning and displaying multiple pet
species at once (krombi, mochi, and future species). The full feature breaks into:

1. **Data model** (this spec) — owned-species records, window slots, core operations.
2. **Multi-pet rendering/layout** — show 2+ pets in one window without overlap, drag each
   independently.
3. **Dex (도감) UI** — silhouette gallery to browse all catalog species, drill into a
   species' branch/stage tree, and pick a pet to acquire or display.
4. **Context menu wiring** — "펫 추가" / "펫 선택" / "펫 숨기기" menu items, thin glue over
   1–3.

Today the app hardcodes a single species (`krombi`) and a single `PetData` record
(`src/pet/petState.ts`). There is no concept of owning more than one species, no
acquisition flow, and the window always renders exactly one pet
(`src/App.tsx`).

This spec only covers the data model and the pure functions that operate on it. No
rendering, no Dex UI, no context menu changes.

## Data shape

```ts
type FormKey = string; // "stage1" | "stage2-sage" | "stage3-sage" | ...

type SpeciesProgress = {
  /** Forms ever reached for this species. Permanent — reset never removes entries. */
  unlockedForms: FormKey[];
  /** The one active growth run for this species. */
  instance: {
    form: FormKey;       // current stage; drives exp gating and evolution
    exp: number;
    tendencies: Tendencies;
    status: { satiety: number };
    unknownApps: Record<string, number>;
    last_updated: string;
  };
};

type SlotState = {
  speciesId: string;
  /** Cosmetic only — what form to render. Must be in unlockedForms[speciesId]. */
  displayForm: FormKey;
};

type AppData = {
  /** Keyed by speciesId. A species with no entry has never been acquired. */
  pets: Record<string, SpeciesProgress>;
  /** Pets currently shown in the window. Order = display order (used by part 2). */
  slots: SlotState[];
};
```

Rules baked into the shape:

- One instance per species — no owning two krombis at once.
- A species can occupy at most one slot at a time (no duplicate display).
- A species not in `slots` is "hidden" — present in `pets` but not displayed.
- A species with no key in `pets` is "not yet acquired" — shown as a locked silhouette
  in the Dex (part 3).

## Species registry

`canEvolve`/`resolveNextForm`/`applyEvolution` in `petState.ts` already take a
`SpeciesDef` parameter — they don't need to change shape, just need to be called per
species instead of against one hardcoded `SPECIES` constant. Add a small registry
(parallel to the existing per-form glob in `petForms.ts`) that collects every
`assets/pets/*/species.json` into `Record<speciesId, SpeciesDef>`, keyed the same way
`catalog.json` keys species. This is pure data plumbing, not rendering, so it belongs in
this part.

## Core operations

All operations are pure functions over `AppData`, mirroring the style of the existing
`petState.ts` functions (no side effects, caller persists the result).

- **`applyTick(data, rates)`** — for every `speciesId` currently in `slots`, decrement
  satiety and add exp on its `instance`. Species not in any slot are untouched (ticking
  pauses while hidden).
- **`evolveSpecies(data, speciesId)`** — runs the existing `canEvolve`/`applyEvolution`
  logic against `pets[speciesId].instance`; on success appends the new form to
  `unlockedForms` if not already present.
- **`resetSpecies(data, speciesId)`** — sets `instance` back to
  `{ form: "stage1", exp: 0, tendencies: all-zero }` (satiety and `last_updated` follow
  existing `defaultPet()` conventions). `unlockedForms` is never touched — reset cannot
  remove acquired history.
- **`acquireSpecies(data, speciesId)`** — no-ops if already owned; otherwise creates
  `pets[speciesId] = { unlockedForms: ["stage1"], instance: <default> }`. Does not touch
  `slots` — adding to the window is a separate step.
- **`addSlot(data, speciesId)`** — no-ops if `speciesId` is already in `slots` or not
  owned; otherwise appends `{ speciesId, displayForm: pets[speciesId].instance.form }`.
- **`hideSlot(data, speciesId)`** — removes the matching slot; no-ops if it would leave
  `slots` empty (always at least one pet shown — matches "if the window has only one pet
  it can't be hidden").
- **`setDisplayForm(data, speciesId, form)`** — no-ops if `form` is not in
  `pets[speciesId].unlockedForms`; otherwise updates that slot's `displayForm`. Pure
  cosmetic change — `instance` is untouched.

No slot-count cap. No restriction on which species combinations can coexist.

## Migration

Existing saves have `{ pet: PetData }` (implicitly krombi, no `species` field). On load,
if the new `pets`/`slots` keys are absent, convert once:

1. Walk `krombiSpecies.forms[oldPet.form].from` back to `"stage1"` to reconstruct
   `unlockedForms` (e.g. `stage3-sage` → `["stage1", "stage2-sage", "stage3-sage"]`).
2. `pets = { krombi: { unlockedForms, instance: <oldPet fields mapped 1:1> } }`.
3. `slots = [{ speciesId: "krombi", displayForm: oldPet.form }]`.

No other species gets a `pets` entry — they remain unacquired until the Dex flow (part
3) grants them.

## Out of scope (handled in later parts)

- Rendering multiple pets in the window, non-overlap layout, per-pet dragging (part 2).
- Dex UI: silhouette gallery, locked/unlocked rendering, click-to-acquire, click-to-select
  (part 3).
- Context menu items "펫 추가" / "펫 선택" / "펫 숨기기" and routing them to the
  operations above (part 4).
- Any change to how `진화하기`/`초기화`/`밥주기` are currently presented in the context
  menu — this spec only changes what's underneath them.
