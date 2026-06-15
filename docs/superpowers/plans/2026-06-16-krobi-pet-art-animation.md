# Krobi 펫 아트 & 애니메이션 시스템 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이모지(🐤) 펫을 64×64 HD 픽셀 스프라이트로 교체하고, 게임 상태(배고픔/청결)와 사용자 액션(밥/청소)에 반응하는 프레임 애니메이션을 붙인다.

**Architecture:** 순수 로직(애니메이션 결정·프레임 진행)을 React에서 분리해 Vitest로 단위 테스트한다. Vite `import.meta.glob`으로 프레임 PNG를 URL 맵으로 로드하고, `usePetAnimation` 훅이 manifest의 fps/loop에 따라 `<img>` 프레임을 교체한다. 기존 decay/store 로직은 건드리지 않고 펫 렌더링 부분만 교체한다.

**Tech Stack:** React 19 + TypeScript, Vite 7, Tauri v2, Vitest(신규), Python/Pillow 추출기(기존).

**참고 spec:** `docs/superpowers/specs/2026-06-16-krobi-pet-art-pipeline-design.md`

---

## 파일 구조

| 파일 | 역할 |
|---|---|
| `src/pet/types.ts` | `AnimationName`, `AnimationDef`, `PetManifest` 타입 |
| `src/pet/animation.ts` | 순수 로직: `baseAnimation`, `advanceFrame`, `resolveFrameUrls` |
| `src/pet/animation.test.ts` | 위 순수 함수 단위 테스트 |
| `src/pet/frameUrls.ts` | `import.meta.glob`로 프레임 PNG → URL 맵 (impure 경계) |
| `src/pet/usePetAnimation.ts` | fps/loop에 맞춰 현재 프레임 URL 반환하는 훅 |
| `src/pet/Pet.tsx` | 프레임 URL을 픽셀 또렷하게 렌더하는 단순 컴포넌트 |
| `src/assets/pets/krobi/manifest.json` | 애니메이션 정의(에셋↔코드 인터페이스) |
| `src/App.tsx` (수정) | 펫 렌더 교체 + 상태머신 배선 |
| `vitest.config.ts` | Vitest 설정 |

---

## 자산 생성에 대한 메모 (코딩 작업 아님)

실제 `eat/happy/sad` 9프레임은 사용자가 나노바나나로 생성 후 `tools/extract_sprites.py`로 추출한다(spec §4, 스파이크에서 검증됨). 본 계획은 **placeholder 프레임(=idle 복사본)**으로 앱이 끝까지 돌도록 만들고, 추후 같은 파일명으로 PNG만 교체하면 코드 변경 없이 실물이 반영된다.

---

## Task 1: 기존 Phase-1 앱을 baseline으로 커밋

**Files:**
- 모든 untracked 프로젝트 파일 (`.gitignore`로 `node_modules`, `src-tauri/target`, `tools/venv`, `src/assets/pets/_incoming`, `.superpowers` 제외됨)

- [ ] **Step 1: 무엇이 커밋될지 확인**

Run: `git status --short`
Expected: `src/`, `src-tauri/`, `tools/`, `package.json` 등이 `??`(untracked)로 표시. `tools/venv`, `src/assets/pets/_incoming`, `src-tauri/target`은 **나오지 않아야** 함.

- [ ] **Step 2: 전체 스테이징**

Run: `git add -A`

- [ ] **Step 3: gitignore가 작동하는지 재확인**

Run: `git status --short | grep -E "venv|_incoming|target" || echo "OK: 제외됨"`
Expected: `OK: 제외됨`

- [ ] **Step 4: 커밋**

```bash
git commit -m "chore: baseline commit of Phase-1 Krobi app and asset tooling

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

Expected: 커밋 생성, `git log --oneline -1`에 표시.

---

## Task 2: 펫 타입 + manifest.json

**Files:**
- Create: `src/pet/types.ts`
- Create: `src/assets/pets/krobi/manifest.json`

- [ ] **Step 1: 타입 정의 작성**

`src/pet/types.ts`:
```ts
export type AnimationName = "idle" | "eat" | "happy" | "sad";

