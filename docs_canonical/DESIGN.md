# Coniva — Design Document (Single Source of Truth)

**Last updated:** 2026-04-04
**Product:** Coniva — icon authoring tool with SF Symbols-grade animation capabilities
**gstack design docs:** `~/.gstack/projects/taehee-pd-icon-authoring-tool/`

---

## Product Vision

Coniva is a cross-platform icon authoring tool that enables designers to create,
animate, and distribute production-ready icons — with zero developer handoff for
the distribution step. Designers edit, save, and publish. Developers consume via
`npm install` or platform-native formats.

## Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     Coniva Studio                            │
│  (Next.js 16 + React 19 + Custom Store + Tailwind + Radix)  │
├──────────────┬───────────────┬───────────────────────────────┤
│  Schema      │  Editor Core  │  Runtime Core                 │
│  (types.ts)  │  (path, snap, │  (morph, topology, transition │
│              │   keyboard)   │   resolver, draw, compositor) │
├──────────────┴───────────────┴───────────────────────────────┤
│                      Export Pipeline                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Runtime JSON  │  │ Lottie 5.x   │  │ Platform Adapters │  │
│  │ (.coniva.json)│  │ (.json)      │  │ (React, Swift,    │  │
│  │              │  │              │  │  Flutter, WC)     │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                     Distribution                             │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Live Sync    │  │ Git PR       │  │ NPM Registry      │  │
│  │ (Lane 1)     │  │ Connector    │  │ + @coniva/cli     │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                     Persistence & Platform                   │
│  IndexedDB auto-save + Web API routes                        │
│  (/api/github-sync, /api/publish-npm, /api/import/figma)     │
└──────────────────────────────────────────────────────────────┘
```

## Engineering Status

All 23 engineering phases (1–8, C–Q) are shipped. See `TASKS.md` for the summary table.

**Production readiness gaps** are tracked in `NEXT_PHASES.md` (R6–R7 remain).
Phases R1–R5 (desktop removal, web persistence, state UI, prompt replacement, accessibility) are shipped.

| Key shipped phases | Key deliverable |
|--------------------|-----------------|
| Q — NPM Registry | `npm-registry` delivery mode, auto-publish, server-side token proxy |
| M — Lottie Export | `exportLottie()`, lottie-web preview, downgrade diagnostics |
| N — Derived Variants | fill/slash/circle/square/badge derivation via Paper.js booleans |
| P — Import Ecosystem | Heroicons, Phosphor, Material Symbols, Figma adapters + batch import |
| O — Cubic Weight | Fritsch-Carlson monotone spline, 9-point controls |
| R1–R5 | Desktop removal, IndexedDB persistence, state CRUD UI, dialog cleanup, a11y pass |
| Distribution | Repo-native live-sync, release flow, `@coniva/cli`, PublishPanel, ReleasePanel |
| Studio Layout | Sanity Studio-style single-screen workspace |
| Figma Import | Figma plugin + API route + import dialog |

## Security Posture

- **Tokens:** Never in project JSON. Server-side env vars only (`NPM_PUBLISH_TOKEN`, `GITHUB_SYNC_TOKEN`).
- **Figma PATs:** Passed per-request to `/api/import/figma`, never stored server-side.
- **Web proxy:** Server-side token pattern for npm publish and GitHub sync — never from client.
- **File upload:** Path traversal protection + package.json sanitization (strict allowlist, `--ignore-scripts`).
- **Auth pattern:** Fail-fast — auth check before request validation in all API routes.

## Canonical Documentation Index

| Document | Purpose |
|----------|---------|
| `PLAN.md` | Production readiness plan — gaps, technical specs, full IA |
| `TASKS.md` | Open items + shipped phase summary table |
| `ARCHITECTURE.md` | System architecture, module boundaries, data flow |
| `REPO_MAP.md` | Repository structure and key entry points |
| `TESTING.md` | Test strategy, runner, coverage expectations |
| `WORKFLOWS.md` | Development, build, deploy, CI workflows |
| `STYLEGUIDE.md` | Code conventions, naming, formatting |
| `IMPORT_ADAPTER_SDK.md` | Import adapter lifecycle and test contract |
| `SYNC_TROUBLESHOOTING.md` | Sync pipeline error codes and resolution |
| `UX_AUDIT_TASKS.md` | UX flow audit with severity-ranked tasks |
| `NEXT_PHASES.md` | Next phases plan — R1–R5 shipped, R6–R7 remaining |
| `LAYOUT_REVAMP.md` | Studio layout revamp design and implementation |
| `UX_AUDIT_TASKS.md` | UX flow audit with severity-ranked tasks |
