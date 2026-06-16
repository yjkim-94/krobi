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
