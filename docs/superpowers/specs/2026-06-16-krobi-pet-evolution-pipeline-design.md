# Krobi 펫 진화 아트 파이프라인 — 설계 문서

- 작성일: 2026-06-16
- 상태: 승인됨 (브레인스토밍 → spec)
- 대상: Krobi 데스크톱 다마고치 앱 — `add-pet` 스킬 + `tools/extract_sprites.py` 재정비
- 선행 문서: `docs/superpowers/specs/2026-06-16-krobi-pet-art-pipeline-design.md` (단일 형태 12프레임 파이프라인). 본 문서는 그 위에 **진화·도감·스타일 규칙 분리**를 얹는다.

## 1. 목표 / 범위

기존 `add-pet` 스킬은 "단일 형태·12프레임(idle/eat/happy/sad)"까지만 책임진다. 본 설계는 이를 **3단계 진화 + 분기**를 만들 수 있는 파이프라인으로 확장하고, 스타일 일관성·컨셉 중복 방지·진화 공식을 데이터로 강제한다.

### 1.1 인 스코프

- **잠긴 스타일 규칙 분리**: SKILL.md에 하드코딩된 Style Bible을 `pet_design.md`로 분리해 단일 진실원천화.
- **펫 도감**: `catalog.json` — 종 추가 전 컨셉/모티프/색 충돌 차단, 추가 성공 시 자동 append.
- **진화 데이터 구조**: 종별 `species.json` (진화 트리 + 분기 화이트리스트 + 추상 분기 조건).
- **형태 단위 매니페스트**: 폴더 하나 = 한 형태(표준 32프레임: idle/eat/happy/sad 각 8), `frameSize` 형태별 가변.
- **`add-pet` 스킬 재작업**: 인터뷰 확장, 스타일 규칙 주입, 프레임 순서/진화 연속성 강제, 7형태 생성 흐름, 검수 게이트.
- **`extract_sprites.py`**: 최소 변경(형태별 `--size`만 다르게 호출).

### 1.2 아웃 오브 스코프 (별도 spec / 이후 phase)

- **업무 추적 런타임** (활성 앱 감지 → 카테고리별 스탯 적립 → 진화 트리거). 본 spec은 분기 조건을 추상 `stat ≥ 임계` 필드로만 잡아두고, 어떤 업무가 어떤 스탯을 올리는지는 **별도 spec**에서 정의한다.
- **진화 전환 연출**(런타임 애니메이션), **멀티펫/진화 폼 런타임 로더 구현**.
- 즉 본 결과물은 *데이터 구조 + 스킬 + 7형태를 만들 수 있는 제작 파이프라인*까지다. 런타임 코드(App.tsx 로더)는 변경하지 않는다.

## 2. 진화 토폴로지

한 종(species)당 **7형태**:

```
stage1 (유년기, 분기 없음)
  ├─ stage2-<branchA> (성장기)  ─→ stage3-<branchA> (성숙기)
  ├─ stage2-<branchB>           ─→ stage3-<branchB>
  └─ stage2-<branchC>           ─→ stage3-<branchC>
```

- 한 형태 = 32프레임(idle/eat/happy/sad 각 8). 7형태 = **224프레임 권위본**. (기존 `krobi/stage1`도 새 스타일·8프레임으로 재생성.)
- 한 플레이에서 플레이어가 보는 경로는 `stage1 → stage2-X → stage3-X` = 3형태. 어느 분기든 도달 가능하므로 7형태 전부를 author한다.
- 분기 선택은 **업무 행동 기반**(특정 업무에 시간을 쏟으면 해당 카테고리 스탯이 오르고, 임계 돌파 시 그 분기로 진화). 트리거 메커니즘이 무엇이든 **아트는 7형태를 동일하게 만들어야** 하므로, 본 spec의 아트 파이프라인은 트리거 구현과 독립이다.

## 3. 디렉터리 / 파일 레이아웃

