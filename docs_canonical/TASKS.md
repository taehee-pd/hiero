# Tasks

**Last updated:** 2026-03-23
**Canonical product name:** Coniva

All phases are **completed**. This document serves as a reference for
what was built, where it lives, and key decisions made.

---

## Completed Phases (chronological)

| # | Phase | Completed | Summary |
|---|-------|-----------|---------|
| 1 | **Runtime Export (R1)** | 2026-03-18 | Draw annotation, variable draw, magic replace, diagnostics |
| 2 | **Runtime Execution (R2-R3)** | 2026-03-18 | Draw executor, replace strategy, effect scheduler, DOM renderer |
| 3 | **Runtime React (R4)** | 2026-03-18 | ConivaIcon, useSyncExternalStore, demo page |
| 4 | **CI/CD & Ops** | 2026-03-18 | Web/desktop CI, coverage, Prettier, ESLint strict, signing |
| 5 | **Platform & Adapters (R5-R6)** | 2026-03-19 | Platform profiles, React adapter, Storybook, manifests |
| 6 | **Sync & Distribution (R7)** | 2026-03-19 | SyncTarget schema, GitHub PR connector, local directory sync |
| 7 | **Cross-Platform (R8)** | 2026-03-19 | Swift, Flutter, Web Component adapters |
| 8 | **Cross-Icon Morphing** | 2026-03-20 | Strict/bestGuess/crossIcon morph, topology detection |
| C | **Editor Animation** | 2026-03-21 | Timeline editor, transition preview, animation studio |
| D | **React API Enrichment** | 2026-03-21 | useIconState, prop-driven transitions |
| F | **Cross-Icon Transitions** | 2026-03-23 | TransitionEndpoint, CrossIconContext, direction support |
| G | **Closed/Open Path Animation** | 2026-03-23 | Subpath classifier, trim tracks, hybrid compositor |
| H | **SF Symbols Parity** | 2026-03-23 | Variable value, parallel effects, weight interpolation |
| UX | **Visual & Interaction Polish** | 2026-03-23 | Spacing, typography, scrollbars, keyboard nav, onboarding |

---

## Phase F — Cross-Icon Transition Model

- [x] **F1** — `TransitionEndpoint` type; `fromEndpoint`/`toEndpoint` on `Transition` (`lib/schema/types.ts`)
- [x] **F2** — `CrossIconContext` in resolver; 3-pass semantic layer matching (`lib/runtime-core/transition-resolver.ts`)
- [x] **F3** — `TransitionPreview` with `baseIconId`/`targetIconId` fields (`lib/editor-store/store.ts`)
- [x] **F4** — Cross-icon mode toggle + cascading endpoint pickers (`components/editor/TransitionPanel.tsx`)
- [x] **F5** — `direction` field (downUp/upUp/offUp/automatic); directional slide+fade (`lib/runtime-core/store.ts`)

## Phase G — Closed/Open Path Animation Strategy

- [x] **G1** — `classifySubPathStrategies()` → morph/trim/crossfade per subpath pair (`lib/runtime-core/topology-detection.ts`)
- [x] **G2** — `trimStart`/`trimEnd`/`trimOffset` tracks; `computeTrimValues()` (`lib/runtime-core/draw-executor.ts`)
- [x] **G3** — Both-open paths with matching signatures now morph (not flagged incompatible)
- [x] **G4** — `CompoundTrimMode` (simultaneously/individually); `computeCompoundTrim()` (`lib/runtime-core/draw-executor.ts`)
- [x] **G5** — `composeHybridFrame()` compositor with morph+trim+crossfade (`lib/runtime-core/hybrid-compositor.ts`)

## Phase H — SF Symbols Parity

- [x] **H1** — `variableValue` on Variant; `computeVariableValue()` + `applyVariableValue()` + editor slider
- [x] **H2** — Parallel effects verified: `Map<string, EffectScheduler>`, additive transforms, multiplicative opacity
- [x] **H3** — `strokeWidth`/`fillOpacity`/`strokeOpacity` tracks verified end-to-end
- [x] **H4** — `'individually'` stagger mode: each layer waits for previous to finish
- [x] **H5** — `SymbolVariantModifier` type; `canDeriveVariant()`; `availableModifiers()` (foundation — path booleans deferred)
- [x] **H6** — All 4 animation callbacks wired to ConivaIcon React props
- [x] **H7** — `palette` on Effect type; export pipeline; palette editor UI in AnimationStudio
- [x] **H8** — `generateAutoGradient()` with HSL lighten/darken (`lib/rendering/auto-gradient.ts`)
- [x] **H9** — `interpolateWeight()` + `validateWeightControlPoints()` (foundation — cubic interp deferred)
- [x] **H10** — 27 SF Symbols categories; `suggestCategory()` keyword matcher

## Phase UX — Visual & Interaction Polish

