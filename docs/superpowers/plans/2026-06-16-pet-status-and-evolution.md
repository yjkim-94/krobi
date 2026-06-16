# Pet Status & Evolution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 펫상태 / 진화하기 context-menu actions backed by a time-driven EXP gauge, three active-app-driven tendency gauges, and a tendency-resolved evolution flow (placeholder art).

**Architecture:** Pure state logic lives in small testable modules under `src/pet/` (`petState.ts`, `appCategories.ts`, `formAppearance.ts`); a Rust Tauri command exposes the macOS frontmost app; `App.tsx` wires the tick, the 30s app poll, the native menu, the status panel, and the evolution action. Evolved forms reuse the stage1 sprite with a per-branch CSS tint until real art is produced via add-pet.

**Tech Stack:** Tauri 2 (Rust, `objc2-app-kit`), React 19 + TypeScript, Vite, Tailwind v4, Vitest, `@tauri-apps/plugin-store`.

---

## File structure

- `src/assets/pets/krombi/species.json` — **rewrite** to `branches` map + `branch`/`expToEvolve`.
- `src/assets/pets/catalog.json` — branch keys → `maker/sage/wild`.
- `src/pet/types.ts` — **modify** `SpeciesDef`/`SpeciesForm`; add branch types.
- `src/pet/petState.ts` — **create**: `PetData`, migrate, tick, evolution logic (pure).
- `src/pet/petState.test.ts` — **create**.
- `src/pet/petData.test.ts` — **modify** to new species schema.
- `src/pet/appCategories.ts` + `.test.ts` — **create**: app → tendency mapping.
- `src/pet/formAppearance.ts` + `.test.ts` — **create**: placeholder tint/scale per form.
- `src/pet/useActiveAppTracker.ts` — **create**: 30s frontmost-app poll hook.
- `src/ui/StatusPanel.tsx` — **create**: satiety/EXP/tendency gauges.
- `src/pet/Pet.tsx` — **modify**: optional `filter` prop.
- `src-tauri/Cargo.toml` — **modify**: macOS objc2 deps.
- `src-tauri/src/lib.rs` — **modify**: `get_frontmost_app` command + handler.
- `src/App.tsx` — **modify**: wire everything.
- `.claude/skills/add-pet/SKILL.md` + `references/templates.md` — **modify**: new branch model.

---

## Task 1: Redefine species.json schema + types

**Files:**
- Modify: `src/pet/types.ts`
- Modify: `src/assets/pets/krombi/species.json`
- Modify: `src/assets/pets/catalog.json`
- Test: `src/pet/petData.test.ts`

- [ ] **Step 1: Rewrite the species test to the new schema**

Replace the body of `src/pet/petData.test.ts` with:

```ts
import { describe, expect, it } from "vitest";
import type { Catalog, SpeciesDef } from "./types";
import catalog from "../assets/pets/catalog.json";
import krombiSpecies from "../assets/pets/krombi/species.json";

const cat = catalog as Catalog;
const krombi = krombiSpecies as SpeciesDef;

describe("catalog.json", () => {
  it("has a well-formed krombi entry", () => {
    const entry = cat.species.find((s) => s.id === "krombi");
    expect(entry).toBeDefined();
    expect(entry!.archetype).toBe("slime");
    expect(entry!.branches).toHaveLength(3);
  });
});

describe("krombi species.json", () => {
  it("declares 3 branches matching the catalog", () => {
    const entry = cat.species.find((s) => s.id === "krombi")!;
    expect(krombi.archetype).toBe("slime");
    expect(Object.keys(krombi.branches).sort()).toEqual([...entry.branches].sort());
  });

  it("stage1 has frameSize 64, an expToEvolve, no parent/branch", () => {
    const s1 = krombi.forms.stage1;
    expect(s1.frameSize).toBe(64);
    expect(s1.from).toBeUndefined();
    expect(s1.branch).toBeUndefined();
    expect(s1.expToEvolve).toBeGreaterThan(0);
  });

  it("every stage2 form has from=stage1, a known branch, and an expToEvolve", () => {
    for (const key of ["stage2-maker", "stage2-sage", "stage2-wild"]) {
      const f = krombi.forms[key];
      expect(f.from).toBe("stage1");
      expect(krombi.branches[f.branch!]).toBeDefined();
      expect(f.expToEvolve).toBeGreaterThan(0);
    }
  });

  it("stage3 forms are terminal (no expToEvolve)", () => {
    for (const key of ["stage3-maker", "stage3-sage", "stage3-wild"]) {
      const f = krombi.forms[key];
      expect(f.from).toBe(`stage2-${f.branch}`);
      expect(f.expToEvolve).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run the test, expect failure**

Run: `npm test -- petData`
Expected: FAIL (types/schema mismatch — `branches` undefined, `expToEvolve` missing).

- [ ] **Step 3: Update the types**

In `src/pet/types.ts`, replace the `SpeciesForm` and `SpeciesDef` interfaces (and the `CatalogEntry.branches` comment) with:

```ts
/** A reachable evolution branch. Key (e.g. "maker") is used in form names. */
export interface SpeciesBranch {
  /** in-game display name of the branch's evolved form */
  label: string;
  /** the user tendency this branch aligns with (display string) */
  tendency: string;
}

/** species.json 의 한 형태(노드) */
export interface SpeciesForm {
  frameSize: number;
  /** 부모 노드 키(stage1 은 없음) */
  from?: string;
  /** 이 폼이 속한 분기 키 (stage1 은 없음) */
  branch?: string;
  /** 이 폼에서 다음 단계로 진화하는 데 필요한 EXP. 없으면 종착(진화 불가). */
  expToEvolve?: number;
}

