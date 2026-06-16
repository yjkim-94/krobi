# Krobi Interaction Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Krobi into a panel-less floating pet driven by left-click (happy), right-click menu (feed / resize), and drag-to-move, with runtime clipping auto-fit, a satiety-only stat model, an 8-frame animation contract, and a trimmed `add-pet` skill.

**Architecture:** Pure logic (stat threshold, opaque-pixel bounds, fit math, drag threshold) lives in small unit-tested modules under `src/pet/`. Browser/Tauri IO (canvas pixel reads, `startDragging`, `setSize`, persistence) lives in thin hooks/components verified manually via `npm run tauri dev`. `App.tsx` orchestrates them.

**Tech Stack:** Tauri v2 (`@tauri-apps/api` window/dpi, `plugin-store`), React 19 + TypeScript, Vite, Tailwind v4, Vitest (node env — pure logic only).

---

## File Structure

**Pure logic (unit-tested, node env):**
- `src/pet/contentBounds.ts` — `Box`, `opaqueBoundsFromAlpha`, `unionBounds`, `boxSize`, `fitWindowSize`, `fitScale`.
- `src/pet/dragMath.ts` — `exceededThreshold`.
- `src/pet/animation.ts` — `baseAnimation` (modify: satiety-only).

**Browser/Tauri IO (manual verification):**
- `src/pet/sheetImage.ts` — `loadImage`, `measureBounds` (canvas `getImageData`).
- `src/pet/Pet.tsx` — rewrite to a `<canvas>` renderer (crop content box → scale to fit).
- `src/pet/useWindowDrag.ts` — left-button mousedown→move-threshold→`startDragging`, else click callback.
- `src/ui/ContextMenu.tsx` — custom right-click menu.
- `src/ui/ResizeOverlay.tsx` — grid guide + handle + O/X save/cancel via `setSize`.
- `src/App.tsx` — orchestration rewrite (layout, satiety, menu, resize, fit, persistence).

**Config / assets / docs:**
- `src-tauri/tauri.conf.json`, `src-tauri/capabilities/default.json`, `src-tauri/src/lib.rs`.
- `src/assets/pets/krobi/stage1/manifest.json` — sad 8-frame contract.
- `.claude/skills/add-pet/SKILL.md` + new `references/`.

---

## Task 1: Window permissions + Tauri config

Enable programmatic window control (drag, resize) before any wiring needs it.

**Files:**
- Modify: `src-tauri/capabilities/default.json`
- Modify: `src-tauri/tauri.conf.json:14-24`

- [ ] **Step 1: Add window permissions to capabilities**

Replace the `permissions` array in `src-tauri/capabilities/default.json` with:

```json
  "permissions": [
    "core:default",
    "opener:default",
    "store:default",
    "core:window:allow-start-dragging",
    "core:window:allow-set-size",
    "core:window:allow-inner-size",
    "core:window:allow-set-resizable",
    "core:window:allow-scale-factor"
  ]
```

- [ ] **Step 2: Allow runtime resize in tauri.conf.json**

In `src-tauri/tauri.conf.json`, in the `main` window object, set `"resizable": true` (OS-edge resize is suppressed in the frontend; we only resize via `setSize`). Leave `decorations`, `transparent`, `alwaysOnTop` as-is. The width/height become the fallback only — runtime fit/saved-size override at startup.

- [ ] **Step 3: Verify the app still builds**

Run: `npm run build`
Expected: `tsc` + vite build succeed (no frontend code changed yet).

- [ ] **Step 4: Commit**

```bash
git add src-tauri/capabilities/default.json src-tauri/tauri.conf.json
git commit -m "feat(tauri): grant window drag/resize permissions"
```

---

## Task 2: Satiety-only stat model (`baseAnimation`)

**Files:**
- Modify: `src/pet/animation.ts:5-12`
- Modify: `src/pet/animation.test.ts:1-16`

- [ ] **Step 1: Update the failing test for the new signature**

Replace the `baseAnimation` describe block in `src/pet/animation.test.ts` with:

```typescript
describe("baseAnimation", () => {
  it("포만감이 임계값 이상이면 idle", () => {
    expect(baseAnimation(100)).toBe("idle");
    expect(baseAnimation(30)).toBe("idle");
  });
  it("포만감이 임계값 미만이면 sad", () => {
    expect(baseAnimation(29)).toBe("sad");
    expect(baseAnimation(0)).toBe("sad");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- animation`
