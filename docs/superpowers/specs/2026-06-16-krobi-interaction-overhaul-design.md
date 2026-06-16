# Krobi 인터랙션 개편 + 클리핑 QA + 정리 — 설계 문서

- 작성일: 2026-06-16
- 상태: 승인됨 (브레인스토밍 → spec)
- 대상: Krobi 데스크톱 다마고치 앱 — 프론트엔드 인터랙션(App.tsx/Pet) + Tauri 창 제어 + `add-pet` 스킬 정리
- 선행 문서: `docs/superpowers/specs/2026-06-16-krobi-pet-evolution-pipeline-design.md` (아트/진화 파이프라인). 본 문서는 그 위에 **런타임 UX·창 제어·정리**를 얹는다.

## 1. 목표 / 범위

현재 앱은 하늘색 패널 + 상태바(시장기/청결) + 버튼 2개(밥주기/청소하기) 위에 펫을 띄운다. 본 설계는 이를 **"투명 창에 펫만 떠 있고, 클릭/우클릭/드래그로 상호작용하는"** 다마고치로 개편하고, 캐릭터가 잘리지 않도록 런타임 자동 맞춤을 넣고, `add-pet` 스킬과 불필요 파일을 정리한다.

### 1.1 인 스코프

- **레이아웃**: 패널·상태바·버튼 제거 → 투명 프레임리스 창에 펫만.
- **스탯 단일화**: 청결(cleanliness) 제거, **포만감(satiety) 단일 스탯**.
- **인터랙션**: 펫 좌클릭 → happy 1회, 우클릭 → 컨텍스트 메뉴(밥주기 / 크기 조절), 좌클릭 드래그 → 창 이동.
- **리사이즈 모드**: 격자 가이드 + 핸들로 창 리사이즈, O(저장)/X(취소). 저장 크기는 영구 저장·복원.
- **클리핑 런타임 QA**: 스프라이트 시트의 불투명 픽셀 경계를 측정해 어떤 캐릭터든 머리가 안 잘리게 창/펫 표시 영역 산정.
- **애니메이션 계약 정리**: 4종(idle/eat/happy/sad) 모두 8프레임 계약 보장. sad 8프레임 루프로 정의.
- **`add-pet` 스킬 정리**: 긴 SKILL.md(298줄)의 프롬프트 블록·템플릿을 `references/`로 분리.
- **불필요 파일 삭제**: `_incoming/` 스크래치, 미사용 에셋, 데모 코드.

### 1.2 아웃 오브 스코프

- **krobi 실제 sad 아트 생성**: 본 spec은 sad **계약·동작·placeholder**까지만. 실제 sad 8프레임 아트는 추후 `add-pet` 프롬프트로 재생성(사용자 수동 이미지 작업 필요).
- **업무 추적 런타임**(스탯 적립/진화 트리거), **멀티펫/진화 폼 런타임 로더**.
- 즉 본 결과물은 *현재 단일 펫(krobi stage1)을 대상으로 한 UX·창 제어·정리*까지다.

## 2. 컴포넌트 설계

각 컴포넌트는 독립적으로 이해·검증 가능하도록 분리한다.

### A. 창 · 레이아웃

- `App.tsx`의 하늘색 패널 div, `Bar` 컴포넌트, 상태바 2개, 버튼 2개(밥주기/청소하기) 제거.
- 루트는 **투명 배경 + 펫만** 중앙 배치. 그림자는 기존 `set_shadow(false)` 유지.
- 펫은 고정 128px이 아니라 **창 콘텐츠 영역에 맞춰 스케일**(섹션 F가 크기를 결정). `image-rendering: pixelated` 유지.

### B. 스탯 · 애니메이션

- 저장 타입에서 `cleanliness` 제거. `status: { satiety: number }`로 변경(기존 `hunger` 의미 계승).
  - **마이그레이션**: 기존 저장 파일에 `hunger`만 있으면 `satiety`로 읽고, `cleanliness`는 무시. 값 없으면 기본 100.
