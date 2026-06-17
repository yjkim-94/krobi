# Multi-pet Data Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-species `PetData` model with a multi-species `AppData` model (owned species, permanent Dex unlock history, display slots) and the pure functions that operate on it — no UI, no rendering, no context-menu changes.

**Architecture:** Keep `src/pet/petState.ts`'s existing single-instance pure functions (`defaultPet`, `migrate`, `applyTick`, `canEvolve`, `applyEvolution`) as the per-species building block (renamed conceptually to "instance" but same type, just without the unused `name` field). Add two new files on top: `speciesRegistry.ts` (glob every `assets/pets/*/species.json` into a lookup table) and `appData.ts` + `appDataOps.ts` (the multi-species `AppData` shape, migration, and operations: tick/evolve/reset/acquire/addSlot/hideSlot/setDisplayForm).

**Tech Stack:** TypeScript, Vitest, Vite `import.meta.glob`.

## Global Constraints

- One growth instance per species — no owning two of the same species at once.
- A species can occupy at most one display slot at a time.
- `unlockedForms` is permanent — `resetSpecies` never removes entries from it.
- `resetSpecies` always returns the instance to `stage1`, `exp: 0`, all tendencies `0`.
- Ticking (satiety decay / exp gain) only applies to species currently in `slots`.
- `hideSlot` is a no-op if it would leave `slots` empty (at least one pet always shown).
- No cap on the number of simultaneous slots.
- This plan touches `src/pet/*` only. `src/App.tsx` is NOT touched — it still runs on the existing single-pet `petState.ts` API until the next part (multi-pet rendering) wires `AppData` into it.

---

### Task 1: Drop the unused `name` field from `PetData`

`PetData.name` is dead weight — nothing in the app reads `pet.name` (verified: only `petState.ts`/`petState.test.ts` reference it). Removing it now means the per-species "instance" type in later tasks is exactly `PetData`, with no translation layer needed.

**Files:**
- Modify: `src/pet/petState.ts:7-31` (type `PetData`, `defaultPet`)
- Modify: `src/pet/petState.ts:34-60` (`migrate`)
- Modify: `src/pet/petState.test.ts:25-30` (`migrate` test)

**Interfaces:**
- Produces: `PetData` (now `{ form, status, exp, tendencies, unknownApps, last_updated }`, no `name`), `defaultPet(): PetData`, `migrate(raw: unknown): PetData` — unchanged signatures, used by every later task in this plan.

- [ ] **Step 1: Update the failing test first**

Replace the existing test in `src/pet/petState.test.ts`:

```ts
  it("carries old satiety/hunger and drops legacy level", () => {
    const p = migrate({ name: "x", level: 3, status: { hunger: 42 }, last_updated: "t" });
    expect(p.name).toBe("x");
    expect(p.status.satiety).toBe(42);
    expect(p.form).toBe("stage1");
  });
```

with:

```ts
  it("carries old satiety/hunger, drops legacy level/name", () => {
    const p = migrate({ name: "x", level: 3, status: { hunger: 42 }, last_updated: "t" });
    expect(p.status.satiety).toBe(42);
    expect(p.form).toBe("stage1");
    expect(p.last_updated).toBe("t");
    expect((p as Record<string, unknown>).name).toBeUndefined();
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- petState.test.ts`
Expected: FAIL — `p.last_updated` is `"t"` already today, but `(p as Record<string, unknown>).name` is currently `"x"`, not `undefined`, so the new assertion fails.

- [ ] **Step 3: Remove `name` from the type, `defaultPet`, and `migrate`**

In `src/pet/petState.ts`, change:

```ts
export type PetData = {
  name: string;
  form: string; // 현재 폼 키 ("stage1" | "stage2-maker" ...)
  status: Status;
  exp: number; // 시간으로 증가, 진화 시 0
  tendencies: Tendencies; // 활성 앱 감지로 증가
  unknownApps: Record<string, number>; // 미분류 앱 카운트
  last_updated: string;
};
```

to:

```ts
export type PetData = {
  form: string; // 현재 폼 키 ("stage1" | "stage2-maker" ...)
  status: Status;
  exp: number; // 시간으로 증가, 진화 시 0
  tendencies: Tendencies; // 활성 앱 감지로 증가
  unknownApps: Record<string, number>; // 미분류 앱 카운트
  last_updated: string;
};
```

Change:

