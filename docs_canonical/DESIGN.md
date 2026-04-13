# Contour — Design Document (Single Source of Truth)

**Last updated:** 2026-04-13
**Product:** Contour — Icon design studio with SF Symbols-grade animation capabilities
**gstack design docs:** `~/.gstack/projects/taehee-pd-contour/`

---

## Product Vision

Contour is a web-based icon design studio that enables designers to create,
animate, and distribute production-ready icons — with zero developer handoff for
the distribution step. Designers edit, save, and publish. Developers consume via
`npm install` or platform-native formats.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Contour Studio                            │
│  (Next.js 16 + React 19 + Custom Store + Tailwind + Radix)  │
├──────────────┬───────────────┬───────────────────────────────┤
│  Schema      │  Editor Core  │  Runtime Core                 │
│  (types.ts)  │  (path, snap, │  (autoMorph, intrinsic interp,│
│              │   keyboard)   │   topology, draw, compositor) │
├──────────────┴───────────────┴───────────────────────────────┤
│                      Export Pipeline                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Runtime JSON  │  │ Lottie 5.x   │  │ Platform Adapters │  │
│  │ (.contour.json)│  │ (.json)      │  │ (React, Swift,    │  │
│  │              │  │              │  │  Flutter, WC)     │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                     Distribution                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Live Sync    │  │ Git PR       │  │ NPM Registry      │  │
│  │ (Lane 1)     │  │ Connector    │  │ + @contour/cli     │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                     Persistence & Platform                   │
│  IndexedDB auto-save + Web API routes                        │
│  (/api/github-sync/pr, /api/publish-npm, /api/import/*)      │
└──────────────────────────────────────────────────────────────┘
```

## Engineering Status

All 23 engineering phases (1–8, C–Q) and R1–R6 are shipped. See
`TASKS.md` for the full completion table.

**Remaining production-readiness phase** is R7 (Server-side embedding
readiness), tracked in `NEXT_PHASES.md`.

| Key shipped phases | Key deliverable |
|--------------------|-----------------|
| Q — NPM Registry | `npm-registry` delivery mode, auto-publish, server-side token proxy |
| M — Lottie Export | `exportLottie()`, lottie-web preview, downgrade diagnostics |
| N — Derived Variants | fill/slash/circle/square/badge derivation via Paper.js booleans |
| P — Import Ecosystem | Heroicons, Phosphor, Material Symbols, Figma adapters + batch import |
| O — Cubic Weight | Fritsch-Carlson monotone spline, 9-point controls |
| R1–R5 | Desktop removal, IndexedDB persistence, state CRUD UI, dialog cleanup, a11y pass |
| R6 | `?` cheat sheet, `⌘K` command palette verified, Canvas/Layer/Transition empty-state CTAs (breadcrumb deferred) |
| Distribution | Repo-native live-sync, release flow, `@contour/cli`, PublishPanel, ReleasePanel |
| Studio Layout | Sanity Studio-style single-screen workspace |
| Figma Import | Figma plugin + API route + import dialog |
| Remove all-caps | App-wide removal of uppercase styling (PR #127) |
| Design audit §7 | Tooltips, inline rename, resizable Layers+Variants, shape glyphs, drag reorder, context menus, segmented controls, ARIA min/max on spinners, grouped animation presets (PR #128) |
| Animate Panel Revamp | SF Symbols 7 hierarchy: Animation → Playback Mode → Timing → Preview → Advanced; `autoMorph()` as the only public contract (PR #128) |
| `@contour/cli` deploy prep | Provenance publish config, `.github/workflows/cli-release.yml`, CLI README (PR #128) |

## Security Posture

- **Tokens:** Never in project JSON. Server-side env vars only (`NPM_PUBLISH_TOKEN`, `GITHUB_SYNC_TOKEN`).
- **Figma PATs:** Passed per-request to `/api/import/figma`, never stored server-side.
- **Web proxy:** Server-side token pattern for npm publish and GitHub sync — never from client.
- **File upload:** Path traversal protection + package.json sanitization (strict allowlist, `--ignore-scripts`).
- **Auth pattern:** Fail-fast — auth check before request validation in all API routes.

## Canonical Documentation Index

| Document | Purpose |
|----------|---------|
| `TASKS.md` | Shipped phase summary table; the authoritative "what's done" list |
| `NEXT_PHASES.md` | Next phases plan — R1–R6 shipped, R7 remaining |
| `ARCHITECTURE.md` | System architecture, module boundaries, data flow |
| `REPO_MAP.md` | Repository structure and key entry points |
| `TESTING.md` | Test strategy, runner, coverage expectations |
| `WORKFLOWS.md` | Development, build, deploy, CI workflows |
| `STYLEGUIDE.md` | Code conventions, naming, formatting |
| `IMPORT_ADAPTER_SDK.md` | Import adapter lifecycle and test contract |
| `SYNC_TROUBLESHOOTING.md` | Sync pipeline error codes and resolution |
| `ANIMATE_PANEL_REVAMP_PLAN.md` | Active design doc covering (§2) Animate panel revamp, (§3) `@contour/cli` deploy prep, (§6) resolved open questions, and (§7) full workspace design audit |
| `PLAN.md` | Archived production-readiness plan (all gaps shipped/removed); kept for decision history |
| `DESIGN.md` (repo root) | Stitch-style UI design-system prompt for coding/design agents |
