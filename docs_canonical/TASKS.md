# Tasks

## Purpose

This file records the current engineering backlog that can be justified from
the existing codebase and legacy documentation. It is not a product roadmap
replacement and should avoid speculative items that are not grounded in
repository evidence. The ordering favors repository-stability and operational
needs over product feature speculation.

**Last updated:** 2026-03-18
**Canonical product name:** Coniva (rename tracked in task 4C.1)

### Implementation order (start here)

Phases are listed below in dependency/priority order. Completed phases
are at the bottom for reference. If you're starting fresh, implement
in this order:

1. **Phase E** — Adoption Readiness (E1-E3 done; E4-E7 next)
2. **Phase 4** — CI/CD & Operational Hardening
3. **Phase A** — Animation Engine Hardening
4. **Phase B** — Runtime Capability Expansion
5. **Phase 5** — Platform & Adapter Foundation
6. **Phase C** — Editor Animation Authoring (depends on A)
7. **Phase 6** — Sync & Distribution
8. **Phase D** — React API Enrichment (depends on B)
9. **Phase 7** — Cross-Platform Adapters
10. **Phase 8** — Cross-Icon Morphing (can parallel with A)

---

## Phase 1 — Runtime Export Completion (R1 finish)

Status: **completed** (verified 2026-03-18).

All export features are implemented in `lib/export/export-runtime-json.ts`
and covered by `tests/runtime-json-export.test.ts`.

- [x] **1.1 — Draw annotation export from editor guide points.**
  `buildDrawAnnotation()` collects `drawPoint` guide items, groups by
  layer, filters layers with < 2 points, and emits `RuntimeDrawAnnotation`.
  Test: `runtime-json-export.test.ts:97-177` — fixture with drawPoint
  items for `chevron`, `bg-circle` (valid, 2 points each), and
  `accent-dot` (filtered, 1 point).

- [x] **1.2 — Variable Draw participation export.**
  `exportRuntimeIconVariant()` derives `variableDraw.participatingLayerIds`
  from draw annotation layers. Test: `runtime-json-export.test.ts:178-180`
  — asserts sorted `['bg-circle', 'chevron']`.

- [x] **1.3 — Magic Replace continuity metadata for preserved enclosures.**
  `getPreservedLayerIds()` computes preserved layers by JSON serialization
  equality. `toRuntimeTransition()` emits `magicReplace.preserveLayerIds`
  and `magicReplace.drawIntegrated`. Test: `runtime-json-export.test.ts:182-189`
  — asserts `preserveLayerIds: ['accent-dot', 'bg-circle']` and
  `drawIntegrated: true`.

- [x] **1.4 — Exporter diagnostics for invalid runtime transitions.**
  Test: `runtime-json-export.test.ts:197-217` — asserts `invalid-transition`
  diagnostic for `missingState` (references non-existent state) and
  `strictMorphMissingTopology` (strict morph without topology contract).
  Also asserts `invalid-draw-layer` for `accent-dot` (insufficient points).

- [x] **1.5 — Effect export validation coverage.**
  Test: `runtime-json-export.test.ts:220-244` — creates icon with
  `lineDrawOff` effect but no draw guides, asserts `invalid-effect`
  diagnostic fires and effect is omitted from output.

---

## Phase 2 — Runtime Execution (R2-R3)

Status: **completed** (verified 2026-03-18).

### 2A — Runtime Core (`lib/runtime-core/`)

- [x] **2A.1 — Execute Draw On / Draw Off from exported annotation data.**
  `lib/runtime-core/draw-executor.ts`: `computeDrawOnValues()` and
  `computeDrawOffValues()` consume `DrawAnnotation` and produce
  `pathLength`-based progress per layer in sequence.
  Tests: `tests/runtime-core.test.ts` — "draw executor" describe block.

- [x] **2A.2 — Support Variable Draw progress on participating layers.**
  `computeVariableDrawValues()` in `draw-executor.ts` maps normalized
  progress (0-1) across `participatingLayerIds` in sequence.
  Tests: `tests/runtime-core.test.ts` — "variable draw" describe block.