- 감소 루프: `satiety -= HUNGER_RATE`(분당 1)만. `CLEAN_RATE`/청결 차감 제거. 오프라인 보정도 satiety만.
- `baseAnimation(satiety)`: `satiety < 30 → "sad"`, 아니면 `"idle"`. (cleanliness 인자 삭제, `LOW_THRESHOLD = 30` 유지)
- **좌클릭 → happy**: oneShot "happy" 1회 재생 후 idle 복귀(`then: "idle"`). 단, **드래그와 구분**(섹션 C).
- **밥주기**: satiety +20, clamp(100). 우클릭 메뉴에서 호출(섹션 D). `clean()` 함수 삭제.

### C. 드래그 이동 (좌클릭 충돌 해소)

- 기존 `data-tauri-drag-region` 의존 제거(macOS transparent 창에서 불안정 추정).
- **수동 드래그**: 펫 영역 `onMouseDown`(좌버튼)에서 시작점 기록. `onMouseMove`에서 임계값(4px) 초과 이동 시 1회 `getCurrentWindow().startDragging()` 호출 + `dragged=true` 마킹. `onMouseUp`에서 `dragged===false`면 **클릭 = happy** 트리거.
- 결과: 가볍게 누르면 happy, 끌면 창 이동. 단일 좌버튼으로 두 동작을 임계값으로 분기.

### D. 우클릭 컨텍스트 메뉴

- 펫 영역 `onContextMenu`(기본 메뉴 `preventDefault`) → 커서 좌표에 **커스텀 React 메뉴** 표시. 네이티브 OS 메뉴 대신 커스텀(리사이즈 오버레이와 톤 일치, 스타일 제어).
- 항목:
  - **밥주기** → 섹션 B의 feed(+20) 실행, 메뉴 닫기.
  - **크기 조절** → 리사이즈 모드 진입(섹션 E), 메뉴 닫기.
- 메뉴 바깥 클릭/Esc → 닫기.

### E. 리사이즈 모드

- 진입 시 펫 주변에 **격자 가이드 오버레이** + 우하단 **드래그 핸들** 렌더.
- 핸들 드래그 → 실시간 `getCurrentWindow().setSize(new LogicalSize(w, h))`. 펫은 창에 맞춰 스케일(섹션 F). 비율은 콘텐츠 종횡비 유지(정사각 셀 기준).
- 격자 **우측 상단에 O / X 아이콘**:
  - **O(저장)**: 현재 창 크기를 store(`krobi_data.json`)에 영구 저장 → 다음 실행 시 복원. 모드 종료.
  - **X(취소)**: 진입 직전 크기로 `setSize` 복원. 모드 종료.
- OS 가장자리 리사이즈는 비활성(핸들 경유만). `tauri.conf.json`은 `resizable`를 프로그램 `setSize`가 동작하도록 설정.

### F. 클리핑 런타임 자동 맞춤 (QA)

- 목적: **어떤 캐릭터든** 머리/끝이 잘리지 않게 표시.
- 알고리즘:
  1. 로드시 sheet.png를 오프스크린 `<canvas>`에 그려 픽셀 접근.
  2. 매니페스트의 모든 애니 셀을 순회, **불투명(alpha>threshold) 픽셀의 합집합 경계 박스**(셀 로컬 좌표, 모든 프레임 최대 포함)를 계산.
  3. 그 콘텐츠 박스(+여백 마진)를 기준으로 펫 표시 배율과 **기본 창 크기**를 산정. 표시 영역은 콘텐츠를 잘림 없이 포함.
- 우선순위: **사용자가 O로 저장한 크기가 있으면 그것 우선**, 없으면 자동 맞춤값을 기본으로 사용.
- 펫 렌더는 셀 전체(또는 콘텐츠 박스)를 표시 영역에 fit. 정수 배율 권장(픽셀 또렷함 유지), 어려우면 근사.

### G. 애니메이션 계약

- 매니페스트 계약: idle/eat/happy/sad **각 8프레임**. idle/eat/happy는 이미 8프레임(셀 0–23).
- sad: **8프레임 루프** 계약으로 manifest 정의(`frames` 길이 8). krobi 실제 sad 아트는 미생성이므로 당장은 placeholder 셀로 채우되(현재 idle 복사), **계약 길이는 8**로 맞춘다. 실제 아트 재생성 시 셀 24–31로 교체.
- `usePetAnimation`은 manifest의 `frames` 길이를 그대로 재생 → 아트만 교체되면 자동 8프레임 재생.