```ts
export function defaultPet(): PetData {
  return {
    name: "크롬비",
    form: "stage1",
    status: { satiety: 100 },
    exp: 0,
    tendencies: { maker: 0, sage: 0, wild: 0 },
    unknownApps: {},
    last_updated: new Date().toISOString(),
  };
}
```

to:

```ts
export function defaultPet(): PetData {
  return {
    form: "stage1",
    status: { satiety: 100 },
    exp: 0,
    tendencies: { maker: 0, sage: 0, wild: 0 },
    unknownApps: {},
    last_updated: new Date().toISOString(),
  };
}
```

In `migrate`, remove the `name` line from the returned object:

```ts
  return {
    name: typeof r.name === "string" ? r.name : base.name,
    form: typeof r.form === "string" ? r.form : base.form,
```

becomes:

```ts
  return {
    form: typeof r.form === "string" ? r.form : base.form,
```

- [ ] **Step 4: Run the full test suite to verify it passes and nothing else broke**

Run: `npm run test`
Expected: PASS (all suites, including `petState.test.ts`, `petData.test.ts`, and the rest)

- [ ] **Step 5: Commit**

```bash
git add src/pet/petState.ts src/pet/petState.test.ts
git commit -m "refactor(pet): drop unused PetData.name field"
```

---

### Task 2: Species registry across all owned species folders

`src/pet/petForms.ts` already globs `assets/pets/krombi/*/manifest.json` for sprite assets. We need the equivalent for `species.json` files, but across *every* species folder (`krombi`, `mochi`, future ones), keyed by species id — needed so multi-species operations (Task 4) can look up the right `SpeciesDef` for `canEvolve`/`applyEvolution`.

**Files:**
- Create: `src/pet/speciesRegistry.ts`
- Test: `src/pet/speciesRegistry.test.ts`

**Interfaces:**
- Consumes: `SpeciesDef` type from `src/pet/types.ts` (already defined, unchanged).
- Produces: `getSpeciesDef(id: string): SpeciesDef | undefined`, `allSpeciesIds(): string[]` — used by Task 4/5 and by later parts (Dex UI, rendering).

- [ ] **Step 1: Write the failing test**

```ts
// src/pet/speciesRegistry.test.ts
import { describe, expect, it } from "vitest";
import { getSpeciesDef, allSpeciesIds } from "./speciesRegistry";

describe("speciesRegistry", () => {
  it("finds krombi and mochi species defs", () => {
    expect(getSpeciesDef("krombi")?.archetype).toBe("slime");
    expect(getSpeciesDef("mochi")?.archetype).toBe("beast");
  });

  it("returns undefined for an unknown species id", () => {
    expect(getSpeciesDef("nope")).toBeUndefined();
  });

  it("lists all known species ids, including krombi and mochi", () => {
    const ids = allSpeciesIds();
    expect(ids).toContain("krombi");
    expect(ids).toContain("mochi");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- speciesRegistry.test.ts`
Expected: FAIL with "Cannot find module './speciesRegistry'"

- [ ] **Step 3: Write the implementation**

```ts
// src/pet/speciesRegistry.ts
import type { SpeciesDef } from "./types";

// 빌드 시 모든 종 폴더의 species.json 을 수집("krombi" / "mochi" / ...).
const modules = import.meta.glob("../assets/pets/*/species.json", {
  eager: true,
}) as Record<string, { default: SpeciesDef }>;

function speciesIdFromPath(path: string): string {
  // ".../assets/pets/<id>/species.json" -> "<id>"
  const m = path.match(/\/assets\/pets\/([^/]+)\/species\.json$/);
  return m ? m[1] : "";
}

const REGISTRY: Record<string, SpeciesDef> = {};
for (const [path, mod] of Object.entries(modules)) {
  const id = speciesIdFromPath(path);
  if (id) REGISTRY[id] = mod.default;
}

export function getSpeciesDef(id: string): SpeciesDef | undefined {
  return REGISTRY[id];
}

export function allSpeciesIds(): string[] {
  return Object.keys(REGISTRY);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- speciesRegistry.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pet/speciesRegistry.ts src/pet/speciesRegistry.test.ts
git commit -m "feat(pet): add cross-species registry for species.json lookups"
```

---

### Task 3: `AppData` types, defaults, and migration

**Files:**
- Create: `src/pet/appData.ts`
- Test: `src/pet/appData.test.ts`