- [x] **2A.3 — Implement `replace` transition strategy execution.**
  `resolveTransition()` already assigns morph or fallback to unmatched
  layers in replace transitions. Test added verifying unmatched layers
  receive fallback or morph strategy decisions.

- [x] **2A.4 — Add effect playback and snapshot composition.**
  `lib/runtime-core/effect-scheduler.ts`: `EffectScheduler` class with
  `computeEffectValues()` supporting bounce, pulse, rotate, breathe,
  wiggle, scale, appear, disappear, lineDrawOn, lineDrawOff.
  Tests: `tests/runtime-core.test.ts` — "effect scheduler" describe block.

- [x] **2A.5 — Magic Replace continuity with preserved enclosures.**
  `resolveTransition()` accepts `preserveLayerIds` option. Preserved
  layers are marked with `preserved: true` and skip morph/fallback.
  Tests: `tests/runtime-core.test.ts` — "magic replace" describe block.

### 2B — Runtime DOM (`lib/runtime-dom/`)

- [x] **2B.1 — Efficient DOM updates across animated frames.**
  `DomRenderer.setState()` now diff-updates shared layers in-place
  (reapplies geometry/style/transform) rather than full teardown+rebuild.
  Only removes layers absent from the new state and creates new ones.
  Test: `tests/runtime-dom.test.ts` — "diff-updates shared layers".

- [x] **2B.2 — Effect playback integration in DomRenderer.**
  `IconDriver.triggerEffect()` creates an `EffectScheduler` and routes
  frame values through `DomRenderer.applyFrame()`. The driver accepts
  `effects`, `drawAnnotation`, and `targetLayerIds` options.

- [x] **2B.3 — Draw execution integration in DomRenderer.**
  `IconDriver.setVariableDrawProgress()` calls `computeVariableDrawValues()`
  and routes the output through `DomRenderer.applyFrame()`.
  `triggerEffect()` passes `drawAnnotation` to `EffectScheduler` for
  lineDrawOn/Off effects.

- [x] **2B.4 — Expand runtime-dom test coverage.**
  Added tests for:
  - Diff-based state change with shared layers (identity preservation)
  - pathLength-based draw animation (strokeDasharray/strokeDashoffset)
  - Existing crossfade test covers replace transition opacity interpolation

---

## Phase 3 — Runtime React & Demo (R4)

Status: **completed** (verified 2026-03-18).

- [x] **3.1 — Wire `useSyncExternalStore` in VibeIcon.**
  `IconDriver` now exposes `subscribe()` for `useSyncExternalStore`
  compatibility. `VibeIcon` tracks driver state via
  `useSyncExternalStore(subscribe, getSnapshot, serverSnapshot)`,
  eliminating stale-closure issues during rapid prop changes.

- [x] **3.2 — Prop-driven state changes in VibeIcon.**
  The state transition effect now compares `currentDriverState`
  (from `useSyncExternalStore`) against the resolved prop state.
  Rapid prop changes during active transitions are handled correctly:
  the driver cancels the active scheduler and starts a new transition.
  `animate={false}` destroys and recreates the driver at the new state.

- [x] **3.3 — Integration tests for VibeIcon controlled/uncontrolled flows.**
  `tests/runtime-react.test.tsx` — 9 tests covering:
  - Container dimensions (default and custom size)
  - Color and className pass-through
  - Variant resolution by size number, id string, and unknown fallback
  - Custom style composition
  - `useIconState` hook return shape

- [x] **3.4 — End-to-end demo icon path in the web app.**
  `app/demo/runtime/page.tsx` — renders two icons (Hamburger/Close
  and Chevron) with `VibeIcon`, state toggle button, animate checkbox,
  and a "Export Chevron → Runtime JSON" button that validates the full
  Editor → Export → Runtime → React pipeline in the browser.

---

