# Multi-pet Rendering Fixes & Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix two bugs found in manual QA of the multi-pet rendering branch (window doesn't grow during a live drag; the 펫상태 panel doesn't track the focused pet), and reduce `App.tsx` to a thin render layer by extracting its state/effects into `useAppState`, adding a first round of component tests along the way.

**Architecture:** Bug fixes land first, directly in the current `App.tsx`/`PetSlot.tsx`/`StatusPanel.tsx`. Once both are verified, all state/effects/actions get moved into a new `src/pet/useAppState.ts` hook (pure extraction, no behavior change) so `App.tsx` becomes render-only. Two regression-test additions close the loop: a pure-function test for the exact bug class that shipped past review last time (`evolveAndSync`/`resetAndSync` in `appDataOps.ts`), and the first component test in this codebase (`PetSlot`'s context-menu handler), using a newly-added `@testing-library/react` + jsdom setup.

**Tech Stack:** TypeScript, React 19, Vitest, `@testing-library/react`, jsdom, Tauri v2.

## Global Constraints

- Drag clamping: a pet can be dragged freely right/down (the window grows to follow), but leftward/upward dragging is clamped at the window's *current* left/top edge (`originOffset - margin`) — it does not push further out, and the window does not reposition. This is a deliberate, lower-risk choice over a full resize+reposition fix.
- The clamp must apply consistently to both what `PetSlot` renders live during the drag and what gets committed on drop — implement it once, in `PetSlot`, not duplicated in `App.tsx`.
- `useAppState`'s extraction must be a pure move: no behavior change beyond what Tasks 2-3 already fixed.
- New component tests use `// @vitest-environment jsdom` per-file pragmas — do not change the global Vitest `environment` (must stay `"node"` for the existing 93 pure-logic tests, which run faster that way).
- Component tests in this pass are a starting point, not full coverage: only `evolveAndSync`/`resetAndSync` (pure, in `appDataOps.test.ts`) and `PetSlot`'s `onContextMenu` handler are covered.

---

### Task 1: `evolveAndSync` / `resetAndSync` — pure regression-proof combinators

The previous branch shipped two Critical bugs: evolving or resetting a pet updated
`instance.form` but never synced the slot's separate `displayForm`, so the wrong
sprite stayed on screen. The fix (already merged) inlined the two-step fix directly
in `App.tsx`'s `evolveAction`/`resetAction`. This task extracts that exact two-step
sequence into pure, testable functions in `appDataOps.ts`, so the fix has a permanent
regression test that doesn't depend on rendering anything.

**Files:**
- Modify: `src/pet/appDataOps.ts` (append after `feedSpecies`, currently ending at line 92)
- Test: `src/pet/appDataOps.test.ts` (append after the `feedSpecies` describe block, currently ending at line 193)

**Interfaces:**
- Consumes: `evolveSpecies`, `resetSpecies`, `setDisplayForm` (all already in `appDataOps.ts`), `type AppData` (`./appData`), `type SpeciesDef` (`./types`).
- Produces: `evolveAndSync(data: AppData, speciesId: string, species: SpeciesDef): AppData`, `resetAndSync(data: AppData, speciesId: string): AppData` — used by `useAppState.ts` in Task 4.

- [ ] **Step 1: Write the failing tests**

Append to `src/pet/appDataOps.test.ts` (add `evolveAndSync, resetAndSync` to the existing import from `./appDataOps`):

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
  evolveAndSync,
  resetAndSync,
} from "./appDataOps";
```

```ts
describe("evolveAndSync", () => {
  it("advances the instance AND syncs the slot's displayForm to the new form", () => {
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
    const next = evolveAndSync(ready, "krombi", krombi);
    expect(next.pets.krombi.instance.form).toBe("stage2-maker");
    expect(next.slots.find((s) => s.speciesId === "krombi")?.displayForm).toBe("stage2-maker");
  });

  it("is a no-op (including no displayForm change) when not eligible to evolve", () => {
    const data = withTwoSpecies();
    expect(evolveAndSync(data, "krombi", krombi)).toEqual(data);
  });
});