### H. add-pet 스킬 정리

- `.claude/skills/add-pet/SKILL.md`(298줄)에서 다음을 `.claude/skills/add-pet/references/`로 분리:
  - `animation-prompts.md` — INVARIANTS+MOTION 4블록.
  - `templates.md` — manifest draft/packed, species.json, catalog.json 템플릿.
- SKILL.md에는 워크플로우(Step 1–9) + 위 참조 링크만 남김. 목표 분량 ~120줄 이하.

### I. 불필요 파일 삭제

- 실삭제 전 목록을 사용자에게 확인. 후보:
  - `src/assets/pets/_incoming/*` 스크래치/프리뷰/raw PNG.
  - `.DS_Store` 파일들.
  - 미사용 `src/assets/react.svg`.
  - `src-tauri/src/lib.rs`의 데모 `greet` 커맨드 + `invoke_handler` 등록.

## 3. 데이터 / 상태 흐름

```
[로드] store.get(pet) → satiety 보정(오프라인) → 저장 크기 있으면 setSize
   ↓
[런타임] satiety 감소 틱(60s) → baseAnimation(satiety) = idle|sad 루프
   ↓
[좌클릭(이동 없음)] → oneShot "happy" → 끝나면 idle/sad 복귀
[좌드래그(>4px)]   → startDragging()
[우클릭]          → 메뉴: 밥주기(satiety+20) | 크기 조절 → 리사이즈 모드(O 저장 / X 취소)
```

- 영속: `krobi_data.json`에 `pet`(satiety 포함) + `window_size`(O 저장 시).

## 4. 파일 영향 범위

- `src/App.tsx` — 레이아웃/스탯/인터랙션/메뉴/리사이즈 상태(가장 큰 변경). 비대해지면 훅/컴포넌트 분리(예: `useWindowDrag`, `ContextMenu`, `ResizeOverlay`).
- `src/pet/animation.ts` — `baseAnimation` 시그니처 단순화.
- `src/pet/Pet.tsx` — 표시 배율 fit, 드래그/클릭 핸들러 연동.
- `src/pet/*` — 클리핑 측정 유틸 신규(예: `measureContentBounds.ts`), 단위 테스트.
- `src/assets/pets/krobi/stage1/manifest.json` — sad 8프레임 계약.
- `src-tauri/tauri.conf.json` — 창 resize 관련 설정.
- `src-tauri/src/lib.rs` — 데모 코드 제거.
- `src-tauri/capabilities/default.json` — window setSize/startDragging 권한 확인/추가.
- `.claude/skills/add-pet/` — SKILL.md 축소 + references 분리.

## 5. 테스트 / 검증

- **단위(Vitest)**: `baseAnimation`(satiety<30→sad), 클리핑 경계 측정 유틸(합집합 박스 계산), 드래그 클릭/드래그 분기 로직(임계값).
- **수동/통합**: `npm run tauri dev`로 — (1) 패널 없이 펫만, (2) 좌클릭 happy, (3) 드래그 이동, (4) 우클릭 메뉴 밥주기, (5) 리사이즈 모드 O/X, (6) 재실행 시 저장 크기 복원, (7) 머리 안 잘림.
- **성공 기준**: 12개 검토 항목이 각각 위 검증으로 확인됨(sad 실제 아트는 계약/placeholder까지).

## 6. 위험 / 미해결

- `startDragging` 호출 타이밍과 OS 드래그 루프 진입 후 `mouseup` 누락 가능성 → 클릭/드래그 분기 견고성 수동 검증 필요.
- 캔버스 픽셀 접근 시 에셋 로드 타이밍(이미지 onload) — 측정 전 펫 표시 깜빡임 방지(초기 숨김 후 측정 완료 시 표시).
- 권한: Tauri v2 capabilities에 `core:window:allow-set-size`, `allow-start-dragging` 등 필요 시 추가.