Expected: FAIL — `baseAnimation` still expects two args / wrong results.

- [ ] **Step 3: Simplify `baseAnimation` to satiety-only**

Replace the `baseAnimation` function in `src/pet/animation.ts` with:

```typescript
/** 포만감으로부터 기본(루프) 애니를 결정 */
export function baseAnimation(
  satiety: number,
  low: number = LOW_THRESHOLD,
): AnimationName {
  return satiety < low ? "sad" : "idle";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- animation`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pet/animation.ts src/pet/animation.test.ts
git commit -m "feat(pet): drop cleanliness, base animation on satiety only"
```

---

## Task 3: Content-bounds + fit math (pure)

**Files:**
- Create: `src/pet/contentBounds.ts`
- Create: `src/pet/contentBounds.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/pet/contentBounds.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  opaqueBoundsFromAlpha,
  unionBounds,
  boxSize,
  fitWindowSize,
  fitScale,
} from "./contentBounds";

// 4x4 RGBA grid helper: opaque pixels at given [x,y] coords.
function rgba(w: number, h: number, opaque: [number, number][]): number[] {
  const data = new Array(w * h * 4).fill(0);
  for (const [x, y] of opaque) data[(y * w + x) * 4 + 3] = 255;
  return data;
}

describe("opaqueBoundsFromAlpha", () => {
  it("finds the tight box around opaque pixels", () => {
    const data = rgba(4, 4, [[1, 1], [2, 1], [2, 2]]);
    expect(opaqueBoundsFromAlpha(data, 4, 4)).toEqual({
      minX: 1, minY: 1, maxX: 2, maxY: 2,
    });
  });
  it("ignores alpha at/below threshold", () => {
    const data = new Array(2 * 2 * 4).fill(0);
    data[3] = 5; // alpha 5 at (0,0), below default threshold 8
    expect(opaqueBoundsFromAlpha(data, 2, 2)).toBeNull();
  });
});

describe("unionBounds", () => {
  it("merges two boxes", () => {
    expect(
      unionBounds(
        { minX: 1, minY: 2, maxX: 3, maxY: 4 },
        { minX: 0, minY: 3, maxX: 2, maxY: 6 },
      ),
    ).toEqual({ minX: 0, minY: 2, maxX: 3, maxY: 6 });
  });
  it("returns the non-null side when one is null", () => {
    const b = { minX: 1, minY: 1, maxX: 2, maxY: 2 };
    expect(unionBounds(null, b)).toEqual(b);
    expect(unionBounds(b, null)).toEqual(b);
    expect(unionBounds(null, null)).toBeNull();
  });
});

describe("boxSize", () => {
  it("is inclusive (maxX-minX+1)", () => {
    expect(boxSize({ minX: 1, minY: 2, maxX: 3, maxY: 6 })).toEqual({ w: 3, h: 5 });
  });
});

describe("fitWindowSize", () => {
  it("scales content and adds margin on both sides", () => {
    expect(fitWindowSize({ w: 40, h: 50 }, 2, 12)).toEqual({
      width: 104, // 40*2 + 24
      height: 124, // 50*2 + 24
    });
  });
});

