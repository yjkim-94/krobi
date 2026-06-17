# Multi-pet Rendering & Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Render every species in `AppData.slots` simultaneously in the one app window, each independently draggable and never overlapping at rest, replacing today's single hardcoded-krombi rendering in `src/App.tsx`.

**Architecture:** Pure layout math (collision, default placement, bounding box) lives in a new `src/pet/layout.ts`, unit-tested like the rest of `src/pet/`. A new `PetSlot` component owns everything about rendering *one* pet (its own sprite load, animation, drag handling) so `App.tsx` can map over slots without violating React's rules of hooks. `App.tsx` itself becomes the integration point: it loads/migrates/persists `AppData` + a new `LayoutState`, ticks all slotted species, and reactively recomputes window size from whatever is currently on screen. There are no automated tests for `App.tsx` or the new React components — this codebase has no component-testing library (no React Testing Library in `package.json`); existing files like `Pet.tsx`, `StatusPanel.tsx`, and `useWindowDrag.ts` have no test files either, only the pure logic they depend on (`dragMath.ts`, `contentBounds.ts`) is unit-tested. This plan follows the same pattern and verifies `App.tsx`/`PetSlot.tsx` manually via `npm run tauri dev`, per this project's CLAUDE.md.

**Tech Stack:** TypeScript, React 19, Vitest, Tauri v2 (`@tauri-apps/api/window`, `@tauri-apps/plugin-store`).

## Global Constraints

- One growth instance per species; a species occupies at most one display slot at a time (from part 1, unchanged).
- Pets can be dragged freely in 2D; releasing one on top of another snaps it to the nearest non-overlapping position instead.
- The window auto-fits to whatever pets are currently placed; it is not capped at a fixed size.
- Right-clicking a specific pet's sprite makes the existing menu items (밥주기/진화하기/펫상태/크기 조절/초기화) act on *that* pet's species, not a hardcoded one.
- This plan does not add the Dex UI or the 펫 추가/펫 선택/펫 숨기기 menu items (parts 3 and 4).

## Implementation decisions (read before reviewing tasks)

The approved design (`docs/superpowers/specs/2026-06-17-multi-pet-rendering-layout-design.md`) left some mechanics underspecified at the pixel-math level. These are the concrete choices this plan makes to fill those gaps — flag any of these now if they're wrong, since they shape every task below:

