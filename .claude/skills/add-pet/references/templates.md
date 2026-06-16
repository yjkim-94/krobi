# add-pet — file templates

## manifest.json draft template (per form — before packing)

`frames` are frame file names; `pack_sheet.py` rewrites them to cell indices and adds
`sheet` + `columns`.

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

After `pack_sheet.py` (columns 8 → 4 rows), the manifest is index-based:

```json
{
  "id": "<species>/<form>",
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

## species.json template

```json
{
  "id": "<species>",
  "archetype": "<archetype>",
  "branches": {
    "maker": { "label": "<maker form name>", "tendency": "생산·창작" },
    "sage":  { "label": "<sage form name>",  "tendency": "탐구·학습" },
    "wild":  { "label": "<wild form name>",  "tendency": "유희·감상" }
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

## catalog.json entry template

```json
{
  "id": "<species>",
  "displayName": "<name>",
  "archetype": "<archetype>",
  "concept": "<one-line concept>",
  "claimedMotifs": ["<motif>", "..."],
  "claimedColors": ["<color>", "..."],
  "branches": ["maker", "sage", "wild"]
}
```