describe("fitScale", () => {
  it("uses the limiting dimension to preserve aspect", () => {
    expect(fitScale({ w: 40, h: 50 }, 80, 200)).toBeCloseTo(2); // width-limited
    expect(fitScale({ w: 40, h: 50 }, 200, 50)).toBeCloseTo(1); // height-limited
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- contentBounds`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `contentBounds.ts`**

Create `src/pet/contentBounds.ts`:

```typescript
export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** RGBA 픽셀 배열에서 불투명(alpha>threshold) 픽셀의 경계 박스. 없으면 null. */
export function opaqueBoundsFromAlpha(
  data: Uint8ClampedArray | number[],
  w: number,
  h: number,
  threshold = 8,
): Box | null {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return null;
  return { minX, minY, maxX, maxY };
}

/** 두 박스의 합집합(둘 다 포함하는 최소 박스). */
export function unionBounds(a: Box | null, b: Box | null): Box | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY),
  };
}

/** 박스의 픽셀 크기 (경계 포함). */
export function boxSize(box: Box): { w: number; h: number } {
  return { w: box.maxX - box.minX + 1, h: box.maxY - box.minY + 1 };
}

/** 콘텐츠 크기 × 배율 + 양쪽 마진 = 기본 창 콘텐츠 크기(논리 px). */
export function fitWindowSize(
  content: { w: number; h: number },
  scale: number,
  margin: number,
): { width: number; height: number } {
  return {
    width: Math.round(content.w * scale + margin * 2),
    height: Math.round(content.h * scale + margin * 2),
  };
}

/** 가용 영역에 콘텐츠를 비율 유지로 맞추는 배율. */
export function fitScale(
  content: { w: number; h: number },
  availW: number,
  availH: number,
): number {
  return Math.min(availW / content.w, availH / content.h);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- contentBounds`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add src/pet/contentBounds.ts src/pet/contentBounds.test.ts
git commit -m "feat(pet): add opaque-bounds + fit math for clipping QA"
```

---

## Task 4: Drag threshold math (pure)

**Files:**
- Create: `src/pet/dragMath.ts`
- Create: `src/pet/dragMath.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/pet/dragMath.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { exceededThreshold } from "./dragMath";

describe("exceededThreshold", () => {
  it("false inside the radius (treated as a click)", () => {
    expect(exceededThreshold(2, 2, 4)).toBe(false); // hypot≈2.83
  });
  it("true once movement exceeds the radius (treated as a drag)", () => {
    expect(exceededThreshold(5, 0, 4)).toBe(true);
    expect(exceededThreshold(-3, -4, 4)).toBe(true); // hypot=5
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm run test -- dragMath`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `dragMath.ts`**

Create `src/pet/dragMath.ts`:

```typescript
/** 마우스 이동량이 임계 반경을 넘었는지(넘으면 드래그, 아니면 클릭). */
export function exceededThreshold(dx: number, dy: number, threshold: number): boolean {
  return Math.hypot(dx, dy) > threshold;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm run test -- dragMath`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pet/dragMath.ts src/pet/dragMath.test.ts
git commit -m "feat(pet): add drag/click threshold helper"
```

---

## Task 5: Sheet image loader + bounds measurement (IO)

**Files:**
- Create: `src/pet/sheetImage.ts`

- [ ] **Step 1: Implement loader + measurer**

Create `src/pet/sheetImage.ts`:

```typescript
import { opaqueBoundsFromAlpha, unionBounds, type Box } from "./contentBounds";

/** 스프라이트 시트 PNG를 로드. */
export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * 주어진 셀들의 불투명 픽셀 합집합 경계(셀 로컬 좌표).
 * 모든 프레임을 포함하므로 어떤 프레임도 잘리지 않는 표시 박스가 된다.
 */
export function measureBounds(
  img: HTMLImageElement,
  cellSize: number,
  columns: number,
  cells: number[],
  threshold = 8,
): Box {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0);

  let acc: Box | null = null;
  for (const cell of cells) {
    const col = cell % columns;
    const row = Math.floor(cell / columns);
    const { data } = ctx.getImageData(
      col * cellSize,
      row * cellSize,
      cellSize,
      cellSize,
    );
    acc = unionBounds(acc, opaqueBoundsFromAlpha(data, cellSize, cellSize, threshold));
  }
  // 전부 투명이면(이론상 없음) 셀 전체로 폴백.
  return acc ?? { minX: 0, minY: 0, maxX: cellSize - 1, maxY: cellSize - 1 };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: `tsc` passes (file compiles; not yet imported anywhere — that's fine).

- [ ] **Step 3: Commit**

```bash
git add src/pet/sheetImage.ts
git commit -m "feat(pet): load sheet + measure opaque content bounds"
```

---

## Task 6: Canvas-based `Pet` renderer

Replace the background-position `div` with a `<canvas>` that crops the content box of the current cell and scales it to a target size (handles both clipping-safe crop and arbitrary resize).

> **Build note:** From this task through Task 10, `npm run build` (tsc) is intentionally red — the only errors are in `App.tsx`, which still uses the old `Pet` props until Task 10 rewrites it. The Vitest pure-logic suite (`npm run test`) stays green the whole time. Don't try to "fix" App.tsx early; Task 10 replaces it wholesale.

**Files:**
- Modify: `src/pet/Pet.tsx` (full rewrite)

- [ ] **Step 1: Rewrite `Pet.tsx`**

Replace the entire contents of `src/pet/Pet.tsx` with:

```typescript
import { useEffect, useRef } from "react";
import type { Box } from "./contentBounds";

/**
 * 현재 셀의 콘텐츠 박스 영역을 canvas로 잘라 destW×destH로 픽셀 또렷하게 렌더.
 * 콘텐츠 박스만 그리므로 빈 여백 없이 꽉 차고, 어떤 프레임도 잘리지 않는다.
 */
export function Pet({
  img,
  cell,
  columns,
  cellSize,
  box,
  destW,
  destH,
}: {
  img: HTMLImageElement;
  cell: number;
  columns: number;
  cellSize: number;
  box: Box;
  destW: number;
  destH: number;
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    canvas.width = destW;
    canvas.height = destH;
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, destW, destH);

    const col = cell % columns;
    const row = Math.floor(cell / columns);
    const srcX = col * cellSize + box.minX;
    const srcY = row * cellSize + box.minY;
    const srcW = box.maxX - box.minX + 1;
    const srcH = box.maxY - box.minY + 1;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, destW, destH);
  }, [img, cell, columns, cellSize, box, destW, destH]);

  return <canvas ref={ref} style={{ display: "block", userSelect: "none" }} />;
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: `tsc` fails ONLY in `App.tsx` (old `Pet` props). That is expected — Task 9 rewrites `App.tsx`. If `tsc` errors are confined to `App.tsx`, proceed.

- [ ] **Step 3: Commit**

```bash
git add src/pet/Pet.tsx
git commit -m "feat(pet): render pet via cropped+scaled canvas"
```

---

## Task 7: `useWindowDrag` hook

Left-button press → if movement exceeds threshold, start OS window drag; a clean release (no movement) fires the click callback (→ happy).

**Files:**
- Create: `src/pet/useWindowDrag.ts`

- [ ] **Step 1: Implement the hook**

Create `src/pet/useWindowDrag.ts`:

```typescript
import { useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { exceededThreshold } from "./dragMath";

/**
 * 펫 좌클릭 상호작용:
 * - 누른 채 임계값 초과 이동 → 창 드래그 시작(startDragging)
 * - 이동 없이 떼기 → onClick() (happy 트리거)
 */
export function useWindowDrag(onClick: () => void, threshold = 4) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const dragged = useRef(false);

  function onMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return; // 좌버튼만
    start.current = { x: e.screenX, y: e.screenY };
    dragged.current = false;
  }

  function onMouseMove(e: React.MouseEvent) {
    if (!start.current || dragged.current) return;
    if (exceededThreshold(e.screenX - start.current.x, e.screenY - start.current.y, threshold)) {
      dragged.current = true;
      void getCurrentWindow().startDragging();
    }
  }

  function onMouseUp() {
    if (start.current && !dragged.current) onClick();
    start.current = null;
  }

  return { onMouseDown, onMouseMove, onMouseUp };
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: errors confined to `App.tsx` (still the old version). Proceed.

- [ ] **Step 3: Commit**

```bash
git add src/pet/useWindowDrag.ts
git commit -m "feat(pet): drag-to-move window with click fallback"
```

---

## Task 8: `ContextMenu` component

**Files:**
- Create: `src/ui/ContextMenu.tsx`

- [ ] **Step 1: Implement the menu**

Create `src/ui/ContextMenu.tsx`:

```typescript
import { useEffect } from "react";

export interface MenuItem {
  label: string;
  onClick: () => void;
}

/** 커서 위치에 뜨는 커스텀 우클릭 메뉴. 바깥 클릭/Esc로 닫힘. */
export function ContextMenu({
  x,
  y,
  items,
  onClose,
}: {
  x: number;
  y: number;
  items: MenuItem[];
  onClose: () => void;
}) {
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <ul
      onMouseDown={(e) => e.stopPropagation()}
      style={{ left: x, top: y }}
      className="absolute z-50 min-w-24 overflow-hidden rounded-lg bg-white/95 py-1 text-xs shadow-lg backdrop-blur"
    >
      {items.map((item) => (
        <li key={item.label}>
          <button
            onClick={() => {
              item.onClick();
              onClose();
            }}
            className="block w-full px-3 py-1.5 text-left font-semibold text-slate-700 hover:bg-sky-100"
          >
            {item.label}
          </button>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: errors confined to `App.tsx`. Proceed.

- [ ] **Step 3: Commit**

```bash
git add src/ui/ContextMenu.tsx
git commit -m "feat(ui): custom right-click context menu"
```

---

## Task 9: `ResizeOverlay` component

Grid guide + bottom-right handle that resizes the window via `setSize`; O commits (parent persists), X restores the entry size and closes.

**Files:**
- Create: `src/ui/ResizeOverlay.tsx`

- [ ] **Step 1: Implement the overlay**

Create `src/ui/ResizeOverlay.tsx`:

```typescript
import { useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";

const MIN = 80;

/**
 * 리사이즈 모드 오버레이.
 * - 우하단 핸들 드래그 → setSize 로 창 실시간 리사이즈
 * - O(저장): onDone(true) — 부모가 현재 크기를 영구 저장
 * - X(취소): 진입 직전 크기로 복원 후 onDone(false)
 */
export function ResizeOverlay({ onDone }: { onDone: (commit: boolean) => void }) {
  // 진입 직전 크기(취소 복원용).
  const startSize = useRef({ w: window.innerWidth, h: window.innerHeight });
  const drag = useRef<{ mx: number; my: number; w: number; h: number } | null>(null);

  function onHandleDown(e: React.MouseEvent) {
    e.stopPropagation();
    drag.current = { mx: e.screenX, my: e.screenY, w: window.innerWidth, h: window.innerHeight };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  function onMove(e: MouseEvent) {
    if (!drag.current) return;
    const w = Math.max(MIN, drag.current.w + (e.screenX - drag.current.mx));
    const h = Math.max(MIN, drag.current.h + (e.screenY - drag.current.my));
    void getCurrentWindow().setSize(new LogicalSize(w, h));
  }
  function onUp() {
    drag.current = null;
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
  }

  function cancel() {
    void getCurrentWindow()
      .setSize(new LogicalSize(startSize.current.w, startSize.current.h))
      .then(() => onDone(false));
  }

  return (
    <div className="absolute inset-0 z-40" onMouseDown={(e) => e.stopPropagation()}>
      {/* 격자 가이드 */}
      <div
        className="absolute inset-1 rounded border-2 border-dashed border-sky-400/80"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(56,189,248,.25) 1px, transparent 1px)," +
            "linear-gradient(to bottom, rgba(56,189,248,.25) 1px, transparent 1px)",
          backgroundSize: "16px 16px",
        }}
      />
      {/* O / X */}
      <div className="absolute right-1 top-1 flex gap-1">
        <button
          onClick={() => onDone(true)}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-xs font-bold text-white shadow"
        >
          ✓
        </button>
        <button
          onClick={cancel}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs font-bold text-white shadow"
        >
          ✕
        </button>
      </div>
      {/* 우하단 리사이즈 핸들 */}
      <div
        onMouseDown={onHandleDown}
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize rounded-tl bg-sky-500/80"
      />
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run build`
Expected: errors confined to `App.tsx`. Proceed.

- [ ] **Step 3: Commit**

```bash
git add src/ui/ResizeOverlay.tsx
git commit -m "feat(ui): resize overlay with grid guide + save/cancel"
```

---

## Task 10: `App.tsx` orchestration rewrite

Wire everything: panel-less layout, satiety-only persistence + migration, click→happy / feed→eat, drag, context menu, resize mode, runtime fit, saved-size restore.

**Files:**
- Modify: `src/App.tsx` (full rewrite)

- [ ] **Step 1: Rewrite `App.tsx`**

Replace the entire contents of `src/App.tsx` with:

```typescript
import { useEffect, useRef, useState } from "react";
import { load, type Store } from "@tauri-apps/plugin-store";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { LogicalSize } from "@tauri-apps/api/dpi";
import "./App.css";
import manifest from "./assets/pets/krobi/stage1/manifest.json";
import type { AnimationName, PetManifest } from "./pet/types";
import { baseAnimation } from "./pet/animation";
import { krobiSheetUrl } from "./pet/frameUrls";
import { usePetAnimation } from "./pet/usePetAnimation";
import { Pet } from "./pet/Pet";
import { useWindowDrag } from "./pet/useWindowDrag";
import { loadImage, measureBounds } from "./pet/sheetImage";
import { fitWindowSize, fitScale, boxSize, type Box } from "./pet/contentBounds";
import { ContextMenu } from "./ui/ContextMenu";
import { ResizeOverlay } from "./ui/ResizeOverlay";

const PET = manifest as PetManifest;
const STORE_FILE = "krobi_data.json";
const VERSION = "1.0.0";
const HUNGER_RATE = 1; // 포만감: 분당 -1
const TICK_MS = 60_000;
const MARGIN = 12; // 펫 주변 여백(px)

type Status = { satiety: number };
type PetData = {
  name: string;
  level: number;
  status: Status;
  last_updated: string;
};
type WindowSize = { width: number; height: number };

const clampMin0 = (v: number) => Math.max(0, v);
const clampMax100 = (v: number) => Math.min(100, v);

function defaultPet(): PetData {
  return {
    name: "크로비",
    level: 1,
    status: { satiety: 100 },
    last_updated: new Date().toISOString(),
  };
}

// 구버전 저장(hunger/cleanliness)에서 satiety로 마이그레이션.
function migrate(raw: unknown): PetData {
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
  return {
    name: typeof r.name === "string" ? r.name : base.name,
    level: typeof r.level === "number" ? r.level : base.level,
    status: { satiety },
    last_updated:
      typeof r.last_updated === "string" ? r.last_updated : base.last_updated,
  };
}

function App() {
  const storeRef = useRef<Store | null>(null);
  const [pet, setPet] = useState<PetData | null>(null);
  const [oneShot, setOneShot] = useState<AnimationName | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const [inner, setInner] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null);
  const [resizing, setResizing] = useState(false);

  async function persistPet(next: PetData) {
    const store = storeRef.current;
    if (!store) return;
    await store.set("version", VERSION);
    await store.set("pet", next);
    await store.save();
  }

  // 펫 데이터 로드 + 오프라인 보정 + 감소 틱.
  useEffect(() => {
    let intervalId: number | undefined;
    (async () => {
      const store = await load(STORE_FILE, { defaults: {}, autoSave: false });
      storeRef.current = store;
      let current = migrate(await store.get("pet"));

      const now = Date.now();
      const last = new Date(current.last_updated).getTime();
      const elapsedMin = Math.max(0, Math.floor((now - last) / 60_000));
      if (elapsedMin > 0) {
        current = {
          ...current,
          status: { satiety: clampMin0(current.status.satiety - elapsedMin * HUNGER_RATE) },
          last_updated: new Date(now).toISOString(),
        };
      }
      await persistPet(current);
      setPet(current);

      intervalId = window.setInterval(() => {
        setPet((prev) => {
          if (!prev) return prev;
          const next: PetData = {
            ...prev,
            status: { satiety: clampMin0(prev.status.satiety - HUNGER_RATE) },
            last_updated: new Date().toISOString(),
          };
          void persistPet(next);
          return next;
        });
      }, TICK_MS);
    })();
    return () => {
      if (intervalId) window.clearInterval(intervalId);
    };
  }, []);

  // 시트 로드 + 콘텐츠 경계 측정 + 초기 창 크기(저장값 우선, 없으면 자동맞춤).
  useEffect(() => {
    const cells = Object.values(PET.animations).flatMap((a) => a.frames);
    (async () => {
      const store = storeRef.current ?? (await load(STORE_FILE, { defaults: {}, autoSave: false }));
      const image = await loadImage(krobiSheetUrl);
      const measured = measureBounds(image, PET.frameSize, PET.columns, cells);
      setImg(image);
      setBox(measured);

      const saved = (await store.get("window_size")) as WindowSize | undefined;
      const size = saved ?? fitWindowSize(boxSize(measured), PET.displayScale, MARGIN);
      await getCurrentWindow().setSize(new LogicalSize(size.width, size.height));
    })();
  }, []);

  // 창 크기 변화 추적(리사이즈 시 펫 스케일 갱신).
  useEffect(() => {
    const onResize = () => setInner({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

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

  async function commitSize() {
    const store = storeRef.current;
    if (store) {
      await store.set("window_size", { width: window.innerWidth, height: window.innerHeight });
      await store.save();
    }
    setResizing(false);
  }

  if (!pet || !img || !box) return null;

  // 콘텐츠 박스를 가용 영역(창 - 마진)에 비율 유지로 맞춤.
  const cb = boxSize(box);
  const scale = fitScale(cb, inner.w - MARGIN * 2, inner.h - MARGIN * 2);
  const destW = Math.round(cb.w * scale);
  const destH = Math.round(cb.h * scale);

  return (
    <div
      onMouseDown={drag.onMouseDown}
      onMouseMove={drag.onMouseMove}
      onMouseUp={drag.onMouseUp}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!resizing) setMenu({ x: e.clientX, y: e.clientY });
      }}
      className="relative flex h-screen w-screen items-center justify-center bg-transparent"
      style={{ userSelect: "none" }}
    >
      <Pet
        img={img}
        cell={cell}
        columns={PET.columns}
        cellSize={PET.frameSize}
        box={box}
        destW={destW}
        destH={destH}
      />

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: "밥주기", onClick: feed },
            { label: "크기 조절", onClick: () => setResizing(true) },
          ]}
        />
      )}

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

- [ ] **Step 2: Typecheck + unit tests**

Run: `npm run build && npm run test`
Expected: `tsc` passes; all Vitest suites green.

- [ ] **Step 3: Manual smoke test in the desktop app**

Run: `npm run tauri dev`
Verify each (matches the 12 review items):
1. Only the pet shows — no sky panel, no bars, no buttons.
2. Pet head/edges are NOT clipped.
3. Left-click pet → happy plays once, returns to idle.
4. Press-and-drag pet → window moves.
5. Right-click → menu with 밥주기 / 크기 조절.
6. 밥주기 → eat plays, satiety rises (let it idle a while, then feed to confirm sad→idle around 30).
7. 크기 조절 → grid + handle appear; drag handle resizes window and pet scales; ✓ saves, ✕ restores.
8. Quit and relaunch → saved window size is restored.

If any fail, fix the relevant module and re-run before committing.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx
git commit -m "feat(app): panel-less pet with click/drag/menu/resize + runtime fit"
```

---

## Task 11: sad 8-frame contract in manifest

**Files:**
- Modify: `src/assets/pets/krobi/stage1/manifest.json:52-61`

- [ ] **Step 1: Make sad an 8-frame loop**

In `src/assets/pets/krobi/stage1/manifest.json`, replace the `sad` block so it has 8 frames (placeholder reuses idle cells 0–7 until real sad art is generated; real art will occupy cells 24–31):

```json
    "sad": {
      "frames": [
        0,
        1,
        2,
        3,
        4,
        5,
        6,
        7
      ],
      "fps": 3,
      "loop": true
    }
```

- [ ] **Step 2: Verify the frame contract test passes**

Run: `npm run test -- frameUrls`
Expected: PASS (cells are valid non-negative integers).

- [ ] **Step 3: Commit**

```bash
git add src/assets/pets/krobi/stage1/manifest.json
git commit -m "chore(pet): sad placeholder to 8-frame contract (real art pending)"
```

---

## Task 12: Remove demo Rust command

**Files:**
- Modify: `src-tauri/src/lib.rs:4-7,25`

- [ ] **Step 1: Delete the `greet` command and its handler registration**

Replace the contents of `src-tauri/src/lib.rs` with:

```rust
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // 맥 그림자 제거
            #[cfg(target_os = "macos")]
            {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_shadow(false);
                }
            }
            let _ = app;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npm run tauri build -- --no-bundle` (or `cargo check` in `src-tauri/`)
Expected: Rust compiles with no reference to `greet`.

- [ ] **Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "chore(tauri): remove demo greet command"
```