/** species.json — 종별 진화 트리 */
export interface SpeciesDef {
  id: string;
  archetype: string;
  /** 분기 키 → 분기 정의 (maker/sage/wild) */
  branches: Record<string, SpeciesBranch>;
  forms: Record<string, SpeciesForm>;
}
```

Leave `CatalogEntry` as-is (its `branches: string[]` still mirrors the branch keys).

- [ ] **Step 4: Rewrite `src/assets/pets/krombi/species.json`**

```json
{
  "id": "krombi",
  "archetype": "slime",
  "branches": {
    "maker": { "label": "마그마 대장장이", "tendency": "생산·창작" },
    "sage":  { "label": "지혜의 등불 정령", "tendency": "탐구·학습" },
    "wild":  { "label": "불꽃 야수", "tendency": "유희·감상" }
  },
  "forms": {
    "stage1":       { "frameSize": 64, "expToEvolve": 100 },
    "stage2-maker": { "frameSize": 64, "from": "stage1", "branch": "maker", "expToEvolve": 300 },
    "stage2-sage":  { "frameSize": 64, "from": "stage1", "branch": "sage",  "expToEvolve": 300 },
    "stage2-wild":  { "frameSize": 64, "from": "stage1", "branch": "wild",  "expToEvolve": 300 },
    "stage3-maker": { "frameSize": 96, "from": "stage2-maker", "branch": "maker" },
    "stage3-sage":  { "frameSize": 96, "from": "stage2-sage",  "branch": "sage" },
    "stage3-wild":  { "frameSize": 96, "from": "stage2-wild",  "branch": "wild" }
  }
}
```

- [ ] **Step 5: Update `src/assets/pets/catalog.json` branch keys**

Change the krombi entry's `"branches"` array to:

```json
    "branches": ["maker", "sage", "wild"]
```

(Leave `concept`, `claimedMotifs`, `claimedColors` unchanged.)

- [ ] **Step 6: Run the test, expect pass**

Run: `npm test -- petData`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pet/types.ts src/assets/pets/krombi/species.json src/assets/pets/catalog.json src/pet/petData.test.ts
git commit -m "feat(pet): redefine krombi evolution as maker/sage/wild branches with expToEvolve"
```

---

## Task 2: Pet state module (migrate, tick, evolution)

**Files:**
- Create: `src/pet/petState.ts`
- Test: `src/pet/petState.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/pet/petState.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { SpeciesDef } from "./types";
import krombiSpecies from "../assets/pets/krombi/species.json";
import {
  defaultPet,
  migrate,
  applyTick,
  dominantTendency,
  canEvolve,
  resolveNextForm,
  applyEvolution,
} from "./petState";

const species = krombiSpecies as SpeciesDef;

describe("migrate", () => {
  it("returns a default stage1 pet for empty input", () => {
    const p = migrate(undefined);
    expect(p.form).toBe("stage1");
    expect(p.exp).toBe(0);
    expect(p.tendencies).toEqual({ maker: 0, sage: 0, wild: 0 });
    expect(p.status.satiety).toBe(100);
  });

  it("carries old satiety/hunger and drops legacy level", () => {
    const p = migrate({ name: "x", level: 3, status: { hunger: 42 }, last_updated: "t" });
    expect(p.name).toBe("x");
    expect(p.status.satiety).toBe(42);
    expect(p.form).toBe("stage1");
  });
});

describe("applyTick", () => {
  it("decrements satiety and increments exp by the given rates", () => {
    const base = defaultPet();
    const next = applyTick(base, { satietyRate: 1, expGain: 10 });
    expect(next.status.satiety).toBe(99);
    expect(next.exp).toBe(10);
  });

  it("clamps satiety at 0", () => {
    const p = { ...defaultPet(), status: { satiety: 0 } };
    expect(applyTick(p, { satietyRate: 5, expGain: 0 }).status.satiety).toBe(0);
  });
});

describe("dominantTendency", () => {
  it("picks the max tendency", () => {
    expect(dominantTendency({ maker: 1, sage: 9, wild: 3 })).toBe("sage");
  });
  it("defaults to maker on an all-zero tie", () => {
    expect(dominantTendency({ maker: 0, sage: 0, wild: 0 })).toBe("maker");
  });
});

describe("canEvolve", () => {
  it("true when exp reaches the form threshold", () => {
    expect(canEvolve(species, "stage1", 100)).toBe(true);
    expect(canEvolve(species, "stage1", 99)).toBe(false);
  });
  it("false for terminal stage3 forms", () => {
    expect(canEvolve(species, "stage3-maker", 9999)).toBe(false);
  });
});

describe("resolveNextForm", () => {
  it("stage1 evolves toward the dominant tendency", () => {
    const pet = { ...defaultPet(), exp: 100, tendencies: { maker: 2, sage: 9, wild: 1 } };
    expect(resolveNextForm(species, pet)).toBe("stage2-sage");
  });
  it("stage2 evolves to stage3 of the same branch", () => {
    const pet = { ...defaultPet(), form: "stage2-wild", exp: 300 };
    expect(resolveNextForm(species, pet)).toBe("stage3-wild");
  });
  it("returns null for a terminal form", () => {
    const pet = { ...defaultPet(), form: "stage3-wild", exp: 9999 };
    expect(resolveNextForm(species, pet)).toBeNull();
  });
});

describe("applyEvolution", () => {
  it("advances form and resets exp when eligible", () => {
    const pet = { ...defaultPet(), exp: 150, tendencies: { maker: 5, sage: 1, wild: 1 } };
    const next = applyEvolution(species, pet);
    expect(next.form).toBe("stage2-maker");
    expect(next.exp).toBe(0);
  });
  it("is a no-op when not eligible", () => {
    const pet = { ...defaultPet(), exp: 10 };
    expect(applyEvolution(species, pet)).toEqual(pet);
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- petState`
Expected: FAIL (`petState.ts` not found).