export interface AnimationDef {
  /** 재생 순서대로의 프레임 base 이름 (확장자 제외) */
  frames: string[];
  fps: number;
  loop: boolean;
  /** loop:false 종료 후 전환할 애니 (선택) */
  then?: AnimationName;
}

export interface PetManifest {
  id: string;
  frameSize: number;
  displayScale: number;
  animations: Record<AnimationName, AnimationDef>;
}
```

- [ ] **Step 2: manifest 작성**

`src/assets/pets/krobi/manifest.json`:
```json
{
  "id": "krobi",
  "frameSize": 64,
  "displayScale": 2,
  "animations": {
    "idle":  { "frames": ["idle_0", "idle_1", "idle_0", "idle_2"], "fps": 4, "loop": true },
    "eat":   { "frames": ["eat_0", "eat_1", "eat_2", "eat_3"], "fps": 8, "loop": false, "then": "idle" },
    "happy": { "frames": ["happy_0", "happy_1", "happy_2"], "fps": 8, "loop": false, "then": "idle" },
    "sad":   { "frames": ["sad_0", "sad_1"], "fps": 2, "loop": true }
  }
}
```

- [ ] **Step 3: 타입 체크 통과 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없이 종료(코드 0). (`resolveJsonModule`은 이미 tsconfig에 켜져 있음.)

- [ ] **Step 4: 커밋**

```bash
git add src/pet/types.ts src/assets/pets/krobi/manifest.json
git commit -m "feat(pet): add pet manifest schema and krobi manifest

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: 애니메이션 순수 로직 (TDD) + 테스트 인프라

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (scripts에 `test` 추가, devDep `vitest`)
- Create: `src/pet/animation.test.ts`
- Create: `src/pet/animation.ts`

- [ ] **Step 1: Vitest 설치 및 설정**

Run: `npm install -D vitest`

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

`package.json`의 `"scripts"`에 추가:
```json
    "test": "vitest run"
```

- [ ] **Step 2: 실패하는 테스트 작성**

`src/pet/animation.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { baseAnimation, advanceFrame, resolveFrameUrls } from "./animation";

describe("baseAnimation", () => {
  it("스탯이 건강하면 idle", () => {
    expect(baseAnimation(100, 100)).toBe("idle");
    expect(baseAnimation(30, 30)).toBe("idle");
  });
  it("hunger가 임계값 미만이면 sad", () => {
    expect(baseAnimation(29, 100)).toBe("sad");
  });
  it("cleanliness가 임계값 미만이면 sad", () => {
    expect(baseAnimation(100, 10)).toBe("sad");
  });
});

describe("advanceFrame", () => {
  it("범위 내에서 다음 프레임으로", () => {
    expect(advanceFrame(0, 3, true)).toEqual({ index: 1, finished: false });
  });
  it("루프면 마지막 다음에 0으로 복귀", () => {
    expect(advanceFrame(2, 3, true)).toEqual({ index: 0, finished: false });
  });
  it("루프 아니면 마지막에 멈추고 finished=true", () => {
    expect(advanceFrame(3, 4, false)).toEqual({ index: 3, finished: true });
  });
});

describe("resolveFrameUrls", () => {
  const urls = { idle_0: "/a.png", idle_1: "/b.png" };
  it("프레임 이름을 URL로 매핑", () => {
    expect(
      resolveFrameUrls({ frames: ["idle_0", "idle_1"], fps: 4, loop: true }, urls),
    ).toEqual(["/a.png", "/b.png"]);
  });
  it("없는 프레임이면 throw", () => {
    expect(() =>
      resolveFrameUrls({ frames: ["nope"], fps: 4, loop: true }, urls),
    ).toThrow(/Missing frame/);
  });
});
```

- [ ] **Step 3: 테스트가 실패하는지 확인**

Run: `npm run test`
Expected: FAIL — `./animation` 모듈을 찾을 수 없음(Cannot find module).

- [ ] **Step 4: 최소 구현 작성**