---

## Task 13: Refactor `add-pet` skill (split references)

Shrink `SKILL.md` (298 lines) by moving prompt blocks + templates into `references/`.

**Files:**
- Create: `.claude/skills/add-pet/references/animation-prompts.md`
- Create: `.claude/skills/add-pet/references/templates.md`
- Modify: `.claude/skills/add-pet/SKILL.md`

- [ ] **Step 1: Move the prompt blocks**

Create `.claude/skills/add-pet/references/animation-prompts.md` containing the current SKILL.md section **"## Animation prompt blocks (INVARIANTS + MOTION)"** (the idle/eat/happy/sad blocks, lines 170–217) verbatim, with a one-line top heading `# add-pet — animation prompt blocks`.

- [ ] **Step 2: Move the templates**

Create `.claude/skills/add-pet/references/templates.md` containing the current SKILL.md sections **"## manifest.json draft template"**, **"## species.json template"**, and **"## catalog.json entry template"** (lines 219–287) verbatim, with a one-line top heading `# add-pet — file templates`.

- [ ] **Step 3: Trim SKILL.md to workflow + references**

In `.claude/skills/add-pet/SKILL.md`, delete the three moved sections (everything from `## Animation prompt blocks` through the end of the catalog template, i.e. lines 170–287), keeping the `## Notes` section. Where Step 3 and Step 6 reference the blocks/templates, point to the new files. Add near the top (after the intro) a `## References` list:

