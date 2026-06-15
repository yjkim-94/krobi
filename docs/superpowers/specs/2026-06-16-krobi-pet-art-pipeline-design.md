# Krobi 펫 아트 & 애니메이션 시스템 — 설계 문서

- 작성일: 2026-06-16
- 상태: 승인됨 (브레인스토밍 → spec)
- 대상: Krobi(크로비) macOS 데스크톱 다마고치 앱, Phase 1 이후 아트 교체 작업

## 1. 목표 / 범위

이모지(🐤)로 임시 표현된 펫을 **HD 픽셀 아트 진화 몬스터**로 교체하고, 게임 상태에
반응하는 스프라이트 애니메이션을 붙인다.

- **MVP 범위**: 유년기 몬스터 **'크로비' 1마리**, 4종 애니메이션(idle/eat/happy/sad).
- **펫 컨셉**: 디지몬형 — 유년기는 형태가 덜 다듬어진 블롭, 진화하면 동물형·인간형·공룡형
  등으로 변화. (진화 구현은 Phase 2, 본 설계는 구조만 열어둠.)
- **비목표(Phase 2 이후)**: 진화 전환 연출, sleep/사망 등 추가 상태, 다중 몬스터 도감,
  바닥 그림자 자동 정리.

## 2. 에셋 사양

- 원본 해상도 **64×64**, 화면 표시 **×2 = 128px**, `image-rendering: pixelated`.
- 투명 배경 PNG (투명 창 위에 떠야 함).
- 팔레트 ~32색, "심플 HD" 음영 (Octopath Traveler 계열을 한 단계 단순화한 수준).
- **바닥-가운데 정렬 + 공통 배율**: 한 애니메이션 내 프레임들은 동일 배율로 스케일하고
  바닥 기준으로 배치 → squash/stretch 시 크기 점프 없이 접지 상태 유지.

### 프레임 세트 (총 12장)

| 애니 | 프레임 | fps | 루프 | 비고 |
|---|---|---|---|---|
| idle | idle_0, idle_1, idle_2 | 4 | ✅ | 호흡 시퀀스 0→1→0→2 |
| eat | eat_0, eat_1, eat_2, eat_3 | 8 | ❌ | 1회 재생 후 idle 복귀 |
| happy | happy_0, happy_1, happy_2 | 8 | ❌ | 1회 재생 후 idle 복귀 |
| sad | sad_0, sad_1 | 2 | ✅ | 저스탯 시 idle 대체 |

## 3. 디렉터리 구조

```
src/assets/pets/
  _incoming/          # 나노바나나 원본 스트립 투입구 (작업용, 빌드/커밋 제외)
  krobi/
    idle_0.png … sad_1.png   # 추출된 최종 프레임 (12장)
    manifest.json            # 애니메이션 정의
tools/
  extract_sprites.py  # 스프라이트 추출기 (완성·검증됨)
  make_anim_preview.py# 애니 미리보기 생성기 (검수용)
  venv/               # Pillow/numpy 전용 파이썬 환경 (커밋 제외)
```

## 4. 제작 파이프라인 (검증 완료)

생성의 정밀/일관성은 AI에 맡기지 않고 추출기 코드가 강제한다.
역할 분담: **생성 = 나노바나나(대략적 레이아웃·내용) / 정밀·일관성 = 추출기.**

```
1. 나노바나나로 매직핑크(#ff00ff) 배경 위 프레임 스트립 생성
   - eat/happy/sad 생성 시 idle_0.png를 레퍼런스 이미지로 첨부 → 동일 개체 유지
   - "render large/high-res, 균등 배치, 넉넉한 간격" 요청 (정확한 px는 요구하지 않음)
2. PNG를 src/assets/pets/_incoming/ 에 투입
3. tools/extract_sprites.py 실행:
     배경 크로마키 제거 → 빈 띠 기반 행/칸 자동 탐지 → 타이트 크롭
     → 공통 배율 + 바닥 정렬로 64×64 배치 → ~32색 양자화 → 프레임 저장
4. tools/make_anim_preview.py 로 재생 미리보기 생성, 육안 검수
5. 합격이면 src/assets/pets/<id>/ 에 확정
```

### 추출기 인터페이스 (tools/extract_sprites.py)

```
python tools/extract_sprites.py INPUT.png \
  --out src/assets/pets/krobi --names idle_0,idle_1,idle_2 \
  --size 64 --colors 32 --tol 120 --anchor bottom \
  --preview src/assets/pets/_incoming/preview.png
```

