# Tasks

**Last updated:** 2026-03-26
**Canonical product name:** Coniva
**Forward-looking roadmap:** See `docs_canonical/PLAN.md` for the production readiness plan.

---

## Open Items

These are the only remaining incomplete tasks from the engineering phases.
All other phase tasks are shipped and verified.

### M7 — Mount Lottie Export UI
- **Status:** Not started
- **Covered by:** PLAN.md → G2 (Export UI Wiring)
- **What:** Mount `LottieExportPanel.tsx` in Editor right sidebar Export tab and Toolbar dropdown
- **Files:** `EditorShell.tsx`, `Toolbar.tsx`

### M8 — Lottie Preview Canvas
- **Status:** Not started
- **Covered by:** PLAN.md → G2
- **What:** Enable `NEXT_PUBLIC_LOTTIE_PREVIEW_ENABLED=true`, verify lottie-web lazy load
- **Files:** `.env.local`, `LottieExportPanel.tsx`

### O5 — Visual Weight Curve Editor
- **Status:** Low priority
- **What:** `WeightCurveEditor` component exists but is a polish item — renders cubic vs linear comparison
- **Files:** `components/editor/WeightCurveEditor.tsx`

### Q3 — Version Management UI
- **Status:** Not started
- **Covered by:** PLAN.md → G4 (NPM Publish UX)
- **What:** Bump patch/minor/major selector, changelog from `diffCompiledIcons()`, publish button
- **Files:** `SyncTargetPanel.tsx`

### Q4 — Auto-Publish Countdown with Cancel
- **Status:** Not started
- **Covered by:** PLAN.md → G4
- **What:** `pendingPublish` store state, countdown badge, cancel mechanism
- **Files:** `store.ts`, `ExplorerShell.tsx`, `auto-publish.ts`

---

## Shipped Phase Summary

All phases below are fully implemented. Detailed task lists have been
archived — each phase's implementation details are documented in the
codebase, specs, and commit history.

| # | Phase | Completed | Summary | PR |
|---|-------|-----------|---------|-----|
| 1 | Runtime Export (R1) | 2026-03-18 | Draw annotation, variable draw, magic replace, diagnostics | — |
| 2 | Runtime Execution (R2-R3) | 2026-03-18 | Draw executor, replace strategy, effect scheduler, DOM renderer | — |
| 3 | Runtime React (R4) | 2026-03-18 | ConivaIcon, useSyncExternalStore, demo page | — |
| 4 | CI/CD & Ops | 2026-03-18 | Web/desktop CI, coverage, Prettier, ESLint strict, signing | — |
| 5 | Platform & Adapters (R5-R6) | 2026-03-19 | Platform profiles, React adapter, Storybook, manifests | — |
| 6 | Sync & Distribution (R7) | 2026-03-19 | SyncTarget schema, GitHub PR connector, local directory sync | — |
| 7 | Cross-Platform (R8) | 2026-03-19 | Swift, Flutter, Web Component adapters | — |
| 8 | Cross-Icon Morphing | 2026-03-20 | Strict/bestGuess/crossIcon morph, topology detection | — |
| C | Editor Animation | 2026-03-21 | Timeline editor, transition preview, animation studio | — |
| D | React API Enrichment | 2026-03-21 | useIconState, prop-driven transitions | — |
| F | Cross-Icon Transitions | 2026-03-23 | TransitionEndpoint, CrossIconContext, direction support | — |
| G | Closed/Open Path Animation | 2026-03-23 | Subpath classifier, trim tracks, hybrid compositor | — |
| H | SF Symbols Parity | 2026-03-23 | Variable value, parallel effects, weight interpolation | — |
| UX | Visual & Interaction Polish | 2026-03-23 | Spacing, typography, scrollbars, keyboard nav, onboarding | — |
| I | Animation Tab Surface | 2026-03-23 | 14 track types, per-binding strategy, trim path UI | — |
| J | Animation Preview & Composition | 2026-03-23 | HybridFrame bridge, cross-icon preview, variable value track | — |
| K | Advanced Animation Authoring | 2026-03-23 | Magic Replace, auto-gradient mode, auto-strategy, presets | — |
| L | Inspect Tab Redesign | 2026-03-23 | Variable value indicator, topology, strategy badges, weight editor | — |
| M | Lottie Export | 2026-03-24 | Core exporter + downgrade diagnostics (UI wiring pending → G2) | #74 |
| N | Derived Variant Generation | 2026-03-24 | Boolean-op derivation, inspector actions, re-derive support | #75 |
| O | Cubic Weight Interpolation | 2026-03-24 | Fritsch-Carlson spline, 9-point controls (visual editor low-pri) | #77 |
| P | Import Adapter Ecosystem | 2026-03-24 | Heroicons, Phosphor, Material Symbols, capability badges, batch | #76 |
| Q | NPM Registry Distribution | 2026-03-24 | Connector, keychain, proxy, dry-run, tests (UI partial → G4) | #73 |

---

## Engineering Review Decisions (2026-03-23)

Key technical decisions from the engineering review that remain relevant:

- **Token security:** npm tokens live in platform keychain only, never in project JSON
- **Lottie morph:** use `strictMorph()`/`bestGuessMorph()` directly, not `interpolatePaths()`
- **Lottie frames:** `Math.round(durationMs / 1000 * fr)` — always integer
- **lottie-web:** regular dependency, lazy-loaded with feature flag
- **Paper.js:** browser-only — tests must mock `booleanOp`
- **SF Symbols (P4):** intentionally omitted — Apple license restrictions
- **Web publish proxy:** server-side token pattern (matches GitHub sync)
- **Auto-publish:** must have explicit cancel/abort before shipping

---

## Spec Documentation

All major implementations are documented in `/specs/`:

| Domain | Specs |
|--------|-------|
| Schema | `icon-schema.md`, `transition-schema.md` |
| Runtime | `morph-interpolation.md`, `topology-detection.md`, `transition-resolver.md`, `draw-executor.md`, `hybrid-compositor.md` |
| Editor | `editor-store.md`, `cross-icon-transitions.md` |
| Export | `runtime-json-format.md` |