1. **Unbounded logical coordinates, translated at render time.** Pet positions are stored as plain `(x, y)` numbers with no floor — a position can be negative (e.g. a taller pet placed bottom-aligned next to a shorter one will have a negative `y`). Rendering always subtracts the current bounding box's top-left corner before painting, so the window only ever shows a tightly-cropped, margin-padded view of wherever the pets currently are. This is what makes "free 2D drag in any direction" and "bottom-anchored row placement" both work without ad hoc clamping.
2. **Fixed per-pet pixel size**, not dynamic fill-to-window-space. Each pet renders at `measured sprite box × manifest.displayScale` (× a placeholder-tint scale if a form's real art is missing and it falls back to stage1's). This replaces the old single-pet behavior where the sprite scaled up/down to fill whatever window size existed.
3. **Window size is fully derived (auto-fit)**, recomputed reactively whenever slot membership, pet positions, measured pet sizes, or the 펫상태 panel toggle change — *not* on every per-minute stat tick. The old one-time `sizedRef`-guarded initial sizing and the persisted `window_size` store key are removed.
4. **크기 조절 (manual resize) becomes a transient override.** It still works (drag the handle, see the window resize live) but is no longer persisted; the next time slots/positions/sizes/status change, the window snaps back to the auto-fit size.
5. **펫상태 stays a single global panel** showing whichever species was last right-clicked (the "focused" species), centered at the window's top edge — not anchored above that specific pet's position.
6. **Evolution FX stays whole-window.** During one pet's evolution, the OS window still grows/shrinks symmetrically around its current position (existing Rust `evolve_grow`/`evolve_restore`, unchanged); other already-visible pets may visually shift by a few pixels for those few seconds. Not corrected in this part — purely cosmetic, and brief.
7. **Tendency gain from active-app tracking applies to every currently-slotted species at once**, mirroring how satiety/exp ticking already applies uniformly to all slotted species (part 1's `applyTickAll`).

---

### Task 1: `feedSpecies` operation

**Files:**
- Modify: `src/pet/appDataOps.ts:72` (append after `setDisplayForm`)
- Test: `src/pet/appDataOps.test.ts:160` (append after the `setDisplayForm` describe block)

**Interfaces:**
- Consumes: `AppData` from `./appData`.
- Produces: `feedSpecies(data: AppData, speciesId: string, amount?: number): AppData` — used by `App.tsx`'s feed action in Task 6.

- [ ] **Step 1: Append the failing tests**

Add to `src/pet/appDataOps.test.ts` (after the `setDisplayForm` `describe` block, and add `feedSpecies` to the existing import from `./appDataOps`):

```ts
import {
  applyTickAll,
  evolveSpecies,
  resetSpecies,
  acquireSpecies,
  addSlot,
  hideSlot,
  setDisplayForm,
  feedSpecies,
} from "./appDataOps";
```

```ts
describe("feedSpecies", () => {
  it("increases satiety by the given amount", () => {
    const data = withTwoSpecies();
    const lowered = {
      ...data,
      pets: { ...data.pets, krombi: { ...data.pets.krombi, instance: { ...data.pets.krombi.instance, status: { satiety: 50 } } } },
    };
    const next = feedSpecies(lowered, "krombi", 20);
    expect(next.pets.krombi.instance.status.satiety).toBe(70);
  });

  it("clamps satiety at 100", () => {
    const data = withTwoSpecies();
    const next = feedSpecies(data, "krombi", 20); // starts at 100 via defaultPet()
    expect(next.pets.krombi.instance.status.satiety).toBe(100);
  });

  it("defaults amount to 20", () => {
    const data = withTwoSpecies();
    const lowered = {
      ...data,
      pets: { ...data.pets, krombi: { ...data.pets.krombi, instance: { ...data.pets.krombi.instance, status: { satiety: 50 } } } },
    };
    const next = feedSpecies(lowered, "krombi");
    expect(next.pets.krombi.instance.status.satiety).toBe(70);
  });

  it("is a no-op for an unowned species", () => {
    const data = withTwoSpecies();
    expect(feedSpecies(data, "nope")).toEqual(data);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- appDataOps.test.ts`
Expected: FAIL with "feedSpecies is not a function"

- [ ] **Step 3: Append the implementation**

Append to `src/pet/appDataOps.ts`:

```ts
export function feedSpecies(data: AppData, speciesId: string, amount = 20): AppData {
  const progress = data.pets[speciesId];
  if (!progress) return data;
  const satiety = Math.min(100, progress.instance.status.satiety + amount);
  return {
    ...data,
    pets: {
      ...data.pets,
      [speciesId]: {
        ...progress,
        instance: {
          ...progress.instance,
          status: { satiety },
          last_updated: new Date().toISOString(),
        },
      },
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- appDataOps.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pet/appDataOps.ts src/pet/appDataOps.test.ts
git commit -m "feat(pet): add feedSpecies operation over AppData"
```

---

### Task 2: Cross-species sprite asset registry

`src/pet/petForms.ts` globs `assets/pets/krombi/*/manifest.json` only. This task adds the multi-species equivalent the rest of the app will use going forward.

**Files:**
- Create: `src/pet/speciesFormAssets.ts`
- Test: `src/pet/speciesFormAssets.test.ts`

**Interfaces:**
- Produces: `type FormAsset = { manifest: PetManifest; sheetUrl: string }`, `speciesFormAsset(speciesId: string, form: string): FormAsset | null` — used by `PetSlot` in Task 5.

- [ ] **Step 1: Write the failing test**

```ts
// src/pet/speciesFormAssets.test.ts
import { describe, expect, it } from "vitest";
import { speciesFormAsset } from "./speciesFormAssets";

describe("speciesFormAsset", () => {
  it("finds krombi's stage1 manifest and sheet", () => {
    const asset = speciesFormAsset("krombi", "stage1");
    expect(asset?.manifest.id).toBe("krombi/stage1");
    expect(asset?.sheetUrl).toBeTruthy();
  });

  it("finds mochi's stage2-sage manifest and sheet", () => {
    const asset = speciesFormAsset("mochi", "stage2-sage");
    expect(asset?.manifest.id).toBe("mochi/stage2-sage");
    expect(asset?.sheetUrl).toBeTruthy();
  });

  it("returns null for an unknown species", () => {
    expect(speciesFormAsset("nope", "stage1")).toBeNull();
  });

  it("returns null for an unknown form of a known species", () => {
    expect(speciesFormAsset("krombi", "stage9")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- speciesFormAssets.test.ts`
Expected: FAIL with "Cannot find module './speciesFormAssets'"

- [ ] **Step 3: Write the implementation**

```ts
// src/pet/speciesFormAssets.ts
import type { PetManifest } from "./types";

export type FormAsset = { manifest: PetManifest; sheetUrl: string };

// 빌드 시 모든 종의 모든 폼 폴더에서 manifest/sheet 를 수집 ("krombi/stage1", "mochi/stage2-sage", ...).
const manifests = import.meta.glob("../assets/pets/*/*/manifest.json", {
  eager: true,
}) as Record<string, { default: PetManifest }>;
const sheets = import.meta.glob("../assets/pets/*/*/sheet.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function parsePath(path: string): { speciesId: string; form: string } | null {
  // ".../assets/pets/<speciesId>/<form>/manifest.json" -> { speciesId, form }
  const m = path.match(/\/assets\/pets\/([^/]+)\/([^/]+)\/manifest\.json$/);
  return m ? { speciesId: m[1], form: m[2] } : null;
}

const REGISTRY: Record<string, FormAsset> = {};
for (const [path, mod] of Object.entries(manifests)) {
  const parsed = parsePath(path);
  if (!parsed) continue;
  const url = sheets[path.replace("manifest.json", "sheet.png")];
  if (url) REGISTRY[`${parsed.speciesId}/${parsed.form}`] = { manifest: mod.default, sheetUrl: url };
}

/** 실제 에셋이 있으면 반환, 없으면 null. */
export function speciesFormAsset(speciesId: string, form: string): FormAsset | null {
  return REGISTRY[`${speciesId}/${form}`] ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- speciesFormAssets.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pet/speciesFormAssets.ts src/pet/speciesFormAssets.test.ts
git commit -m "feat(pet): add cross-species sprite asset registry"
```

---

### Task 3: Layout math (`src/pet/layout.ts`)

This is the core algorithmic piece: pure functions for default placement, overlap detection, collision-resolved drop position, and the bounding box of everything currently placed. No React, no Tauri — fully unit-testable.

**Files:**
- Create: `src/pet/layout.ts`
- Test: `src/pet/layout.test.ts`

**Interfaces:**
- Consumes: `unionBounds`, `type Box` from `./contentBounds` (existing, unchanged).
- Produces: `type Point = { x: number; y: number }`, `type Rect = Point & { w: number; h: number }`, `type PetPosition = Point & { speciesId: string }`, `type LayoutState = { positions: PetPosition[] }`, `rectsOverlap(a: Rect, b: Rect): boolean`, `defaultPosition(existing: Rect[], size: { w: number; h: number }, gap: number): Point`, `resolveDropPosition(dropped: Rect, others: Rect[], step?: number, maxRings?: number): Point`, `layoutBounds(rects: Rect[]): Box | null` — all used by `App.tsx` in Task 6.

- [ ] **Step 1: Write the failing tests**

```ts
// src/pet/layout.test.ts
import { describe, expect, it } from "vitest";
import { rectsOverlap, defaultPosition, resolveDropPosition, layoutBounds, type Rect } from "./layout";

describe("rectsOverlap", () => {
  it("true when boxes intersect", () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 })).toBe(true);
  });
  it("false when edges merely touch", () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 10, y: 0, w: 10, h: 10 })).toBe(false);
  });
  it("false when far apart", () => {
    expect(rectsOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 100, y: 100, w: 10, h: 10 })).toBe(false);
  });
});

describe("defaultPosition", () => {
  it("places the first pet at the origin", () => {
    expect(defaultPosition([], { w: 30, h: 20 }, 8)).toEqual({ x: 0, y: 0 });
  });

  it("places a same-height pet to the right, sharing the same bottom line", () => {
    const existing: Rect[] = [{ x: 0, y: 0, w: 40, h: 50 }];
    expect(defaultPosition(existing, { w: 30, h: 50 }, 8)).toEqual({ x: 48, y: 0 });
  });

  it("bottom-aligns a taller new pet (its y goes negative)", () => {
    const existing: Rect[] = [{ x: 0, y: 0, w: 40, h: 50 }];
    expect(defaultPosition(existing, { w: 30, h: 80 }, 8)).toEqual({ x: 48, y: -30 });
  });
});

describe("resolveDropPosition", () => {
  it("returns the dropped position unchanged when nothing overlaps", () => {
    const dropped: Rect = { x: 100, y: 100, w: 10, h: 10 };
    expect(resolveDropPosition(dropped, [])).toEqual({ x: 100, y: 100 });
  });

  it("snaps to the nearest non-overlapping spot when it overlaps another pet", () => {
    const dropped: Rect = { x: 0, y: 0, w: 10, h: 10 };
    const others: Rect[] = [{ x: 0, y: 0, w: 10, h: 10 }];
    expect(resolveDropPosition(dropped, others, 10)).toEqual({ x: 10, y: 0 });
  });
});

describe("layoutBounds", () => {
  it("returns null for an empty list", () => {
    expect(layoutBounds([])).toBeNull();
  });

  it("returns the union bounding box of all rects", () => {
    const rects: Rect[] = [
      { x: 0, y: 0, w: 10, h: 10 },
      { x: -5, y: 20, w: 10, h: 10 },
    ];
    expect(layoutBounds(rects)).toEqual({ minX: -5, minY: 0, maxX: 9, maxY: 29 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- layout.test.ts`
Expected: FAIL with "Cannot find module './layout'"

- [ ] **Step 3: Write the implementation**

```ts
// src/pet/layout.ts
import { unionBounds, type Box } from "./contentBounds";

export type Point = { x: number; y: number };
export type Rect = Point & { w: number; h: number };
export type PetPosition = Point & { speciesId: string };
export type LayoutState = { positions: PetPosition[] };

/** 두 사각형이 겹치는지(경계가 닿기만 하는 건 겹침이 아님). */
export function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

/**
 * 새 펫의 기본 위치: 기존 펫들 중 가장 오른쪽 옆, 같은 바닥선(bottom)에 맞춤.
 * 기존 펫이 없으면 원점에 배치.
 */
export function defaultPosition(existing: Rect[], size: { w: number; h: number }, gap: number): Point {
  if (existing.length === 0) return { x: 0, y: 0 };
  const ground = Math.max(...existing.map((r) => r.y + r.h));
  const rightX = Math.max(...existing.map((r) => r.x + r.w)) + gap;
  return { x: rightX, y: ground - size.h };
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * dropped 위치가 others 중 하나와 겹치면, 겹치지 않는 가장 가까운 위치로 옮긴다.
 * 겹치지 않으면 dropped 위치 그대로 반환. step 간격으로 점점 넓어지는 고리를 탐색한다.
 */
export function resolveDropPosition(
  dropped: Rect,
  others: Rect[],
  step = 16,
  maxRings = 50,
): Point {
  const fitsAt = (p: Point) => !others.some((o) => rectsOverlap({ ...dropped, x: p.x, y: p.y }, o));
  if (fitsAt(dropped)) return { x: dropped.x, y: dropped.y };
  for (let ring = 1; ring <= maxRings; ring++) {
    const r = ring * step;
    const candidates: Point[] = [
      { x: dropped.x + r, y: dropped.y },
      { x: dropped.x - r, y: dropped.y },
      { x: dropped.x, y: dropped.y + r },
      { x: dropped.x, y: dropped.y - r },
      { x: dropped.x + r, y: dropped.y + r },
      { x: dropped.x + r, y: dropped.y - r },
      { x: dropped.x - r, y: dropped.y + r },
      { x: dropped.x - r, y: dropped.y - r },
    ].sort((a, b) => dist(a, dropped) - dist(b, dropped));
    const found = candidates.find(fitsAt);
    if (found) return found;
  }
  return { x: dropped.x, y: dropped.y };
}

/** 모든 사각형을 감싸는 최소 경계 박스. 비어있으면 null. */
export function layoutBounds(rects: Rect[]): Box | null {
  return rects.reduce<Box | null>(
    (acc, r) => unionBounds(acc, { minX: r.x, minY: r.y, maxX: r.x + r.w - 1, maxY: r.y + r.h - 1 }),
    null,
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- layout.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pet/layout.ts src/pet/layout.test.ts
git commit -m "feat(pet): add pure layout math for multi-pet placement"
```

---

### Task 4: Per-pet drag/click hook

A per-pet equivalent of `src/pet/useWindowDrag.ts`: instead of calling `startDragging()` on the OS window, it reports raw screen-pixel deltas to the caller so a single pet's position can move independently. No test file — `useWindowDrag.ts` (the existing hook this mirrors) has none either; its only testable logic (`exceededThreshold`) already lives in `dragMath.ts` and is covered by `dragMath.test.ts`.

**Files:**
- Create: `src/pet/usePetDrag.ts`

**Interfaces:**
- Consumes: `exceededThreshold` from `./dragMath` (existing, unchanged).
- Produces: `usePetDrag(onClick: () => void, onDragMove: (dx: number, dy: number) => void, onDrop: (dx: number, dy: number) => void, threshold?: number): { onMouseDown, onMouseMove, onMouseUp }` — used by `PetSlot` in Task 5.

- [ ] **Step 1: Write the implementation**

```ts
// src/pet/usePetDrag.ts
import { useRef } from "react";
import { exceededThreshold } from "./dragMath";

/**
 * 펫 좌클릭 상호작용(펫 전용, 창 전체가 아니라 그 펫의 위치만 바뀜):
 * - 누른 채 임계값 초과 이동 → onDragMove(dx, dy) 계속 호출(드래그 시작점 기준 누적 이동량)
 * - 임계값 초과 후 떼기 → onDrop(dx, dy)
 * - 이동 없이 떼기 → onClick()
 */
export function usePetDrag(
  onClick: () => void,
  onDragMove: (dx: number, dy: number) => void,
  onDrop: (dx: number, dy: number) => void,
  threshold = 4,
) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return; // 좌버튼만
    e.stopPropagation(); // 배경(창 전체) 드래그 핸들러로 전파되지 않게
    start.current = { x: e.screenX, y: e.screenY };
    dragged.current = false;
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!start.current) return;
    const dx = e.screenX - start.current.x;
    const dy = e.screenY - start.current.y;
    if (!dragged.current && exceededThreshold(dx, dy, threshold)) dragged.current = true;
    if (dragged.current) onDragMove(dx, dy);
  }

  function onMouseUp(e: React.MouseEvent) {
    if (!start.current) return;
    const dx = e.screenX - start.current.x;
    const dy = e.screenY - start.current.y;
    if (dragged.current) onDrop(dx, dy);
    else onClick();
    start.current = null;
  }

  return { onMouseDown, onMouseMove, onMouseUp };
}
```

- [ ] **Step 2: Run the full test suite to confirm nothing else broke**

Run: `npm run test`
Expected: PASS (this file adds no new tests; it must not break existing ones)

- [ ] **Step 3: Commit**

```bash
git add src/pet/usePetDrag.ts
git commit -m "feat(pet): add per-pet drag/click hook"
```

---

### Task 5: `PetSlot` component

Owns everything about rendering one pet: resolving its sprite asset (falling back to that species' own stage1 if the exact form is missing — mirrors today's single-species placeholder fallback, just generalized), loading/measuring the sheet, animating it, handling its drag/click/right-click, and reporting its measured pixel size up to the parent (`App.tsx` needs this to compute window size and default placement for new pets — see Task 6). No test file, matching the existing `Pet.tsx`/`StatusPanel.tsx` convention (presentational React components in this codebase aren't unit tested).

**Files:**
- Create: `src/pet/PetSlot.tsx`

**Interfaces:**
- Consumes: `usePetAnimation` (`./usePetAnimation`), `usePetDrag` (`./usePetDrag`, Task 4), `Pet` (`./Pet`), `loadImage`/`measureBounds` (`./sheetImage`), `boxSize`/`type Box` (`./contentBounds`), `formAppearance` (`./formAppearance`), `speciesFormAsset` (`./speciesFormAssets`, Task 2), `EvolveReadyFx` (`../ui/EvolveReadyFx`), `type EvoPhase` (`../ui/EvolutionFx`), `type AnimationName` (`./types`) — all existing/already built.
- Produces: `PetSlot` component with props `{ speciesId: string; form: string; base: AnimationName; oneShot: AnimationName | null; onOneShotEnd: () => void; position: { x: number; y: number }; originOffset: { x: number; y: number }; margin: number; evoPhase: EvoPhase; evoReady: boolean; onSizeReady: (w: number, h: number) => void; onClick: () => void; onContextMenu: () => void; onDrop: (dx: number, dy: number) => void }` — used by `App.tsx` in Task 6.

- [ ] **Step 1: Write the implementation**

```tsx
// src/pet/PetSlot.tsx
import { useEffect, useRef, useState } from "react";
import type { AnimationName } from "./types";
import type { EvoPhase } from "../ui/EvolutionFx";
import { usePetAnimation } from "./usePetAnimation";
import { usePetDrag } from "./usePetDrag";
import { Pet } from "./Pet";
import { EvolveReadyFx } from "../ui/EvolveReadyFx";
import { loadImage, measureBounds } from "./sheetImage";
import { boxSize, type Box } from "./contentBounds";
import { formAppearance } from "./formAppearance";
import { speciesFormAsset } from "./speciesFormAssets";

export function PetSlot({
  speciesId,
  form,
  base,
  oneShot,
  onOneShotEnd,
  position,
  originOffset,
  margin,
  evoPhase,
  evoReady,
  onSizeReady,
  onClick,
  onContextMenu,
  onDrop,
}: {
  speciesId: string;
  form: string;
  base: AnimationName;
  oneShot: AnimationName | null;
  onOneShotEnd: () => void;
  position: { x: number; y: number };
  originOffset: { x: number; y: number };
  margin: number;
  evoPhase: EvoPhase;
  evoReady: boolean;
  onSizeReady: (w: number, h: number) => void;
  onClick: () => void;
  onContextMenu: () => void;
  onDrop: (dx: number, dy: number) => void;
}) {
  // 실제 폼 에셋이 없으면 그 종의 stage1 로 대체(기존 단일-종 placeholder 동작을 종별로 일반화).
  // acquireSpecies 로 보유한 모든 종은 stage1 실제 아트가 있다고 가정한다(도감에서 그렇게만 추가됨).
  const exact = speciesFormAsset(speciesId, form);
  const asset = exact ?? speciesFormAsset(speciesId, "stage1");
  if (!asset) throw new Error(`no sprite asset for species "${speciesId}"`);
  const appearance = exact ? { filter: "none", scale: 1 } : formAppearance(form);

  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const frozenRef = useRef<{ w: number; h: number } | null>(null);

  useEffect(() => {
    let cancelled = false;
    setImg(null);
    setBox(null);
    (async () => {
      const image = await loadImage(asset.sheetUrl);
      if (cancelled) return;
      const cells = Object.values(asset.manifest.animations).flatMap((a) => a.frames);
      const measured = measureBounds(image, asset.manifest.frameSize, asset.manifest.columns, cells);
      setImg(image);
      setBox(measured);
    })().catch((e) => console.error(`${speciesId} 시트 로드/측정 실패:`, e));
    return () => {
      cancelled = true;
    };
  }, [asset, speciesId]);

  const cell = usePetAnimation(asset.manifest, base, oneShot, onOneShotEnd);

  const [liveOffset, setLiveOffset] = useState({ dx: 0, dy: 0 });
  const [dragging, setDragging] = useState(false);
  const drag = usePetDrag(
    onClick,
    (dx, dy) => {
      setDragging(true);
      setLiveOffset({ dx, dy });
    },
    (dx, dy) => {
      setDragging(false);
      setLiveOffset({ dx: 0, dy: 0 });
      onDrop(dx, dy);
    },
  );

  let destW = 0;
  let destH = 0;
  if (box) {
    const cb = boxSize(box);
    destW = Math.round(cb.w * asset.manifest.displayScale * appearance.scale);
    destH = Math.round(cb.h * asset.manifest.displayScale * appearance.scale);
    // 진화 연출 중엔 펫 픽셀 크기를 고정(창이 커져도 안 커지게). idle 로 돌아오면 해제.
    if (evoPhase === "idle") {
      frozenRef.current = null;
    } else {
      if (!frozenRef.current) frozenRef.current = { w: destW, h: destH };
      destW = frozenRef.current.w;
      destH = frozenRef.current.h;
    }
  }

  useEffect(() => {
    if (destW > 0 && destH > 0) onSizeReady(destW, destH);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destW, destH]);

  if (!img || !box) return null;

  const petFilter =
    evoPhase === "flash"
      ? "brightness(0) invert(1) blur(2px) drop-shadow(0 0 14px #fff) drop-shadow(0 0 26px #fff)"
      : evoPhase === "charge"
        ? `${appearance.filter === "none" ? "" : appearance.filter} brightness(1.3) drop-shadow(0 0 8px #ffd36b)`.trim()
        : appearance.filter;

  return (
    <div
      onMouseDown={drag.onMouseDown}
      onMouseMove={drag.onMouseMove}
      onMouseUp={drag.onMouseUp}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu();
      }}
      style={{
        position: "absolute",
        left: position.x - originOffset.x + margin + liveOffset.dx,
        top: position.y - originOffset.y + margin + liveOffset.dy,
        zIndex: dragging ? 2 : 1,
        opacity: evoPhase === "hidden" ? 0 : 1,
        userSelect: "none",
      }}
    >
      {evoReady && <EvolveReadyFx />}
      <div style={{ position: "relative", zIndex: 1 }}>
        <Pet
          img={img}
          cell={cell}
          columns={asset.manifest.columns}
          cellSize={asset.manifest.frameSize}
          box={box}
          destW={destW}
          destH={destH}
          filter={petFilter}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run the full test suite and typecheck to confirm nothing broke**

Run: `npm run test && npx tsc --noEmit`
Expected: both PASS (this file adds no tests of its own; `App.tsx` doesn't use it yet so it has no consumers to break)

- [ ] **Step 3: Commit**

```bash
git add src/pet/PetSlot.tsx
git commit -m "feat(pet): add PetSlot component for per-pet rendering and drag"
```

---

### Task 6: Wire it all into `App.tsx`

Replaces the single-hardcoded-krombi app shell with one that loads/migrates `AppData` + `LayoutState`, ticks every slotted species, renders a `PetSlot` per slot, resolves drag-drop collisions, reactively auto-fits the window, and retargets the existing menu actions to whichever pet was right-clicked. There is no automated test for this file (see the plan header) — verification is `npx tsc --noEmit` plus a manual run-through.

**Files:**
- Modify: `src/App.tsx` (full replacement — the changes touch nearly every part of the file)
- Delete: `src/pet/petForms.ts` (its only consumer was the old `App.tsx`; `speciesFormAssets.ts` from Task 2 replaces it, and nothing else imports it — confirm with `grep -rn "petForms" src/` before deleting)

**Interfaces:**
- Consumes everything built in Tasks 1-5 (`feedSpecies`, `speciesFormAsset` indirectly via `PetSlot`, `defaultPosition`/`resolveDropPosition`/`layoutBounds`/`type Rect`/`type LayoutState`/`type PetPosition` from `./pet/layout`, `PetSlot`), plus part 1's `migrateAppData`/`type AppData` (`./pet/appData`), `applyTickAll`/`evolveSpecies`/`resetSpecies` (`./pet/appDataOps`), `getSpeciesDef` (`./pet/speciesRegistry`), and existing unchanged modules (`petState.ts`'s `canEvolve`, `animation.ts`'s `baseAnimation`, `contentBounds.ts`'s `fitWindowSize`/`boxSize`, `useWindowDrag.ts`, `StatusPanel.tsx`, `EvolutionFx.tsx`, `ResizeOverlay.tsx`).
- Produces: the running app — no other task consumes this one.

- [ ] **Step 1: Confirm `petForms.ts` has no other consumers**

Run: `grep -rn "petForms" src/`
Expected: only `src/App.tsx` (about to be replaced) and `src/pet/petForms.ts` itself appear.

- [ ] **Step 2: Replace the entire contents of `src/App.tsx`**

```tsx
import { useEffect, useRef, useState } from "react";
import { load, type Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { Menu } from "@tauri-apps/api/menu";
import "./App.css";
import type { AnimationName } from "./pet/types";
import { baseAnimation } from "./pet/animation";
import { useWindowDrag } from "./pet/useWindowDrag";
import { useActiveAppTracker } from "./pet/useActiveAppTracker";
import { fitWindowSize, boxSize } from "./pet/contentBounds";
import { PetSlot } from "./pet/PetSlot";
import { defaultPosition, resolveDropPosition, layoutBounds, type LayoutState, type Rect } from "./pet/layout";
import { getSpeciesDef } from "./pet/speciesRegistry";
import { migrateAppData, type AppData } from "./pet/appData";
import { applyTickAll, evolveSpecies, resetSpecies, feedSpecies } from "./pet/appDataOps";
import { canEvolve } from "./pet/petState";
import { StatusPanel } from "./ui/StatusPanel";
import { EvolutionFx, type EvoPhase } from "./ui/EvolutionFx";
import { ResizeOverlay } from "./ui/ResizeOverlay";

const STORE_FILE = "krobi_data.json";
const VERSION = "3.0.0";
const HUNGER_RATE = 1; // 포만감: 분당 -1
const EXP_GAIN = 10; // 경험치: 분당 +10 (잠정)
const TENDENCY_GAIN = 10; // 활성 앱 1회 감지당 +10 (잠정)
const APP_POLL_MS = 30_000; // 활성 앱 폴링 주기
const TICK_MS = 60_000;
const MARGIN = 12; // 펫 주변 여백(px)
const GAP = 16; // 펫 기본 배치 시 펫 사이 간격(px)
const PANEL_H = 96; // 펫상태 패널을 위해 창에 더할 높이(px)
const PANEL_W = 170; // 펫상태 패널이 잘리지 않을 최소 창 너비(px)
const EVO_PAD = 90; // 진화 중 섬광이 퍼질 투명 여백(px, 사방). 펫 크기/위치는 고정.

const delay = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
// 다음 paint 까지 기다린다(상태 변경이 화면에 실제 반영된 뒤 다음 단계로). rAF 2틱 = 한 번은 확실히 그려짐.
const nextPaint = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

// 창 리사이즈가 끝나고 레이아웃이 화면에 반영될 때까지 기다린다.
function waitForResizeSettled(timeoutMs = 800): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("resize", onResize);
      resolve();
    };
    const onResize = () =>
      requestAnimationFrame(() => requestAnimationFrame(finish));
    window.addEventListener("resize", onResize);
    window.setTimeout(finish, timeoutMs);
  });
}

function App() {
  const storeRef = useRef<Store | null>(null);
  const [appData, setAppData] = useState<AppData | null>(null);
  const [layout, setLayout] = useState<LayoutState>({ positions: [] });
  const layoutRef = useRef(layout);
  useEffect(() => {
    layoutRef.current = layout;
  }, [layout]);
  const [sizes, setSizes] = useState<Record<string, { w: number; h: number }>>({});
  const [oneShots, setOneShots] = useState<Record<string, AnimationName | null>>({});
  const [focusedSpeciesId, setFocusedSpeciesId] = useState<string | null>(null);
  const [evolvingSpeciesId, setEvolvingSpeciesId] = useState<string | null>(null);
  const [resizing, setResizing] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [evoPhase, setEvoPhase] = useState<EvoPhase>("idle");
  const evoBoxRef = useRef<[number, number, number, number] | null>(null); // 진화 전 창 (x,y,w,h)

  async function persistAll(data: AppData, lay: LayoutState) {
    const store = storeRef.current;
    if (!store) return;
    await store.set("version", VERSION);
    await store.set("appData", data);
    await store.set("layout", lay);
    await store.save();
  }

  // 펫 데이터 로드 + 마이그레이션 + 오프라인 보정 + 감소/증가 틱.
  useEffect(() => {
    let intervalId: number | undefined;
    (async () => {
      const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
      storeRef.current = store;
      const krombiDef = getSpeciesDef("krombi")!;
      const storedAppData = await store.get("appData");
      const storedPet = await store.get("pet");
      let current = migrateAppData(storedAppData ?? { pet: storedPet }, krombiDef);

      const referenceSlot = current.slots[0];
      const lastUpdated = referenceSlot ? current.pets[referenceSlot.speciesId]?.instance.last_updated : undefined;
      const now = Date.now();
      const last = lastUpdated ? new Date(lastUpdated).getTime() : now;
      const elapsedMin = Math.max(0, Math.floor((now - last) / 60_000));
      for (let i = 0; i < elapsedMin; i++) {
        current = applyTickAll(current, { satietyRate: HUNGER_RATE, expGain: EXP_GAIN });
      }

      const storedLayout = (await store.get("layout")) as LayoutState | undefined;
      const lay = storedLayout ?? { positions: [] };

      await persistAll(current, lay);
      setAppData(current);
      setLayout(lay);
      setFocusedSpeciesId(current.slots[0]?.speciesId ?? null);

      intervalId = window.setInterval(() => {
        setAppData((prev) => {
          if (!prev) return prev;
          const next = applyTickAll(prev, { satietyRate: HUNGER_RATE, expGain: EXP_GAIN });
          void persistAll(next, layoutRef.current);
          return next;
        });
      }, TICK_MS);
    })();
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  // 활성 앱 감지 → 현재 표시 중인 모든 종의 성향 게이지 증가(분류) 또는 미분류 카운트.
  useActiveAppTracker((key, appName) => {
    setAppData((prev) => {
      if (!prev) return prev;
      const pets = { ...prev.pets };
      for (const slot of prev.slots) {
        const progress = pets[slot.speciesId];
        if (!progress) continue;
        if (key) {
          pets[slot.speciesId] = {
            ...progress,
            instance: {
              ...progress.instance,
              tendencies: { ...progress.instance.tendencies, [key]: progress.instance.tendencies[key] + TENDENCY_GAIN },
            },
          };
        } else {
          pets[slot.speciesId] = {
            ...progress,
            instance: {
              ...progress.instance,
              unknownApps: {
                ...progress.instance.unknownApps,
                [appName]: (progress.instance.unknownApps[appName] ?? 0) + 1,
              },
            },
          };
        }
      }
      const next = { ...prev, pets };
      void persistAll(next, layoutRef.current);
      return next;
    });
  }, APP_POLL_MS);

  // 슬롯에 위치가 없는 펫(막 추가됐거나 막 로드된 펫)에 기본 위치를 배정.
  // 그 펫의 크기가 측정될 때까지(= sizes 에 들어올 때까지) 기다린다.
  useEffect(() => {
    if (!appData) return;
    const missing = appData.slots.filter((s) => !layout.positions.some((p) => p.speciesId === s.speciesId));
    const ready = missing.filter((s) => sizes[s.speciesId]);
    if (ready.length === 0) return;
    setLayout((prev) => {
      let positions = prev.positions;
      for (const slot of ready) {
        const existingRects: Rect[] = positions
          .map((p) => {
            const sz = sizes[p.speciesId];
            return sz ? { x: p.x, y: p.y, w: sz.w, h: sz.h } : null;
          })
          .filter((r): r is Rect => r !== null);
        const size = sizes[slot.speciesId];
        const pt = defaultPosition(existingRects, size, GAP);
        positions = [...positions, { speciesId: slot.speciesId, ...pt }];
      }
      const next = { positions };
      void persistAll(appData, next);
      return next;
    });
  }, [appData, sizes, layout]);

  // 창 크기는 현재 보이는 펫들의 배치+크기(+펫상태 패널)로부터 다시 계산한다(자동 맞춤).
  // appData 는 분당 틱마다도 새 객체가 되므로, 매분 창이 깜빡 재계산되는 걸 막기 위해
  // "슬롯 구성"만 안정적인 문자열 키(slotsKey)로 뽑아 deps 에 넣는다 — appData 자체는 deps 에서 뺀다
  // (틱은 pets 의 satiety/exp 만 바꾸고 slots 배열은 그대로이므로, effect 가 다시 안 돌아도
  // 안전하게 "약간 오래된" appData.slots 를 읽게 된다 — 내용이 어차피 같다).
  const slotsKey = appData ? appData.slots.map((s) => s.speciesId).join(",") : "";
  useEffect(() => {
    if (!appData) return;
    const rects: Rect[] = appData.slots
      .map((slot) => {
        const pos = layout.positions.find((p) => p.speciesId === slot.speciesId);
        const size = sizes[slot.speciesId];
        return pos && size ? { x: pos.x, y: pos.y, w: size.w, h: size.h } : null;
      })
      .filter((r): r is Rect => r !== null);
    if (rects.length === 0 || rects.length !== appData.slots.length) return; // 아직 전부 준비 안 됨
    const bounds = layoutBounds(rects);
    const content = bounds ? boxSize(bounds) : { w: 0, h: 0 };
    const fitted = fitWindowSize(content, 1, MARGIN);
    const width = Math.max(fitted.width, showStatus ? PANEL_W : 0);
    const height = fitted.height + (showStatus ? PANEL_H : 0);
    void getCurrentWindow().setSize(new LogicalSize(width, height));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsKey, layout, sizes, showStatus]);

  function feedAction(speciesId: string) {
    setOneShots((prev) => ({ ...prev, [speciesId]: "eat" }));
    setAppData((prev) => {
      if (!prev) return prev;
      const next = feedSpecies(prev, speciesId);
      void persistAll(next, layoutRef.current);
      return next;
    });
  }

  function resetAction(speciesId: string) {
    setAppData((prev) => {
      if (!prev) return prev;
      const next = resetSpecies(prev, speciesId);
      void persistAll(next, layoutRef.current);
      return next;
    });
  }

  async function growForEvo() {
    try {
      evoBoxRef.current = await invoke<[number, number, number, number]>("evolve_grow", { pad: EVO_PAD });
    } catch (e) {
      console.error("진화 창 확장 실패:", e);
    }
  }
  async function restoreFromEvo() {
    const b = evoBoxRef.current;
    if (!b) return;
    evoBoxRef.current = null;
    try {
      await invoke("evolve_restore", { x: b[0], y: b[1], w: b[2], h: b[3] });
    } catch (e) {
      console.error("진화 창 복원 실패:", e);
    }
  }

  function evolveAction(speciesId: string) {
    if (!appData || evoPhase !== "idle") return;
    const species = getSpeciesDef(speciesId);
    const progress = appData.pets[speciesId];
    if (!species || !progress || !canEvolve(species, progress.instance.form, progress.instance.exp)) return;
    setEvolvingSpeciesId(speciesId);
    void (async () => {
      setEvoPhase("hidden");
      await nextPaint();
      const grown = waitForResizeSettled();
      await growForEvo();
      await grown;
      setEvoPhase("charge");
      await delay(1350);
      setEvoPhase("flash");
      setAppData((prev) => {
        if (!prev) return prev;
        const next = evolveSpecies(prev, speciesId, species);
        if (next === prev) return prev;
        void persistAll(next, layoutRef.current);
        return next;
      });
      await delay(750);
      setEvoPhase("reveal");
      await delay(1650);
      const restored = waitForResizeSettled();
      await restoreFromEvo();
      await restored;
      setEvoPhase("idle");
      setEvolvingSpeciesId(null);
      setOneShots((prev) => ({ ...prev, [speciesId]: "happy" }));
    })();
  }

  function toggleStatus() {
    setShowStatus((prev) => !prev);
  }

  async function showMenu(speciesId: string) {
    setFocusedSpeciesId(speciesId);
    const species = getSpeciesDef(speciesId);
    const progress = appData?.pets[speciesId];
    const evolvable =
      species && progress ? canEvolve(species, progress.instance.form, progress.instance.exp) && evoPhase === "idle" : false;
    const menu = await Menu.new({
      items: [
        { id: "feed", text: "밥주기", action: () => feedAction(speciesId) },
        { id: "status", text: showStatus ? "펫상태 숨기기" : "펫상태", action: () => toggleStatus() },
        { id: "evolve", text: "진화하기", enabled: evolvable, action: () => evolveAction(speciesId) },
        { id: "resize", text: "크기 조절", action: () => setResizing(true) },
        { id: "reset", text: "초기화", action: () => resetAction(speciesId) },
      ],
    });
    await menu.popup();
  }

  function commitSize() {
    setResizing(false);
  }

  function handleDrop(speciesId: string, dx: number, dy: number) {
    if (!appData) return;
    const pos = layout.positions.find((p) => p.speciesId === speciesId);
    const size = sizes[speciesId];
    if (!pos || !size) return;
    const dropped: Rect = { x: pos.x + dx, y: pos.y + dy, w: size.w, h: size.h };
    const others: Rect[] = appData.slots
      .filter((s) => s.speciesId !== speciesId)
      .map((s) => {
        const p = layout.positions.find((pp) => pp.speciesId === s.speciesId);
        const sz = sizes[s.speciesId];
        return p && sz ? { x: p.x, y: p.y, w: sz.w, h: sz.h } : null;
      })
      .filter((r): r is Rect => r !== null);
    const resolved = resolveDropPosition(dropped, others);
    setLayout((prev) => {
      const positions = prev.positions.map((p) => (p.speciesId === speciesId ? { ...p, ...resolved } : p));
      const next = { positions };
      void persistAll(appData, next);
      return next;
    });
  }

  const backgroundDrag = useWindowDrag(() => {});

  if (!appData) return null;

  const rects: Rect[] = appData.slots
    .map((slot) => {
      const pos = layout.positions.find((p) => p.speciesId === slot.speciesId);
      const size = sizes[slot.speciesId];
      return pos && size ? { x: pos.x, y: pos.y, w: size.w, h: size.h } : null;
    })
    .filter((r): r is Rect => r !== null);
  const bounds = layoutBounds(rects);
  const originOffset = bounds ? { x: bounds.minX, y: bounds.minY } : { x: 0, y: 0 };

  return (
    <div
      onMouseDown={backgroundDrag.onMouseDown}
      onMouseMove={backgroundDrag.onMouseMove}
      onMouseUp={backgroundDrag.onMouseUp}
      className="relative h-screen w-screen bg-transparent"
      style={{ userSelect: "none", paddingTop: showStatus ? PANEL_H : 0 }}
    >
      {showStatus && focusedSpeciesId && appData.pets[focusedSpeciesId] && getSpeciesDef(focusedSpeciesId) && (
        <StatusPanel pet={appData.pets[focusedSpeciesId].instance} species={getSpeciesDef(focusedSpeciesId)!} />
      )}

      <EvolutionFx phase={evoPhase} />

      {appData.slots.map((slot) => {
        const progress = appData.pets[slot.speciesId];
        if (!progress) return null;
        const species = getSpeciesDef(slot.speciesId);
        const pos = layout.positions.find((p) => p.speciesId === slot.speciesId) ?? { x: 0, y: 0 };
        const base = baseAnimation(progress.instance.status.satiety);
        const evoReady = species
          ? canEvolve(species, progress.instance.form, progress.instance.exp) && evoPhase === "idle"
          : false;
        return (
          <PetSlot
            key={slot.speciesId}
            speciesId={slot.speciesId}
            form={slot.displayForm}
            base={base}
            oneShot={oneShots[slot.speciesId] ?? null}
            onOneShotEnd={() => setOneShots((prev) => ({ ...prev, [slot.speciesId]: null }))}
            position={pos}
            originOffset={originOffset}
            margin={MARGIN}
            evoPhase={slot.speciesId === evolvingSpeciesId ? evoPhase : "idle"}
            evoReady={evoReady}
            onSizeReady={(w, h) =>
              setSizes((prev) =>
                prev[slot.speciesId]?.w === w && prev[slot.speciesId]?.h === h ? prev : { ...prev, [slot.speciesId]: { w, h } },
              )
            }
            onClick={() => setOneShots((prev) => ({ ...prev, [slot.speciesId]: "happy" }))}
            onContextMenu={() => {
              if (!resizing) void showMenu(slot.speciesId);
            }}
            onDrop={(dx, dy) => handleDrop(slot.speciesId, dx, dy)}
          />
        );
      })}

      {resizing && (
        <ResizeOverlay
          onDone={(commit) => {
            if (commit) commitSize();
            else setResizing(false);
          }}
        />
      )}
    </div>
  );
}

export default App;
```

- [ ] **Step 3: Delete the now-orphaned single-species sprite registry**

```bash
git rm src/pet/petForms.ts
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: PASS — fix any type errors before continuing (e.g. import paths, prop name mismatches between `App.tsx` and `PetSlot.tsx`).

- [ ] **Step 5: Run the full automated test suite**

Run: `npm run test`
Expected: PASS (this task adds no new automated tests, but must not break Tasks 1-5's)

- [ ] **Step 6: Manual QA — single pet (regression check)**

```bash
lsof -ti:1420 | xargs -r kill -9 ; pkill -f "tauri dev"
```

Then start `npm run tauri dev` in the background and wait for the window. Confirm:
- krombi renders alone, idle animation plays.
- Right-click krombi: 밥주기 raises its satiety (check via 펫상태); 펫상태 shows krombi's bars; 크기 조절 still lets you drag-resize the window (it'll snap back to fit on the next change); 초기화 resets krombi to stage1/exp0.
- Dragging krombi's sprite moves only the sprite (not the OS window); dragging an empty part of the window moves the whole window.
- Quit the app. Open `~/Library/Application Support/com.kim_yongjin.krobi/krobi_data.json` and confirm it now has top-level `appData` (with a `krombi` entry under `appData.pets`) and `layout` keys — migration ran.

- [ ] **Step 7: Manual QA — two pets (hand-edit the store to simulate part 3/4, which don't exist yet)**

With the app closed, edit `~/Library/Application Support/com.kim_yongjin.krobi/krobi_data.json`: duplicate the `appData.pets.krombi` entry as `appData.pets.mochi` (same shape, e.g. `{"unlockedForms": ["stage1"], "instance": {"form": "stage1", "exp": 0, "tendencies": {"maker": 0, "sage": 0, "wild": 0}, "status": {"satiety": 100}, "unknownApps": {}, "last_updated": "2026-06-17T00:00:00.000Z"}}`), add `{"speciesId": "mochi", "displayForm": "stage1"}` to `appData.slots`, and remove the `layout` key entirely (so both pets get auto-placed fresh).

Relaunch `npm run tauri dev`. Confirm:
- Both krombi and mochi render, side by side, not overlapping; the window has grown to fit both.
- Dragging krombi moves only krombi; mochi stays put.
- Drag krombi until its sprite overlaps mochi's, then release: krombi snaps to a nearby spot instead of resting on top of mochi.
- Dragging an empty area of the window still moves the whole OS window.
- Right-click mochi specifically, then 밥주기: open 펫상태 and confirm it shows *mochi's* (now-higher) satiety, not krombi's.
- Right-click krombi again: confirm the menu now targets krombi (e.g. 펫상태 switches back to krombi's bars).
- Quit and relaunch once more: confirm both pets are still at the same positions as before quitting (layout persisted).

- [ ] **Step 8: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): render every slotted pet independently, drag/collision/auto-fit window"
```

---

## Definition of Done

- `npm run test` passes (Tasks 1-3's new tests plus everything from part 1).
- `npx tsc --noEmit` passes.
- Manual QA in Task 6 Steps 6-7 completed and behaves as described.
- `src/pet/petForms.ts` is deleted; nothing references it (`grep -rn "petForms" src/` returns nothing).
- Every operation from the design spec (`docs/superpowers/specs/2026-06-17-multi-pet-rendering-layout-design.md`) is implemented: per-pet drag vs background-drag, drop-time collision resolution, auto-fit window sizing, and per-pet context-menu targeting.
