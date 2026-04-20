# Tasks

**Last updated:** 2026-04-13
**Canonical product name:** Hiero
**Forward-looking roadmap:** See `docs_canonical/NEXT_PHASES.md` for the
remaining phases (only R7 is still open).

---

## Open Items

The engineering phase backlog is fully shipped through 2026-04-13. The one
remaining forward-looking phase is **R7 — Server-Side Embedding Readiness**,
partially addressed by the repo-native distribution work. See
`docs_canonical/NEXT_PHASES.md` for scope.

---

## Shipped Phase Summary

All phases below are fully implemented. Detailed task lists have been
archived — each phase's implementation details are documented in the
codebase, specs, and commit history.

| # | Phase | Completed | Summary | PR |
|---|-------|-----------|---------|-----|
| 1 | Runtime Export (R1) | 2026-03-18 | Draw annotation, variable draw, magic replace, diagnostics | — |
| 2 | Runtime Execution (R2-R3) | 2026-03-18 | Draw executor, replace strategy, effect scheduler, DOM renderer | — |
| 3 | Runtime React (R4) | 2026-03-18 | HieroIcon, useSyncExternalStore, demo page | — |
| 4 | CI/CD & Ops | 2026-03-18 | Web CI (4 workflows), coverage, Prettier, ESLint strict | — |
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
| M | Lottie Export | 2026-03-28 | Core exporter, mounted toolbar export UI, preview, downgrade diagnostics | #74 |
| N | Derived Variant Generation | 2026-03-24 | Boolean-op derivation, inspector actions, re-derive support | #75 |
| O | Cubic Weight Interpolation | 2026-03-28 | Fritsch-Carlson spline, 9-point controls, mounted visual curve editor | #77 |
| P | Import Adapter Ecosystem | 2026-03-24 | Heroicons, Phosphor, Material Symbols, capability badges, batch | #76 |
| Q | NPM Registry Distribution | 2026-03-28 | Connector, keychain, proxy, dry-run, mounted version UI, immediate publish, save-triggered auto-publish | #73 |
| R1 | Desktop/Electrobun Removal | 2026-04-02 | Platform pivot to web-only; removed desktop shell, native bridge, desktop CI | — |
| R2 | Web Persistence (IndexedDB) | 2026-04-02 | IndexedDB as sole storage path, auto-save, workspace restoration | — |
| R3 | State Management UI | 2026-04-02 | Create/rename/duplicate/delete states from editor, CRUD actions | — |
| R4 | Replace `prompt()` Dialogs | 2026-04-02 | Radix AlertDialog/DropdownMenu for all destructive actions | — |
| R5 | Accessibility Pass | 2026-04-02 | Focus rings, ARIA roles/labels, live regions, keyboard nav | — |
| — | Repo-Native Distribution | 2026-04-02 | Lane 1 live-sync, Lane 2 release, @hiero/cli, PublishPanel, ReleasePanel | — |
| — | Figma Plugin Import | 2026-04-02 | Figma plugin export + API route + import dialog | — |
| — | Studio Layout Revamp | 2026-04-03 | Sanity Studio-style single screen: NavPane, ListPane, embedded editor | — |
| — | Stagger Ordering Fix | 2026-04-02 | Transition resolver stagger ordering ranks corrected | — |
| — | Post-Review Bug Fixes | 2026-04-03 | 13 bugs fixed from Codex adversarial review | — |
| — | Unified autoMorph + Draw Animation | 2026-04-04 | autoMorph (intrinsic interpolation, auto strategy selection), draw effect (trim-based open-path animation), 39 new tests | #100 |
| — | Remove all-caps styling | 2026-04-13 | App-wide removal of `text-transform: uppercase` + `uppercase` Tailwind utilities; sentence-case labels everywhere | #127 |
| — | Design audit §7.1–§7.5 | 2026-04-13 | Far-Left Strip tooltips, icon grid double-click rename, Layers+Variants resizable merge, shape glyphs, drag reorder, right-click context menus, canvas contextual menu, Inspect panel segmented controls + ARIA min/max, Animate panel grouped presets + hover previews | #128 |
| — | Animate Panel Revamp (plan §2) | 2026-04-13 | Strip strategy dropdown + compatibility badges; restructure to Animation → Playback Mode → Timing → Preview → Advanced; `'simultaneous'` stagger mode; dev-only debug overlay; `autoMorph()` is the only public contract | #128 |
| — | `@hiero/cli` deploy prep (plan §3) | 2026-04-13 | Finalize `packages/hiero-cli/package.json` metadata, provenance publish config, new `.github/workflows/cli-release.yml`, CLI README with usage + versioning + limitations | #128 |
| R6 | Navigation & Discoverability (partial) | 2026-04-13 | `?` opens the shortcuts cheat sheet via global custom event; Canvas / Layer panel / Transition panel empty-state CTAs; `⌘K` command palette verified | #128 |

---

## Engineering Review Decisions (2026-03-23)

Key technical decisions from the engineering review that remain relevant:

- **Token security:** npm tokens via server-side `NPM_PUBLISH_TOKEN` env var (web publish proxy); never in project JSON
- **Lottie morph:** use `strictMorph()`/`bestGuessMorph()` directly, not `interpolatePaths()` (note: `autoMorph()` is now the preferred entry point for automatic strategy selection)
- **Unified morph:** `autoMorph()` replaces manual strategy selection; cascade: identity → intrinsicStrict → bestGuess → pointSampled → fallback. Explicit strategies remain for backward compat.
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
| Schema | `schema/icon-schema.md`, `schema/transition-schema.md`, `schema/install-config.md` |
| Runtime | `runtime/morph-interpolation.md`, `runtime/topology-detection.md`, `runtime/transition-resolver.md`, `runtime/draw-executor.md`, `runtime/hybrid-compositor.md`, `runtime/weight-interpolation-cubic.md` |
| Editor | `editor/editor-store.md`, `editor/animation-tab.md`, `editor/cross-icon-transitions.md`, `editor/inspect-tab.md`, `editor/derived-variants.md` |
| Export | `export/runtime-json-format.md`, `export/repo-native-distribution.md`, `export/lottie-export.md` |
| UI | `ui/screens.md`, `ui/components.md`, `ui/repo-native-workflow.md` |