- [ ] **Step 3: Implement `src/pet/petState.ts`**

```ts
import type { SpeciesDef } from "./types";

export type TendencyKey = "maker" | "sage" | "wild";
export type Tendencies = Record<TendencyKey, number>;
export type Status = { satiety: number };

export type PetData = {
  name: string;
  form: string; // 현재 폼 키 ("stage1" | "stage2-maker" ...)
  status: Status;
  exp: number; // 시간으로 증가, 진화 시 0
  tendencies: Tendencies; // 활성 앱 감지로 증가
  unknownApps: Record<string, number>; // 미분류 앱 카운트
  last_updated: string;
};

export const TENDENCY_KEYS: TendencyKey[] = ["maker", "sage", "wild"];

const clampMin0 = (v: number) => Math.max(0, v);

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

/** 구버전 저장(level/hunger) → 신버전(form/exp/tendencies)으로 마이그레이션. */
export function migrate(raw: unknown): PetData {
  const base = defaultPet();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Record<string, unknown>;
  const status = (r.status ?? {}) as Record<string, unknown>;
  const satiety =
    typeof status.satiety === "number"
      ? status.satiety
      : typeof status.hunger === "number"
        ? status.hunger
        : 100;
  const t = (r.tendencies ?? {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" ? v : 0);
  return {
    name: typeof r.name === "string" ? r.name : base.name,
    form: typeof r.form === "string" ? r.form : base.form,
    status: { satiety },
    exp: typeof r.exp === "number" ? r.exp : 0,
    tendencies: { maker: num(t.maker), sage: num(t.sage), wild: num(t.wild) },
    unknownApps:
      r.unknownApps && typeof r.unknownApps === "object"
        ? (r.unknownApps as Record<string, number>)
        : {},
    last_updated:
      typeof r.last_updated === "string" ? r.last_updated : base.last_updated,
  };
}

/** 한 틱: 포만감 감소 + EXP 증가. last_updated 갱신. */
export function applyTick(
  pet: PetData,
  rates: { satietyRate: number; expGain: number },
): PetData {
  return {
    ...pet,
    status: { satiety: clampMin0(pet.status.satiety - rates.satietyRate) },
    exp: pet.exp + rates.expGain,
    last_updated: new Date().toISOString(),
  };
}

/** 가장 높은 성향 키. 전부 동률이면 maker. */
export function dominantTendency(t: Tendencies): TendencyKey {
  let best: TendencyKey = "maker";
  for (const k of TENDENCY_KEYS) if (t[k] > t[best]) best = k;
  return best;
}

export function canEvolve(species: SpeciesDef, form: string, exp: number): boolean {
  const f = species.forms[form];
  return !!f && f.expToEvolve != null && exp >= f.expToEvolve;
}

/** 다음 폼 키. 진화 불가/종착이면 null. */
export function resolveNextForm(species: SpeciesDef, pet: PetData): string | null {
  if (!canEvolve(species, pet.form, pet.exp)) return null;
  if (pet.form === "stage1") return `stage2-${dominantTendency(pet.tendencies)}`;
  const f = species.forms[pet.form];
  if (f.branch && pet.form.startsWith("stage2-")) return `stage3-${f.branch}`;
  return null;
}

/** 진화 가능하면 폼 전진 + EXP 0, 아니면 그대로. */
export function applyEvolution(species: SpeciesDef, pet: PetData): PetData {
  const next = resolveNextForm(species, pet);
  if (!next) return pet;
  return { ...pet, form: next, exp: 0, last_updated: new Date().toISOString() };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- petState`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pet/petState.ts src/pet/petState.test.ts
git commit -m "feat(pet): pure pet-state module (migrate, tick, tendency evolution)"
```

---

## Task 3: App → tendency classification

**Files:**
- Create: `src/pet/appCategories.ts`
- Test: `src/pet/appCategories.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/pet/appCategories.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { classifyApp } from "./appCategories";

