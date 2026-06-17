# CLI Image Generation Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `tools/gen_image.py` to replace the manual ChatGPT web copy-paste step in the add-pet pipeline with a single CLI command.

**Architecture:** A thin wrapper script (`gen_image.py`) calls `chatgpt-imagegen` as a subprocess for the default OAuth backend, and the `openai` SDK for the future API backend. The add-pet skill is updated to write a plain-text prompt file and print the ready-to-run command instead of asking the user to copy-paste into a browser.

**Tech Stack:** Python 3, `chatgpt-imagegen` (PyPI), `openai` SDK (PyPI), existing `tools/venv`

---

## File Map

| File | Action |
|---|---|
| `tools/gen_image.py` | Create — image generation wrapper |
| `tools/prompts/.gitkeep` | Create — makes the gitignored directory trackable |
| `tests/test_gen_image.py` | Create — unit tests (argument parsing + backend routing) |
| `.gitignore` | Modify — add `tools/prompts/` |
| `.claude/skills/add-pet/SKILL.md` | Modify — Step 3: write prompt txt + print CLI command |

---

## Task 1: Install dependencies and scaffold directory

**Files:**
- Modify: `.gitignore`
- Create: `tools/prompts/.gitkeep`

- [ ] **Step 1: Install chatgpt-imagegen and openai into tools/venv**

```bash
tools/venv/bin/pip install chatgpt-imagegen openai
```

Expected: both packages install without errors. Verify:

```bash
tools/venv/bin/chatgpt-imagegen --version
tools/venv/bin/python -c "import openai; print(openai.__version__)"
```

- [ ] **Step 2: Add tools/prompts/ to .gitignore**

Open `.gitignore` and append after the `tools/venv` line:

```
# Ephemeral prompt files for gen_image.py
tools/prompts/
```

- [ ] **Step 3: Create the prompts directory with a gitkeep**

```bash
mkdir -p tools/prompts && touch tools/prompts/.gitkeep
```

- [ ] **Step 4: Commit**

```bash
git add .gitignore tools/prompts/.gitkeep
git commit -m "chore(tools): add chatgpt-imagegen + openai to venv, scaffold prompts dir"
```

---

## Task 2: Write tests for gen_image.py

**Files:**
- Create: `tests/test_gen_image.py`

- [ ] **Step 1: Create the tests directory if it doesn't exist**

```bash
mkdir -p tests && touch tests/__init__.py
```

- [ ] **Step 2: Write the test file**

Create `tests/test_gen_image.py`:

```python
import argparse
import os
import sys
import types
import unittest
from unittest.mock import MagicMock, patch, mock_open

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestArgParsing(unittest.TestCase):
    def _parse(self, args):
        # Import fresh each time so we can test the parser in isolation
        import importlib
        import tools.gen_image as m
        importlib.reload(m)
        parser = m._build_parser()
        return parser.parse_args(args)

    def test_required_args(self):
        args = self._parse(["myprompt.txt", "--out", "out.png"])
        self.assertEqual(args.prompt_file, "myprompt.txt")
        self.assertEqual(args.out, "out.png")

    def test_defaults(self):
        args = self._parse(["p.txt", "--out", "o.png"])
        self.assertEqual(args.size, "1536x1024")
        self.assertEqual(args.backend, "oauth")
        self.assertIsNone(args.ref)

    def test_backend_choices(self):
        args = self._parse(["p.txt", "--out", "o.png", "--backend", "api"])
        self.assertEqual(args.backend, "api")

    def test_invalid_backend_exits(self):
        with self.assertRaises(SystemExit):
            self._parse(["p.txt", "--out", "o.png", "--backend", "bad"])

    def test_missing_out_exits(self):
        with self.assertRaises(SystemExit):
            self._parse(["p.txt"])


class TestGenerateRouting(unittest.TestCase):
    def setUp(self):
        import importlib
        import tools.gen_image as m
        importlib.reload(m)
        self.m = m

    def test_oauth_backend_called(self):
        with patch.object(self.m, "_chatgpt_oauth") as mock_oauth:
            self.m.generate("prompt", "1536x1024", None, "oauth", "out.png")
            mock_oauth.assert_called_once_with("prompt", "1536x1024", "out.png")

    def test_api_backend_called(self):
        with patch.object(self.m, "_openai_api") as mock_api:
            self.m.generate("prompt", "1536x1024", "ref.png", "api", "out.png")
            mock_api.assert_called_once_with("prompt", "1536x1024", "ref.png", "out.png")

    def test_unknown_backend_exits(self):
        with self.assertRaises(SystemExit):
            self.m.generate("prompt", "1536x1024", None, "unknown", "out.png")


class TestOutputDir(unittest.TestCase):
    def test_output_dir_created(self):
        import importlib
        import tools.gen_image as m
        importlib.reload(m)

        with patch.object(m, "generate"), \
             patch("builtins.open", mock_open(read_data="some prompt")), \
             patch("os.makedirs") as mock_makedirs:
            sys.argv = ["gen_image.py", "p.txt", "--out", "a/b/c.png"]
            try:
                m.main()
            except SystemExit:
                pass
            mock_makedirs.assert_called_with(os.path.dirname(os.path.abspath("a/b/c.png")), exist_ok=True)


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 3: Run tests to verify they all fail with ImportError (gen_image.py not yet written)**

```bash
tools/venv/bin/python -m pytest tests/test_gen_image.py -v 2>&1 | head -30
```

Expected: `ModuleNotFoundError: No module named 'tools.gen_image'`

- [ ] **Step 4: Commit**

```bash
git add tests/
git commit -m "test(tools): add unit tests for gen_image.py (failing — red)"
```

---

## Task 3: Implement gen_image.py

**Files:**
- Create: `tools/gen_image.py`

- [ ] **Step 1: Create tools/gen_image.py**

```python
#!/usr/bin/env python3
"""
Image generation wrapper for the add-pet pipeline.

Usage:
  tools/venv/bin/python tools/gen_image.py <prompt_file> --out <path> \
      [--size WxH] [--backend oauth|api] [--ref <image>]

Backends:
  oauth (default)  chatgpt-imagegen subprocess, no API key required
  api              openai SDK, requires OPENAI_API_KEY env var; --ref is active
"""
import argparse
import os
import subprocess
import sys