**Interfaces:**
- Consumes: `PetData`, `defaultPet`, `migrate` from `./petState` (Task 1); `SpeciesDef` from `./types`.
- Produces: types `SpeciesInstance` (= `PetData`), `SpeciesProgress`, `SlotState`, `AppData`; functions `unlockChain(species: SpeciesDef, form: string): string[]` and `migrateAppData(raw: unknown, krombiSpecies: SpeciesDef): AppData` — used by Task 4/5 and by the future App.tsx wiring (part 2 of the feature).

- [ ] **Step 1: Write the failing tests**

```ts
// src/pet/appData.test.ts
import { describe, expect, it } from "vitest";
import type { SpeciesDef } from "./types";
import krombiSpecies from "../assets/pets/krombi/species.json";
import { unlockChain, migrateAppData } from "./appData";

const krombi = krombiSpecies as SpeciesDef;

describe("unlockChain", () => {
  it("returns just stage1 for stage1", () => {
    expect(unlockChain(krombi, "stage1")).toEqual(["stage1"]);
  });

  it("walks the from-chain back to stage1 for a stage3 form", () => {
    expect(unlockChain(krombi, "stage3-sage")).toEqual(["stage1", "stage2-sage", "stage3-sage"]);
  });

  it("walks one step for a stage2 form", () => {
    expect(unlockChain(krombi, "stage2-wild")).toEqual(["stage1", "stage2-wild"]);
  });
});

describe("migrateAppData", () => {
  it("builds a fresh-install AppData when there is no saved data", () => {
    const data = migrateAppData(undefined, krombi);
    expect(Object.keys(data.pets)).toEqual(["krombi"]);
    expect(data.pets.krombi.unlockedForms).toEqual(["stage1"]);
    expect(data.pets.krombi.instance.form).toBe("stage1");
    expect(data.slots).toEqual([{ speciesId: "krombi", displayForm: "stage1" }]);
  });

  it("converts a legacy single-pet save into the krombi entry", () => {
    const legacy = {
      pet: {
        form: "stage3-sage",
        status: { satiety: 80 },
        exp: 0,
        tendencies: { maker: 1, sage: 9, wild: 1 },
        unknownApps: {},
        last_updated: "2026-01-01T00:00:00.000Z",
      },
    };
    const data = migrateAppData(legacy, krombi);
    expect(data.pets.krombi.unlockedForms).toEqual(["stage1", "stage2-sage", "stage3-sage"]);
    expect(data.pets.krombi.instance.form).toBe("stage3-sage");
    expect(data.pets.krombi.instance.status.satiety).toBe(80);
    expect(data.slots).toEqual([{ speciesId: "krombi", displayForm: "stage3-sage" }]);
  });

  it("returns already-migrated data unchanged", () => {
    const migrated = {
      pets: { mochi: { unlockedForms: ["stage1"], instance: { form: "stage1", status: { satiety: 50 }, exp: 0, tendencies: { maker: 0, sage: 0, wild: 0 }, unknownApps: {}, last_updated: "t" } } },
      slots: [{ speciesId: "mochi", displayForm: "stage1" }],
    };
    expect(migrateAppData(migrated, krombi)).toEqual(migrated);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- appData.test.ts`
Expected: FAIL with "Cannot find module './appData'"

- [ ] **Step 3: Write the implementation**

```ts
// src/pet/appData.ts
import type { SpeciesDef } from "./types";
import { defaultPet, migrate as migratePetData, type PetData } from "./petState";

export type SpeciesInstance = PetData;

export type SpeciesProgress = {
  /** Forms ever reached for this species. Permanent — reset never removes entries. */
  unlockedForms: string[];
  /** The one active growth run for this species. */
  instance: SpeciesInstance;
};

export type SlotState = {
  speciesId: string;
  /** Cosmetic only — what form to render. Must be in pets[speciesId].unlockedForms. */
  displayForm: string;
};

export type AppData = {
  /** Keyed by speciesId. A species with no entry has never been acquired. */
  pets: Record<string, SpeciesProgress>;
  /** Pets currently shown in the window. Order = display order. */
  slots: SlotState[];
};

const STARTER_SPECIES = "krombi";

/** Walks species.json's `from` pointers from `form` back to stage1, inclusive, in order. */
export function unlockChain(species: SpeciesDef, form: string): string[] {
  const chain: string[] = [];
  let current: string | undefined = form;
  while (current) {
    chain.unshift(current);
    current = species.forms[current]?.from;
  }
  return chain;
}

function isAppData(raw: unknown): raw is AppData {
  return !!raw && typeof raw === "object" && "pets" in raw && "slots" in raw;
}

/**
 * Migrates legacy single-pet saves (`{ pet: PetData }`, implicitly krombi) and
 * fresh installs (no saved data) into the multi-species shape. Already-migrated
 * data is returned unchanged.
 */
export function migrateAppData(raw: unknown, krombiSpecies: SpeciesDef): AppData {
  if (isAppData(raw)) return raw;
  const r = (raw ?? {}) as Record<string, unknown>;
  const oldPet = migratePetData(r.pet);
  return {
    pets: {
      [STARTER_SPECIES]: { unlockedForms: unlockChain(krombiSpecies, oldPet.form), instance: oldPet },
    },
    slots: [{ speciesId: STARTER_SPECIES, displayForm: oldPet.form }],
  };
}
```