```markdown
## References

- Animation prompt blocks (INVARIANTS + MOTION): `references/animation-prompts.md`
- File templates (manifest / species.json / catalog.json): `references/templates.md`
```

And update the in-step pointers:
- Step 3 (`### Step 3 — Generate prompts`): change "(blocks below)" → "(blocks in `references/animation-prompts.md`)".
- Step 6 (`### Step 6 — Write a draft manifest`): change "from the **draft template** below" → "from the draft template in `references/templates.md`".
- Step 8: change template references "below" → "in `references/templates.md`".

- [ ] **Step 4: Verify length + integrity**

Run: `wc -l .claude/skills/add-pet/SKILL.md`
Expected: under ~160 lines, and no remaining "below" pointer references a deleted section.

- [ ] **Step 5: Commit**

```bash
git add .claude/skills/add-pet/
git commit -m "docs(skill): split add-pet prompts/templates into references/"
```

---

## Task 14: Delete unnecessary files

**Files:**
- Delete: `src/assets/pets/_incoming/*`
- Delete: `src/assets/react.svg` (if unused)
- Delete: stray `.DS_Store` files

- [ ] **Step 1: Confirm `react.svg` is unused**

Run: `grep -rn "react.svg" src/ index.html public/ 2>/dev/null`
Expected: no references → safe to delete. (If referenced, skip its deletion.)

