# Krobi 펫 진화 아트 파이프라인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `add-pet` 스킬과 펫 에셋 구조를 3단계 진화(1+3+3=7형태)로 확장하고, 스타일 규칙·도감·진화 트리를 데이터로 분리한다(런타임 업무추적은 범위 밖).

**Architecture:** 펫 에셋을 `src/assets/pets/<species>/<form>/` 형태 단위 폴더로 재구성한다. 잠긴 그림체 규칙은 `pet_design.md`, 컨셉 중복방지 인덱스는 `catalog.json`, 종별 진화 트리·분기 화이트리스트는 `species.json`로 둔다. 기존 `krobi/`는 `krobi/stage1/`로 마이그레이션하고 두 import 경로만 갱신한다. `add-pet` SKILL.md는 이 구조를 생성하도록 재작성한다.

**Tech Stack:** React 19 + Vite 7 + TypeScript, Vitest 4, Tauri 2, Python(Pillow/numpy) 추출기.

**Spec:** `docs/superpowers/specs/2026-06-16-krobi-pet-evolution-pipeline-design.md`

---

## File Structure

생성/수정 파일과 책임:

- `src/assets/pets/krobi/stage1/` *(생성: krobi/ 에서 이동)* — 기존 12프레임 + manifest.json. 유년기 형태.
- `src/assets/pets/krobi/species.json` *(생성)* — krobi 진화 트리 + 분기 화이트리스트. 현재는 stage1만 실재.
- `src/assets/pets/catalog.json` *(생성)* — 전체 종 도감 인덱스(중복방지).
- `src/assets/pets/pet_design.md` *(생성)* — 잠긴 그림체 규칙 + 프레임 순서 규칙 + 진화 연속성 규칙(단일 진실원천).
- `src/pet/types.ts` *(수정)* — `Catalog`/`CatalogEntry`/`SpeciesDef`/`SpeciesForm` 타입 추가.
- `src/pet/frameUrls.ts` *(수정)* — glob 경로 `krobi/*.png` → `krobi/stage1/*.png`.
- `src/App.tsx` *(수정:4)* — manifest import 경로 `krobi/manifest.json` → `krobi/stage1/manifest.json`.
- `src/pet/frameUrls.test.ts` *(생성)* — 프레임 로드 회귀 가드.
- `src/pet/petData.test.ts` *(생성)* — catalog/species 스키마 계약 테스트.
- `.claude/skills/add-pet/SKILL.md` *(수정: 전면 재작성)* — 진화 7형태 생성 파이프라인.
- `tools/extract_sprites.py` — **변경 없음**(형태별 `--size`/`--out`만 다르게 호출).

---

## Task 1: krobi 에셋을 stage1 폴더로 마이그레이션

기존 단일 펫 레이아웃을 형태 단위 폴더로 옮기고, 깨지는 두 import 경로를 고친다. 회귀 가드 테스트로 프레임 로드를 보호한다.

**Files:**
- Test: `src/pet/frameUrls.test.ts` (생성)
- Move: `src/assets/pets/krobi/*.png` + `manifest.json` → `src/assets/pets/krobi/stage1/`
- Modify: `src/assets/pets/krobi/stage1/manifest.json` (id 갱신)
- Modify: `src/pet/frameUrls.ts:2`
- Modify: `src/App.tsx:4`

- [ ] **Step 1: 프레임 로드 회귀 가드 테스트 작성**

