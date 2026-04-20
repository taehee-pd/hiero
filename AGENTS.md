## Repository Knowledge Harness

This repository uses a canonical documentation layer
for repository knowledge.

Repository architecture, workflows, coding conventions,
and testing policies are defined in:

docs_canonical/

Agents must read these documents before performing
repository tasks.

Canonical documentation is the authoritative source
for repository behavior.

Legacy documentation may be used only for reference.

If canonical documentation conflicts with legacy documentation,
canonical documentation takes precedence.

## Design Documentation (SSOT)

- **Master design doc:** `docs_canonical/DESIGN.md` — single source of truth for
  product vision, architecture, all phases, security posture, and key decisions.
  Read this before starting any feature work.
- **Task backlog:** `docs_canonical/TASKS.md` — engineering phases with checklists.
- **Per-branch design docs:** `~/.gstack/projects/taehee-pd-hiero/`
  (created by gstack `/office-hours` skill).

## Project-Local Skills

- Repo-local Codex skills live under `.codex/skills/`.
- `figma-use` is available at `.codex/skills/figma-use/SKILL.md`.
- Use `figma-use` before any Figma Plugin API / `use_figma` write flow or
  unique JS-based Figma read flow.

## CI Emulation (mandatory before push)

CI uses `bun install --frozen-lockfile` which fails if `bun.lock` is out of sync
with `package.json`. **After adding or removing any dependency**, agents must run:

```bash
bun install                     # Regenerate bun.lock
bun install --frozen-lockfile   # Emulate CI — must pass before pushing
bun run format:check            # Prettier check (CI runs this on pnpm-lock.yaml too)
bun run lint                    # ESLint — 0 errors required
bun test                        # Run tests
pnpm build                      # Verify production build
```

Both `pnpm-lock.yaml` and `bun.lock` must be committed together. The project uses
pnpm as the primary package manager but CI and the test runner use bun.

Failure to sync lockfiles causes CI failures on:
- `Validate desktop build`
- `Validate source export`
- `Validate web app`
