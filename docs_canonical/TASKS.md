# Tasks

**Last updated:** 2026-03-23
**Canonical product name:** Coniva

## Open Phases

| # | Phase | Status | Tasks | Summary |
|---|-------|--------|-------|---------|
| I | **Animation Tab Surface** | open | 11 | Expose all 14 track types, per-binding strategy display, trim path UI |
| J | **Animation Preview & Composition** | open | 9 | HybridFrame bridge, cross-icon preview, direction, variable value |
| K | **Advanced Animation Authoring** | open | 6 | Magic Replace UI, weight/gradient preview, auto-strategy, presets |
| L | **Inspect Tab Redesign** | open | 6 | Variable value indicator, topology display, strategy badges, weight editor |

---

## Phase I — Animation Tab Surface

Status: **open** (bridge gap between runtime capabilities and editor UI)

The runtime implements 14 timeline track types (6 transform, 3 trim, 3 style,
2 color), per-subpath strategy classification, trim path computation, and
hybrid frame composition. The Animation tab currently exposes only 6 track
types (transform + pathLength) and no trim, style, color, or subpath UI.
This phase surfaces all existing runtime capabilities in the editor.

Spec: [`specs/editor/animation-tab.md`](../specs/editor/animation-tab.md)

### Priority 1 — Track Completeness

- [ ] **I1 — Add trim path tracks to TimelineEditor.**
  Add `trimStart`, `trimEnd`, `trimOffset` to the `TRACKS` array in
  `components/editor/TimelineEditor.tsx`. These are numeric 0-1 tracks
  with rest values defined in `scheduler.ts` (trimStart=0, trimEnd=1,
  trimOffset=0). Enables authoring stroke-reveal and traveling-segment
  animations for open paths.

- [ ] **I2 — Add style tracks to TimelineEditor.**
  Add `strokeWidth`, `fillOpacity`, `strokeOpacity` to the `TRACKS`
  array. These were added in Phase H3 at the schema/runtime level but
  never exposed in the editor. All are numeric tracks with standard
  interpolation.

- [ ] **I2b — Add color tracks to TimelineEditor.**
  Add `fill` and `stroke` to the timeline as color-type tracks. These
  are already defined in the `TimelineTrack` union in `lib/schema/types.ts`
  and handled by the runtime interpolation path in `scheduler.ts` and
  `store.ts`. Unlike numeric tracks, color tracks need a color keyframe
  editor (hex input or color picker per keyframe) instead of a numeric
  input. Implementation: add a `ColorTrackRow` component alongside the
  existing numeric `TrackRow`, with color swatch keyframes that open
  `ColorPickerPopover` on click.

- [ ] **I3 — Smart track suggestions based on path topology.**
  When a user adds a track to a layer binding, suggest appropriate
  tracks based on the layer's subpath classification:
  - Closed subpaths → suggest morph-related tracks (opacity, scale)
  - Open subpaths → suggest trim tracks (trimStart, trimEnd, trimOffset)
  - All layers → suggest transform tracks (translateX/Y, rotate, scale)
  Show suggestions as a categorized dropdown with section headers.

### Priority 2 — Per-Binding Strategy Display

- [ ] **I4 — Show per-binding animation strategy in layer binding list.**
  In `TransitionPanel.tsx`, display the classified strategy (morph/trim/
  crossfade/preserved) next to each layer binding with color-coded
  badges. Use `classifySubPathStrategies()` from topology-detection.ts
  to compute. Green=morph, Yellow=trim, Red=crossfade, Blue=preserved.

- [ ] **I5 — Show per-binding morph readiness scores.**
  Expand the layer binding list to show `MorphReadiness` score per
  binding (not just global compatibility badge). Display score components:
  commandCompatibility, subpathCompatibility, closedCompatibility,
  bboxSimilarity, centroidSimilarity. Show recommended strategy with
  one-line explanation.

- [ ] **I6 — Per-subpath strategy breakdown for compound paths.**
  When a layer has multiple subpaths, show a collapsible breakdown:
  `subpath 0: morph (both closed, score: 0.94)` /
  `subpath 1: trim (both open, mismatched commands)`.
  Use `classifySubPathStrategies()` output. Only shown for layers
  with > 1 subpath.

