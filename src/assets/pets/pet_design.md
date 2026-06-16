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