Create `src/pet/frameUrls.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { krobiFrameUrls } from "./frameUrls";

describe("krobiFrameUrls", () => {
  it("loads all 12 krobi frames keyed by base name", () => {
    const keys = Object.keys(krobiFrameUrls);
    expect(keys).toHaveLength(12);
    for (const name of ["idle_0", "idle_1", "idle_2", "eat_3", "happy_2", "sad_1"]) {
      expect(krobiFrameUrls[name]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: 가드 테스트 실행 — 현재 PASS 확인**

Run: `npm test -- frameUrls`
Expected: PASS (krobi/ 에 12프레임이 이미 존재).

- [ ] **Step 3: 에셋 파일을 stage1/ 로 이동**

Run:
```bash
mkdir -p src/assets/pets/krobi/stage1
git mv src/assets/pets/krobi/*.png src/assets/pets/krobi/stage1/
git mv src/assets/pets/krobi/manifest.json src/assets/pets/krobi/stage1/manifest.json
```

- [ ] **Step 4: stage1 manifest 의 id 갱신**

Edit `src/assets/pets/krobi/stage1/manifest.json` — 첫 줄의 id를 바꾼다:

```json
  "id": "krobi/stage1",
```

(나머지 필드는 그대로.)

- [ ] **Step 5: 가드 테스트 실행 — 이동으로 FAIL 확인**

Run: `npm test -- frameUrls`
Expected: FAIL — `krobiFrameUrls` 가 0개(glob 경로가 stale).

- [ ] **Step 6: glob 경로와 App import 경로 갱신**

Edit `src/pet/frameUrls.ts:2`:

```ts
const modules = import.meta.glob("../assets/pets/krobi/stage1/*.png", {
```

Edit `src/App.tsx:4`:

```ts
import manifest from "./assets/pets/krobi/stage1/manifest.json";
```

- [ ] **Step 7: 가드 테스트 + 전체 스위트 + 타입체크 통과 확인**

Run: `npm test && npx tsc --noEmit`
Expected: 모든 테스트 PASS, 타입 에러 0.

- [ ] **Step 8: 커밋**

```bash
git add src/assets/pets/krobi src/pet/frameUrls.ts src/pet/frameUrls.test.ts src/App.tsx
git commit -m "refactor(pet): migrate krobi assets to stage1 form folder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: 도감/종 스키마 타입 + 데이터 파일

`catalog.json`/`species.json` 스키마를 TS 타입으로 정의하고, 두 JSON을 실재화한다. 계약 테스트가 두 파일을 import해 구조를 검증한다(이 테스트가 유일한 소비자이자 스키마 가드).

**Files:**
- Modify: `src/pet/types.ts` (타입 추가)
- Create: `src/assets/pets/catalog.json`
- Create: `src/assets/pets/krobi/species.json`
- Test: `src/pet/petData.test.ts` (생성)

- [ ] **Step 1: 스키마 타입 추가**

Append to `src/pet/types.ts`:

```ts
/** 도감(catalog.json) — 컨셉 중복방지 인덱스 */
export interface CatalogEntry {
  id: string;
  displayName: string;
  archetype: string;
  concept: string;
  claimedMotifs: string[];
  claimedColors: string[];
  /** 도달 가능 스타일 분기 = species.json 의 branchWhitelist 미러 */
  branches: string[];
}

export interface Catalog {
  species: CatalogEntry[];
}

/** species.json 의 한 형태(노드) */
export interface SpeciesForm {
  frameSize: number;
  /** 부모 노드 키(stage1 은 없음) */
  from?: string;
  /** 분기 조건 — stat 은 업무 카테고리(별도 spec), gte 는 placeholder 임계 */
  condition?: { stat: string; gte: number };
}

/** species.json — 종별 진화 트리 + 진화 공식 */
export interface SpeciesDef {
  id: string;
  archetype: string;
  /** 이 종이 도달 가능한 스타일(공식). 아키타입에 맞는 값만. */
  branchWhitelist: string[];
  forms: Record<string, SpeciesForm>;
}
```

- [ ] **Step 2: 계약 테스트 작성**

Create `src/pet/petData.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { Catalog, SpeciesDef } from "./types";
import catalog from "../assets/pets/catalog.json";
import krobiSpecies from "../assets/pets/krobi/species.json";

const cat = catalog as Catalog;
const krobi = krobiSpecies as SpeciesDef;