def _build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(description="Generate a pet sprite sheet image")
    p.add_argument("prompt_file", help="Path to plain-text file with the full prompt")
    p.add_argument("--out", required=True, help="Output PNG path (e.g. src/assets/pets/_incoming/species_form_sheet.png)")
    p.add_argument("--size", default="1536x1024", help="Image dimensions WxH (default: 1536x1024)")
    p.add_argument("--backend", choices=["oauth", "api"], default="oauth",
                   help="oauth: chatgpt-imagegen (default); api: OpenAI SDK + OPENAI_API_KEY")
    p.add_argument("--ref", default=None,
                   help="Reference image path. Active only with --backend api; silently ignored for oauth.")
    return p


def _chatgpt_oauth(prompt: str, size: str, out: str) -> None:
    exe = os.path.join(os.path.dirname(os.path.abspath(__file__)), "venv", "bin", "chatgpt-imagegen")
    result = subprocess.run([exe, prompt, "-o", out, "--size", size])
    if result.returncode != 0:
        sys.exit(f"chatgpt-imagegen exited with code {result.returncode}")


def _openai_api(prompt: str, size: str, ref: str | None, out: str) -> None:
    import base64
    import openai
    client = openai.OpenAI()
    if ref:
        with open(ref, "rb") as f:
            resp = client.images.edit(
                model="gpt-image-2",
                image=f,
                prompt=prompt,
                size=size,
                response_format="b64_json",
            )
    else:
        resp = client.images.generate(
            model="gpt-image-2",
            prompt=prompt,
            size=size,
            response_format="b64_json",
        )
    with open(out, "wb") as f:
        f.write(base64.b64decode(resp.data[0].b64_json))


def generate(prompt: str, size: str, ref: str | None, backend: str, out: str) -> None:
    if backend == "oauth":
        _chatgpt_oauth(prompt, size, out)
    elif backend == "api":
        _openai_api(prompt, size, ref, out)
    else:
        sys.exit(f"Unknown backend: {backend}")


