# Pet status & evolution — design

Date: 2026-06-16
Branch: spec/pet-evolution-pipeline

## Goal

Add two context-menu actions and the runtime behind them:

- **펫상태 (Pet status)** — toggles a panel above the pet showing satiety, EXP, and the
  three tendency gauges.
- **진화하기 (Evolve)** — enabled only when EXP is full; evolves the pet to the next stage.
  Disabled at stage 3 (terminal).

This finally wires the live runtime to the evolution tree that `species.json` already
describes (today only the stage1 sprite exists and the app hardcodes it).

## Core model

A pet has **one EXP gauge** and **three tendency gauges**. They grow from different sources:

- **EXP** grows automatically over time (a tick, like satiety but increasing). When EXP
  reaches the current form's threshold, evolution becomes available.
- **Tendencies** grow from *what the user actually does on the computer*, sampled by
  watching the frontmost (active) app periodically. Three tendencies:

  | key | 성향 | rises when the active app is… |
  |---|---|---|
  | `maker` | 생산·창작 | IDE/terminal, office, Notion, Figma |
  | `sage`  | 탐구·학습 | browser, PDF/paper readers, lecture video |
  | `wild`  | 유희·감상 | games, YouTube/Netflix, music, messengers |

**Evolution direction** is decided by the **dominant tendency at the first evolution only**
(stage1 → stage2). stage2 → stage3 stays in the same branch.

## Evolution branches (krombi, redefined)

The old `beast/machine/morph` whitelist was a leftover from the old coding/research/writing
split. It is replaced by three fixed, tendency-aligned branches, each a **variation of the
stage1 identity** (a lava slime stays fire/lava in every branch — no genre jumps like
slime→machine):

| branch | tendency | theme (stage2 → stage3) |
|---|---|---|
| `maker` | 생산·창작 | 마그마 대장장이 → 용암 골렘 (forges / builds / shapes) |
| `sage`  | 탐구·학습 | 도깨비불 → 지혜의 등불 정령 (illuminates / refines / knows) |
| `wild`  | 유희·감상 | 불꽃 야수 → 화염 정령 (untamed / fierce / playful) |

### New `species.json` schema

```json
{
  "id": "krombi",
  "archetype": "slime",
  "branches": {
    "maker": { "label": "마그마 대장장이", "tendency": "생산·창작" },
    "sage":  { "label": "지혜의 등불 정령", "tendency": "탐구·학습" },
    "wild":  { "label": "불꽃 야수", "tendency": "유희·감상" }
  },
  "forms": {
    "stage1":       { "frameSize": 64, "expToEvolve": 100 },
    "stage2-maker": { "frameSize": 64, "from": "stage1", "branch": "maker", "expToEvolve": 300 },
    "stage2-sage":  { "frameSize": 64, "from": "stage1", "branch": "sage",  "expToEvolve": 300 },
    "stage2-wild":  { "frameSize": 64, "from": "stage1", "branch": "wild",  "expToEvolve": 300 },
    "stage3-maker": { "frameSize": 96, "from": "stage2-maker", "branch": "maker" },
    "stage3-sage":  { "frameSize": 96, "from": "stage2-sage",  "branch": "sage" },
    "stage3-wild":  { "frameSize": 96, "from": "stage2-wild",  "branch": "wild" }
  }
}
```

- `expToEvolve` absent ⇒ terminal form (stage3): evolve disabled.
- `branch` on each form lets the runtime resolve the next form from the dominant tendency.
- EXP thresholds (100 / 300) are provisional and tunable.

## State model (`PetData`)

```ts
type Tendencies = { maker: number; sage: number; wild: number };

type PetData = {
  name: string;
  form: string;            // current form key, e.g. "stage1" | "stage2-maker" — replaces `level`
  status: { satiety: number };
  exp: number;             // time-driven; reset to 0 on evolution
  tendencies: Tendencies;  // active-app driven
  unknownApps: Record<string, number>; // count of unmapped apps seen (for future mapping growth)
  last_updated: string;
};
```

### Migration

Existing saves (`level`, `status.satiety` only) migrate to:
`form = "stage1"`, `exp = 0`, `tendencies = {maker:0, sage:0, wild:0}`, `unknownApps = {}`.
Keep the existing satiety/hunger migration.

## Active-app detection (macOS only, this build)

- New Rust/Tauri command `get_frontmost_app()` returns the active app's name + bundle id
  via **NSWorkspace** (`frontmostApplication`). This needs **no Accessibility permission** —
  we never read window titles or contents, only the app identity.
- Frontend polls every **~30s**, maps the app to a tendency via a lookup table, and adds a
  small weight to that gauge.