## Phase 4 — CI/CD & Operational Hardening

### 4A — CI Workflows

- [ ] **4A.1 — Web app CI workflow.**
  The 3 existing workflows (`icons-pr-validate.yml`,
  `icons-post-merge-build.yml`, `icons-package-release.yml`) cover only
  the icon pipeline. Add a `web-app-ci.yml` workflow triggered on PRs
  that touch `app/`, `components/`, `lib/`, `hooks/`, or `styles/` paths.
  Steps: install, type-check, lint, test, build.

- [ ] **4A.2 — Desktop app CI workflow.**
  Add a `desktop-ci.yml` workflow triggered on PRs that touch `desktop/`.
  Steps: install desktop dependencies, type-check, build static export,
  run `desktop:build` in CI-safe mode (skip signing). Verify the build
  produces output in `desktop/build/`.

- [ ] **4A.3 — Test coverage reporting.**
  Investigate `bun test --coverage` support. If available, add coverage
  thresholds to CI. If not, document the gap and plan for a coverage
  tool integration.

### 4B — Code Quality

- [ ] **4B.1 — Commit to a code formatter (Prettier or Biome).**
  The repo currently has ESLint (`eslint.config.mjs`) but no formatter.
  Add a config and `format` / `format:check` scripts. Add `format:check`
  to CI. Start with a config that matches existing code style (2-space
  indent, single quotes, trailing commas).

- [ ] **4B.2 — Tighten `@typescript-eslint/no-explicit-any` to error.**
  Currently set to `warn` in `eslint.config.mjs`. Audit remaining `any`
  usages and fix them, then promote to `error`.

- [ ] **4B.3 — Enable `eslint-plugin-react-hooks` exhaustive-deps as error.**
  Currently set to `warn` in `eslint.config.mjs`. Fix outstanding
  violations and promote to `error`.

### 4C — Product Naming & Desktop Hardening

- [ ] **4C.1 — Product naming consistency audit.**
  The repo uses several names: `icon-authoring-tool` (package.json),
  `Icophone` (desktop/electrobun.config.ts), `icophone-runtime`
  (runtime-sdk warn prefix), `@icophone/icons` (CI package name).
  Document the canonical product name and ensure package.json, desktop
  config, and runtime warn prefixes all agree.

- [ ] **4C.2 — Desktop code signing/notarization hardening.**
  `electrobun.config.ts` already guards signing behind
  `ELECTROBUN_BUILD_ENV === 'stable'` and `requireSigningEnv()`.
  Document the required CI secrets in a `desktop/SIGNING.md` and verify
  the release pipeline succeeds end-to-end with placeholder credentials.

- [ ] **4C.3 — Desktop auto-update endpoint validation.**
  The update endpoint uses `${releaseBaseUrl}/latest.json`. The release
  script generates `latest.json`. Add a CI step or test that validates
  the generated `latest.json` matches the expected schema (version,
  releaseDate, platforms, downloadUrls).

---

## Phase 5 — Platform & Adapter Foundation (R5-R6)

### 5A — Platform Capability Layer (R5)

- [ ] **5A.1 — Define target platform types.**
  Create `lib/platform/types.ts` (the `lib/platform/` directory already
  exists with `bridge.ts` and `routes.ts`) defining: `TargetPlatform`
  (react, swift, flutter, web-component), `DeliveryMode` (package, repo,
  asset-bundle), `PlatformCapability` (draw, morph, effects, gradients,
  clip-paths), and `ExportOutcome`.

- [ ] **5A.2 — Add downgrade reporting for unsupported features.**
  When an export encounters a feature the target platform does not
  support, emit a diagnostic with downgrade info. Extend
  `RuntimeExportDiagnostic` or create a separate `PlatformDiagnostic`
  type.

- [ ] **5A.3 — Separate adapter transforms from sync connectors.**
  Document the boundary: adapters transform runtime-json into
  platform-specific output; sync connectors deliver that output to a
  target location. This is a design document, not code.