describe("catalog.json", () => {
  it("has a well-formed krobi entry", () => {
    const entry = cat.species.find((s) => s.id === "krobi");
    expect(entry).toBeDefined();
    expect(entry!.archetype).toBe("slime");
    expect(entry!.branches).toHaveLength(3);
  });
});

describe("krobi species.json", () => {
  it("declares archetype + 3-branch whitelist matching the catalog", () => {
    const entry = cat.species.find((s) => s.id === "krobi")!;
    expect(krobi.archetype).toBe("slime");
    expect(krobi.branchWhitelist).toHaveLength(3);
    expect([...krobi.branchWhitelist].sort()).toEqual([...entry.branches].sort());
  });

  it("has a real stage1 form with frameSize 64", () => {
    expect(krobi.forms.stage1).toBeDefined();
    expect(krobi.forms.stage1.frameSize).toBe(64);
    expect(krobi.forms.stage1.from).toBeUndefined();
  });

  it("every non-stage1 form has a parent and an abstract condition", () => {
    for (const [key, form] of Object.entries(krobi.forms)) {
      if (key === "stage1") continue;
      expect(form.from, `${key}.from`).toBeTruthy();
      expect(form.condition?.stat, `${key}.condition.stat`).toBeTruthy();
    }
  });
});
```

- [ ] **Step 3: 테스트 실행 — JSON 부재로 FAIL 확인**

Run: `npm test -- petData`
Expected: FAIL — `catalog.json` / `species.json` 을 찾지 못함(모듈 해석 실패).

- [ ] **Step 4: catalog.json 생성**

Create `src/assets/pets/catalog.json`:

```json
{
  "species": [
    {
      "id": "krobi",
      "displayName": "크로비",
      "archetype": "slime",
      "concept": "둥근 청록 블롭 슬라임, 큰 눈, 작은 물방울 하이라이트",
      "claimedMotifs": ["슬라임", "물방울", "왕관", "망토"],
      "claimedColors": ["청록", "민트"],
      "branches": ["humanoid", "spirit", "dragon"]
    }
  ]
}
```

- [ ] **Step 5: krobi/species.json 생성**

Create `src/assets/pets/krobi/species.json`. stage1 은 실재 형태, 나머지 6형태는 아트 제작 전이지만 진화 트리·조건을 선언한다(조건의 `stat`/`gte` 는 업무추적 spec 확정 전 placeholder):

```json
{
  "id": "krobi",
  "archetype": "slime",
  "branchWhitelist": ["humanoid", "spirit", "dragon"],
  "forms": {
    "stage1":          { "frameSize": 64 },
    "stage2-humanoid": { "frameSize": 64, "from": "stage1", "condition": { "stat": "writing",  "gte": 100 } },
    "stage2-spirit":   { "frameSize": 64, "from": "stage1", "condition": { "stat": "research", "gte": 100 } },
    "stage2-dragon":   { "frameSize": 64, "from": "stage1", "condition": { "stat": "coding",   "gte": 100 } },
    "stage3-humanoid": { "frameSize": 96, "from": "stage2-humanoid", "condition": { "stat": "writing",  "gte": 300 } },
    "stage3-spirit":   { "frameSize": 96, "from": "stage2-spirit",   "condition": { "stat": "research", "gte": 300 } },
    "stage3-dragon":   { "frameSize": 96, "from": "stage2-dragon",   "condition": { "stat": "coding",   "gte": 300 } }
  }
}
```

- [ ] **Step 6: 테스트 + 타입체크 통과 확인**

Run: `npm test -- petData && npx tsc --noEmit`
Expected: PASS, 타입 에러 0.

> 참고: `tsconfig` 의 `resolveJsonModule` 이 켜져 있어야 한다(App.tsx 가 이미 manifest.json 을 import 하므로 켜져 있음). 만약 tsc 가 JSON import 에러를 내면 `tsconfig.json` 의 `compilerOptions` 에 `"resolveJsonModule": true` 를 추가하고 다시 실행한다.

- [ ] **Step 7: 커밋**

```bash
git add src/pet/types.ts src/pet/petData.test.ts src/assets/pets/catalog.json src/assets/pets/krobi/species.json
git commit -m "feat(pet): add catalog + species schema and krobi evolution tree

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: pet_design.md — 잠긴 스타일 규칙 분리