describe("resetAndSync", () => {
  it("resets the instance to stage1 AND syncs the slot's displayForm to stage1", () => {
    const data = withTwoSpecies();
    const grown = {
      ...data,
      pets: {
        ...data.pets,
        krombi: {
          unlockedForms: ["stage1", "stage2-sage", "stage3-sage"],
          instance: { ...data.pets.krombi.instance, form: "stage3-sage", exp: 50 },
        },
      },
      slots: data.slots.map((s) => (s.speciesId === "krombi" ? { ...s, displayForm: "stage3-sage" } : s)),
    };
    const next = resetAndSync(grown, "krombi");
    expect(next.pets.krombi.instance.form).toBe("stage1");
    expect(next.slots.find((s) => s.speciesId === "krombi")?.displayForm).toBe("stage1");
  });

  it("is a no-op for an unowned species", () => {
    const data = withTwoSpecies();
    expect(resetAndSync(data, "nope")).toEqual(data);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test -- appDataOps.test.ts`
Expected: FAIL with "evolveAndSync is not a function" (and similarly for `resetAndSync`)

- [ ] **Step 3: Append the implementation**

Append to `src/pet/appDataOps.ts`:

```ts
export function evolveAndSync(data: AppData, speciesId: string, species: SpeciesDef): AppData {
  const evolved = evolveSpecies(data, speciesId, species);
  if (evolved === data) return data;
  return setDisplayForm(evolved, speciesId, evolved.pets[speciesId].instance.form);
}

export function resetAndSync(data: AppData, speciesId: string): AppData {
  const reset = resetSpecies(data, speciesId);
  if (reset === data) return data;
  return setDisplayForm(reset, speciesId, "stage1");
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test -- appDataOps.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pet/appDataOps.ts src/pet/appDataOps.test.ts
git commit -m "feat(pet): add evolveAndSync/resetAndSync to keep displayForm in sync"
```

---

### Task 2: Fix — window grows live during drag (right/down), clamped at the edge (left/up)

**Files:**
- Modify: `src/pet/PetSlot.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: a new required `PetSlot` prop `onDragLive: (dx: number, dy: number) => void` — called continuously during a drag with the *clamped* delta (same clamp applied to what's rendered locally). `App.tsx` (and later `useAppState.ts` in Task 4) stores the latest live delta per dragging pet and feeds it into the window-fit calculation.

- [ ] **Step 1: Add the `onDragLive` prop and apply the edge clamp in `PetSlot.tsx`**

In `src/pet/PetSlot.tsx`, add `onDragLive` to the props type (next to `onDrop`):

```ts
  onDrop: (dx: number, dy: number) => void;
```

becomes:

```ts
  onDrop: (dx: number, dy: number) => void;
  onDragLive: (dx: number, dy: number) => void;
```

and destructure it in the function signature (add `onDragLive` next to `onDrop` in the parameter list).

Replace the `usePetDrag` call:

```tsx
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
```

with:

```tsx
  // 왼쪽/위쪽으로는 현재 창 경계(originOffset - margin)까지만 끌리게 막는다 — 창은 setSize 로만
  // 커지므로(오른쪽/아래쪽 성장만 가능) 그 방향은 막지 않으면 펫이 창 밖으로 보이지 않게 된다.
  function clamp(dx: number, dy: number) {
    const minDx = originOffset.x - margin - position.x;
    const minDy = originOffset.y - margin - position.y;
    return { dx: Math.max(dx, minDx), dy: Math.max(dy, minDy) };
  }

  const drag = usePetDrag(
    onClick,
    (dx, dy) => {
      const c = clamp(dx, dy);
      setDragging(true);
      setLiveOffset(c);
      onDragLive(c.dx, c.dy);
    },
    (dx, dy) => {
      const c = clamp(dx, dy);
      setDragging(false);
      setLiveOffset({ dx: 0, dy: 0 });
      onDrop(c.dx, c.dy);
    },
  );
```

- [ ] **Step 2: Wire `dragLive` state and the clamped live offset into `App.tsx`**

In `src/App.tsx`, add a new piece of state next to the other `useState` calls (right after `const [evoPhase, setEvoPhase] = useState<EvoPhase>("idle");`):

```ts
  const [dragLive, setDragLive] = useState<{ speciesId: string; dx: number; dy: number } | null>(null);
```

Replace the window-fit effect's `rects` computation — change:

```tsx
    const rects: Rect[] = appData.slots
      .map((slot) => {
        const pos = layout.positions.find((p) => p.speciesId === slot.speciesId);
        const size = sizes[slot.speciesId];
        return pos && size ? { x: pos.x, y: pos.y, w: size.w, h: size.h } : null;
      })
      .filter((r): r is Rect => r !== null);
```

to:

```tsx
    const rects: Rect[] = appData.slots
      .map((slot) => {
        const pos = layout.positions.find((p) => p.speciesId === slot.speciesId);
        const size = sizes[slot.speciesId];
        if (!pos || !size) return null;
        const live = dragLive && dragLive.speciesId === slot.speciesId ? dragLive : null;
        const x = live ? pos.x + live.dx : pos.x;
        const y = live ? pos.y + live.dy : pos.y;
        return { x, y, w: size.w, h: size.h };
      })
      .filter((r): r is Rect => r !== null);
```

and add `dragLive` to that effect's dependency array — change:

```tsx
  }, [slotsKey, layout, sizes, showStatus]);
```

to:

```tsx
  }, [slotsKey, layout, sizes, showStatus, dragLive]);
```

In `handleDrop`, clear the live state at the start (it's about to be superseded by a
committed `layout` position) — change:

```tsx
  function handleDrop(speciesId: string, dx: number, dy: number) {
    if (!appData) return;
```

to:

```tsx
  function handleDrop(speciesId: string, dx: number, dy: number) {
    setDragLive(null);
    if (!appData) return;
```

Finally, pass the new prop to `PetSlot` in the render — change:

```tsx
            onDrop={(dx, dy) => handleDrop(slot.speciesId, dx, dy)}
```

to:

```tsx
            onDragLive={(dx, dy) => setDragLive({ speciesId: slot.speciesId, dx, dy })}
            onDrop={(dx, dy) => handleDrop(slot.speciesId, dx, dy)}
```

- [ ] **Step 3: Typecheck and run the suite**

Run: `npx tsc --noEmit && npm run test`
Expected: both PASS (no new automated tests in this task — `App.tsx`/`PetSlot.tsx` have none, per existing convention; verify manually in Step 4)

- [ ] **Step 4: Manual verification**

```bash
lsof -ti:1420 | xargs -r kill -9 ; pkill -f "tauri dev"
```

Launch `npm run tauri dev` in the background. Drag the pet toward the right or bottom
edge of the window — confirm the window visibly grows to keep the sprite fully
visible as you drag (not just after releasing). Drag it toward the left or top edge —
confirm it stops at the window's current edge instead of disappearing past it.

- [ ] **Step 5: Commit**

```bash
git add src/pet/PetSlot.tsx src/App.tsx
git commit -m "fix(app): grow window live during drag, clamp left/up at the current edge"
```

---

### Task 3: Fix — 펫상태 panel follows the focused pet

**Files:**
- Modify: `src/ui/StatusPanel.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `StatusPanel` gains an optional `anchor?: { x: number; y: number; width: number } | null` prop (window-local pixel coordinates of the focused pet's top-left and rendered width, in the same coordinate space `PetSlot` renders into — i.e. already translated by `originOffset` and `margin`). When provided, the panel is positioned just above that rect, horizontally centered over it; when absent/null, it falls back to today's centered-at-top-of-window position.

- [ ] **Step 1: Add the `anchor` prop to `StatusPanel`**

In `src/ui/StatusPanel.tsx`, add the import:

```ts
import type { CSSProperties } from "react";
```

Change the function signature:

```tsx
export function StatusPanel({ pet, species }: { pet: PetData; species: SpeciesDef }) {
```

to:

```tsx
export function StatusPanel({
  pet,
  species,
  anchor,
}: {
  pet: PetData;
  species: SpeciesDef;
  anchor?: { x: number; y: number; width: number } | null;
}) {
```

Replace the returned `<div style={{...}}>` — change:

```tsx
    <div style={{
      position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)",
      width: 150, padding: "6px 8px", borderRadius: 8,
      background: "rgba(17,24,39,0.82)", color: "#fff", fontFamily: "system-ui",
      boxShadow: "0 2px 8px rgba(0,0,0,0.4)", pointerEvents: "none",
    }}>
```

to:

```tsx
    <div style={panelStyle(anchor)}>
```

and add this helper above the `StatusPanel` function (after the `Bar` function):

```ts
function panelStyle(anchor?: { x: number; y: number; width: number } | null): CSSProperties {
  const shared: CSSProperties = {
    width: 150, padding: "6px 8px", borderRadius: 8,
    background: "rgba(17,24,39,0.82)", color: "#fff", fontFamily: "system-ui",
    boxShadow: "0 2px 8px rgba(0,0,0,0.4)", pointerEvents: "none",
  };
  if (anchor) {
    return {
      ...shared,
      position: "absolute",
      left: anchor.x + anchor.width / 2,
      top: anchor.y - 8,
      transform: "translate(-50%, -100%)", // 펫의 머리 위, 가로 중앙
    };
  }
  return { ...shared, position: "absolute", top: 4, left: "50%", transform: "translateX(-50%)" };
}
```

- [ ] **Step 2: Compute and pass the anchor in `App.tsx`**

In `src/App.tsx`, right before the `return (` statement (after the `originOffset` computation), add:

```tsx
  const focusedPos = focusedSpeciesId ? layout.positions.find((p) => p.speciesId === focusedSpeciesId) : undefined;
  const focusedSize = focusedSpeciesId ? sizes[focusedSpeciesId] : undefined;
  const focusedAnchor =
    focusedPos && focusedSize
      ? { x: focusedPos.x - originOffset.x + MARGIN, y: focusedPos.y - originOffset.y + MARGIN, width: focusedSize.w }
      : null;
```

Change the `StatusPanel` usage:

```tsx
      {showStatus && focusedSpeciesId && appData.pets[focusedSpeciesId] && getSpeciesDef(focusedSpeciesId) && (
        <StatusPanel pet={appData.pets[focusedSpeciesId].instance} species={getSpeciesDef(focusedSpeciesId)!} />
      )}
```

to:

```tsx
      {showStatus && focusedSpeciesId && appData.pets[focusedSpeciesId] && getSpeciesDef(focusedSpeciesId) && (
        <StatusPanel
          pet={appData.pets[focusedSpeciesId].instance}
          species={getSpeciesDef(focusedSpeciesId)!}
          anchor={focusedAnchor}
        />
      )}
```

- [ ] **Step 3: Typecheck and run the suite**

Run: `npx tsc --noEmit && npm run test`
Expected: both PASS

- [ ] **Step 4: Manual verification**

Relaunch `npm run tauri dev` (kill any stale instance first, see Task 2 Step 4).
Right-click the pet, choose 펫상태. Confirm the panel appears directly above the
pet's head, not centered at the window's top edge. Drag the pet around — confirm the
panel follows along.

- [ ] **Step 5: Commit**

```bash
git add src/ui/StatusPanel.tsx src/App.tsx
git commit -m "fix(ui): anchor StatusPanel above the focused pet instead of window-centering"
```

---

### Task 4: Extract `App.tsx` state into `useAppState`

Pure extraction — every piece of state, every effect, and every action function
moves into a new hook. `App.tsx` keeps only render-derived computations (`rects`,
`originOffset`, `focusedAnchor`) and JSX. No behavior change versus the end of
Task 3.

**Files:**
- Create: `src/pet/useAppState.ts`
- Modify: `src/App.tsx` (full replacement)

**Interfaces:**
- Consumes: `evolveAndSync`, `resetAndSync` (Task 1, replacing the old inline two-step in `evolveAction`/`resetAction`), `feedSpecies`, `applyTickAll` (existing), `defaultPosition`/`resolveDropPosition`/`layoutBounds`/`type Rect`/`type LayoutState` (`./layout`), `migrateAppData`/`type AppData` (`./appData`), `getSpeciesDef` (`./speciesRegistry`), `canEvolve` (`./petState`), `useWindowDrag` (`./useWindowDrag`), `useActiveAppTracker` (`./useActiveAppTracker`), `fitWindowSize`/`boxSize` (`./contentBounds`).
- Produces: `useAppState(): { appData, layout, sizes, oneShots, focusedSpeciesId, evolvingSpeciesId, resizing, showStatus, evoPhase, backgroundDrag, showMenu, handleDrop, handleDragLive, reportSize, clearOneShot, triggerHappy, commitSize, setResizing, MARGIN, PANEL_H }` — consumed only by `App.tsx`.

- [ ] **Step 1: Create `src/pet/useAppState.ts`**

```ts
import { useEffect, useRef, useState } from "react";
import { load, type Store } from "@tauri-apps/plugin-store";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { Menu } from "@tauri-apps/api/menu";
import type { AnimationName } from "./types";
import { useWindowDrag } from "./useWindowDrag";
import { useActiveAppTracker } from "./useActiveAppTracker";
import { fitWindowSize, boxSize } from "./contentBounds";
import { defaultPosition, resolveDropPosition, layoutBounds, type LayoutState, type Rect } from "./layout";
import { getSpeciesDef } from "./speciesRegistry";
import { migrateAppData, type AppData } from "./appData";
import { applyTickAll, feedSpecies, evolveAndSync, resetAndSync } from "./appDataOps";
import { canEvolve } from "./petState";
import type { EvoPhase } from "../ui/EvolutionFx";

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
const nextPaint = () =>
  new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

function waitForResizeSettled(timeoutMs = 800): Promise<void> {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener("resize", onResize);
      resolve();
    };
    const onResize = () => requestAnimationFrame(() => requestAnimationFrame(finish));
    window.addEventListener("resize", onResize);
    window.setTimeout(finish, timeoutMs);
  });
}

export function useAppState() {
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
  const [dragLive, setDragLive] = useState<{ speciesId: string; dx: number; dy: number } | null>(null);
  const evoBoxRef = useRef<[number, number, number, number] | null>(null);

  async function persistAll(data: AppData, lay: LayoutState) {
    const store = storeRef.current;
    if (!store) return;
    await store.set("version", VERSION);
    await store.set("appData", data);
    await store.set("layout", lay);
    await store.save();
  }

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

  const slotsKey = appData ? appData.slots.map((s) => s.speciesId).join(",") : "";
  useEffect(() => {
    if (!appData) return;
    const rects: Rect[] = appData.slots
      .map((slot) => {
        const pos = layout.positions.find((p) => p.speciesId === slot.speciesId);
        const size = sizes[slot.speciesId];
        if (!pos || !size) return null;
        const live = dragLive && dragLive.speciesId === slot.speciesId ? dragLive : null;
        const x = live ? pos.x + live.dx : pos.x;
        const y = live ? pos.y + live.dy : pos.y;
        return { x, y, w: size.w, h: size.h };
      })
      .filter((r): r is Rect => r !== null);
    if (rects.length === 0 || rects.length !== appData.slots.length) return;
    const bounds = layoutBounds(rects);
    const content = bounds ? boxSize(bounds) : { w: 0, h: 0 };
    const fitted = fitWindowSize(content, 1, MARGIN);
    const width = Math.max(fitted.width, showStatus ? PANEL_W : 0);
    const height = fitted.height + (showStatus ? PANEL_H : 0);
    void getCurrentWindow().setSize(new LogicalSize(width, height));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slotsKey, layout, sizes, showStatus, dragLive]);

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
      const next = resetAndSync(prev, speciesId);
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
        const next = evolveAndSync(prev, speciesId, species);
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
    setDragLive(null);
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

  function handleDragLive(speciesId: string, dx: number, dy: number) {
    setDragLive({ speciesId, dx, dy });
  }

  function reportSize(speciesId: string, w: number, h: number) {
    setSizes((prev) => (prev[speciesId]?.w === w && prev[speciesId]?.h === h ? prev : { ...prev, [speciesId]: { w, h } }));
  }

  function clearOneShot(speciesId: string) {
    setOneShots((prev) => ({ ...prev, [speciesId]: null }));
  }

  function triggerHappy(speciesId: string) {
    setOneShots((prev) => ({ ...prev, [speciesId]: "happy" }));
  }

  const backgroundDrag = useWindowDrag(() => {});

  return {
    appData,
    layout,
    sizes,
    oneShots,
    focusedSpeciesId,
    evolvingSpeciesId,
    resizing,
    showStatus,
    evoPhase,
    backgroundDrag,
    showMenu,
    handleDrop,
    handleDragLive,
    reportSize,
    clearOneShot,
    triggerHappy,
    commitSize,
    setResizing,
    MARGIN,
    PANEL_H,
  };
}
```

- [ ] **Step 2: Replace `src/App.tsx` with the render-only version**

```tsx
import "./App.css";
import { baseAnimation } from "./pet/animation";
import { PetSlot } from "./pet/PetSlot";
import { layoutBounds, type Rect } from "./pet/layout";
import { getSpeciesDef } from "./pet/speciesRegistry";
import { canEvolve } from "./pet/petState";
import { StatusPanel } from "./ui/StatusPanel";
import { EvolutionFx } from "./ui/EvolutionFx";
import { ResizeOverlay } from "./ui/ResizeOverlay";
import { useAppState } from "./pet/useAppState";

function App() {
  const {
    appData,
    layout,
    sizes,
    oneShots,
    focusedSpeciesId,
    evolvingSpeciesId,
    resizing,
    showStatus,
    evoPhase,
    backgroundDrag,
    showMenu,
    handleDrop,
    handleDragLive,
    reportSize,
    clearOneShot,
    triggerHappy,
    commitSize,
    setResizing,
    MARGIN,
    PANEL_H,
  } = useAppState();

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

  const focusedPos = focusedSpeciesId ? layout.positions.find((p) => p.speciesId === focusedSpeciesId) : undefined;
  const focusedSize = focusedSpeciesId ? sizes[focusedSpeciesId] : undefined;
  const focusedAnchor =
    focusedPos && focusedSize
      ? { x: focusedPos.x - originOffset.x + MARGIN, y: focusedPos.y - originOffset.y + MARGIN, width: focusedSize.w }
      : null;

  return (
    <div
      onMouseDown={backgroundDrag.onMouseDown}
      onMouseMove={backgroundDrag.onMouseMove}
      onMouseUp={backgroundDrag.onMouseUp}
      className="relative h-screen w-screen bg-transparent"
      style={{ userSelect: "none", paddingTop: showStatus ? PANEL_H : 0 }}
    >
      {showStatus && focusedSpeciesId && appData.pets[focusedSpeciesId] && getSpeciesDef(focusedSpeciesId) && (
        <StatusPanel
          pet={appData.pets[focusedSpeciesId].instance}
          species={getSpeciesDef(focusedSpeciesId)!}
          anchor={focusedAnchor}
        />
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
            onOneShotEnd={() => clearOneShot(slot.speciesId)}
            position={pos}
            originOffset={originOffset}
            margin={MARGIN}
            evoPhase={slot.speciesId === evolvingSpeciesId ? evoPhase : "idle"}
            evoReady={evoReady}
            onSizeReady={(w, h) => reportSize(slot.speciesId, w, h)}
            onClick={() => triggerHappy(slot.speciesId)}
            onContextMenu={() => {
              if (!resizing) void showMenu(slot.speciesId);
            }}
            onDragLive={(dx, dy) => handleDragLive(slot.speciesId, dx, dy)}
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

- [ ] **Step 3: Typecheck and run the suite**

Run: `npx tsc --noEmit && npm run test`
Expected: both PASS

- [ ] **Step 4: Manual regression check**

Relaunch `npm run tauri dev` (kill stale instance first). Confirm krombi still
renders, feed/evolve/reset/펫상태/크기 조절 all still work, and the two fixes from
Tasks 2-3 (live drag resize, panel follows pet) still behave the same as before this
extraction — this task must not change any observable behavior.

- [ ] **Step 5: Commit**

```bash
git add src/pet/useAppState.ts src/App.tsx
git commit -m "refactor(app): extract App.tsx state/effects into useAppState hook"
```

---

### Task 5: Component test infrastructure + first `PetSlot` test

**Files:**
- Modify: `package.json` (new devDependencies, via `npm install -D`)
- Modify: `vitest.config.ts`
- Create: `src/test-setup.ts`
- Create: `src/pet/PetSlot.test.tsx`

**Interfaces:**
- Consumes: `PetSlot` (`./PetSlot`, from earlier work) — its props are exactly the
  shape defined in Task 2 (now including `onDragLive`).
- Produces: nothing consumed by other tasks — this is the last task in the plan.

- [ ] **Step 1: Install the testing libraries**

```bash
npm install -D @testing-library/react @testing-library/jest-dom jsdom
```

- [ ] **Step 2: Update Vitest config to pick up `.tsx` test files and the setup file**

Replace the entire contents of `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    setupFiles: ["./src/test-setup.ts"],
  },
});
```

- [ ] **Step 3: Create the jest-dom setup file**

```ts
// src/test-setup.ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Run the existing suite to confirm the config change alone breaks nothing**

Run: `npm run test`
Expected: PASS — same 93 tests as before (the `include` pattern only added `.tsx`,
of which none exist yet; `setupFiles` only adds jest-dom matchers, it doesn't
require jsdom globally since `environment` is still `"node"`)

- [ ] **Step 5: Write the failing `PetSlot` test**

```tsx
// src/pet/PetSlot.test.tsx
// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, waitFor, fireEvent } from "@testing-library/react";
import { PetSlot } from "./PetSlot";

vi.mock("./Pet", () => ({
  Pet: () => <div data-testid="pet-canvas-stub" />,
}));

vi.mock("./sheetImage", () => ({
  loadImage: () => Promise.resolve({} as HTMLImageElement),
  measureBounds: () => ({ minX: 0, minY: 0, maxX: 9, maxY: 9 }),
}));

vi.mock("./speciesFormAssets", () => ({
  speciesFormAsset: () => ({
    manifest: {
      id: "test/stage1",
      frameSize: 10,
      displayScale: 1,
      sheet: "sheet.png",
      columns: 1,
      animations: { idle: { frames: [0], fps: 1, loop: true } },
    },
    sheetUrl: "test://sheet.png",
  }),
}));

describe("PetSlot onContextMenu", () => {
  it("suppresses the native context menu and calls onContextMenu exactly once", async () => {
    const onContextMenu = vi.fn();
    const { container } = render(
      <PetSlot
        speciesId="test"
        form="stage1"
        base="idle"
        oneShot={null}
        onOneShotEnd={() => {}}
        position={{ x: 0, y: 0 }}
        originOffset={{ x: 0, y: 0 }}
        margin={0}
        evoPhase="idle"
        evoReady={false}
        onSizeReady={() => {}}
        onClick={() => {}}
        onContextMenu={onContextMenu}
        onDragLive={() => {}}
        onDrop={() => {}}
      />,
    );

    await waitFor(() => expect(container.firstElementChild).not.toBeNull());
    const wrapper = container.firstElementChild as HTMLElement;

    const notCancelled = fireEvent.contextMenu(wrapper);

    expect(notCancelled).toBe(false); // false = the event's default action was prevented
    expect(onContextMenu).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 6: Run it to verify it fails for the right reason first, then passes**

Run: `npm run test -- PetSlot.test.tsx`
Expected: this test requires no new source code (only test infra + mocks), so it
should PASS immediately once Steps 1-3 are done correctly. If it instead fails,
read the failure carefully:
- "Cannot find module '@testing-library/react'" → Step 1 didn't complete, re-run the install.
- A timeout in `waitFor` → one of the three `vi.mock` calls doesn't match the real
  module's export shape; double check `speciesFormAsset`'s mock return value has
  every field `PetSlot.tsx` reads from `asset.manifest` (`frameSize`, `displayScale`,
  `columns`, `animations`).

- [ ] **Step 7: Run the full suite**

Run: `npm run test`
Expected: PASS — 93 previous tests (node environment) + 1 new test (jsdom
environment, via the file's `@vitest-environment` pragma) = 94 total.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/test-setup.ts src/pet/PetSlot.test.tsx
git commit -m "test(pet): add component test infra and first PetSlot test"
```

---

## Definition of Done

- `npm run test` passes with 94 tests (93 prior + 1 new `PetSlot` test).
- `npx tsc --noEmit` passes.
- Manual checks from Tasks 2-4 all confirmed: live drag grows the window
  right/down and clamps left/up; 펫상태 panel follows the focused pet; behavior is
  otherwise unchanged after the `useAppState` extraction.
- `src/App.tsx` contains no `useState`/`useEffect`/Tauri-store calls of its own —
  only `useAppState()` plus render-derived `const`s and JSX.