`src/pet/animation.ts`:
```ts
import type { AnimationDef, AnimationName, PetManifest } from "./types";

export const LOW_THRESHOLD = 30;

/** 스탯으로부터 기본(루프) 애니를 결정 */
export function baseAnimation(
  hunger: number,
  cleanliness: number,
  low: number = LOW_THRESHOLD,
): AnimationName {
  return hunger < low || cleanliness < low ? "sad" : "idle";
}

export function getAnimationDef(
  manifest: PetManifest,
  name: AnimationName,
): AnimationDef {
  return manifest.animations[name];
}

/** 다음 프레임 인덱스와 종료 여부 */
export function advanceFrame(
  index: number,
  frameCount: number,
  loop: boolean,
): { index: number; finished: boolean } {
  const next = index + 1;
  if (next < frameCount) return { index: next, finished: false };
  return loop ? { index: 0, finished: false } : { index: frameCount - 1, finished: true };
}

/** 프레임 base 이름 배열을 URL 배열로 변환 */
export function resolveFrameUrls(
  def: AnimationDef,
  urls: Record<string, string>,
): string[] {
  return def.frames.map((name) => {
    const url = urls[name];
    if (!url) throw new Error(`Missing frame asset: ${name}`);
    return url;
  });
}
```

- [ ] **Step 5: 테스트 통과 확인**

Run: `npm run test`
Expected: PASS — 모든 테스트 통과.

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json vitest.config.ts src/pet/animation.ts src/pet/animation.test.ts
git commit -m "feat(pet): add animation pure logic with vitest tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: 프레임 URL 로더 + placeholder 프레임

**Files:**
- Create: `src/pet/frameUrls.ts`
- Create: `src/assets/pets/krobi/{eat,happy,sad}_*.png` (placeholder = idle 복사본)

- [ ] **Step 1: placeholder 프레임 생성 (idle 복사)**

Run:
```bash
cd src/assets/pets/krobi
cp idle_0.png eat_0.png && cp idle_1.png eat_1.png && cp idle_2.png eat_2.png && cp idle_0.png eat_3.png
cp idle_0.png happy_0.png && cp idle_1.png happy_1.png && cp idle_2.png happy_2.png
cp idle_1.png sad_0.png && cp idle_2.png sad_1.png
cd -
ls src/assets/pets/krobi/*.png | wc -l
```
Expected: `12` (idle 3 + eat 4 + happy 3 + sad 2). 추후 나노바나나 실물로 같은 이름 덮어쓰기.

- [ ] **Step 2: 프레임 URL 맵 로더 작성**

`src/pet/frameUrls.ts`:
```ts
// Vite가 빌드 시 각 PNG를 URL로 변환해 eager 로드한다.
const modules = import.meta.glob("../assets/pets/krobi/*.png", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

/** base 파일명(확장자 제외) -> 에셋 URL */
export const krobiFrameUrls: Record<string, string> = Object.fromEntries(
  Object.entries(modules).map(([path, url]) => {
    const name = path.split("/").pop()!.replace(/\.png$/, "");
    return [name, url];
  }),
);
```

- [ ] **Step 3: 타입 체크 통과 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 4: 커밋**

```bash
git add src/pet/frameUrls.ts src/assets/pets/krobi/eat_*.png src/assets/pets/krobi/happy_*.png src/assets/pets/krobi/sad_*.png
git commit -m "feat(pet): add frame URL loader and placeholder frames

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: usePetAnimation 훅

**Files:**
- Create: `src/pet/usePetAnimation.ts`

- [ ] **Step 1: 훅 구현**

`src/pet/usePetAnimation.ts`:
```ts
import { useEffect, useMemo, useRef, useState } from "react";
import type { AnimationName, PetManifest } from "./types";
import { advanceFrame, getAnimationDef, resolveFrameUrls } from "./animation";

/**
 * 현재 재생할 프레임 URL을 반환.
 * - current = oneShot(있으면) ?? base
 * - loop:false 애니가 끝나면 onOneShotEnd() 호출
 */