현재 `add-pet/SKILL.md` 에 하드코딩된 Style Bible 을 단일 진실원천 파일로 옮기고, 프레임 순서 규칙·진화 연속성 규칙을 추가한다. (SKILL.md 에서의 제거는 Task 4 에서 한다.)

**Files:**
- Create: `src/assets/pets/pet_design.md`

- [ ] **Step 1: pet_design.md 작성**

Create `src/assets/pets/pet_design.md`:

```markdown
# Krobi 펫 스타일 규칙 (잠금 — 단일 진실원천)

모든 펫/형태 프롬프트는 이 파일을 그대로 주입한다. 스킬은 이 규칙을 복제하지 말고 참조만 한다.

## 1. 그림체 규칙 (Style Bible)

```
HD pixel art, simplified "simple HD" (Octopath-Traveler-like).
Chibi proportions, big expressive eyes, cute friendly monster, clear silhouette.
~32-color palette, soft cell shading (max 1-2 shadow tones), subtle thin outline,
clean deliberate pixel clusters.
Solid flat magenta #ff00ff background only (for keying). Render LARGE / high-res.
64x64 target feel, creature centered.
Creature: <<<USER CONCEPT HERE>>>
Do NOT: text, UI, multiple creatures per frame, gradient overload, realistic/3D
shading, baked ground shadow.
```

레퍼런스 라인(항상 포함):

```
[REFERENCE] Use the attached image as the EXACT same art style, palette, outline
weight, and chibi proportions. Keep identity consistent; only the creature concept
and the per-frame motion change.
```

## 2. 프레임 순서 규칙

- 여러 프레임의 연속 동작은 **번호 매긴 스토리보드**로 기술하고 인과 순서를 강제한다.
  예: "F1 칼집에서 칼을 뽑는다 → F2 머리 위로 치켜든다 → F3 아래로 내려벤다."
  (뽑기 전에 베는 등 인과가 뒤집힌 순서를 만들지 않는다.)
- 순차 동작 스트립 생성 시 **직전 프레임을 레퍼런스로 첨부**해 자세 연속성을 유지한다.

## 3. 진화 연속성 규칙 (진화 공식)

- 각 진화 형태(stage2/stage3) 프롬프트는 **직전 단계 형태의 프레임을 레퍼런스로 첨부**하고
  실루엣·정체성을 유지한다.
- 형태 급변 금지: 슬라임이 갑자기 인간/기계/천사/식물이 되는 진화는 부자연스럽다.
- 허용: **점진적 장식·크기·부속 추가**.
  예) 슬라임이 형태를 유지한 채 망토 → 왕관을 두른다.
  예) 작은 악마의 뿔이 커지고 뒤에 불꽃이 떠다니게 된다.
- 도달 가능한 스타일은 종의 `branchWhitelist`(species.json)로 제한된다.
  아키타입과 맞지 않는 스타일(예: slime → angel/plant)은 화이트리스트에 넣지 않는다.
```

- [ ] **Step 2: 내용 검증**

Run: `grep -c "INVARIANTS\|magenta #ff00ff\|진화 공식\|번호 매긴 스토리보드" src/assets/pets/pet_design.md`
Expected: 매칭 ≥ 3 (Style Bible + 순서 규칙 + 진화 규칙이 모두 존재).

- [ ] **Step 3: 커밋**