### 5B — React Adapter Family (R6)

- [ ] **5B.1 — Generate icons into generic React repos from runtime-json.**
  The existing `lib/export/export-react-components.ts` and
  `lib/export/export-react/` generate React components from the
  `CompiledIcon` pipeline. Create an equivalent that generates React
  components from `RuntimeVariantPayload`, embedding the JSON payload
  and wrapping it with the `VibeIcon` component.

- [ ] **5B.2 — Vendor or import runtime helpers for React hosts.**
  Decide whether generated React components import `VibeIcon` from a
  published runtime-react package or vendor the runtime code inline.
  Document the decision.

- [ ] **5B.3 — Add deterministic stale-file cleanup and generated file manifests.**
  When the React adapter generates files into a target directory, emit
  a `.manifest.json` listing all generated files. On subsequent runs,
  delete files in the old manifest but not the new one.

- [ ] **5B.4 — Thin host integration: Storybook preview.**
  Create a minimal Storybook story generator that produces stories for
  each generated React icon component.

---

## Phase 6 — Sync & Distribution (R7)

- [ ] **6.1 — Add target export config to project schema.**
  Extend the `ExportProfile` type (`lib/schema/types.ts`) or add a new
  `SyncTarget` type that captures: target repo, branch, path, platform,
  delivery mode, and adapter config.

- [ ] **6.2 — Build editor-side export/connections UI.**
  Add a panel or dialog for configuring sync targets. The existing
  `lib/sync-ui/` module provides `use-sync-pr.ts` and `sync-state.ts`
  for the GitHub sync flow; extend this to support the broader target
  config from 6.1.

- [ ] **6.3 — Implement local-directory sync.**
  Given a target directory path, run the adapter for the configured
  platform, write generated files, and apply stale-file cleanup from
  5B.3. This is the simplest sync connector and should be implemented
  first.

- [ ] **6.4 — Implement Git PR-based sync for adapter output.**
  The existing `lib/sync-service/sync-pr.ts` and
  `lib/sync-service/github-provider.ts` already implement PR creation
  for icon source sync. Extend or generalize this for adapter output
  sync: create a branch, write generated files, open a PR with a
  changelog summary.

---

## Phase 7 — Cross-Platform Adapters (R8)

- [ ] **7.1 — Define Swift adapter capability mapping.**
  Document which `RuntimeVariantPayload` features map to SwiftUI/UIKit:
  Draw -> CAShapeLayer stroke animation, transitions -> withAnimation,
  effects -> implicit animations. Define which features require downgrade.

- [ ] **7.2 — Define Flutter adapter capability mapping.**
  Document which features map to Flutter: Draw -> CustomPainter stroke
  animation, transitions -> AnimationController, effects -> implicit
  animations. Define downgrade rules.

- [ ] **7.3 — Decide v1 downgrade rules for non-React targets.**
  For features not supported by Swift/Flutter adapters (e.g., morph,
  complex track transitions), define the fallback behavior: snap,
  fade-through, or omit.

---

## Phase E — Adoption Readiness

These are table-stakes requirements that block adoption regardless of
animation quality. Phase E should be implemented before Phases A-D.

- [x] **E1 — SSR-safe rendering.**
  `VibeIcon` now renders static SVG inline with `<path>` elements on the
  server using `getRenderableLayers()` and `resolvePaintToString()`.
  The `IconDriver` hydrates by mounting onto the existing SVG element
  via the `existingSvg` option. `renderToStaticMarkup(<VibeIcon />)`
  produces real SVG content, not an empty div.

- [x] **E2 — Accessibility.**
  VibeIcon: `label` prop sets `role="img"` + `aria-label` on the SVG.
  When omitted, `aria-hidden="true"` is set (decorative icon).
  `focusable="false"` is always set to prevent keyboard tab-stop.
  `DomRenderer.mount()` accepts `label` and applies accessibility
  attributes on the SVG root.

