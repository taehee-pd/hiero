# Coniva — Design Document (Single Source of Truth)

**Last updated:** 2026-03-26
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
│                        Coniva Editor                         │
│  (Next.js 16 + React 19 + Zustand + Tailwind + Radix UI)    │
├──────────────┬───────────────┬───────────────────────────────┤
│  Schema      │  Editor Core  │  Runtime Core                 │
│  (types.ts)  │  (path, snap, │  (morph, topology, transition │
│              │   keyboard)   │   resolver, draw, compositor) │
├──────────────┴───────────────┴───────────────────────────────┤
│                      Export Pipeline                         │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Runtime JSON  │  │ Lottie 5.x   │  │ Platform Adapters │  │
│  │ (.coniva.json)│  │ (.json)      │  │ (React, Swift,    │  │
│  │              │  │ M1-M10       │  │  Flutter, WC)     │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                     Sync Pipeline                            │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ Local Dir    │  │ Git PR       │  │ NPM Registry      │  │
│  │ Connector    │  │ Connector    │  │ Connector (Q0-Q8) │  │
│  └──────────────┘  └──────────────┘  └───────────────────┘  │
├──────────────────────────────────────────────────────────────┤
│                     Platform Layer                           │
│  Desktop: Electrobun RPC (keychain, npm-publish, native UI)  │
│  Web: Next.js API routes (/api/github-sync, /api/publish-npm)│
└──────────────────────────────────────────────────────────────┘
```

## Engineering Status

All 23 engineering phases (1–8, C–Q) are shipped. See `TASKS.md` for the summary table.

**Production readiness gaps** are tracked in `PLAN.md` (7 gaps: G1–G7).
The gaps are primarily UI wiring and distribution — the core engine is complete.

| Key shipped phases | Key deliverable |
|--------------------|-----------------|
| Q — NPM Registry | `npm-registry` delivery mode, auto-publish, keychain tokens |
| M — Lottie Export | `exportLottie()`, lottie-web preview, downgrade diagnostics |
| N — Derived Variants | fill/slash/circle/square/badge derivation via Paper.js booleans |
| P — Import Ecosystem | Heroicons, Phosphor, Material Symbols adapters + batch import |
| O — Cubic Weight | Fritsch-Carlson monotone spline, 9-point controls |

## Security Posture

- **Tokens:** Never in project JSON. Desktop: OS keychain. Web: server-side env vars only.
- **Web proxy:** Server-side `NPM_PUBLISH_TOKEN` / `GITHUB_SYNC_TOKEN` — never from client.
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
| `UX_AUDIT_PHASE2.md` | Deep code review of UX/a11y issues (reference for G7) |
| `UX_AUDIT_TASKS.md` | UX flow audit with severity-ranked tasks |