```bash
git add src/assets/pets/pet_design.md
git commit -m "docs(pet): add pet_design.md locked style + ordering + evolution rules

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: add-pet SKILL.md 재작성

스킬을 7형태 진화 파이프라인으로 재작성한다: 인터뷰 확장(아키타입·분기 화이트리스트·catalog 중복검사), pet_design.md 참조 주입, 형태 단위 생성·추출, species.json/catalog append.

**Files:**
- Modify: `.claude/skills/add-pet/SKILL.md` (전면 재작성)

- [ ] **Step 1: SKILL.md 전체를 아래 내용으로 교체**

Write `.claude/skills/add-pet/SKILL.md`:

````markdown
---
name: add-pet
description: Use when the user wants to add a new pet, character, or monster to the Krobi app. Runs an interview, checks the catalog for concept collisions, generates Nano Banana image prompts that inject the locked style rules from pet_design.md plus per-frame INVARIANTS+MOTION (with numbered storyboard ordering and previous-stage reference for evolutions), ingests the returned PNG strips via the Python extractor, and writes the form-folder structure (frames + manifest.json per form), species.json (3-stage evolution tree), and a catalog.json entry the app can load.
---

# add-pet — add a new 3-stage evolving monster to Krobi

This skill turns "add a new monster" into a repeatable pipeline:
**interview → catalog dedup → generate style-locked prompts → user creates art in
Nano Banana → extract → write form folders + species.json + catalog entry.**

The image model (Nano Banana) only handles *rough layout + content*; the Python
extractor enforces *exact size, baseline alignment, palette cleanup*. Style
consistency comes from (a) the locked rules in `src/assets/pets/pet_design.md`,
always injected, and (b) attaching a reference image (style sibling, or the
previous evolution stage).

## Evolution model (per species: 7 forms)

```
stage1 (유년기, no branch)
  ├─ stage2-<A> ─→ stage3-<A>
  ├─ stage2-<B> ─→ stage3-<B>
  └─ stage2-<C> ─→ stage3-<C>
```

- One form = the standard 4-animation set (idle 8 / eat 8 / happy 8 / sad 8 = 32 frames).
  All forms follow this, including krobi (krobi/stage1 will be regenerated in the new
  style at 8 frames per action).
- Branch styles (A/B/C) come from a pool: beast, humanoid, machine, spirit, morph,
  human, angel, demon, dragon, plant, … and MUST fit the species archetype
  (slime → not angel/plant). These 3 are the species' `branchWhitelist`.
- Authoring all 7 forms is the full job; a single playthrough only shows
  stage1 → one stage2 → one stage3.

## Scope

- **In scope:** producing the per-species folder structure under
  `src/assets/pets/<species>/`, with form folders (frames + manifest.json),
  `species.json` (evolution tree), and a `catalog.json` entry.
- **Out of scope:** the work-tracking runtime that drives which branch is reached,
  evolution transition FX, and the app's multi-form runtime loader. Branch
  conditions in species.json stay abstract (`stat >= threshold`, placeholder).

## Prerequisites

- Extractor: `tools/extract_sprites.py`
- Python env: `tools/venv` (Pillow + numpy). If missing:
  `python3 -m venv tools/venv && tools/venv/bin/pip install Pillow numpy`.
- Locked style rules: `src/assets/pets/pet_design.md` (always injected).
- Catalog: `src/assets/pets/catalog.json` (read before interview, append after).

## Workflow

### Step 1 — Read the catalog, then interview

First `Read` `src/assets/pets/catalog.json`. Then ask the user (group into one or
two messages):

1. **species id** — kebab-case slug → `src/assets/pets/<species>/`.
2. **display name** — shown in-game.
3. **archetype** — base body family (slime / beast / dragon / …).
4. **concept** — stage1 (유년기) shape / colors / motif in one or two sentences.
5. **branch whitelist (3 styles)** — reachable styles that FIT the archetype.
6. **style reference** — an existing frame for consistency.
   Default: `src/assets/pets/krobi/stage1/idle_0.png`.

**Collision check:** compare the new concept / motifs / colors / archetype against
every entry in catalog.json. If they overlap, tell the user and ask them to
differentiate before continuing.

### Step 2 — Decide form generation order

Author forms in this order (a stage2/3 form needs its parent finished first, to
attach as reference):

```
stage1 → stage2-<A> → stage2-<B> → stage2-<C> → stage3-<A> → stage3-<B> → stage3-<C>
```

It is fine to do this incrementally across sessions; stage1 alone is a valid
checkpoint.

### Step 3 — Generate prompts for the current form

`Read` `src/assets/pets/pet_design.md` and inject it verbatim. For each of the 4
animations, output a ready-to-paste prompt =
**pet_design.md rules + Reference line + that animation's INVARIANTS+MOTION block**
(blocks below), with the form's concept substituted into the Style Bible's
`Creature:` line.

Per-form reference image:
- **stage1:** the chosen style reference (default krobi stage1 idle_0).
- **stage2-X:** that species' `stage1/idle_0.png`.
- **stage3-X:** that species' `stage2-X/idle_0.png`.

Always tell the user:
- Generate on solid flat magenta `#ff00ff`, render LARGE / high-res.
- **Attach the per-form reference image** above so identity/silhouette stays consistent.
- For sequential actions, keep the numbered storyboard order (pet_design.md §2).
- Save each result to `src/assets/pets/_incoming/<species>_<form>_<anim>.png`
  (e.g. `ember-pup_stage2-dragon_eat.png`).