- Built-in mapping table of ~30–40 well-known apps (VSCode, Terminal/iTerm, Xcode, Chrome,
  Safari, Preview, Notion, Figma, MS Office, 한글, Slack, KakaoTalk, Steam, YouTube/Netflix
  in browser is ambiguous → treated as browser=`sage`, Spotify, etc.).
- **Unmapped apps:** do nothing to gauges; increment `unknownApps[name]` so the top
  unmapped apps can inform future table growth.
- Windows support is **out of scope** for this build (documented, not implemented).

## Evolution logic

1. **Can evolve?** `form.expToEvolve` exists AND `exp >= form.expToEvolve`.
2. **Resolve next form:**
   - At stage1: pick dominant tendency (max of `tendencies`) → `stage2-<dominant>`.
     Tie / all-zero (only unmapped apps used) → fall back to a default branch
     (`maker`) — see Open decisions.
   - At stage2: next is `stage3-<sameBranch>`.
3. **Apply:** set `form`, reset `exp = 0`. Tendencies persist (not reset) so the branch
   stays consistent into stage3. Satiety unchanged.
4. stage3: no `expToEvolve` ⇒ evolve action disabled.

## Asset reality — mechanic first, art later

Only `krombi/stage1` art exists. stage2/stage3 sprites for all three branches do not.
This build delivers the **full mechanic** (gauges, detection, evolution flow, UI). Evolved
forms are shown with a **placeholder**: reuse the stage1 sprite with a per-branch tint /
scale bump plus the form's `label` text. Real sprites are produced later via the add-pet
pipeline and drop in by form folder with no logic change.

## UI

### Context menu (native OS popup, existing `Menu` API)

Add to the existing 밥주기 / 크기 조절 items:

- **펫상태** — toggles the status panel.
- **진화하기** — `enabled` only when "Can evolve?" is true; greyed/disabled otherwise and
  at stage3. Selecting it runs the evolution and (optionally) plays a transition.

### Status panel (above the pet)

Shown while 펫상태 is toggled on. Contents:

- 포만감 (satiety) bar
- 경험치 (EXP) bar + "진화 가능!" marker when full
- three tendency bars (maker / sage / wild) with the current dominant one highlighted

### Window-clip fix

The transparent window is sized to fit the pet + margin, so a panel above the head would be
clipped (the very reason the context menu went native). When 펫상태 toggles **on**, grow the
window upward to make room for the panel; restore the original size when toggled **off**.
The committed `window_size` (resize feature) is preserved separately.

## add-pet skill changes

The skill currently treats branches as a free style pool (`beast/machine/morph…`) chosen to
fit the archetype, with abstract `stat >= threshold` conditions. Update it to the new model:

1. **Interview (Step 1):** after capturing the stage1 concept, the assistant **proposes
   three branch themes aligned to the fixed tendencies** (`maker` 생산·창작 / `sage` 탐구·학습 /
   `wild` 유희·감상), each a **variation of the stage1 identity**, folding in any extra concept
   the user gives. The user confirms/adjusts; these locked themes then feed catalog + prompts.
   (e.g. rabbit → maker: armored/crafter rabbit; sage: moon/stargazer rabbit; wild: horned
   wild hare — all unmistakably rabbits.)
2. **Identity-variation principle** (new rule, replaces the free-pool guidance): stage2/3 must
   keep stage1's core identity (material / element / silhouette lineage), specialized toward
   the branch's tendency. No genre jumps.
3. **Schema/template updates:** `species.json` template moves from `branchWhitelist` +
   `condition.stat/gte` to the `branches` map + `branch` + `expToEvolve` shown above. Update
   `references/templates.md`, the Evolution-model section, Scope, and Notes accordingly.
   `catalog.json` `branches` mirrors the branch keys (`maker/sage/wild`).

## Out of scope

- Real stage2/stage3 artwork (placeholder only; produced later via add-pet).
- Windows/Linux active-app detection.
- Evolution transition FX beyond a minimal placeholder.
- Tuning of EXP rates / tendency weights beyond provisional values.

## Open decisions (assumed defaults; adjust in review)

- **Status panel scope:** show all five gauges (satiety + EXP + 3 tendencies). *(assumed yes)*
- **`scholar` → `sage`** rename with "도깨비불 → 지혜의 등불 정령" theme. *(assumed yes)*
- **Window-clip fix:** expand window while panel is shown. *(assumed yes)*
- **Tendency tiebreak / all-zero:** default to `maker` branch. *(assumed; could instead
  prompt the user to choose at evolve time.)*