export function usePetAnimation(
  manifest: PetManifest,
  urls: Record<string, string>,
  base: AnimationName,
  oneShot: AnimationName | null,
  onOneShotEnd: () => void,
): string {
  const current: AnimationName = oneShot ?? base;
  const def = getAnimationDef(manifest, current);
  const frames = useMemo(() => resolveFrameUrls(def, urls), [def, urls]);

  const [index, setIndex] = useState(0);

  // 콜백을 ref로 보관해 effect 의존성을 안정화
  const endRef = useRef(onOneShotEnd);
  endRef.current = onOneShotEnd;

  useEffect(() => {
    setIndex(0);
    let i = 0;
    const id = window.setInterval(() => {
      const r = advanceFrame(i, frames.length, def.loop);
      i = r.index;
      setIndex(r.index);
      if (r.finished) {
        window.clearInterval(id);
        endRef.current();
      }
    }, 1000 / def.fps);
    return () => window.clearInterval(id);
  }, [current, def.fps, def.loop, frames.length]);

  return frames[Math.min(index, frames.length - 1)];
}
```

- [ ] **Step 2: 타입 체크 통과 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/pet/usePetAnimation.ts
git commit -m "feat(pet): add usePetAnimation frame-stepper hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Pet 렌더 컴포넌트

**Files:**
- Create: `src/pet/Pet.tsx`

- [ ] **Step 1: 컴포넌트 구현**

`src/pet/Pet.tsx`:
```tsx
/** 단일 프레임을 픽셀 또렷하게 렌더. 드래그 영역 포함, 드래그 시 이미지 선택 방지. */
export function Pet({ frameUrl, size }: { frameUrl: string; size: number }) {
  return (
    <img
      src={frameUrl}
      width={size}
      height={size}
      alt="pet"
      draggable={false}
      data-tauri-drag-region
      style={{ imageRendering: "pixelated", userSelect: "none" }}
    />
  );
}
```

- [ ] **Step 2: 타입 체크 통과 확인**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

- [ ] **Step 3: 커밋**

```bash
git add src/pet/Pet.tsx
git commit -m "feat(pet): add Pet sprite render component

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: App.tsx 통합

**Files:**
- Modify: `src/App.tsx`

기존 `src/App.tsx`는 펫을 `<span className="animate-bounce text-5xl" data-tauri-drag-region>🐤</span>`로 렌더하고, `feed`/`clean` 함수에서 스탯을 갱신한다. decay/store 로직은 **그대로 두고** 펫 렌더와 액션 트리거만 교체한다.

- [ ] **Step 1: import 추가**

`src/App.tsx` 상단 import 블록(기존 `import { load, type Store } ...` 아래)에 추가:
```tsx
import manifest from "./assets/pets/krobi/manifest.json";
import type { AnimationName, PetManifest } from "./pet/types";
import { baseAnimation } from "./pet/animation";
import { krobiFrameUrls } from "./pet/frameUrls";
import { usePetAnimation } from "./pet/usePetAnimation";
import { Pet } from "./pet/Pet";
```

- [ ] **Step 2: manifest 상수 추가**

import 블록 바로 아래, 기존 상수들(`const STORE_FILE = ...`) 근처에 추가:
```tsx
const PET = manifest as PetManifest;
```
> 만약 `tsc`가 "Conversion ... may be a mistake" 류 에러를 내면 `manifest as unknown as PetManifest`로 바꾼다.

- [ ] **Step 3: 컴포넌트 안에 애니메이션 상태/훅 추가**

`function App() {` 내부에서 기존 `const [pet, setPet] = useState<Pet | null>(null);` **다음 줄**에 추가:
```tsx
  const [oneShot, setOneShot] = useState<AnimationName | null>(null);
```

그리고 **`if (!pet) return null;` 보다 위쪽**(다른 hook들과 같은 위치, early return 이전)에 추가:
```tsx
  const base: AnimationName = pet
    ? baseAnimation(pet.status.hunger, pet.status.cleanliness)
    : "idle";
  const frameUrl = usePetAnimation(PET, krobiFrameUrls, base, oneShot, () =>
    setOneShot(null),
  );
```
> 주의: hook은 조건/early-return 이전에 호출되어야 한다. `pet`이 null일 때도 `base`는 "idle"로 안전하게 계산된다.

- [ ] **Step 4: feed/clean에 애니 트리거 추가**

기존 `feed` 함수 본문 시작의 `e.stopPropagation();` 바로 다음 줄에 추가:
```tsx
    setOneShot("eat");
```
기존 `clean` 함수 본문 시작의 `e.stopPropagation();` 바로 다음 줄에 추가:
```tsx
    setOneShot("happy");
```

- [ ] **Step 5: 이모지를 Pet으로 교체**