- [ ] **I7 — Per-binding strategy override.**
  Allow users to override the auto-classified strategy per binding.
  Add a strategy selector dropdown to each binding in the list.
  Override persists in the LayerBinding schema (add optional
  `strategyOverride?: 'morph' | 'trim' | 'crossfade'`).

### Priority 3 — Trim Path UI

- [ ] **I8 — Compound trim mode selector.**
  When a binding has trim tracks, show a `CompoundTrimMode` dropdown
  (`simultaneously` / `individually`) in the binding detail view.
  Wire to `LayerBinding.compoundTrimMode`. Default to `simultaneously`.

- [ ] **I9 — Trim path visual preview in timeline.**
  When trim tracks are active, show a miniature path preview next to
  the track rows indicating the visible stroke range. Update in
  real-time as the playhead scrubs. Use `computeTrimValues()` to
  compute the dasharray/dashoffset for the preview.

- [ ] **I10 — Default trim keyframes auto-population.**
  When the system classifies a binding as `trim` strategy, auto-populate
  default keyframes: `trimEnd: [0, 1]` (draw on) with the transition's
  easing. User can edit or remove these defaults.

---

## Phase J — Animation Preview & Composition

Status: **open** (live preview integration for cross-icon, direction, variable value)

### Priority 0 — Rendering Infrastructure (from eng review)

- [ ] **J0 — Build HybridFrame → SVG rendering bridge.**
  Create `lib/editor-renderer-svg/hybrid-frame-bridge.ts` with
  `applyHybridFrameToSVG(frame: HybridFrame, svgElement: SVGElement)`.
  Routes morph paths to d-attribute updates, trim paths to
  stroke-dasharray/dashoffset CSS, crossfade paths to opacity.
  **Blocks J3 and J4.** Wire into the canvas preview pipeline alongside
  existing `applyTransitionPreview()`.

### Priority 1 — Cross-Icon Preview

- [ ] **J1 — Cross-icon transition preview in timeline.**
  When a cross-icon transition is selected, load layers from both
  source and target icons simultaneously. Render the interpolated
  frame on the canvas using `resolveTransition()` with
  `crossIconContext`. The timeline should show source layers fading
  out and target layers fading in with morph/trim tracks overlaid.

- [ ] **J2 — Cross-icon layer matching visualization.**
  In the layer binding list, show which source layer matched to which
  target layer and why (role match, name match, geometry match).
  Display the 3-pass matching result from the resolver with a brief
  label per binding: "matched by role", "matched by name",
  "matched by geometry (score: 0.82)".

### Priority 2 — Direction & Composition Preview

- [ ] **J3 — Direction preview in canvas.**
  When direction is set on a replace transition, the canvas preview
  should show the directional slide+fade effect during scrubbing.
  Apply `buildDirectionalReplaceSnapshot()` transform values
  (translateY offset, scale) to the rendered SVG layers.

- [ ] **J4 — Hybrid frame preview in canvas.**
  When a transition has mixed strategies (morph + trim + crossfade),
  render the hybrid frame using `composeHybridFrame()`. Split the
  SVG rendering into: morphed paths (interpolated d attribute),
  trimmed paths (dasharray animation), crossfaded paths (opacity).
  Show which rendering mode each subpath uses via a toggle overlay.

- [ ] **J5 — Stagger delay visualization in timeline.**
  Show computed stagger delays as offset indicators in the timeline.
  Each binding row should show its delay as an indented start position.
  For `individually` mode, each row starts after the previous completes.

### Priority 3 — Variable Value Integration

- [ ] **J6 — Variable value live canvas preview.**
  Connect the variable value slider (in InspectorPanel) to the canvas
  rendering pipeline. When the slider moves, call
  `computeVariableValue()` and `applyVariableValue()` to update
  layer opacities in real-time on the canvas.

- [ ] **J7 — Per-layer visibility indicators at current variable value.**
  In the layer panel, show dim/bright indicators per layer based on
  the current variable value. Primary layers (visible at value > 0),
  secondary (visible at value > 0.33), tertiary (visible at > 0.66).
  Use role badges already in the layer panel.

- [ ] **J8 — Variable value keyframe track.**
  Add `variableValue` as an animatable track in the timeline editor.
  This allows authoring transitions where the variable value changes
  over time (e.g., wifi signal bars filling up during a transition).
  Schema: add `{ property: 'variableValue'; keyframes: number[] }` to
  TimelineTrack union.

---