- [x] **E3 — `prefers-reduced-motion` support.**
  New `lib/runtime-core/motion-preference.ts`: `shouldReduceMotion()`,
  `getMotionPreference()`, `subscribeMotionPreference()`. VibeIcon:
  `reduceMotion` prop (default `'system'`). Driver: when reduced motion
  is active, transitions snap via `setState()` (no scheduler created)
  and effects are suppressed.

- [x] **E4 — Generated component API (promote from Phase 5B).**
  The codegen pipeline should produce per-icon components:
  `export function ChevronRight(props) { return <VibeIcon icon={data} {...props} /> }`.
  TypeScript autocomplete for icon names via barrel exports. Tree-shakeable
  (one file per icon). Type-safe state/effect names per icon (generated
  from schema). This is the PRIMARY consumer API — nobody should import
  raw JSON schema objects.

- [x] **E5 — Bundle size targets and tree-shaking.**
  Runtime core target: <10KB gzipped. Per-icon data: <2KB gzipped.
  Tree-shaking: icons individually importable, unused icons don't bundle.
  Code-split animation engine: static SVG render path loads zero animation
  JS; animation JS loads on first interaction. Measurement is enforced via
  `scripts/check-runtime-size.ts` and CI workflow steps.

- [x] **E6 — Vanilla JS API.**
  `createIcon(container, iconData, options)` — framework-agnostic entry
  point. Same `IconDriver` interface, no React dependency. Implemented as
  `createIcon(...)` (first-class alias over `createIconDriver`) in
  `lib/runtime-dom/driver.ts`, with variant auto-resolution and docs.
  Vue/Svelte/Angular wrappers become thin layers over this.

- [x] **E7 — CSS transition fallback for simple animations.**
  For simple property animations (opacity, transform), use CSS transitions
  instead of JS rAF. Only use JS for: morph (path `d` interpolation),
  draw (pathLength), complex multi-property interpolation. CSS transitions
  are more battery-efficient, respect `prefers-reduced-motion` natively,
  and run on the compositor thread. Detect which tracks need JS vs CSS
  at transition resolution time. Runtime now plans CSS fallback for track
  transitions with transform/opacity-only tracks, while JS schedulers remain
  for morph, draw/pathLength, and fallback crossfade cases.

---

## Phase A — Animation Engine Hardening

Addresses critical gaps relative to SF Symbols + Framer Motion quality.
All changes are in `lib/runtime-core/` and `lib/schema/types.ts`.

- [ ] **A1 — Cubic-bezier custom easing.**
  `lib/runtime-core/easing.ts`: parse `cubic-bezier(x1,y1,x2,y2)`
  strings via Newton-Raphson t-solving. Add `steps(n, 'start'|'end')`
  for stepped animations. No schema changes needed — easing field
  already accepts arbitrary strings. The current 6 hardcoded presets
  remain as shortcuts.

- [ ] **A2 — Spring physics engine.**
  New `lib/runtime-core/spring.ts`: `SpringSolver` class implementing
  an analytical damped harmonic oscillator (stiffness, damping, mass,
  velocity). `springProgress(config, elapsed)` returns progress with
  overshoot for underdamped springs. `estimateSpringDuration(config)`
  returns settling time. Presets: gentle, bouncy, stiff, slow.
  Schema: add `SpringConfig` type, widen `Transition.easing` and
  `Effect.easing` to `string | SpringConfig`. `durationMs` becomes a
  hard cap when spring is active. Properties clamp individually in the
  renderer (not at scheduler level) to allow overshoot on transform
  properties while clamping opacity to [0,1].

- [ ] **A3 — Color interpolation.**
  New `lib/runtime-core/color.ts`: `interpolateColor(from, to, t)` with
  hex parsing (#RGB, #RRGGBB, #RRGGBBAA) and linear RGB lerp (not sRGB,
  for perceptually correct transitions). Schema: add `fill` and `stroke`
  properties to `TimelineTrack` with string keyframes. Renderer: handle
  color values in `applyAnimatedValues` by setting fill/stroke attributes.