기존 펫 렌더 블록:
```tsx
        <span className="animate-bounce text-5xl" data-tauri-drag-region>
          🐤
        </span>
```
를 다음으로 교체:
```tsx
        <Pet frameUrl={frameUrl} size={PET.frameSize * PET.displayScale} />
```

- [ ] **Step 6: 바깥 패딩을 줄여 128px 펫 공간 확보**

루트 div의 className에서 `p-3`을 `p-2`로 변경:
```tsx
      className="flex h-screen w-screen flex-col items-center justify-between rounded-2xl bg-sky-100/80 p-2 backdrop-blur-sm"
```

- [ ] **Step 7: 타입 체크 + 단위 테스트 통과 확인**

Run: `npx tsc --noEmit && npm run test`
Expected: tsc 에러 없음, 모든 테스트 PASS.

- [ ] **Step 8: 커밋**

```bash
git add src/App.tsx
git commit -m "feat(pet): replace emoji with animated sprite and wire state machine

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: 앱 실행 후 성공 기준 검증 (시각 확인)

**Files:** 없음 (관찰 + 필요 시 레이아웃 미세 조정)

- [ ] **Step 1: 빌드가 통과하는지 확인**

Run: `npm run build`
Expected: tsc + vite build 성공, `dist/` 생성.

- [ ] **Step 2: dev 실행**

Run: `export PATH="$HOME/.cargo/bin:$PATH" && npm run tauri dev` (백그라운드 권장, 로그 파일로 리다이렉트)
Expected: 200×200 투명 창이 뜨고, 슬라임이 idle 호흡 루프로 재생됨.

- [ ] **Step 2-1: idle 프레임 육안 검수 (선택)**

추출 미리보기를 다시 보려면:
Run: `tools/venv/bin/python tools/make_anim_preview.py /tmp/krobi_anim.html src/assets/pets/krobi/idle_0.png src/assets/pets/krobi/idle_1.png src/assets/pets/krobi/idle_2.png && open /tmp/krobi_anim.html`

- [ ] **Step 3: 성공 기준 체크 (spec §9)**

다음을 직접 확인:
1. 앱 실행 시 idle 호흡 루프 재생.
2. **밥주기** 클릭 → eat 1회 재생 후 idle 복귀 (placeholder라 모션은 idle과 동일하지만, 전환 동작은 확인 가능).
3. **청소** 클릭 → happy 1회 재생 후 복귀.
4. hunger 또는 cleanliness < 30 → sad 루프 전환 (빠른 확인: 앱을 끄고 충분히 시간이 지난 뒤 재실행 → 오프라인 보정으로 스탯 하락, 또는 일시적으로 초기 스탯을 낮춰 테스트).
5. 픽셀이 또렷(128px, pixelated). 펫·바·버튼이 200×200 안에 잘림 없이 배치되는지 확인.
6. 기존 decay/저장 동작 회귀 없음 (스탯 감소·버튼 증가·재시작 보정 정상).

- [ ] **Step 4: 레이아웃이 넘치면 조정**

만약 펫(128px) + 바 + 버튼이 200px 높이를 넘어 잘리면, 루트 div를 `justify-between`→`justify-end`로 바꾸거나 펫을 감싼 영역에 `overflow-hidden`을 주어 정리한다. 조정했다면:
```bash
git add src/App.tsx
git commit -m "fix(pet): adjust layout to fit 128px sprite in 200x200 window

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: dev 프로세스 종료**

Run: `pkill -f "target/debug/tauri-app" || true`

---

## 완료 정의

- `npm run test` 전부 PASS, `npm run build` 성공.
- 앱에서 idle/eat/happy/sad 전환이 상태머신대로 동작.
- 12프레임이 `src/assets/pets/krobi/`에 존재(placeholder 포함), 실물 PNG로 무코드 교체 가능.
- 기존 decay/store 동작 무회귀.

## 후속(Phase 2, 본 계획 범위 밖)

- 나노바나나로 eat/happy/sad 실물 프레임 생성 → placeholder 교체.
- 진화 전환 연출, sleep/사망 상태, 다중 몬스터 도감, 진화 후반 창 확대.
- 반복 클릭 시 one-shot 재시작(현재는 재생 중 같은 액션 재클릭은 무시됨) — 필요 시 트리거 카운터 추가.