describe("classifyApp", () => {
  it("maps known dev apps to maker by bundle id", () => {
    expect(classifyApp("Code", "com.microsoft.VSCode")).toBe("maker");
    expect(classifyApp("iTerm2", "com.googlecode.iterm2")).toBe("maker");
  });
  it("maps browsers/readers to sage", () => {
    expect(classifyApp("Google Chrome", "com.google.Chrome")).toBe("sage");
    expect(classifyApp("Preview", "com.apple.Preview")).toBe("sage");
  });
  it("maps games/media to wild", () => {
    expect(classifyApp("Steam", "com.valvesoftware.steam")).toBe("wild");
    expect(classifyApp("Spotify", "com.spotify.client")).toBe("wild");
  });
  it("falls back to a name substring when bundle id is unknown", () => {
    expect(classifyApp("Some Terminal", "com.unknown.thing")).toBe("maker");
  });
  it("returns null for an unmapped app", () => {
    expect(classifyApp("Totally Unknown App", "com.acme.unknown")).toBeNull();
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- appCategories`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/pet/appCategories.ts`**

```ts
import type { TendencyKey } from "./petState";

/** 번들ID(소문자) → 성향. 우선 매칭. */
const BY_BUNDLE: Record<string, TendencyKey> = {
  // maker — 생산·창작
  "com.microsoft.vscode": "maker",
  "com.apple.dt.xcode": "maker",
  "com.googlecode.iterm2": "maker",
  "com.apple.terminal": "maker",
  "com.jetbrains.intellij": "maker",
  "com.jetbrains.pycharm": "maker",
  "com.sublimetext.4": "maker",
  "com.figma.desktop": "maker",
  "com.microsoft.word": "maker",
  "com.microsoft.excel": "maker",
  "com.microsoft.powerpoint": "maker",
  "com.apple.iwork.pages": "maker",
  "com.apple.iwork.numbers": "maker",
  "notion.id": "maker",
  "com.hancom.hwp": "maker",
  // sage — 탐구·학습
  "com.google.chrome": "sage",
  "com.apple.safari": "sage",
  "org.mozilla.firefox": "sage",
  "company.thebrowser.browser": "sage", // Arc
  "com.microsoft.edgemac": "sage",
  "com.apple.preview": "sage",
  "com.readdle.pdfexpert-mac": "sage",
  "com.literatureandlatte.scrivener3": "sage",
  "md.obsidian": "sage",
  // wild — 유희·감상
  "com.valvesoftware.steam": "wild",
  "com.spotify.client": "wild",
  "com.apple.music": "wild",
  "com.apple.tv": "wild",
  "tv.plex.player": "wild",
  "com.colliderli.iina": "wild",
  "com.hnc.discord": "wild",
  "com.tinyspeck.slackmacgap": "wild",
  "com.kakao.kakaotalkmac": "wild",
};

/** 번들ID 미스 시 이름(소문자) 부분일치. 위→아래 순. */
const BY_NAME: { match: string; key: TendencyKey }[] = [
  { match: "code", key: "maker" },
  { match: "terminal", key: "maker" },
  { match: "xcode", key: "maker" },
  { match: "word", key: "maker" },
  { match: "excel", key: "maker" },
  { match: "figma", key: "maker" },
  { match: "chrome", key: "sage" },
  { match: "safari", key: "sage" },
  { match: "firefox", key: "sage" },
  { match: "preview", key: "sage" },
  { match: "steam", key: "wild" },
  { match: "spotify", key: "wild" },
  { match: "discord", key: "wild" },
  { match: "youtube", key: "wild" },
];

/** 활성 앱을 성향으로 분류. 모르는 앱이면 null. */
export function classifyApp(name: string, bundleId?: string): TendencyKey | null {
  if (bundleId) {
    const hit = BY_BUNDLE[bundleId.toLowerCase()];
    if (hit) return hit;
  }
  const lower = name.toLowerCase();
  for (const { match, key } of BY_NAME) if (lower.includes(match)) return key;
  return null;
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- appCategories`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pet/appCategories.ts src/pet/appCategories.test.ts
git commit -m "feat(pet): map well-known macOS apps to maker/sage/wild tendencies"
```

---

## Task 4: Rust `get_frontmost_app` command (macOS)

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: Add macOS deps to `src-tauri/Cargo.toml`**

Append after the `[dependencies]` block:

```toml
[target.'cfg(target_os = "macos")'.dependencies]
objc2 = "0.5"
objc2-foundation = { version = "0.2", features = ["NSString"] }
objc2-app-kit = { version = "0.2", features = ["NSWorkspace", "NSRunningApplication"] }
```

- [ ] **Step 2: Implement the command in `src-tauri/src/lib.rs`**

Add near the top (after `use tauri::Manager;`):

```rust
use serde::Serialize;

#[derive(Serialize)]
struct FrontmostApp {
    name: String,
    bundle_id: String,
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn get_frontmost_app() -> Option<FrontmostApp> {
    use objc2_app_kit::NSWorkspace;
    unsafe {
        let ws = NSWorkspace::sharedWorkspace();
        let app = ws.frontmostApplication()?;
        Some(FrontmostApp {
            name: app.localizedName().map(|s| s.to_string()).unwrap_or_default(),
            bundle_id: app.bundleIdentifier().map(|s| s.to_string()).unwrap_or_default(),
        })
    }
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn get_frontmost_app() -> Option<FrontmostApp> {
    None
}
```

Then register the handler — change the builder chain so it includes:

```rust
        .invoke_handler(tauri::generate_handler![get_frontmost_app])
```

(insert it right after `.plugin(tauri_plugin_store::Builder::default().build())`).

- [ ] **Step 3: Build to verify it compiles**

Run: `cd src-tauri && cargo build 2>&1 | tail -20`
Expected: `Finished` with no errors.
If a class/method name errors (objc2 version skew), adjust the feature list or method casing per the cargo error; `NSWorkspace::sharedWorkspace()` / `frontmostApplication()` / `localizedName()` / `bundleIdentifier()` are the target APIs. NSString → String via `.to_string()`.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/lib.rs
git commit -m "feat(tauri): get_frontmost_app command via NSWorkspace (macOS, no a11y perm)"
```

---

## Task 5: Placeholder form appearance

**Files:**
- Create: `src/pet/formAppearance.ts`
- Test: `src/pet/formAppearance.test.ts`
- Modify: `src/pet/Pet.tsx`

- [ ] **Step 1: Write the failing tests**

Create `src/pet/formAppearance.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formAppearance } from "./formAppearance";

describe("formAppearance", () => {
  it("stage1 has no tint and scale 1", () => {
    const a = formAppearance("stage1");
    expect(a.filter).toBe("none");
    expect(a.scale).toBe(1);
  });
  it("stage2 branches get a non-none filter and a >1 scale", () => {
    const a = formAppearance("stage2-maker");
    expect(a.filter).not.toBe("none");
    expect(a.scale).toBeGreaterThan(1);
  });
  it("stage3 is larger than stage2", () => {
    expect(formAppearance("stage3-wild").scale).toBeGreaterThan(
      formAppearance("stage2-wild").scale,
    );
  });
  it("different branches get different filters", () => {
    expect(formAppearance("stage2-maker").filter).not.toBe(
      formAppearance("stage2-sage").filter,
    );
  });
});
```

- [ ] **Step 2: Run, expect failure**

Run: `npm test -- formAppearance`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `src/pet/formAppearance.ts`**

```ts
/**
 * 진화 폼의 임시 외형(실제 스프라이트가 나오기 전까지).
 * stage1 스프라이트를 분기별 색조 + 단계별 확대로 재사용한다.
 */
export type FormAppearance = { filter: string; scale: number };

const BRANCH_FILTER: Record<string, string> = {
  maker: "hue-rotate(-20deg) saturate(1.3)", // 더 붉은 용암
  sage: "hue-rotate(180deg) saturate(1.2) brightness(1.1)", // 푸른 등불
  wild: "hue-rotate(280deg) saturate(1.4)", // 보라/마젠타 화염
};

function branchOf(form: string): string | null {
  const m = form.match(/^stage[23]-(.+)$/);
  return m ? m[1] : null;
}

export function formAppearance(form: string): FormAppearance {
  const branch = branchOf(form);
  if (!branch) return { filter: "none", scale: 1 };
  const scale = form.startsWith("stage3-") ? 1.4 : 1.2;
  return { filter: BRANCH_FILTER[branch] ?? "none", scale };
}
```

- [ ] **Step 4: Run, expect pass**

Run: `npm test -- formAppearance`
Expected: PASS.

- [ ] **Step 5: Add the optional `filter` prop to `Pet.tsx`**

In `src/pet/Pet.tsx`, add `filter` to the props type and default it, and apply it to the canvas style:

Change the destructured props to include `filter = "none"`:

```tsx
export function Pet({
  img,
  cell,
  columns,
  cellSize,
  box,
  destW,
  destH,
  filter = "none",
}: {
  img: HTMLImageElement;
  cell: number;
  columns: number;
  cellSize: number;
  box: Box;
  destW: number;
  destH: number;
  filter?: string;
}) {
```

And change the returned canvas to apply the filter:

```tsx
  return <canvas ref={ref} style={{ display: "block", userSelect: "none", filter }} />;
```

- [ ] **Step 6: Run the full suite to confirm nothing broke**

Run: `npm test`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/pet/formAppearance.ts src/pet/formAppearance.test.ts src/pet/Pet.tsx
git commit -m "feat(pet): placeholder per-branch tint/scale for evolved forms"
```

---

## Task 6: Status panel UI

**Files:**
- Create: `src/ui/StatusPanel.tsx`

- [ ] **Step 1: Implement `src/ui/StatusPanel.tsx`**

```tsx
import type { PetData } from "../pet/petState";
import type { SpeciesDef } from "../pet/types";
import { dominantTendency } from "../pet/petState";

function Bar({ label, value, max, color, highlight }: {
  label: string; value: number; max: number; color: string; highlight?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div style={{ marginBottom: 3 }}>
      <div style={{ fontSize: 9, lineHeight: "10px", color: highlight ? "#fff" : "#cbd5e1", fontWeight: highlight ? 700 : 400 }}>
        {label}
      </div>
      <div style={{ height: 6, background: "rgba(0,0,0,0.45)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color }} />
      </div>
    </div>
  );
}

/** 펫 머리 위 상태 패널: 포만감 / 경험치 / 성향 3개. */
export function StatusPanel({ pet, species }: { pet: PetData; species: SpeciesDef }) {
  const expMax = species.forms[pet.form]?.expToEvolve ?? pet.exp || 1;
  const terminal = species.forms[pet.form]?.expToEvolve == null;
  const full = !terminal && pet.exp >= expMax;
  const dom = dominantTendency(pet.tendencies);
  return (
    <div style={{
      position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)",
      width: 150, padding: "6px 8px", borderRadius: 8,
      background: "rgba(17,24,39,0.82)", color: "#fff", fontFamily: "system-ui",
      boxShadow: "0 2px 8px rgba(0,0,0,0.4)", pointerEvents: "none",
    }}>
      <Bar label="포만감" value={pet.status.satiety} max={100} color="#f59e0b" />
      <Bar label={full ? "경험치 — 진화 가능!" : "경험치"} value={terminal ? 1 : pet.exp} max={terminal ? 1 : expMax} color={full ? "#22c55e" : "#38bdf8"} />
      <Bar label="🛠 생산·창작" value={pet.tendencies.maker} max={100} color="#fb7185" highlight={dom === "maker"} />
      <Bar label="🔍 탐구·학습" value={pet.tendencies.sage} max={100} color="#60a5fa" highlight={dom === "sage"} />
      <Bar label="🎮 유희·감상" value={pet.tendencies.wild} max={100} color="#c084fc" highlight={dom === "wild"} />
    </div>
  );
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/ui/StatusPanel.tsx
git commit -m "feat(ui): status panel with satiety/exp/tendency gauges"
```

---

## Task 7: Active-app tracker hook

**Files:**
- Create: `src/pet/useActiveAppTracker.ts`

- [ ] **Step 1: Implement `src/pet/useActiveAppTracker.ts`**

```ts
import { useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { classifyApp } from "./appCategories";
import type { TendencyKey } from "./petState";

type FrontmostApp = { name: string; bundle_id: string };

/**
 * intervalMs 마다 활성 앱을 확인해 onSample 호출.
 * 분류되면 key, 모르는 앱이면 key=null (이름은 항상 전달).
 */
export function useActiveAppTracker(
  onSample: (key: TendencyKey | null, appName: string) => void,
  intervalMs = 30_000,
) {
  const ref = useRef(onSample);
  ref.current = onSample;

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const app = await invoke<FrontmostApp | null>("get_frontmost_app");
        if (cancelled || !app || !app.name) return;
        ref.current(classifyApp(app.name, app.bundle_id), app.name);
      } catch {
        /* 비-macOS 또는 일시 오류는 무시 */
      }
    };
    void tick();
    const id = window.setInterval(tick, intervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [intervalMs]);
}
```

- [ ] **Step 2: Verify it type-checks**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pet/useActiveAppTracker.ts
git commit -m "feat(pet): poll frontmost app every 30s and classify into a tendency"
```

---

## Task 8: Wire everything into App.tsx

**Files:**
- Modify: `src/App.tsx`

This task replaces the file's pet-data plumbing with the `petState` module and adds EXP, tendency tracking, the two menu items, the status panel, the window expand, and the evolution action.

- [ ] **Step 1: Replace `src/App.tsx` with the wired version**

```tsx
import { useEffect, useRef, useState } from "react";
import { load, type Store } from "@tauri-apps/plugin-store";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { Menu } from "@tauri-apps/api/menu";
import "./App.css";
import manifest from "./assets/pets/krombi/stage1/manifest.json";
import krombiSpecies from "./assets/pets/krombi/species.json";
import type { AnimationName, PetManifest, SpeciesDef } from "./pet/types";
import { baseAnimation } from "./pet/animation";
import { krombiSheetUrl } from "./pet/frameUrls";
import { usePetAnimation } from "./pet/usePetAnimation";
import { Pet } from "./pet/Pet";
import { useWindowDrag } from "./pet/useWindowDrag";
import { useActiveAppTracker } from "./pet/useActiveAppTracker";
import { loadImage, measureBounds } from "./pet/sheetImage";
import { fitWindowSize, fitScale, boxSize, type Box } from "./pet/contentBounds";
import { formAppearance } from "./pet/formAppearance";
import { StatusPanel } from "./ui/StatusPanel";
import { ResizeOverlay } from "./ui/ResizeOverlay";
import {
  type PetData,
  type TendencyKey,
  migrate,
  applyTick,
  canEvolve,
  applyEvolution,
} from "./pet/petState";

const PET = manifest as PetManifest;
const SPECIES = krombiSpecies as SpeciesDef;
const STORE_FILE = "krobi_data.json";
const VERSION = "2.0.0";
const HUNGER_RATE = 1; // 포만감: 분당 -1
const EXP_GAIN = 10; // 경험치: 분당 +10 (잠정)
const TENDENCY_GAIN = 5; // 활성 앱 1회 감지당 +5 (잠정)
const TICK_MS = 60_000;
const MARGIN = 12; // 펫 주변 여백(px)
const PANEL_H = 96; // 펫상태 패널을 위해 창에 더할 높이(px)

type WindowSize = { width: number; height: number };

const clampMax100 = (v: number) => Math.min(100, v);

function App() {
  const storeRef = useRef<Store | null>(null);
  const [pet, setPet] = useState<PetData | null>(null);
  const [oneShot, setOneShot] = useState<AnimationName | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [inner, setInner] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [resizing, setResizing] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const baseHeightRef = useRef<number | null>(null); // 패널 펼치기 전 창 높이

  async function persistPet(next: PetData) {
    const store = storeRef.current;
    if (!store) return;
    await store.set("version", VERSION);
    await store.set("pet", next);
    await store.save();
  }

  // 펫 데이터 로드 + 오프라인 보정 + 감소/증가 틱.
  useEffect(() => {
    let intervalId: number | undefined;
    (async () => {
      const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
      storeRef.current = store;
      let current = migrate(await store.get("pet"));

      const now = Date.now();
      const last = new Date(current.last_updated).getTime();
      const elapsedMin = Math.max(0, Math.floor((now - last) / 60_000));
      for (let i = 0; i < elapsedMin; i++) {
        current = applyTick(current, { satietyRate: HUNGER_RATE, expGain: EXP_GAIN });
      }
      await persistPet(current);
      setPet(current);

      intervalId = window.setInterval(() => {
        setPet((prev) => {
          if (!prev) return prev;
          const next = applyTick(prev, { satietyRate: HUNGER_RATE, expGain: EXP_GAIN });
          void persistPet(next);
          return next;
        });
      }, TICK_MS);
    })();
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  // 활성 앱 감지 → 성향 게이지 증가(분류) 또는 미분류 카운트.
  useActiveAppTracker((key: TendencyKey | null, appName: string) => {
    setPet((prev) => {
      if (!prev) return prev;
      let next: PetData;
      if (key) {
        next = {
          ...prev,
          tendencies: { ...prev.tendencies, [key]: prev.tendencies[key] + TENDENCY_GAIN },
        };
      } else {
        next = {
          ...prev,
          unknownApps: { ...prev.unknownApps, [appName]: (prev.unknownApps[appName] ?? 0) + 1 },
        };
      }
      void persistPet(next);
      return next;
    });
  });

  // 시트 로드 + 콘텐츠 경계 측정 + 초기 창 크기.
  useEffect(() => {
    const cells = Object.values(PET.animations).flatMap((a) => a.frames);
    (async () => {
      const store = storeRef.current ?? (await load(STORE_FILE, { defaults: {}, autoSave: false }));
      const image = await loadImage(krombiSheetUrl);
      const measured = measureBounds(image, PET.frameSize, PET.columns, cells);
      setImg(image);
      setBox(measured);

      const saved = (await store.get("window_size")) as WindowSize | undefined;
      const size = saved ?? fitWindowSize(boxSize(measured), PET.displayScale, MARGIN);
      await getCurrentWindow().setSize(new LogicalSize(size.width, size.height));
    })().catch((e) => console.error("펫 시트 로드/측정 실패:", e));
  }, []);

  useEffect(() => {
    const onResize = () => setInner({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // 펫상태 토글 시 창 높이를 패널만큼 늘렸다 복원.
  async function toggleStatus() {
    const win = getCurrentWindow();
    if (!showStatus) {
      baseHeightRef.current = window.innerHeight;
      await win.setSize(new LogicalSize(window.innerWidth, window.innerHeight + PANEL_H));
      setShowStatus(true);
    } else {
      const h = baseHeightRef.current ?? window.innerHeight - PANEL_H;
      await win.setSize(new LogicalSize(window.innerWidth, h));
      setShowStatus(false);
    }
  }

  const base: AnimationName = pet ? baseAnimation(pet.status.satiety) : "idle";
  const cell = usePetAnimation(PET, base, oneShot, () => setOneShot(null));
  const drag = useWindowDrag(() => setOneShot("happy"));

  function feed() {
    setOneShot("eat");
    setPet((prev) => {
      if (!prev) return prev;
      const next: PetData = {
        ...prev,
        status: { satiety: clampMax100(prev.status.satiety + 20) },
        last_updated: new Date().toISOString(),
      };
      void persistPet(next);
      return next;
    });
  }

  function evolve() {
    setPet((prev) => {
      if (!prev) return prev;
      const next = applyEvolution(SPECIES, prev);
      if (next === prev) return prev;
      setOneShot("happy");
      void persistPet(next);
      return next;
    });
  }

  async function showMenu() {
    const evolvable = pet ? canEvolve(SPECIES, pet.form, pet.exp) : false;
    const menu = await Menu.new({
      items: [
        { id: "feed", text: "밥주기", action: () => feed() },
        { id: "status", text: showStatus ? "펫상태 숨기기" : "펫상태", action: () => void toggleStatus() },
        { id: "evolve", text: "진화하기", enabled: evolvable, action: () => evolve() },
        { id: "resize", text: "크기 조절", action: () => setResizing(true) },
      ],
    });
    await menu.popup();
  }

  async function commitSize() {
    const store = storeRef.current;
    if (store) {
      await store.set("window_size", { width: window.innerWidth, height: window.innerHeight });
      await store.save();
    }
    setResizing(false);
  }

  if (!pet || !img || !box) return null;

  const appearance = formAppearance(pet.form);
  const cb = boxSize(box);
  const availH = inner.h - MARGIN * 2 - (showStatus ? PANEL_H : 0);
  const scale = fitScale(cb, inner.w - MARGIN * 2, availH) * appearance.scale;
  const destW = Math.round(cb.w * scale);
  const destH = Math.round(cb.h * scale);

  return (
    <div
      onMouseDown={drag.onMouseDown}
      onMouseMove={drag.onMouseMove}
      onMouseUp={drag.onMouseUp}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!resizing) void showMenu();
      }}
      className="relative flex h-screen w-screen items-center justify-center bg-transparent"
      style={{ userSelect: "none", paddingTop: showStatus ? PANEL_H : 0 }}
    >
      {showStatus && <StatusPanel pet={pet} species={SPECIES} />}

      <Pet
        img={img}
        cell={cell}
        columns={PET.columns}
        cellSize={PET.frameSize}
        box={box}
        destW={destW}
        destH={destH}
        filter={appearance.filter}
      />

      {resizing && (
        <ResizeOverlay
          onDone={(commit) => {
            if (commit) void commitSize();
            else setResizing(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
```

- [ ] **Step 2: Type-check + full test suite**

Run: `npx tsc --noEmit && npm test`
Expected: no type errors; all tests PASS.

- [ ] **Step 3: Run the app and verify behavior**

Run: `npm run tauri dev`
Verify by observation:
- Right-click → menu shows 밥주기 / 펫상태 / 진화하기 / 크기 조절.
- 펫상태 → window grows, panel shows 5 gauges; toggling again restores size.
- Switch to a browser/VSCode for a bit; reopen 펫상태 → the matching tendency bar rose.
- 진화하기 is greyed until EXP fills (wait, or temporarily lower `expToEvolve` in species.json to test, then revert); selecting it tints/enlarges the pet and resets EXP.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): wire exp tick, app-tendency tracking, status panel, evolution menu"
```

---

## Task 9: Update the add-pet skill to the new branch model

**Files:**
- Modify: `.claude/skills/add-pet/SKILL.md`
- Modify: `.claude/skills/add-pet/references/templates.md`

- [ ] **Step 1: Replace the "Evolution model" branch bullets in SKILL.md**

In `.claude/skills/add-pet/SKILL.md`, replace the bullet list under "## Evolution model (per species: 7 forms)" (the three bullets starting "One form = …", "Branch styles (A/B/C) …", "Authoring all 7 forms …") with:

```markdown
- One form = the standard 4-animation set (idle 8 / eat 8 / happy 8 / sad 8 = 32 frames).
  Every form of every species follows this standard.
- The three branches are **fixed to the user tendencies**: `maker` (생산·창작),
  `sage` (탐구·학습), `wild` (유희·감상). They are NOT picked from a free style pool.
- **Identity-variation rule:** stage2/3 of each branch MUST be a variation of the stage1
  identity (same material / element / silhouette lineage), specialized toward the branch:
  `maker` forges/builds/shapes, `sage` illuminates/refines/knows, `wild` runs untamed/fierce.
  No genre jumps (a lava slime never becomes a machine). Example (krombi): maker →
  마그마 대장장이→용암 골렘, sage → 도깨비불→지혜의 등불 정령, wild → 불꽃 야수→화염 정령.
- Authoring all 7 forms is the full job; a single playthrough only shows
  stage1 → one stage2 → one stage3.
```

- [ ] **Step 2: Update the Step 1 interview item for branches**

In the interview list under "### Step 1", replace item 5 ("**branch whitelist (3 styles)** …") with:

```markdown
5. **branch themes (maker / sage / wild)** — after the stage1 concept is set, YOU propose
   three evolved themes, one per fixed tendency (`maker` 생산·창작 / `sage` 탐구·학습 /
   `wild` 유희·감상), each a variation of the stage1 identity (per the Identity-variation
   rule), folding in any extra concept the user gives. The user confirms/adjusts before
   catalog + prompts are generated.
```

- [ ] **Step 3: Update Scope + Notes wording in SKILL.md**

In "## Scope", replace the "Branch conditions in species.json stay abstract (`stat >= threshold`, placeholder)." sentence with:

```markdown
  Evolution in species.json is expressed as `expToEvolve` per form (EXP threshold) with the
  branch resolved from the dominant tendency at the first evolution; the live runtime drives it.
```

In "## Notes", replace the first bullet ("`condition.stat` values are placeholders …") with:

```markdown
- `expToEvolve` numbers are provisional and tuned by the runtime spec; stage3 forms omit it
  (terminal).
```

- [ ] **Step 4: Update the species.json template in references/templates.md**

In `.claude/skills/add-pet/references/templates.md`, replace the entire "## species.json template" fenced block with:

```json
{
  "id": "<species>",
  "archetype": "<archetype>",
  "branches": {
    "maker": { "label": "<maker form name>", "tendency": "생산·창작" },
    "sage":  { "label": "<sage form name>",  "tendency": "탐구·학습" },
    "wild":  { "label": "<wild form name>",  "tendency": "유희·감상" }
  },
  "forms": {
    "stage1":       { "frameSize": 64, "expToEvolve": 100 },
    "stage2-maker": { "frameSize": 64, "from": "stage1", "branch": "maker", "expToEvolve": 300 },
    "stage2-sage":  { "frameSize": 64, "from": "stage1", "branch": "sage",  "expToEvolve": 300 },
    "stage2-wild":  { "frameSize": 64, "from": "stage1", "branch": "wild",  "expToEvolve": 300 },
    "stage3-maker": { "frameSize": 96, "from": "stage2-maker", "branch": "maker" },
    "stage3-sage":  { "frameSize": 96, "from": "stage2-sage",  "branch": "sage" },
    "stage3-wild":  { "frameSize": 96, "from": "stage2-wild",  "branch": "wild" }
  }
}
```

And in "## catalog.json entry template", change the `"branches"` line to:

```json
  "branches": ["maker", "sage", "wild"]
```

- [ ] **Step 5: Update the Step 6 species.json instruction**

In SKILL.md "### Step 6", replace "Keep `condition.stat`/`gte` as abstract placeholders." with
"Use `expToEvolve` per form (stage3 omits it); branch keys are always `maker`/`sage`/`wild`."
And change "`branches` mirrors `branchWhitelist`" to "`branches` lists the branch keys
(`maker`/`sage`/`wild`)".

- [ ] **Step 6: Commit**

```bash
git add .claude/skills/add-pet/SKILL.md .claude/skills/add-pet/references/templates.md
git commit -m "docs(add-pet): fixed maker/sage/wild branches + identity-variation rule"
```

---

## Self-review notes

- **Spec coverage:** model/tick (T2), tendencies+detection (T3,T4,T7), evolution logic+rules (T2,T8), species.json redefine (T1), state model+migration (T2), macOS-only detection (T4), placeholder art (T5,T8), context menu + panel + window expand (T6,T8), add-pet skill changes (T9). All covered.
- **Assumed defaults** (from the spec's Open decisions): panel shows all 5 gauges (T6), `sage` rename (T1), window-expand fix (T8), tiebreak → `maker` (T2). Adjust after seeing it run.
- **Provisional numbers:** `EXP_GAIN=10`/min, `TENDENCY_GAIN=5`/sample, thresholds 100/300. To test evolution quickly, temporarily lower `stage1.expToEvolve`, then revert.
- **Type consistency:** `TendencyKey`/`Tendencies`/`PetData` defined in `petState.ts` and imported everywhere; `get_frontmost_app` returns `{name, bundle_id}` matching the hook's `FrontmostApp`.
