# Hiero — Production Readiness Plan (archived)

**Original:** 2026-03-28 · **Archived:** 2026-04-13
**Standard:** "If you are coding for another project, would you recommend
your team use this tool?"

---

## Status

Every gap this document originally tracked has been shipped, removed, or
superseded. **Use `docs_canonical/TASKS.md` as the source of truth for
completed phases and `docs_canonical/NEXT_PHASES.md` for remaining work
(only R7 is still open).**

This file is retained as a historical archive of the production-readiness
plan that drove Hiero from Phase 1 through the 2026-04 ship-readiness
push, because the gap decomposition and engineering-review decisions still
inform how we evaluate future work.

## Summary of what the plan delivered

| # | Gap | Outcome |
|---|-----|---------|
| G1 | Web persistence (critical) | **Shipped (R2)** — `lib/persistence/` uses IndexedDB as the sole storage path. `AutoSaveProvider` is mounted in `app/layout.tsx`. |
| G2 | Export UI wiring | **Shipped** — Lottie panel mounted in `components/editor/Toolbar.tsx` via a `Sheet`. Runtime JSON / SVG package / React library / Distribution entries are all in the Hiero menu's Export submenu (`components/studio/Navbar.tsx`). |
| G3 | Figma import | **Shipped** — `app/api/import/figma/route.ts` + Figma plugin at `figma-plugin/export-to-hiero/` + editor dialog entry point. |
| G4 | NPM publish UX completion | **Shipped (Q)** — `lib/sync-service/connectors/npm-connector.ts`, `app/api/publish-npm/route.ts` (server-side `NPM_PUBLISH_TOKEN`), `lib/sync-service/auto-publish.ts`, `components/export/ReleasePanel.tsx`. |
| G5 | Desktop distribution | **Removed (R1)** — Hiero is now a pure Next.js web application. `desktop/` retains only build artifacts; the Electrobun shell was removed in Phase R1. |
| G6 | Consumer documentation | **Shipped** — `docs/guides/react-integration.md`, `docs/guides/swift-integration.md`, `docs/guides/flutter-integration.md`, `docs/guides/figma-plugin-export.md`, `docs/guides/framework-integration-playbook.md`, plus the end-user surface at `docs/user-guide/`. |
| G7 | Accessibility debt | **Shipped (R5)** — focus rings, ARIA roles/labels, live regions, keyboard nav. Ongoing follow-up work (ARIA valuemin/valuemax on number inputs, Role field as a dropdown, destructive-action confirmation dialogs) landed as part of the design audit §7.5 in PR #128. |

## Engineering-review decisions that still apply

These choices from the 2026-03-23 engineering review remain load-bearing
even though the individual gaps have shipped:

- **Token security.** npm tokens live in server-side `NPM_PUBLISH_TOKEN`
  env var only, proxied via `app/api/publish-npm/route.ts`. Never in
  project JSON, never on the client.
- **GitHub sync tokens.** Server-side `GITHUB_SYNC_TOKEN` only. The
  `GitHubProvider` constructor rejects empty tokens.
- **Figma PATs.** Per-request, never persisted. `app/api/import/figma`
  validates auth before request validation (fail-fast).
- **Persistence adapter.** `lib/persistence/adapter.ts` abstracts the
  backend so future alternatives (e.g. server-side workspace sync) can
  slot in without touching the editor store.
- **Morph strategy.** `autoMorph()` is the unified entry point. Explicit
  strategies (`strictMorph`, `bestGuessMorph`, `crossIconMorph`,
  `lineAnimation`, `replace`) stay in the schema for backward
  compatibility and are exposed only in the Animate panel's collapsed
  Advanced disclosure (see
  `docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md` §2.3).
- **Lottie morph.** Use `strictMorph()` / `bestGuessMorph()` directly
  rather than `interpolatePaths()`. `autoMorph()` is the preferred entry
  point for new code.
- **Lottie frames.** Always integer: `Math.round(durationMs / 1000 * fr)`.
- **`lottie-web`.** Regular dependency, lazy-loaded via
  `NEXT_PUBLIC_LOTTIE_PREVIEW_ENABLED` feature flag.
- **Paper.js.** Browser-only. Tests must mock `booleanOp` via
  `mock.module('@/lib/editor-core/paper-runtime', ...)` — see
  `tests/boolean-ops.test.ts` and `tests/derived-variants.test.ts`.
- **Auto-publish.** Must have explicit cancel/abort before shipping. See
  `lib/sync-service/auto-publish.ts`.

## Why this file still exists

- The gap decomposition (G1–G7) remains the cleanest way to explain why
  the 2026-03 → 2026-04 ship list was prioritized the way it was.
- The engineering-review decisions above are still the rules future work
  has to respect.
- The "not in scope" and "failure modes" sections of the original plan
  were useful for ruling out speculative features and for the
  `tests/state-crud.test.ts` / `tests/editor-history.test.ts` test plans
  that still protect the persistence and undo/redo paths.

## Pointers

- **Shipped work:** `docs_canonical/TASKS.md`
- **Remaining work:** `docs_canonical/NEXT_PHASES.md` (R7 only)
- **System architecture:** `docs_canonical/ARCHITECTURE.md`
- **Repository structure:** `docs_canonical/REPO_MAP.md`
- **Animate panel revamp (plan §1–§7):**
  `docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md`
- **CLI deploy prep (plan §3):** same document
- **Product vision + security posture:** `docs_canonical/DESIGN.md`
