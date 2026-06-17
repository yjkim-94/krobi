# Krobi — project instructions

## Documentation language

Write all **persisted project documents in English** to save tokens — these are loaded
into agent/prompt context, not primarily human-facing. This covers:

- Design docs / specs (`docs/superpowers/specs/`) and implementation plans (`docs/superpowers/plans/`)
- Skill files and their references (`.claude/skills/`)
- Asset/style docs such as `src/assets/pets/pet_design.md`

User-facing chat responses stay in **Korean** (per the user's global CLAUDE.md).
Only the documents above are English. Existing Korean docs are left as-is unless a
rewrite is requested; new docs are written in English.

## Running the app

This is a Tauri 2 app. To launch it, run the single command **in the background**
(it is a long-running foreground process otherwise):

```
npm run tauri dev
```

This boots Vite on `http://localhost:1420` (via `beforeDevCommand`) and builds/runs
the Rust shell. Run it with the background runner — do not block the conversation on
it; the harness re-notifies when the process exits so logs can be checked.

If a relaunch fails because a stale dev process holds port 1420, clear it first:

```
lsof -ti:1420 | xargs -r kill -9 ; pkill -f "tauri dev"
```

Do not wrap this in a shell script — the command is a single line and is run directly.