```
src/assets/pets/
  catalog.json                    # 전체 도감 인덱스 (중복방지용, 스킬이 자동 append)
  pet_design.md                   # 잠긴 스타일 규칙(Style Bible) — 단일 진실원천
  _incoming/                      # 나노바나나 원본 스트립 투입구 (작업용, 커밋 제외)
  <species>/
    species.json                  # 진화 트리 + 분기 화이트리스트(공식) + 메타
    stage1/            sheet.png + manifest.json     # 유년기 (분기 없음)
    stage2-<branchA>/  sheet.png + manifest.json     # 성장기 3분기
    stage2-<branchB>/  …
    stage2-<branchC>/  …
    stage3-<branchA>/  sheet.png + manifest.json     # 성숙기 3형태 (각 2단계 직선 계승)
    stage3-<branchB>/  …
    stage3-<branchC>/  …
tools/
  extract_sprites.py
  venv/
```

- **결정**: 진화 정의는 전역 `evolution.json` 하나로 모으지 않고 **종별 `species.json` 자족형**으로 둔다. 종 단위 추가/삭제·리뷰가 쉽고, 한 종의 모든 정보가 한 폴더에 모인다.
- 기존 `krobi/`는 마이그레이션 시 `krobi/stage1/`로 이동하고 `species.json`을 신설한다(§9).

## 4. `pet_design.md` — 잠긴 스타일 규칙

현재 SKILL.md에 하드코딩된 Style Bible + 레퍼런스 라인을 이 파일로 이관한다. 스킬은 프롬프트를 만들 때 이 파일을 읽어 그대로 주입한다(중복 정의 금지 — 스킬은 참조만).

담을 섹션:

1. **그림체 규칙 (Style Bible)**: 심플 HD(Octopath 계열 한 단계 단순화), 치비 비율·큰 눈, ~32색 팔레트, 소프트 셀 셰이딩(그림자 1~2톤), 얇은 아웃라인, 매직핑크 `#ff00ff` 배경, LARGE/high-res 렌더, 금지항목(텍스트/UI/다중 개체/그라데이션 과다/3D 셰이딩/바닥 그림자).
2. **프레임 순서 규칙**: 연속 동작은 **번호 매긴 스토리보드**로 기술하고 인과 순서를 강제한다(예: "F1 칼집에서 칼을 뽑는다 → F2 치켜든다 → F3 내려벤다"). 순차 동작 생성 시 **직전 프레임을 레퍼런스로 첨부**한다.
3. **진화 연속성 규칙(공식)**: 각 진화 형태의 프롬프트는 **직전 단계 형태의 프레임을 레퍼런스로 첨부**하고 실루엣·정체성을 유지한다. 형태 급변 금지(슬라임→인간/기계 불가). 허용되는 것은 **점진적 장식·크기·부속 추가**(슬라임이 망토→왕관, 작은 악마의 뿔이 커지고 뒤에 불이 떠다님 등).

## 5. `catalog.json` — 도감 (중복 방지)

```json
{
  "species": [
    {
      "id": "krobi",
      "displayName": "크로비",
      "archetype": "slime",
      "concept": "둥근 청록 블롭",
      "claimedMotifs": ["슬라임", "왕관", "망토"],
      "claimedColors": ["청록", "민트"],
      "branches": ["humanoid", "spirit", "dragon"]
    }
  ]
}
```

- 신규 종 인터뷰 **전에** 스킬이 이 파일을 읽어 컨셉/모티프/색/아키타입 충돌을 검사하고, 겹치면 사용자에게 알린다.
- 종 추가가 성공적으로 끝나면 스킬이 해당 종 엔트리를 자동 append 한다(수기 관리 금지 — 곧 어긋나기 때문).
- `branches`는 §6의 `branchWhitelist`와 동일 값으로 미러링(인덱스 용도).

## 6. `species.json` — 진화 트리 + 공식

```json
{
  "id": "krobi",
  "archetype": "slime",
  "branchWhitelist": ["humanoid", "spirit", "dragon"],
  "forms": {
    "stage1":          { "frameSize": 64 },
    "stage2-humanoid": { "frameSize": 64, "from": "stage1",
                         "condition": { "stat": "writing", "gte": 100 } },
    "stage2-spirit":   { "frameSize": 64, "from": "stage1",
                         "condition": { "stat": "research", "gte": 100 } },
    "stage2-dragon":   { "frameSize": 64, "from": "stage1",
                         "condition": { "stat": "coding", "gte": 100 } },
    "stage3-humanoid": { "frameSize": 96, "from": "stage2-humanoid",
                         "condition": { "stat": "writing", "gte": 300 } },
    "stage3-spirit":   { "frameSize": 96, "from": "stage2-spirit",
                         "condition": { "stat": "research", "gte": 300 } },
    "stage3-dragon":   { "frameSize": 96, "from": "stage2-dragon",
                         "condition": { "stat": "coding", "gte": 300 } }
  }
}
```