def main() -> None:
    args = _build_parser().parse_args()

    with open(args.prompt_file) as f:
        prompt = f.read().strip()

    if not prompt:
        sys.exit(f"Prompt file is empty: {args.prompt_file}")

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)

    print(f"[gen_image] backend={args.backend}  size={args.size}  out={args.out}", flush=True)
    generate(prompt, args.size, args.ref, args.backend, args.out)
    print(f"[gen_image] saved → {args.out}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run the tests — all should pass**

```bash
tools/venv/bin/python -m pytest tests/test_gen_image.py -v
```

Expected:
```
PASSED tests/test_gen_image.py::TestArgParsing::test_required_args
PASSED tests/test_gen_image.py::TestArgParsing::test_defaults
PASSED tests/test_gen_image.py::TestArgParsing::test_backend_choices
PASSED tests/test_gen_image.py::TestArgParsing::test_invalid_backend_exits
PASSED tests/test_gen_image.py::TestArgParsing::test_missing_out_exits
PASSED tests/test_gen_image.py::TestGenerateRouting::test_oauth_backend_called
PASSED tests/test_gen_image.py::TestGenerateRouting::test_api_backend_called
PASSED tests/test_gen_image.py::TestGenerateRouting::test_unknown_backend_exits
PASSED tests/test_gen_image.py::TestOutputDir::test_output_dir_created
```

- [ ] **Step 3: Commit**

```bash
git add tools/gen_image.py
git commit -m "feat(tools): add gen_image.py — CLI image generation wrapper"
```

---

## Task 4: Update add-pet skill Step 3

**Files:**
- Modify: `.claude/skills/add-pet/SKILL.md` lines 160–178

The current block (lines 160–178) tells the user to manually attach a reference image and save the result to `_incoming/`. Replace it with instructions to write a plain-text prompt file and print the CLI command.

- [ ] **Step 1: Open the skill file and locate the target block**

In `.claude/skills/add-pet/SKILL.md`, find this block (around line 160):

```
Always tell the user (in chat — never in prompt.md):
- Generate on solid flat magenta `#ff00ff`, render LARGE / high-res.
- **Attach the per-form reference image** above so identity/silhouette stays consistent.
- Keep the row order idle → eat → happy → sad and the numbered storyboard order within each
  row (pet_design.md §2).
- **Padding:** leave clear margin around the whole grid — no frame may touch any canvas edge,
  with even spacing between rows and columns and a gap at every end. (Frames touching an edge
  get clipped on extraction.)
- Save the result to `src/assets/pets/_incoming/<species>_<form>_sheet.png`
  (e.g. `ember-pup_stage2-dragon_sheet.png`).

**Persist the prompt to the form folder.** Write `src/assets/pets/<species>/<form>/prompt.md`
containing ONLY the single paste-ready full-sheet prompt — one self-contained fenced block =
Sheet layout block + full Style Bible with filled `**Creature**` line + Reference line + §4
Sheet discipline block + the four row blocks (idle / eat / body-form happy / sad) + the
closing `**Never** include` line. The user copies the whole block into Nano Banana as-is.
Do NOT put workflow/operational text in this file (no extract/pack commands, no
reference-cropping how-to, no "save to _incoming" notes, no header addressing the user —
those live in this skill / the chat). Write it in English.
```

- [ ] **Step 2: Replace it with the new block**

Replace the entire block above with:

```
**Persist the prompt — two files:**

1. **Form folder (committed):** Write `src/assets/pets/<species>/<form>/prompt.md` containing
   ONLY the single full-sheet prompt in one self-contained fenced block (Sheet layout block +
   full Style Bible with filled `**Creature**` line + Reference line + §4 Sheet discipline block +
   the four row blocks + the closing `**Never** include` line). No workflow text in this file.
   Write it in English.

2. **Generator input (gitignored):** Write the same prompt as plain text (no fencing, no markdown)
   to `tools/prompts/<species>_<form>.txt`.

**Then tell the user (in chat) to run:**

```
tools/venv/bin/python tools/gen_image.py \
  tools/prompts/<species>_<form>.txt \
  --out src/assets/pets/_incoming/<species>_<form>_sheet.png
```

Note: The OAuth backend does not attach the reference image automatically — style consistency
relies on the palette lock and creature description in the prompt. For stage2/3, the prompt's
`**Creature**` line must already contain the explicit palette and silhouette constraints.
When switching to `--backend api` with `OPENAI_API_KEY`, add `--ref <previous_stage_idle_0.png>`
to activate reference-image consistency.

After running, come back here when the PNG appears in `_incoming/` — then continue with Step 4.
```

- [ ] **Step 3: Verify the edit looks right**

Read lines 155–195 of `.claude/skills/add-pet/SKILL.md` and confirm:
- The old "Always tell the user" block is gone
- The two-file persist block is present
- The CLI command block is present
- Step 4 heading follows immediately after

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/add-pet/SKILL.md
git commit -m "feat(add-pet): replace manual ChatGPT paste with gen_image.py CLI command"
```

---

## Self-Review

**Spec coverage:**
- ✅ `tools/gen_image.py` with `--backend oauth|api` — Task 3
- ✅ `tools/prompts/` directory, gitignored — Task 1
- ✅ Dependencies installed into existing `tools/venv` — Task 1
- ✅ add-pet skill Step 3 updated — Task 4
- ✅ `.gitignore` updated — Task 1
- ✅ `--ref` accepted, silently ignored for oauth, active for api — Task 3

**Placeholder scan:** None found.

**Type consistency:** `generate(prompt, size, ref, backend, out)` signature used consistently across Task 2 (tests) and Task 3 (implementation).