### Step 4 — Extract each strip into the form folder

`--size` = that form's frameSize from species.json (stage1/2 = 64, stage3 = 96 in
the krobi example; adjust per species). Example:

```bash
tools/venv/bin/python tools/extract_sprites.py \
  src/assets/pets/_incoming/<species>_<form>_idle.png \
  --out src/assets/pets/<species>/<form> --names idle_0,idle_1,idle_2,idle_3,idle_4,idle_5,idle_6,idle_7 \
  --size 64 --colors 32 --tol 120 --anchor bottom \
  --preview src/assets/pets/_incoming/<species>_<form>_idle_preview.png
```

Names per animation (8 frames each):
- idle: `idle_0,idle_1,idle_2,idle_3,idle_4,idle_5,idle_6,idle_7`
- eat: `eat_0,eat_1,eat_2,eat_3,eat_4,eat_5,eat_6,eat_7`
- happy: `happy_0,happy_1,happy_2,happy_3,happy_4,happy_5,happy_6,happy_7`
- sad: `sad_0,sad_1,sad_2,sad_3,sad_4,sad_5,sad_6,sad_7`

### Step 5 — Inspect (gate)

`Read` each `_preview.png`. Check: correct frame count, **correct causal order**
(no reversed sequences), solid bodies, clean transparent background, consistent
size, bottom-aligned, and identity consistent with the reference. If wrong, tune
`--tol` (raise to kill leftover shadow; lower if edges get eaten) and re-run, or
ask the user to regenerate with clearer spacing / corrected order.

### Step 6 — Write the manifest for the form

Create `src/assets/pets/<species>/<form>/manifest.json` from the template below.
Set `id` to `<species>/<form>` and `frameSize` to the form's size.

### Step 7 — Write/update species.json and catalog.json

- `src/assets/pets/<species>/species.json` — from the template below. Fill `forms`
  with every form you intend (declare the tree even if some art is pending). Keep
  `condition.stat`/`gte` as abstract placeholders.
- Append the species to `src/assets/pets/catalog.json` (`branches` mirrors
  `branchWhitelist`). Skip if the entry already exists.

### Step 8 — Done

The species folder now matches the app's contract. Commit the frames + per-form
manifests + species.json + catalog.json.

---

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

## manifest.json template (per form)

