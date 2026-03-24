# Coniva — Design Document (Single Source of Truth)

**Last updated:** 2026-03-24
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

## Engineering Backlog (Priority Order)

Per the 2026-03-23 engineering review: **Q → M → N → P → O**

| Phase | Name | Status | PR | Key Deliverable |
|-------|------|--------|----|-----------------|
| Q | NPM Registry Distribution | **shipped** | #73 | `npm-registry` delivery mode, auto-publish, keychain tokens |
| M | Lottie Export | **shipped** | #74 | `exportLottie()`, lottie-web preview, downgrade diagnostics |
| N | Derived Variant Generation | planned | — | SF Symbols fill/circle/square/slash via path booleans |
| P | Import Ecosystem | planned | — | Lucide/Phosphor/SF Symbols import adapters |
| O | Cubic Weight Interpolation | planned | — | Variable font-like weight system |

## Phase Q — NPM Registry Distribution (shipped)

**Problem:** Designers sync icons via git PR, then a developer must manually
`npm publish`. This handoff breaks the designer→developer workflow.

**Solution:** Add `npm-registry` as a third delivery mode. Designers click Publish
(or auto-publish on save with 5-min cooldown + cancel). Token lives in OS keychain
(desktop) or server-side env var (web) — never in project JSON.

**Key decisions:**
- Auto-publish is the PRIMARY workflow, manual is fallback
- Auto semver from `diffCompiledIcons()` (add→minor, modify→patch, remove→major)
- `SyncConnector<TRequest, TResult>` generic interface for all delivery modes
- Web proxy at `/api/publish-npm` matches GitHub sync security pattern

**Files:** `npm-connector.ts`, `keychain.ts`, `auto-publish.ts`, `route.ts` (publish-npm)

## Phase M — Lottie Export (shipped)

**Problem:** Coniva can only export its runtime JSON format. Mobile platforms
(Android, iOS, React Native) use Lottie — the de-facto animated icon standard.

**Solution:** `exportLottie(icon, variantId, options?)` converts Coniva icons to
Lottie 5.x JSON. Includes morph sampling, trim paths, effects, and lottie-web preview.

**Key decisions:**
- Uses `strictMorph()`/`bestGuessMorph()` directly — no `interpolatePaths()`
- Frame count always integer: `Math.round(durationMs / 1000 * fr)`
- `lottie-web` is regular dependency, lazy-loaded with feature flag
- Downgrade diagnostics in separate `lottie-downgrade.ts` (not `downgrade-rules.ts`)
- Spring easing approximated as ease-in-out cubic-bezier

**Files:** `export-lottie.ts`, `lottie-downgrade.ts`, `LottieExportPanel.tsx`

## Phase N — Derived Variant Generation (planned)

**Problem:** SF Symbols supports modifier variants (fill, circle, square, slash, badge)
generated from a base icon. Coniva has the metadata scaffolding but no path boolean
implementation.

**Key constraints (from eng review):**
- Paper.js boolean ops are async and browser-only — tests must mock `booleanOp`
- Add `isDeriving: boolean` to editor store to prevent concurrent ops
- `Icon.meta.derivedSpecs` requires schema migration task (N0)

## Phase P — Import Ecosystem (planned)

**Problem:** Teams with existing icon libraries (Lucide, Phosphor, Material) can't
import them into Coniva for animation authoring.

**Key constraints (from eng review):**
- Import adapters need build-time manifest for web (no node_modules filesystem access)
- Phosphor weight names don't map 1:1 to Coniva — explicit mapping table required
- SF Symbols adapter (P4) requires legal review (Apple license restrictions)

## Phase O — Cubic Weight Interpolation (planned)

**Problem:** Variable font-style weight interpolation requires cubic control points
instead of linear weight stops.

**Key constraints (from eng review):**
- `WeightControlPoints` type change is breaking — all callers need null-check updates

## Security Posture

- **Tokens:** Never in project JSON. Desktop: OS keychain. Web: server-side env vars only.
- **Web proxy:** Server-side `NPM_PUBLISH_TOKEN` / `GITHUB_SYNC_TOKEN` — never from client.
- **File upload:** Path traversal protection + package.json sanitization (strict allowlist, `--ignore-scripts`).
- **Auth pattern:** Fail-fast — auth check before request validation in all API routes.

## Design Docs (per-branch, in ~/.gstack/)

| Branch | Date | Doc |
|--------|------|-----|
| claude/eng-review-phases-MQ-8Qm1p | 2026-03-24 | Phase Q design (NPM Registry) |
| phase-m/lottie-export | 2026-03-24 | Phase M design (Lottie Export) |