- [ ] **A4 — Guide point-aware Draw execution.**
  `lib/runtime-core/draw-executor.ts`: use guide point `t` values to
  determine each layer's active range within overall progress, instead
  of uniform distribution. Layer with `[{t:0},{t:0.3}]` reveals between
  progress 0.0–0.3. Fallback to uniform when no guide points available.

- [ ] **A5 — Per-layer stagger controls.**
  Schema: add optional `delayMs`/`durationMs` to `LayerBinding`; add
  `stagger` to `Transition` with `mode` (linear/from-center/from-edges/
  random), `perLayerMs`, and optional `easing`. In `transition-resolver.ts`,
  `computeDelay` checks: explicit binding delay first, then stagger
  config, then role-based fallback.

- [ ] **A6 — Animation interruption with blend-out.**
  `lib/runtime-core/scheduler.ts`: `interrupt(blendOutMs)` captures
  current interpolated values, lerps to rest position over the blend
  duration. `lib/runtime-dom/driver.ts`: call `interrupt(80)` instead
  of `cancel()` when a new transition starts mid-animation. Brief
  overlap period where blending scheduler and new scheduler both run.

---

## Phase B — Runtime Capability Expansion

- [ ] **B1 — Additional animatable properties.**
  Schema: add `strokeWidth`, `fillOpacity`, `strokeOpacity` to
  `TimelineTrack` property union. Renderer: handle new properties in
  `applyAnimatedValues`. Compiler contracts: extend
  `CompiledTrackProperty`. Export: add to `SUPPORTED_TRACK_PROPERTIES`.

- [ ] **B2 — Parallel effect + transition execution.**
  `lib/runtime-dom/driver.ts`: replace single `activeEffectScheduler`
  with `Map<string, EffectScheduler>`. Different effects stack; same
  effect ID replaces. Add `cancelEffect(effectId)` and
  `cancelAllEffects()` to `IconDriver`. Renderer: compose transition
  values + effect deltas (effects are additive for transforms,
  multiplicative for opacity).

- [ ] **B3 — Animation callbacks.**
  `AnimationEvent` type: transitionStart/Complete, effectStart/Complete.
  `CreateIconDriverOptions.onAnimationEvent` callback. VibeIcon props:
  `onTransitionStart`, `onTransitionComplete`, `onEffectComplete`.

- [ ] **B4 — variableColor implementation.**
  Schema: add optional `palette?: string[]` to `Effect`.
  `lib/runtime-core/effect-scheduler.ts`: variableColor case cycles
  through palette colors per layer role using A3 color utilities.

---

## Phase C — Editor Animation Authoring

- [ ] **C1 — Visual bezier curve editor.**
  New `components/editor/BezierCurveEditor.tsx`: interactive SVG canvas
  for dragging control points (x1,y1) and (x2,y2) on a unit square.
  Real-time curve preview, preset sidebar (material ease, spring
  approximation). Integration with existing `EasingPicker.tsx` as
  "Custom" option. Spring config inputs (stiffness/damping/mass sliders)
  when "Spring" is selected.

- [ ] **C2 — Manual layer binding controls.**
  `components/editor/TransitionPanel.tsx`: layer binding list showing
  auto-resolved from→to mappings. Dropdown to reassign target layers.
  Add/remove explicit bindings. "Reset to Auto" button that clears
  explicit bindings and re-runs auto-resolution.

- [ ] **C3 — Per-track easing.**
  Schema: add optional `easing?: string | SpringConfig` to
  `TimelineTrack`. `components/editor/TimelineEditor.tsx`: easing
  indicator per track row. `lib/runtime-core/scheduler.ts`: per-track
  easing overrides transition-level easing in `buildInterpolatedValues`.

- [ ] **C4 — Stagger/delay controls per binding.**
  `components/editor/TransitionPanel.tsx`: delay and duration number
  inputs on each layer binding row. Global stagger mode dropdown with
  perLayerMs input. Depends on A5 schema changes.