### UX-V: Visual Enhancements
- [x] **UX-V1** — Unified spacing system with CSS custom properties (`--panel-padding`, `--space-*`)
- [x] **UX-V2** — Typography tokens: `--text-heading`, `--text-body`, `--text-label`, `--text-caption`
- [x] **UX-V3** — Border opacity reduced to 2 levels; shadow values normalized
- [x] **UX-V4** — Hover states use background color shifts, not `opacity-80`
- [x] **UX-V5** — Playhead 3px with glow; Play/Pause lucide icons replace text buttons
- [x] **UX-V6** — Preset cards: `hover:shadow-md hover:-translate-y-0.5 hover:border-primary/30`
- [x] **UX-V7** — Thin auto-hiding scrollbars (`w-1.5` → `w-2` on hover, `opacity-0` → visible)
- [x] **UX-V8** — `sticky top-0 z-10 bg-background` on LayerPanel + IconListPanel headers

### UX-F: Flow & Interaction Fixes
- [x] **UX-F1** — `window.prompt()` replaced with inline number input + Enter/Escape
- [x] **UX-F2** — Easing picker live animation preview (animated dot with cubic-bezier)
- [x] **UX-F3** — MorphReadinessIndicator: auto-fix, switch-to-crossfade, switch-to-bestGuess buttons
- [x] **UX-F4** — Layer panel keyboard nav: Arrow↑↓ selection, F2 rename, Delete remove
- [x] **UX-F5** — `clampMenuPosition()` collision detection for timeline context menus
- [x] **UX-F6** — Primary export actions (SVG Package, React Library) surfaced at toolbar top level
- [x] **UX-F7** — Empty state with tool icons, `<kbd>` shortcuts, drag-SVG hint
- [x] **UX-F8** — "Saved X ago" relative timestamp badge with 10s interval refresh
- [x] **UX-F9** — Animated zoom overlay (`zoom-overlay-fade` keyframe, 900ms auto-dismiss)
- [x] **UX-F10** — TransitionPanel collapsible sections (Configuration, Stagger, Triggers, Bindings)

---

## Earlier Completed Phases (collapsed)

<details>
<summary>Phase 1 — Runtime Export (R1)</summary>

- [x] 1.1 — Draw annotation export from editor guide points
- [x] 1.2 — Variable Draw participation export
- [x] 1.3 — Magic Replace continuity metadata
- [x] 1.4 — Exporter diagnostics for invalid transitions
- [x] 1.5 — Effect export validation coverage
</details>

<details>
<summary>Phase 2 — Runtime Execution (R2-R3)</summary>

- [x] 2A.1 — Draw On / Draw Off executor
- [x] 2A.2 — Variable Draw progress
- [x] 2A.3 — Replace transition strategy
- [x] 2A.4 — Effect playback + snapshot composition
- [x] 2A.5 — Magic Replace continuity
- [x] 2B.1 — Efficient DOM diff-updates
- [x] 2B.2 — Effect playback in DomRenderer
- [x] 2B.3 — Draw execution in DomRenderer
- [x] 2B.4 — Runtime-dom test coverage expansion
</details>

<details>
<summary>Phase 3 — Runtime React (R4)</summary>

- [x] 3.1 — useSyncExternalStore in ConivaIcon
- [x] 3.2 — Prop-driven state changes
- [x] 3.3 — Integration tests for controlled/uncontrolled flows
- [x] 3.4 — End-to-end demo icon path
</details>

<details>
<summary>Phase 4 — CI/CD & Operational Hardening</summary>

- [x] 4A.1 — Web app CI workflow
- [x] 4A.2 — Desktop app CI workflow
- [x] 4A.3 — Test coverage reporting
- [x] 4B.1 — Prettier formatter
- [x] 4B.2 — no-explicit-any → error
- [x] 4B.3 — react-hooks exhaustive-deps → error
- [x] 4C.1 — Product naming (Coniva)
- [x] 4C.2 — Desktop code signing
- [x] 4C.3 — Desktop auto-update validation
</details>

<details>
<summary>Phase 5 — Platform & Adapter Foundation (R5-R6)</summary>

- [x] 5A.1 — Platform types + capability profiles
- [x] 5A.2 — Downgrade reporting for unsupported features
- [x] 5A.3 — Adapter vs. sync connector boundary
- [x] 5B.1 — React adapter from runtime-json
- [x] 5B.2 — Runtime helper vendoring strategy
- [x] 5B.3 — Stale-file cleanup + manifests
- [x] 5B.4 — Storybook preview generator
</details>

<details>
<summary>Phase 6 — Sync & Distribution (R7)</summary>

- [x] 6.1 — SyncTarget in project schema
- [x] 6.2 — GitHub PR connector
- [x] 6.3 — Local directory sync connector
- [x] 6.4 — Conflict detection
</details>

<details>
<summary>Phase 7 — Cross-Platform Adapters</summary>

- [x] 7.1 — Swift adapter
- [x] 7.2 — Flutter adapter
- [x] 7.3 — Web Component adapter
</details>

<details>
<summary>Phase 8 — Cross-Icon Morphing</summary>

- [x] 8.1 — Topology detection + path normalization
- [x] 8.2 — Cross-icon morph pipeline (subpath matching, De Casteljau, winding)
</details>

---

## Spec Documentation

All major implementations are documented in `/specs/`:

| Domain | Specs |
|--------|-------|
| Schema | `icon-schema.md`, `transition-schema.md` |
| Runtime | `morph-interpolation.md`, `topology-detection.md`, `transition-resolver.md`, `draw-executor.md`, `hybrid-compositor.md` |
| Editor | `editor-store.md`, `cross-icon-transitions.md` |
| Export | `runtime-json-format.md` |