## Phase K — Advanced Animation Authoring

Status: **open** (advanced features building on Phase I and J)

### Priority 1 — Magic Replace & Topology

- [ ] **K1 — Magic Replace UI (preserveLayerIds).**
  Add a "Preserve" toggle per layer binding in the binding list.
  When toggled, the binding is marked `preserved: true` and excluded
  from morph/trim/crossfade — the layer persists unchanged during the
  transition. Wire to the `preserveLayerIds` field on the transition.

- [ ] **K2 — Topology contract locking UI.**
  Add a "Lock Topology" toggle in the state inspector. When locked,
  geometry edits that would change the command signature are blocked
  with a warning. Shows the current topology contract (subpath count,
  command signature, closed status per subpath). Wire to
  `State.topology.locked`.

### Priority 2 — Weight & Gradient

- [ ] **K3 — Weight interpolation preview.**
  In the variant inspector, when 3 weight control points are available
  (ultralight, regular, black), show a weight slider (100-900) that
  previews interpolated paths on the canvas. Use `interpolateWeight()`
  and `validateWeightControlPoints()`.

- [ ] **K4 — Auto-gradient rendering mode preview.**
  Add an "Auto Gradient" option to the rendering mode dropdown.
  When selected, apply `generateAutoGradient()` to each layer's fill
  color and render with linear gradient stops. Preview on canvas.

### Priority 3 — Animation Intelligence

- [ ] **K5 — Auto-strategy recommendation engine.**
  When creating a transition, analyze all layer bindings and recommend
  the optimal transition strategy (track vs morph vs replace) based on
  aggregate morph readiness scores. Show a one-click "Apply recommended
  strategy" button with explanation.

- [ ] **K6 — Animation preset library.**
  Create a library of reusable animation presets (e.g., "SF Symbols
  Replace Down-Up", "Lottie Draw-On", "Morph with Stagger") that
  pre-configure strategy, direction, stagger, and default keyframes.
  Store as JSON templates in the project or workspace.

---

## Phase L — Inspect Tab Redesign

Status: **open** (surface runtime state and topology in layer inspector)

The Inspect tab currently shows basic layer properties (role, fill, stroke,
transform). It must surface computed runtime state (variable value opacity,
animation strategy, topology contract) and enable advanced authoring controls
(topology locking, weight control points, auto-gradient preview).

Spec: [`specs/editor/animation-tab.md`](../specs/editor/animation-tab.md) §Inspect Tab

- [ ] **L1 — Variable value opacity indicator.**
  Show the computed opacity at the current `variableValue` next to the
  layer's authored opacity. Display the role threshold range
  (e.g., "secondary: visible at 33-66%") and current computed value.
  Use `computeVariableValue()` output for the selected layer.

- [ ] **L2 — Topology status display.**
  Show the selected layer's `GeometryStats`: subpath count, command
  signature per subpath, closed/open status per subpath. Read from
  `computeGeometryStats()` in `path-normalization.ts`. Collapsible
  section below the Position fields. Helps users understand why
  certain morph strategies are recommended.

- [ ] **L3 — Animation strategy badge.**
  When a transition is selected in the Animation tab and the currently
  inspected layer participates in a binding, show a badge indicating
  the classified strategy (morph/trim/crossfade/preserved) with
  color coding (green/yellow/red/blue). Read from `classifySubPathStrategies()`
  output cached in TransitionPreview.

- [ ] **L4 — Weight control point editor.**
  When the variant uses weight interpolation, show the current weight
  value and a list of available control points (ultralight/regular/black).
  Allow uploading or assigning SVG paths as control point data for each
  weight. Store in `Variant.weightControlPoints` (new schema field).
  **Prerequisite for K3** (weight preview slider).

- [ ] **L5 — Auto-gradient preview swatch.**
  When auto-gradient rendering mode is active, show gradient stop
  previews next to each layer's fill color in the inspector. Display
  the 3-stop gradient (lighten/original/darken) generated by
  `generateAutoGradient()`. Helps users understand how their solid
  colors will appear in gradient mode.

- [ ] **L6 — Topology lock toggle.**
  Move topology locking from K2 to the Inspect tab (its natural home).
  Add a "Lock Topology" toggle in the layer topology section (L2).
  When locked, show a lock icon and block geometry edits that would
  change the command signature. Wire to `State.topology.locked`.

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