- [ ] **C5 — Custom effect builder.**
  New `components/editor/CustomEffectBuilder.tsx`: compose effects from
  primitive transforms with per-property curves. Schema: add
  `kind: 'custom'` to `Effect.kind` union, add
  `customTracks?: TimelineTrack[]` to `Effect`. EffectScheduler: handle
  custom kind via keyframe interpolation.

- [ ] **C6 — State interaction triggers.**
  Schema: add `triggers?: StateTrigger[]` to `Transition`
  (`StateTrigger = { event: 'hover' | 'tap' | 'longPress' | 'focus' |
  'auto' }`). New `components/editor/TriggerEditor.tsx`: attach trigger
  events to transitions. Advisory metadata for code generation.

---

## Phase D — React API Enrichment

- [ ] **D1 — Imperative ref API.**
  `React.forwardRef` on VibeIcon exposing: `transitionTo`,
  `triggerEffect`, `cancelEffect`, `cancelAllEffects`,
  `getCurrentState`, `setVariableDrawProgress`. Enables imperative
  control from parent components.

- [ ] **D2 — Gesture props.**
  VibeIcon: `hoverState`, `tapState`, `onHoverStart/End`,
  `onTapStart/End` props. Auto-bind pointer events to state transitions.
  Explicit `state` prop takes precedence over gesture states.

- [ ] **D3 — Animation callbacks.**
  Wire Phase B3 driver events to VibeIcon props:
  `onTransitionStart(from, to)`, `onTransitionComplete(from, to)`,
  `onEffectComplete(effectId)`.

- [ ] **D4 — Animation progress visibility.**
  `onFrame?: (progress: number, stateId: string) => void` prop on
  VibeIcon. New `useAnimationProgress` hook via `useSyncExternalStore`
  returning `{ progress, isAnimating, currentState }`.

---

## Phase 8 — Cross-Icon Morphing & Advanced Transitions (R9)

Research into SF Symbols 7, GSAP MorphSVG, Flubber, and production icon
patterns identifies three distinct transition categories requiring
different algorithms.

### 8.1 — Same-icon state morphing improvements

`strictMorph()` and `bestGuessMorph()` in `lib/runtime-core/morph.ts`
are partially implemented. Improvements needed:

- [ ] **8.1a — Arc-to-cubic conversion.**
  Currently arcs are rejected (`normalizeToCubicPath` returns null for
  arc segments). Add A→C conversion using pi/4 arc segments on the unit
  circle, scaled to the original ellipse (standard algorithm).

- [ ] **8.1b — Rotational interpolation.**
  Replace raw x,y coordinate interpolation in `strictMorph` with
  GSAP-style angle+length interpolation of control point handles
  relative to their anchors. Prevents mid-morph kinks.

- [ ] **8.1c — Shape index optimization.**
  Auto-compute optimal point correspondence offset that minimizes sum
  of squared point displacements, instead of sequential index matching.
  Similar to GSAP's `shapeIndex: 'auto'`.

### 8.2 — Cross-icon morphing (e.g., play→pause, search→close)

New algorithm for morphing between different icons that share similar
topology but different geometry. Common cases: hamburger→X, play→pause,
plus→close, arrow direction changes, lock→unlock, sort→filter.

- [ ] **8.2a — Sub-path matching.**
  Pair sub-paths between source and target icons by centroid proximity
  and bbox similarity (reuse `computeReadiness` scoring from
  `transition-resolver.ts`).

- [ ] **8.2b — Segment-level De Casteljau subdivision.**
  Extend `alignCubicPaths` with per-segment subdivision to equalize
  curve counts within each sub-path pair. Distribution formula:
  `stepSecond = longer.length / shorter.length`.

- [ ] **8.2c — Shape index for each sub-path pair.**
  Find optimal rotation offset per paired sub-path that minimizes
  total displacement. Test all offsets and pick the minimum.