- `archetype` + `branchWhitelist` = **진화 공식**. 종 생성 시 아키타입에 맞는 스타일만 화이트리스트에 넣는다(슬라임은 angel/plant 불가). 스타일 풀 예시: `beast, humanoid, machine, spirit, morph, human, angel, demon, dragon, plant, …`.
- `forms` = 진화 그래프. 각 노드는 한 형태(폴더), `from`은 부모 노드(간선), `condition`은 분기 조건.
- `condition.stat` = **추상 업무 카테고리 문자열**. 본 spec에서는 스키마와 예시 값만 확정하고, 카테고리 목록·적립 규칙·임계 튜닝은 업무추적 spec에서 정의한다. (gte/임계 숫자는 placeholder.)
- `frameSize`는 형태별 가변. 성숙기는 96 등으로 키울 수 있다(런타임 창 크기 확대는 이후 phase). `PetManifest.frameSize` 타입이 이미 지원한다.

## 7. `sheet.png` + `manifest.json` (형태 단위)

형태 폴더마다 **스프라이트 시트 1장(`sheet.png`) + manifest.json 1개**. 개별 프레임 PNG는
`tools/pack_sheet.py`로 격자 시트(열 수 `columns`)에 병합되고, manifest의 `frames`는 시트
**셀 인덱스**(좌→우, 위→아래)가 된다. `id`는 `<species>/<form>` 경로로 식별된다.

```json
{
  "id": "krobi/stage1",
  "frameSize": 64,
  "displayScale": 2,
  "sheet": "sheet.png",
  "columns": 8,
  "animations": {
    "idle":  { "frames": [0, 1, 2, 3, 4, 5, 6, 7], "fps": 8, "loop": true },
    "eat":   { "frames": [8, 9, 10, 11, 12, 13, 14, 15], "fps": 10, "loop": false, "then": "idle" },
    "happy": { "frames": [16, 17, 18, 19, 20, 21, 22, 23], "fps": 10, "loop": false, "then": "idle" },
    "sad":   { "frames": [24, 25, 26, 27, 28, 29, 30, 31], "fps": 4, "loop": true }
  }
}
```

- 애니메이션 세트(idle/eat/happy/sad)는 모든 형태에서 동일 표준(각 동작 8프레임 = 32프레임) 유지.
- `frameSize`만 형태별로 다를 수 있다(예: stage3 = 96). 시트 크기 = `columns × frameSize` × `행수 × frameSize`.
- 런타임은 `background-position`으로 셀 하나를 잘라 `displayScale`로 확대 렌더(`image-rendering: pixelated`).

## 8. `add-pet` 스킬 재작업

### 8.1 인터뷰 (확장)

1. **species id** — kebab-case 슬러그 → `src/assets/pets/<species>/`.
2. **display name** — 인게임 표시명.
3. **archetype** — 종의 기본 형태(slime/beast/dragon …).
4. **concept** — 1단계 유년기의 형태/색/모티프 1~2문장.
5. **branch whitelist (3개)** — 아키타입에 맞는 도달 가능 스타일 3개(공식). `catalog.json`과 충돌 검사.
6. **style reference** — 일관성용 첨부 프레임. 기본 `src/assets/pets/krobi/stage1/idle_0.png`.

인터뷰 시작 전 `catalog.json`을 읽어 컨셉/모티프/색/아키타입 중복을 차단한다.

### 8.2 프롬프트 생성

각 형태×각 애니메이션마다 붙여넣기용 프롬프트 = **`pet_design.md` 주입(읽어서) + 레퍼런스 라인 + 해당 애니의 INVARIANTS+MOTION 블록**.

- 연속 동작은 **번호 스토리보드**로 MOTION을 기술해 인과 순서 강제.
- **진화 형태(stage2/3)**는 프롬프트에 **직전 단계의 프레임을 레퍼런스로 첨부**하도록 안내(정체성·실루엣 유지).
- 사용자에게 매번 고지: 매직핑크 배경, LARGE 렌더, 레퍼런스 첨부, 결과를 `_incoming/<species>_<form>_<anim>.png`로 저장.