- [ ] **Step 2: List the `_incoming` scratch files to be removed**

Run: `ls -1 src/assets/pets/_incoming/`
Expected: only generated/preview/raw PNG scratch (no file the app imports — the app imports `krobi/stage1/sheet.png`, not `_incoming`). Confirm nothing here is referenced:
Run: `grep -rn "_incoming" src/ 2>/dev/null` → expect no code references.

- [ ] **Step 3: Delete**

```bash
git rm -r src/assets/pets/_incoming
git rm src/assets/react.svg   # only if Step 1 found no references
find src src-tauri -name .DS_Store -print -delete
```

- [ ] **Step 4: Verify build + tests still pass**

Run: `npm run build && npm run test`
Expected: green (deletions were scratch/unused only).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove scratch _incoming assets and unused files"
```

---

## Self-Review Notes (coverage map of the 12 review items)

1. sad in prompts → already present in skill; **sad contract** Task 11; real art deferred (spec §1.2).
2. panel hidden, pet only → Task 10 (layout).
3. remove cleaning → Task 2 (animation) + Task 10 (no clean button/stat).
4. click → happy → Task 7 + Task 10.
5. satiety <30 sad / feed +20 / ≥30 idle → Task 2 + Task 10.
6. feed via right-click → Task 8 + Task 10.
7. head clipping self-QA → Tasks 3, 5, 6, 10 (measure → crop → fit).
8. all 8 frames → Task 11 (sad) ; idle/eat/happy already 8.
9. drag moves window → Task 7 + Task 10 (manual `startDragging`).
10. resize with grid + O/X → Task 9 + Task 10.
11. add-pet skill too long → Task 13.
12. delete unnecessary files → Task 14.