- `--names` 미지정 시 frame_0.. 자동 명명.
- `--anchor bottom`(기본): 애니 프레임용 바닥 기준. `center`도 지원.
- `--per-frame-fit`: 끄면(기본) 공통 배율로 크기 일관, 켜면 각 프레임 개별 꽉채움.
- `--key auto`: 배경색 자동 감지(모서리 샘플). 기본은 `ff00ff`.

## 5. manifest.json (에셋 ↔ 코드 인터페이스)

```json
{
  "id": "krobi",
  "frameSize": 64,
  "displayScale": 2,
  "animations": {
    "idle":  { "frames": ["idle_0","idle_1","idle_0","idle_2"], "fps": 4, "loop": true },
    "eat":   { "frames": ["eat_0","eat_1","eat_2","eat_3"], "fps": 8, "loop": false, "then": "idle" },
    "happy": { "frames": ["happy_0","happy_1","happy_2"], "fps": 8, "loop": false, "then": "idle" },
    "sad":   { "frames": ["sad_0","sad_1"], "fps": 2, "loop": true }
  }
}
```

- `frames`: 같은 디렉터리의 PNG 파일명(확장자 제외) 배열. 재생 순서 그대로.
- `loop`: true면 무한 반복. false면 1회 재생 후 `then` 애니로 전환.
- `displayScale`: 표시 배율(원본×scale = 화면 px).

## 6. 런타임 통합 (App.tsx)

- 신규 컴포넌트 **`<Pet animation={state} />`** 가 기존 이모지 `<span>`을 대체.
- 훅 **`usePetAnimation(manifest)`**: 모든 프레임 이미지 프리로드 후 현재 애니의
  fps에 맞춰 프레임 `<img>`를 교체. `loop:false` 종료 시 `then` 애니로 전환.
- 렌더: `<img>` width/height = `frameSize * displayScale`(=128px), `image-rendering: pixelated`.
- **기존 decay/store 로직은 변경하지 않는다** (펫 렌더링 부분만 교체 — 최소 변경).

## 7. 애니메이션 상태 머신

```
기본 상태 결정:
  hunger < 30 || cleanliness < 30  → "sad" (루프)
  그 외                            → "idle" (루프)

이벤트:
  밥주기 클릭 → "eat"   1회 재생 → 종료 후 기본 상태 재계산
  청소 클릭   → "happy" 1회 재생 → 종료 후 기본 상태 재계산
```

- 임계값 `LOW = 30` (조정 가능 상수).
- eat/happy 재생 중에는 기본 상태 전환을 보류하고, 종료 시 현재 스탯으로 idle/sad 재결정.

## 8. 진화 대비 (구조만, 구현은 Phase 2)

- `src/assets/pets/<id>/manifest.json` 패턴이 곧 몬스터/형태 도감. id 추가로 확장.
- 진화 후반 형태는 창 크기를 키워(예: 280×280) 더 큰 스프라이트를 수용
  (Phase 1에서 정한 "원본 64, 진화 후반 창 확대" 방침과 일치).

## 9. 성공 기준 (검증 방법)

1. `tools/extract_sprites.py`로 12프레임 추출 → `src/assets/pets/krobi/`에 존재.
2. 앱 실행 시 idle 호흡 루프가 재생된다.
3. 밥주기 → eat 1회 재생 후 idle 복귀 / 청소 → happy 1회 재생 후 복귀.
4. hunger 또는 cleanliness < 30 → sad 루프로 전환.
5. 픽셀이 또렷(128px, pixelated)하고 기존 decay/저장 동작에 회귀 없음.

## 10. 미해결 / 위험

- 나머지 9프레임(eat·happy·sad)은 사용자가 나노바나나로 생성해야 진행 가능.
  idle_0.png를 레퍼런스로 첨부해 일관성 확보.
- eat/happy/sad의 idle 대비 외형 일관성은 생성 품질에 의존 → 추출 후 검수 루프로 보정.
- 바닥 잔여 그림자(미세)는 현재 접지감으로 허용. 필요 시 추출기 후처리로 제거.

## 11. 검증된 사실 (스파이크 결과)

- 나노바나나 1장 생성 → 추출기 자동 처리만으로 idle 3프레임이 일관되게 추출됨.
- 프레임 간 정체성 유지(동일 슬라임, 모션만 변화) 확인.
- 64px + 32색 정리 후에도 "심플 HD" 느낌 유지, 바닥 정렬로 호흡 애니 자연스러움.