### 8.3 생성 단위 / 순서

작업 단위 = **한 형태(표준 32프레임)**. 7형태를 순서대로 안내: `stage1 → stage2-A/B/C → stage3-A/B/C`. 진화 형태는 반드시 직전 단계가 먼저 완성돼 있어야 레퍼런스로 쓸 수 있다.

### 8.4 추출 / 검수 게이트

- 추출: 형태별 폴더로 `extract_sprites.py` 실행(§9의 `--size`만 형태에 맞게). 예:
  ```bash
  tools/venv/bin/python tools/extract_sprites.py \
    src/assets/pets/_incoming/<species>_stage1_idle.png \
    --out src/assets/pets/<species>/stage1 --names idle_0,idle_1,idle_2 \
    --size 64 --colors 32 --tol 120 --anchor bottom \
    --preview src/assets/pets/_incoming/<species>_stage1_idle_preview.png
  ```
- 검수: `_preview.png`를 Read 해 **프레임 수·순서(인과)·정체성·접지**를 확인. 어긋나면 `--tol` 조정 후 재추출하거나 사용자에게 재생성 요청(반려 루프).

### 8.5 마무리

형태별 `manifest.json` + 종 `species.json` 작성, `catalog.json`에 종 엔트리 append. 프레임 + 매니페스트 + species/catalog 커밋.

## 9. `extract_sprites.py`

로직 변경 없음. 호출 시 형태별 `--size`(64/96 등)와 `--out` 폴더만 다르게 준다. 추출기는 검증된 상태이며 본 작업에서 손보지 않는다.

## 10. 마이그레이션 (기존 krobi)

- 기존 `src/assets/pets/krobi/`(12프레임 + manifest.json)을 `src/assets/pets/krobi/stage1/`로 이동.
- `krobi/manifest.json`의 `id`를 `krobi/stage1`로 갱신.
- `krobi/species.json` 신설(archetype=slime, branchWhitelist 결정, forms.stage1만 우선 채움; 나머지 형태는 추후 제작).
- `catalog.json` 생성 후 krobi 엔트리 추가.
- 런타임 로더는 본 spec에서 바꾸지 않으므로, 앱이 `krobi/stage1/manifest.json`을 가리키도록 하는 경로 갱신만 최소로 반영(또는 마이그레이션을 런타임 변경이 필요한 phase로 미룬다 — 구현 계획에서 결정).

## 11. 성공 기준 (검증 방법)

1. `pet_design.md`가 존재하고 `add-pet` 스킬이 Style Bible을 하드코딩하지 않고 이 파일을 참조한다.
2. `catalog.json` 스키마대로 종 인덱스가 기록되고, 스킬이 추가 전 충돌을 검사하며 추가 후 append 한다.
3. 한 종 폴더에 `species.json` + 7형태 폴더 구조(각 manifest + 표준 프레임 세트)가 스키마대로 생성 가능하다.
4. `species.json`의 `branchWhitelist`가 아키타입에 맞는 스타일만 허용하고, `forms` 그래프가 `stage1 → stage2-X → stage3-X` 위상을 표현한다.
5. 진화 형태 프롬프트가 직전 단계 프레임을 레퍼런스로 첨부하도록 안내하고, 연속 동작이 번호 스토리보드로 순서 강제된다.
6. 기존 krobi가 `krobi/stage1/`로 마이그레이션되고 회귀 없이 로드된다(런타임 변경 범위는 구현 계획에서 확정).

## 12. 미해결 / 위험

- **형태 간 일관성**은 "직전 단계 프레임을 레퍼런스로" 강제하지 않으면 무너진다 → 스킬이 항상 강제.
- **분기 화이트리스트**를 아키타입과 무관하게 열면 진화 공식이 깨진다 → 종 생성 시점에 화이트리스트 확정·검증.
- **업무 카테고리(`condition.stat`) 값**은 본 spec에서 placeholder. 업무추적 spec 확정 전까지 임계/카테고리는 잠정값.
- **224프레임/종**의 생성·검수 부담이 크다 → 형태 단위로 끊어 진행, 후반 형태는 품질 우선 검수 루프 유지.
- **런타임 로더**는 본 spec 밖. 마이그레이션이 앱 로드 경로에 닿는 부분은 구현 계획에서 최소 변경으로 다룬다.