```json
{
  "id": "<species>/<form>",
  "frameSize": 64,
  "displayScale": 2,
  "animations": {
    "idle":  { "frames": ["idle_0", "idle_1", "idle_2", "idle_3", "idle_4", "idle_5", "idle_6", "idle_7"], "fps": 8, "loop": true },
    "eat":   { "frames": ["eat_0", "eat_1", "eat_2", "eat_3", "eat_4", "eat_5", "eat_6", "eat_7"], "fps": 10, "loop": false, "then": "idle" },
    "happy": { "frames": ["happy_0", "happy_1", "happy_2", "happy_3", "happy_4", "happy_5", "happy_6", "happy_7"], "fps": 10, "loop": false, "then": "idle" },
    "sad":   { "frames": ["sad_0", "sad_1", "sad_2", "sad_3", "sad_4", "sad_5", "sad_6", "sad_7"], "fps": 4, "loop": true }
  }
}
```

## species.json template

```json
{
  "id": "<species>",
  "archetype": "<archetype>",
  "branchWhitelist": ["<A>", "<B>", "<C>"],
  "forms": {
    "stage1":     { "frameSize": 64 },
    "stage2-<A>": { "frameSize": 64, "from": "stage1", "condition": { "stat": "<catA>", "gte": 100 } },
    "stage2-<B>": { "frameSize": 64, "from": "stage1", "condition": { "stat": "<catB>", "gte": 100 } },
    "stage2-<C>": { "frameSize": 64, "from": "stage1", "condition": { "stat": "<catC>", "gte": 100 } },
    "stage3-<A>": { "frameSize": 96, "from": "stage2-<A>", "condition": { "stat": "<catA>", "gte": 300 } },
    "stage3-<B>": { "frameSize": 96, "from": "stage2-<B>", "condition": { "stat": "<catB>", "gte": 300 } },
    "stage3-<C>": { "frameSize": 96, "from": "stage2-<C>", "condition": { "stat": "<catC>", "gte": 300 } }
  }
}
```

## catalog.json entry template

```json
{
  "id": "<species>",
  "displayName": "<name>",
  "archetype": "<archetype>",
  "concept": "<one-line concept>",
  "claimedMotifs": ["<motif>", "..."],
  "claimedColors": ["<color>", "..."],
  "branches": ["<A>", "<B>", "<C>"]
}
```

## Notes

- `condition.stat` 값은 업무추적 spec 이 확정하기 전까지 placeholder. 임계 숫자도 잠정.
- Existing frames make excellent reference images. Evolutions MUST attach the
  previous stage; consistency from a reference beats text alone.
- Simpler, rounder creatures reproduce best; complex/humanoid forms need more
  hand-cleanup.
- Related: `src/assets/pets/pet_design.md`,
  `docs/superpowers/specs/2026-06-16-krobi-pet-evolution-pipeline-design.md`.
````

- [ ] **Step 2: 스타일 규칙이 SKILL.md 에 중복되지 않는지 검증**

Run: `grep -c "Octopath-Traveler-like" .claude/skills/add-pet/SKILL.md`
Expected: `0` (Style Bible 원문은 pet_design.md 에만 존재, SKILL.md 는 참조만).

- [ ] **Step 3: 핵심 흐름이 포함됐는지 검증**

Run: `grep -c "pet_design.md\|catalog.json\|species.json\|branchWhitelist\|stage2-\|previous-stage\|storyboard" .claude/skills/add-pet/SKILL.md`
Expected: 매칭 ≥ 6.

- [ ] **Step 4: 커밋**

```bash
git add .claude/skills/add-pet/SKILL.md
git commit -m "feat(skill): rework add-pet for 3-stage evolution pipeline

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final Verification

- [ ] **Step 1: 전체 테스트 + 타입체크 + 빌드**

Run: `npm test && npx tsc --noEmit && npm run build`
Expected: 모든 테스트 PASS, 타입 에러 0, vite 빌드 성공(import 경로 정상).

- [ ] **Step 2: 구조 점검**

Run: `ls src/assets/pets src/assets/pets/krobi src/assets/pets/krobi/stage1`
Expected: `pets/` 에 `catalog.json`·`pet_design.md`·`krobi/`; `krobi/` 에 `species.json`·`stage1/`; `stage1/` 에 12 PNG + `manifest.json`.