- [ ] **8.2d — Unmatched sub-path handling.**
  Collapse unmatched sub-paths to their centroid point (existing
  degenerate path creation) with coordinated fade-in/fade-out.

### 8.3 — Line-to-solid icon transitions (topology-incompatible)

SF Symbols does NOT morph geometry between outline and filled variants.
Apple uses layer-level crossfade. This is correct because topology
changes fundamentally (open stroked paths vs. closed filled paths).

- [ ] **8.3a — Topology incompatibility detection.**
  Detect when source and target have incompatible topology: different
  sub-path count, different closed/open status, or fill mode change
  (stroked→filled). Auto-select crossfade strategy.

- [ ] **8.3b — Coordinated crossfade with emphasis.**
  Outgoing icon fades out (opacity 1→0) while incoming fades in (0→1).
  Add scale pulse on incoming (1.0→1.12→1.0 via spring easing) for
  tactile feedback. Covers: heart outline→filled, bookmark outline→
  filled, eye→eye-slash, volume→mute.

- [ ] **8.3c — Draw-coordinated crossfade (SF Symbols 7 style).**
  When Magic Replace + Draw metadata are available, outgoing layers
  use Draw Off while incoming layers use Draw On, creating the
  handwriting-style transition that SF Symbols 7 introduced.

### 8.4 — Editor topology validation

- [ ] **8.4a — Geometry change warnings.**
  Warn in editor when user changes geometry that breaks an existing
  strict-morph transition's topology contract. Check on path edit commit.

- [ ] **8.4b — Morph readiness indicator in TransitionPanel.**
  Show morph readiness score with green/yellow/red indicator. The
  existing `computeReadiness` scoring in `transition-resolver.ts`
  provides the data; the editor needs to surface it.

- [ ] **8.4c — Morph quality preview.**
  Preview morph interpolation at 0%, 25%, 50%, 75%, 100% in the
  TransitionPanel before committing, so users can evaluate quality.

---

## Completed (reference only)

### Editor Authoring (Phase 1 — done)
- [x] Schema types and runtime guards
- [x] Zustand editor store with temporal history
- [x] SVG renderer, canvas overlay, editor-core
- [x] Import/export stack
- [x] Deterministic test coverage

### Repo Preparation (R0 — done)
- [x] Package metadata and naming
- [x] Test runner formalization (Bun)
- [x] Shared runtime payload types (`lib/compiler-contracts/types.ts`)
- [x] Module boundary definitions (`lib/runtime-core/`, `lib/runtime-dom/`, `lib/runtime-react/`)

### Harness and Repository Hygiene (P0 — done)
- [x] Root package metadata formalized to `icon-authoring-tool`
- [x] Repository-level lint/test entrypoints explicit in root package scripts
- [x] Canonical and legacy operational docs reconciled

### Documentation Portability (P3 — done)
- [x] Machine-local absolute links replaced with repository-relative links
- [x] Historical planning docs internal cross-links fixed
- [x] Environment-specific path leakage reduced in contributor-facing docs

---

## Source Basis

This backlog is derived from:

- current code and module presence
- `IMPLEMENTATION.md` (Phases R1-R9)
- desktop build/release docs
- dated planning docs in `docs/plans/`
- CI workflow definitions in `.github/workflows/`
- SF Symbols 7 animation model (Draw, Variable Draw, Magic Replace, replace effects)
- Framer Motion / Motion API patterns (spring physics, gesture-driven animation)
- GSAP MorphSVG, Flubber, and SVG Morpheus morphing algorithm research

## Known Conflicts / Notes

- Some legacy plan items are already partially or fully implemented in code, so they should not be copied forward blindly as untouched backlog.
- This file intentionally favors repository-stability and operational needs over product feature speculation.
- Phase numbering: 1-8 align with R0-R9 from `IMPLEMENTATION.md`; Phases A-D are animation architecture phases not in the original roadmap.
- Phase E (adoption readiness) should be implemented before Phases A-D. Phases A and 8 can run in parallel. Phase C depends on A. Phase D depends on B.