Note: `migratePetData(undefined)` already returns `defaultPet()` (stage1), so this single
function covers fresh installs, legacy saves, and already-migrated data — no separate
`defaultAppData()` needed.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- appData.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pet/appData.ts src/pet/appData.test.ts
git commit -m "feat(pet): add multi-species AppData shape and migration"
```

---

### Task 4: Tick and lifecycle operations (`applyTickAll`, `evolveSpecies`, `resetSpecies`)

**Files:**
- Create: `src/pet/appDataOps.ts`
- Test: `src/pet/appDataOps.test.ts`

**Interfaces:**
- Consumes: `AppData` from `./appData` (Task 3); `applyTick`, `canEvolve`, `applyEvolution`, `defaultPet` from `./petState` (Task 1); `SpeciesDef` from `./types`.
- Produces: `applyTickAll(data: AppData, rates: { satietyRate: number; expGain: number }): AppData`, `evolveSpecies(data: AppData, speciesId: string, species: SpeciesDef): AppData`, `resetSpecies(data: AppData, speciesId: string): AppData` — also used by Task 5's tests as fixtures.

- [ ] **Step 1: Write the failing tests**

```ts
// src/pet/appDataOps.test.ts
import { describe, expect, it } from "vitest";
import type { SpeciesDef } from "./types";
import krombiSpecies from "../assets/pets/krombi/species.json";
import { migrateAppData } from "./appData";
import { applyTickAll, evolveSpecies, resetSpecies } from "./appDataOps";

const krombi = krombiSpecies as SpeciesDef;

function withTwoSpecies() {
  const data = migrateAppData(undefined, krombi); // krombi owned + slotted
  return {
    ...data,
    pets: {
      ...data.pets,
      mochi: { unlockedForms: ["stage1"], instance: { ...data.pets.krombi.instance } },
    },
    // mochi NOT in slots -> hidden
  };
}

describe("applyTickAll", () => {
  it("ticks only species currently in slots", () => {
    const data = withTwoSpecies();
    const next = applyTickAll(data, { satietyRate: 1, expGain: 10 });
    expect(next.pets.krombi.instance.exp).toBe(10); // slotted -> ticked
    expect(next.pets.mochi.instance.exp).toBe(0); // hidden -> untouched
  });
});

describe("evolveSpecies", () => {
  it("advances form, resets exp, and records the new unlock", () => {
    const data = withTwoSpecies();
    const ready = {
      ...data,
      pets: {
        ...data.pets,
        krombi: {
          unlockedForms: ["stage1"],
          instance: { ...data.pets.krombi.instance, exp: 150, tendencies: { maker: 5, sage: 1, wild: 1 } },
        },
      },
    };
    const next = evolveSpecies(ready, "krombi", krombi);
    expect(next.pets.krombi.instance.form).toBe("stage2-maker");
    expect(next.pets.krombi.instance.exp).toBe(0);
    expect(next.pets.krombi.unlockedForms).toEqual(["stage1", "stage2-maker"]);
  });

  it("is a no-op when not eligible", () => {
    const data = withTwoSpecies();
    expect(evolveSpecies(data, "krombi", krombi)).toEqual(data);
  });

  it("is a no-op for an unowned species", () => {
    const data = withTwoSpecies();
    expect(evolveSpecies(data, "nope", krombi)).toEqual(data);
  });
});

