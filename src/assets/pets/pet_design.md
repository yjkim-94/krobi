# Krobi 펫 스타일 규칙 (잠금 — 단일 진실원천)

모든 펫/형태 프롬프트는 이 파일을 그대로 주입한다. 스킬은 이 규칙을 복제하지 말고 참조만 한다.

시각 기준(앵커): `src/assets/pets/style_ref_roster.png` (Octopath/HD-2D 캐릭터 로스터).
아래 Style Bible은 이 이미지의 **렌더링 기법**(픽셀밀도·팔레트·아웃라인·셰이딩·데포르메)을
글로 옮긴 것이다. 단, 이 로스터는 인간형이므로 **프롬프트 첨부용 레퍼런스로는 쓰지 않는다**
(첨부 시 생성물이 인간형으로 끌려가 진화 규칙과 충돌). 첨부 레퍼런스는 항상 같은 개체의
이전 프레임/단계를 쓴다(§2, §3).

## 1. 그림체 규칙 (Style Bible)

```
HD-2D pixel art, "simple HD" JRPG overworld-sprite style (Octopath Traveler / HD-2D lineage).

[PROPORTIONS] Super-deformed mini-heroic build, ~2.5 heads tall for bipedal forms
(sturdier and taller than 1:1 chibi; never realistic). Large head/main mass, short
sturdy limbs, compact grounded stance. For non-bipedal creatures (blob, quadruped),
a compact rounded mass with the same restraint.
[FACE/EYES] Small simple eyes: 1-3 px dark almond/dot eyes with at most a single 1px
highlight; expressive via shape and brow, NOT via size. Minimal few-pixel nose/mouth.
NO big glossy anime/chibi eyes, no large white sclera.
[OUTLINE] NO black keyline. Selective/colored outlining only: edge pixels are a darker
shade of the adjacent LOCAL color (dark-teal edge on a teal body, dark-brown on brown
cloth). The silhouette reads by value contrast against the background, not a black
border. Separate interior forms with shading, not black lines.
[PALETTE] Muted, desaturated, earthy palette: warm browns, creams, olive/forest greens,
muted brick reds, slate blue-greys, soft golds. Low-to-medium saturation, slightly
grayed and harmonious. Small coherent palette per creature (~12-24 colors total).
NO neon, no pure-saturated primaries, no gradients/airbrush.
[SHADING] Soft banded cel shading: per material a base tone + 1 shadow + occasional
1 highlight (2-3 value steps). Consistent light from upper-left. Tiny specular dots
only on metal/wet surfaces. NO smooth gradients, no 3D/realistic rendering.
[PIXELS] Clean, deliberate pixel clusters; crisp readable edges; minimal hand
antialiasing at key curves only; NO dithering, no stray/noisy pixels. Render LARGE
but designed to read cleanly when downscaled to ~64 px.
[CANVAS] Solid flat magenta #ff00ff background only (for keying), creature centered,
no baked ground shadow.

Creature: <<<USER CONCEPT HERE>>>

Do NOT: text, UI, multiple creatures per frame, black keyline outline, big anime/chibi
eyes, gradient/airbrush shading, realistic/3D shading, neon colors, baked ground shadow.
```

레퍼런스 라인(이전 프레임/단계를 첨부할 때 항상 포함):

```
[REFERENCE] Match the attached image's EXACT art style: pixel density, muted earthy
palette, selective colored (NO black) outline, soft banded cel shading, and mini-heroic
deformation with small simple eyes. Keep this creature's identity consistent; only the
per-frame motion (and, for evolutions, gradual added detail) changes.
```

## 2. 프레임 수 / 순서 규칙

- 동작별 프레임 수(표준): **모든 동작 8프레임** (idle/eat/happy/sad 각 8 = 32프레임/형태).
  많은 프레임으로 동작을 부드럽게 한다. **모든 형태가 이 표준을 따른다**
  (기존 `krobi/stage1`도 새 스타일·8프레임으로 재생성).
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
