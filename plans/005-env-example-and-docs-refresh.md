# Plan 005: Add `.env.example` and refresh the stale user guide

> **Executor instructions**: Follow step by step; run each verification command
> and confirm its result. On a "STOP condition", stop and report. Update this
> plan's row in `plans/README.md` when done.
>
> **Drift check (run first)**: `git diff --stat 4ffd061..HEAD -- docs/user-guide components/studio CLAUDE.md`
> If the studio components or the user-guide docs changed since this plan was
> written, re-verify the claims you are documenting against the live UI.

## Status

- **Priority**: P3
- **Effort**: S
- **Risk**: LOW
- **Depends on**: none
- **Category**: dx + docs
- **Planned at**: commit `4ffd061`, 2026-06-10

## Why this matters

Two low-risk onboarding gaps. (1) There is no `.env.example`, so a new
contributor cannot tell which environment variables exist, which are build-time
vs. runtime, and which have safe defaults — `CLAUDE.md` mentions a few CI vars
but is not a contract. (2) `docs/user-guide/editor-workspace.md` still describes
the pre-revamp "three working columns" layout, but the app now ships the
single-screen `StudioLayout` (Navbar + NavPane + ListPane + embedded
EditorShell). Docs that are actively wrong are worse than missing — a new user
following them looks for panels that no longer exist.

## Current state

- **No `.env.example`** at repo root (`ls .env.example` → not found).
- Env vars actually referenced in code (from `grep -rhoE` over `lib/`, `app/`,
  `components/`, `next.config.mjs`):
  - Build/version (CI-populated, have local fallbacks via `lib/build-version.ts`):
    `NEXT_PUBLIC_APP_VERSION`, `NEXT_PUBLIC_BUILD_COMMIT`,
    `NEXT_PUBLIC_BUILD_TIME`, `NEXT_PUBLIC_HIERO_UI_ICONS_VERSION`.
  - Channel/output: `NEXT_PUBLIC_BUILD_CHANNEL` (`public` | `internal`,
    default `public`), `NEXT_PUBLIC_OUTPUT_MODE` / `NEXT_OUTPUT_MODE`.
  - Feature/debug flags: `NEXT_PUBLIC_HIERO_DEBUG`, `NEXT_PUBLIC_IMPORT_DEBUG`,
    `NEXT_PUBLIC_LOTTIE_PREVIEW_ENABLED`, `NEXT_PUBLIC_HIERO_RESOLVER_V`.
  - Server-only secrets (NEVER commit values): `GITHUB_SYNC_TOKEN`,
    `NPM_PUBLISH_TOKEN`, `NPM_PUBLISH_PROXY_ENABLED`,
    `NPM_PUBLISH_ALLOWED_REGISTRIES`.
- **Stale doc**: `docs/user-guide/editor-workspace.md` describes a three-column
  layout (left tools/layers, center canvas, right inspector). Live layout:
  `components/studio/StudioLayout.tsx` composes `Navbar`, `NavPane`, `ListPane`,
  and an embedded `EditorShell`. Spot-check the other user-guide files
  (`quick-start.md`, `library-and-browsing.md`, `drawing-and-editing.md`,
  `size-versions-and-guides.md`, `files-export-and-shortcuts.md`,
  `index.md`) for the same drift before editing.

## Commands you will need

| Purpose   | Command                          | Expected  |
|-----------|----------------------------------|-----------|
| Build     | `pnpm build`                     | exit 0    |
| Lint      | `bun run lint`                   | exit 0    |
| Find env  | `grep -rhoE "NEXT_PUBLIC_[A-Z_]+\|process\.env\.[A-Z_]+" lib app components next.config.mjs \| sort -u` | the list above |

## Scope

**In scope:**
- `.env.example` (create)
- `docs/user-guide/editor-workspace.md` (rewrite layout description)
- Other `docs/user-guide/*.md` only where a claim is *actively wrong* about the
  current UI (minimal edits, not a full rewrite).
- Optionally a one-line pointer to `.env.example` in `CLAUDE.md` or `README`.

**Out of scope:**
- Any source/config change. Do not add new env vars or change defaults.
- `docs_canonical/*` (maintainer-facing; different audience).
- Screenshots (none exist to regenerate; describe in prose).

## Steps

### Step 1: Write `.env.example`

Create `.env.example` listing every variable from "Current state", grouped
(Build/version, Channel, Feature flags, Server secrets), each with a one-line
comment stating purpose + default + whether it is optional for local `pnpm dev`.
For secrets, use an empty value and a comment — **never a real token**. State at
the top that local dev needs none of these (defaults cover `pnpm dev`).

**Verify**: `pnpm dev` still boots with no `.env` present (the file is
documentation; nothing should now *require* it). Run
`grep -c "=" .env.example` → matches the count of documented vars.

### Step 2: Fix the editor-workspace doc

Rewrite the layout section of `docs/user-guide/editor-workspace.md` to describe
the single-screen `StudioLayout`: top Navbar (project name, save status, undo/
redo, publish, ⌘K, Help), the `NavPane` (collapsible), the `ListPane` icon
browser, and the embedded editor (canvas + right inspector). Verify each named
element against `components/studio/StudioLayout.tsx`, `Navbar.tsx`, `NavPane.tsx`,
`ListPane.tsx` before writing it.

**Verify**: `grep -in "three.*column\|left side" docs/user-guide/editor-workspace.md`
→ no stale references remain.

### Step 3: Spot-fix other guide pages

For each remaining `docs/user-guide/*.md`, fix only claims that are now wrong
(e.g. CTA names, panel locations). Do not expand scope into a full rewrite.

**Verify**: read each file; confirm no instruction points at a non-existent
control.

## Test plan

- No automated tests (docs + example file). Verification is the `grep` checks
  above plus `pnpm build` staying green (proves no accidental source edits).

## Done criteria

- [ ] `.env.example` exists and documents every variable from the grep list,
      secrets with empty values + comments only
- [ ] `grep -rn "GITHUB_SYNC_TOKEN=ghp_\|NPM_PUBLISH_TOKEN=npm_" .env.example`
      → no matches (no real secret values)
- [ ] `docs/user-guide/editor-workspace.md` describes the StudioLayout; no
      "three column" / "left side tools" language remains
- [ ] `pnpm build` exits 0; `bun run lint` exits 0
- [ ] No source files modified (`git status` shows only `.env.example`, docs,
      and optionally `CLAUDE.md`/`README`)
- [ ] `plans/README.md` status row updated

## STOP conditions

- A user-guide page describes a workflow you cannot verify against the current
  UI (you are unsure whether it is stale or you are missing context) — leave it,
  note it, and report rather than guessing.
- Writing `.env.example` reveals a variable that has no default and silently
  breaks `pnpm dev` when unset — that is a real DX bug; report it (do not paper
  over it in docs).

## Maintenance notes

- Keep `.env.example` in sync when env vars are added — worth a follow-up CI
  check that greps for `NEXT_PUBLIC_*` not present in `.env.example`.
- A reviewer should sanity-check the doc against a running instance, not just
  the component source.