describe("resetSpecies", () => {
  it("returns the instance to stage1/exp0/zero-tendencies but keeps unlockedForms", () => {
    const data = withTwoSpecies();
    const grown = {
      ...data,
      pets: {
        ...data.pets,
        krombi: {
          unlockedForms: ["stage1", "stage2-sage", "stage3-sage"],
          instance: { ...data.pets.krombi.instance, form: "stage3-sage", exp: 50, tendencies: { maker: 1, sage: 9, wild: 0 } },
        },
      },
    };
    const next = resetSpecies(grown, "krombi");
    expect(next.pets.krombi.instance.form).toBe("stage1");
    expect(next.pets.krombi.instance.exp).toBe(0);
    expect(next.pets.krombi.instance.tendencies).toEqual({ maker: 0, sage: 0, wild: 0 });
    expect(next.pets.krombi.unlockedForms).toEqual(["stage1", "stage2-sage", "stage3-sage"]);
  });

  it("is a no-op for an unowned species", () => {
    const data = withTwoSpecies();
    expect(resetSpecies(data, "nope")).toEqual(data);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- appDataOps.test.ts`
Expected: FAIL with "Cannot find module './appDataOps'"

- [ ] **Step 3: Write the implementation**

```ts
// src/pet/appDataOps.ts
import type { SpeciesDef } from "./types";
import { applyTick, canEvolve, applyEvolution, defaultPet } from "./petState";
import type { AppData } from "./appData";

export function applyTickAll(
  data: AppData,
  rates: { satietyRate: number; expGain: number },
): AppData {
  const activeIds = new Set(data.slots.map((s) => s.speciesId));
  const pets = { ...data.pets };
  for (const id of activeIds) {
    const progress = pets[id];
    if (!progress) continue;
    pets[id] = { ...progress, instance: applyTick(progress.instance, rates) };
  }
  return { ...data, pets };
}

export function evolveSpecies(data: AppData, speciesId: string, species: SpeciesDef): AppData {
  const progress = data.pets[speciesId];
  if (!progress) return data;
  if (!canEvolve(species, progress.instance.form, progress.instance.exp)) return data;
  const nextInstance = applyEvolution(species, progress.instance);
  if (nextInstance === progress.instance) return data;
  const unlockedForms = progress.unlockedForms.includes(nextInstance.form)
    ? progress.unlockedForms
    : [...progress.unlockedForms, nextInstance.form];
  return {
    ...data,
    pets: { ...data.pets, [speciesId]: { unlockedForms, instance: nextInstance } },
  };
}

export function resetSpecies(data: AppData, speciesId: string): AppData {
  const progress = data.pets[speciesId];
  if (!progress) return data;
  return {
    ...data,
    pets: { ...data.pets, [speciesId]: { ...progress, instance: defaultPet() } },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- appDataOps.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pet/appDataOps.ts src/pet/appDataOps.test.ts
git commit -m "feat(pet): add tick/evolve/reset operations over AppData"
```

---

### Task 5: Ownership and slot operations (`acquireSpecies`, `addSlot`, `hideSlot`, `setDisplayForm`)

**Files:**
- Modify: `src/pet/appDataOps.ts` (append the four functions)
- Modify: `src/pet/appDataOps.test.ts` (append their tests)

**Interfaces:**
- Consumes: `AppData` from `./appData`; `defaultPet` from `./petState` (already imported in Task 4).
- Produces: `acquireSpecies(data: AppData, speciesId: string): AppData`, `addSlot(data: AppData, speciesId: string): AppData`, `hideSlot(data: AppData, speciesId: string): AppData`, `setDisplayForm(data: AppData, speciesId: string, form: string): AppData` — these are what the future context-menu wiring (part 4 of the feature) calls directly.

- [ ] **Step 1: Append the failing tests**

Add to `src/pet/appDataOps.test.ts` (alongside the existing imports, add `acquireSpecies, addSlot, hideSlot, setDisplayForm` to the `./appDataOps` import):

```ts
import { applyTickAll, evolveSpecies, resetSpecies, acquireSpecies, addSlot, hideSlot, setDisplayForm } from "./appDataOps";
```

```ts
describe("acquireSpecies", () => {
  it("adds a new species at stage1, unowned -> owned", () => {
    const data = migrateAppData(undefined, krombi); // krombi only
    const next = acquireSpecies(data, "mochi");
    expect(next.pets.mochi.unlockedForms).toEqual(["stage1"]);
    expect(next.pets.mochi.instance.form).toBe("stage1");
    expect(next.slots).toEqual(data.slots); // acquiring does not display it
  });

  it("is a no-op if already owned", () => {
    const data = withTwoSpecies();
    expect(acquireSpecies(data, "mochi")).toEqual(data);
  });
});

describe("addSlot", () => {
  it("adds an owned, not-yet-shown species to slots", () => {
    const data = withTwoSpecies(); // mochi owned but hidden
    const next = addSlot(data, "mochi");
    expect(next.slots).toEqual([
      { speciesId: "krombi", displayForm: "stage1" },
      { speciesId: "mochi", displayForm: "stage1" },
    ]);
  });

  it("is a no-op if the species is unowned", () => {
    const data = migrateAppData(undefined, krombi); // mochi not owned
    expect(addSlot(data, "mochi")).toEqual(data);
  });

  it("is a no-op if the species is already shown", () => {
    const data = withTwoSpecies();
    expect(addSlot(data, "krombi")).toEqual(data);
  });
});

describe("hideSlot", () => {
  it("removes a slot when more than one is shown", () => {
    const data = addSlot(withTwoSpecies(), "mochi");
    const next = hideSlot(data, "mochi");
    expect(next.slots).toEqual([{ speciesId: "krombi", displayForm: "stage1" }]);
  });

  it("is a no-op when it would leave slots empty", () => {
    const data = migrateAppData(undefined, krombi); // only krombi shown
    expect(hideSlot(data, "krombi")).toEqual(data);
  });
});

describe("setDisplayForm", () => {
  it("changes a slot's displayForm without touching the instance", () => {
    const data = {
      ...withTwoSpecies(),
      pets: {
        ...withTwoSpecies().pets,
        krombi: { unlockedForms: ["stage1", "stage2-sage", "stage3-sage"], instance: { ...withTwoSpecies().pets.krombi.instance, form: "stage3-sage" } },
      },
    };
    const next = setDisplayForm(data, "krombi", "stage1");
    expect(next.slots[0]).toEqual({ speciesId: "krombi", displayForm: "stage1" });
    expect(next.pets.krombi.instance.form).toBe("stage3-sage"); // progress unaffected
  });

  it("is a no-op if the form was never unlocked", () => {
    const data = withTwoSpecies();
    expect(setDisplayForm(data, "krombi", "stage3-wild")).toEqual(data);
  });

  it("is a no-op if the species has no active slot", () => {
    const data = withTwoSpecies(); // mochi owned but not in slots
    expect(setDisplayForm(data, "mochi", "stage1")).toEqual(data);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- appDataOps.test.ts`
Expected: FAIL with "acquireSpecies is not a function" (and similarly for the other three)

- [ ] **Step 3: Append the implementation to `src/pet/appDataOps.ts`**

```ts
export function acquireSpecies(data: AppData, speciesId: string): AppData {
  if (data.pets[speciesId]) return data;
  const instance = defaultPet();
  return {
    ...data,
    pets: { ...data.pets, [speciesId]: { unlockedForms: [instance.form], instance } },
  };
}

export function addSlot(data: AppData, speciesId: string): AppData {
  const progress = data.pets[speciesId];
  if (!progress) return data;
  if (data.slots.some((s) => s.speciesId === speciesId)) return data;
  return { ...data, slots: [...data.slots, { speciesId, displayForm: progress.instance.form }] };
}

export function hideSlot(data: AppData, speciesId: string): AppData {
  if (data.slots.length <= 1) return data;
  return { ...data, slots: data.slots.filter((s) => s.speciesId !== speciesId) };
}

export function setDisplayForm(data: AppData, speciesId: string, form: string): AppData {
  const progress = data.pets[speciesId];
  if (!progress || !progress.unlockedForms.includes(form)) return data;
  const idx = data.slots.findIndex((s) => s.speciesId === speciesId);
  if (idx === -1) return data;
  const slots = [...data.slots];
  slots[idx] = { ...slots[idx], displayForm: form };
  return { ...data, slots };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- appDataOps.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full suite and the TypeScript build to make sure nothing else broke**

Run: `npm run test && npx tsc --noEmit`
Expected: both PASS

- [ ] **Step 6: Commit**

```bash
git add src/pet/appDataOps.ts src/pet/appDataOps.test.ts
git commit -m "feat(pet): add ownership/slot operations over AppData"
```

---

## Definition of Done

- `npm run test` passes, covering: `petState.test.ts` (updated), `speciesRegistry.test.ts`, `appData.test.ts`, `appDataOps.test.ts` (new).
- `npx tsc --noEmit` passes.
- `src/App.tsx` is unchanged — this plan only adds/edits files under `src/pet/`.
- Every operation from the design spec (`docs/superpowers/specs/2026-06-17-multi-pet-data-model-design.md`) has a corresponding function: tick, evolve, reset, acquire, addSlot, hideSlot, setDisplayForm, plus migration and the species registry.
