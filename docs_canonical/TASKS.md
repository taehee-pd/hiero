# Tasks

## Purpose

This file records the current engineering backlog that can be justified from
the existing codebase and legacy documentation. It is not a product roadmap
replacement and should avoid speculative items that are not grounded in
repository evidence. The ordering favors repository-stability and operational
needs over product feature speculation.

Maintenance rule: update this file after every materially completed repository
change so the task status and implementation notes continue to match the code.

**Last updated:** 2026-03-23 (UX audit, animation model refactor, SF Symbols gap analysis)
**Canonical product name:** Coniva (rename tracked in task 4C.1)

### Implementation order (start here)

Phases are listed below in dependency/priority order. Completed phases
are at the bottom for reference. If you're starting fresh, implement
in this order:

1. ~~**Phase 4** — CI/CD & Operational Hardening~~ (completed)
2. ~~**Phase B** — Runtime Capability Expansion~~ (open — B1-B4 not started)
3. ~~**Phase 5** — Platform & Adapter Foundation~~ (completed)
4. ~~**Phase C** — Editor Animation Authoring~~ (completed)
5. ~~**Phase 6** — Sync & Distribution~~ (completed)
6. ~~**Phase D** — React API Enrichment~~ (completed)
7. ~~**Phase 7** — Cross-Platform Adapters~~ (completed)
8. ~~**Phase 8** — Cross-Icon Morphing~~ (completed)
9. **Phase F** — Cross-Icon Transition Model (open — animation model refactor)
10. **Phase G** — Closed/Open Path Animation Strategy (open — dual animation model)
11. **Phase H** — SF Symbols Parity (open — close remaining gaps)
12. **Phase UX** — Visual & Interaction Polish (open — UX audit findings)

---

## Phase F — Cross-Icon Transition Model

Status: **open** (animation model refactor from same-icon states to cross-icon transitions)

The current animation model treats transitions as state changes within a
single icon variant (State A → State B of the same icon). The target model
supports transitions between *different* icons (Icon A → Icon B), matching
the SF Symbols `.contentTransition(.symbolEffect(.replace))` paradigm.

**Key insight:** The Phase 8.2 `crossIconMorph()` pipeline already supports
arbitrary path pairs regardless of source icon. The limitation is purely at
the schema and transition-resolver layers, not the interpolation engine.

- [ ] **F1 — Extend Transition schema for cross-icon references.**
  Update `Transition` type in `lib/schema/types.ts` to support optional
  cross-icon endpoint references. Proposed shape:
  ```
  TransitionEndpoint = { iconId: string; variantId: string; stateId: string }
  ```
  Existing intra-variant transitions remain valid (backward compatible).
  When `fromIcon`/`toIcon` fields are absent, behavior is unchanged.

- [ ] **F2 — Update transition resolver for cross-icon context.**
  `lib/runtime-core/transition-resolver.ts`: update `resolveTransition()`
  to accept a `crossIconContext` option carrying source/target icon IDs.
  Layer binding resolution (`resolveBindings`) must handle layer matching
  across different icons using semantic matching (name, role, path
  similarity) instead of ID equality. Topology analysis already works
  for arbitrary state pairs — no changes needed there.

- [ ] **F3 — Update editor store for cross-icon preview.**
  `lib/editor-store/store.ts`: extend `TransitionPreview` type to carry
  `baseIconId`/`baseVariantId`/`targetIconId`/`targetVariantId`. The
  preview rendering pipeline must load and resolve layers from two
  different icons simultaneously.

- [ ] **F4 — Cross-icon transition UI in TransitionPanel.**
  `components/editor/TransitionPanel.tsx`: add a "Cross-Icon" transition
  mode alongside existing "Intra-Variant" mode. In cross-icon mode, show
  two pickers: source icon/variant/state and target icon/variant/state.
  Compatibility display and morph readiness indicator already work for
  arbitrary state pairs — reuse as-is.

- [ ] **F5 — Replace transition direction support.**
  Add `direction?: 'downUp' | 'upUp' | 'offUp' | 'automatic'` to
  `Transition` type. Implement directional slide+fade in the replace
  strategy instead of pure crossfade. Matches SF Symbols
  `.replace.downUp` / `.replace.upUp` options.

---

## Phase G — Closed/Open Path Animation Strategy

Status: **open** (dual animation model based on path topology)

Research conclusion: the industry-standard approach (SF Symbols, After
Effects, Lottie, GSAP) is to apply different animation strategies based
on whether a path is closed or open:

- **Closed paths** → geometric morphing (shape A → shape B)
- **Open paths** → trim/draw animation (stroke reveal via pathLength)
- **Mixed** → per-subpath strategy selection

The current codebase already has both engines (`crossIconMorph` for closed
paths, `draw-executor` for open paths) but treats each *layer* uniformly.
The gap is per-subpath strategy splitting within a single layer.

- [ ] **G1 — Per-subpath animation strategy classifier.**
  New function in `lib/runtime-core/topology-detection.ts`:
  `classifySubPathStrategies(fromPath, toPath)` returns per-subpath-pair
  animation strategy (`'morph' | 'trim' | 'crossfade'`). Uses the
  existing `CubicSubPath.closed` boolean and `TopologyContract.closed[]`
  for classification. Rules: both closed → morph; both open with matching
  topology → morph; both open with mismatched topology → trim/draw;
  closed-to-open → crossfade with draw-coordinated transition.

- [ ] **G2 — Trim path start/end/offset (Lottie-style).**
  Extend `TimelineTrack` property union with `trimStart`, `trimEnd`,
  `trimOffset` (0-1 normalized). This enables traveling-segment effects,
  bidirectional draws, and rotational reveals beyond the current single
  `pathLength` (0-1 draw-on) model. Renderer: compute `stroke-dasharray`
  and `stroke-dashoffset` from `(trimEnd - trimStart) * pathLength` and
  `trimStart * pathLength + trimOffset * pathLength`.

- [ ] **G3 — Open-path geometry morphing.**
  Allow morphing between two open paths with matching command signatures.
  Currently `topology-detection.ts` flags `closed-open-mismatch` only
  when one path is closed and the other is open. Add handling for the
  case where both paths are open with compatible topology — these should
  morph geometrically, not use trim animation.

- [ ] **G4 — Compound path trim modes.**
  For compound paths with multiple open subpaths, add a trim mode option:
  `'simultaneously'` (all subpaths trim together as one continuous path)
  vs `'individually'` (each subpath trims independently). Mirrors After
  Effects' "Trim Multiple Shapes" behavior. Implement in
  `lib/runtime-core/draw-executor.ts`.

- [ ] **G5 — Hybrid morph+trim animation compositor.**
  New compositing function that takes per-subpath strategies from G1 and
  applies morph interpolation to closed subpaths while applying trim/draw
  to open subpaths within the same frame. Renders into a single `<path>`
  or splits into multiple `<path>` elements as needed.

---

## Phase H — SF Symbols Parity

Status: **open** (close remaining gaps with SF Symbols 5-7 spec)

Gap analysis shows ~85-90% feature parity with SF Symbols. The following
items close the most impactful remaining gaps.

### Priority 1 — High Impact

- [ ] **H1 — Variable Value system (independent of draw).**
  Add `variableValue?: number` (0.0-1.0) to variant/icon driver state.
  Implement progressive layer opacity/visibility based on value and layer
  hierarchy level (primary/secondary/tertiary). Independent of draw
  animation — controls how many layers are "filled." Use cases: wifi
  signal bars, battery level, speaker volume indicators.
  Builds on existing layer role system and rendering mode infrastructure.

- [ ] **H2 — Parallel effect + transition execution (Phase B2).**
  Replace single `activeEffectScheduler` with `Map<string, EffectScheduler>`.
  Effects stack: transforms are additive, opacity is multiplicative.
  Same effect ID replaces; different IDs compose. Add `cancelEffect(id)`
  and `cancelAllEffects()` to `IconDriver`.

- [ ] **H3 — Additional animatable properties (Phase B1).**
  Add `strokeWidth`, `fillOpacity`, `strokeOpacity` to `TimelineTrack`
  property union. Wire into `applyAnimatedValues` in renderer. Extend
  `CompiledTrackProperty`. Schema types already exist — this is wiring.

### Priority 2 — Medium Impact

- [ ] **H4 — "Individually" sequential playback mode.**
  Add `'individually'` to stagger mode enum. Each layer completes its
  animation before the next starts (strict sequential). Implementation:
  compute total duration as `n * effectDurationMs`, delay each layer by
  `i * effectDurationMs`. Trivial given existing stagger infrastructure.

- [ ] **H5 — Variant derivation system.**
  Define `SymbolVariantModifier` type: `'fill' | 'circle' | 'square' |
  'slash' | 'badge'`. Auto-generate fill variants from outline variants
  (path boolean operations or pre-authored). Context-aware variant
  selection (platform/container hints). Matches SF Symbols
  `.symbolVariant(.fill)` auto-application. High effort — requires
  path boolean operations or manual authoring tooling.

- [ ] **H6 — Animation callbacks (Phase B3).**
  `AnimationEvent` type: transitionStart/Complete, effectStart/Complete.
  `CreateIconDriverOptions.onAnimationEvent` callback. ConivaIcon props:
  `onTransitionStart`, `onTransitionComplete`, `onEffectComplete`.

- [ ] **H7 — variableColor implementation (Phase B4).**
  Add optional `palette?: string[]` to `Effect`. `effect-scheduler.ts`:
  variableColor case cycles through palette colors per layer role using
  A3 color interpolation utilities.

### Priority 3 — Lower Impact

- [ ] **H8 — Auto-gradient rendering mode.**
  Add `'autoGradient'` rendering mode modifier. Auto-generate linear
  gradient stops from a single source color (lighter to darker). Apply
  across all rendering modes. Matches SF Symbols 7 gradient rendering.

- [ ] **H9 — Weight interpolation engine.**
  Accept 3 weight variants (ultralight, regular, black) as control points.
  Interpolate intermediate weights using path-level cubic interpolation.
  Requires paths across variants to maintain same command structure
  (already enforced by `TopologyContract`). Very high effort — essentially
  a font interpolation engine.

- [ ] **H10 — Standardized category taxonomy.**
  Define enum of SF Symbols categories (22 categories) as suggested
  defaults. Map existing freeform `Icon.category` values to standard
  categories. Non-blocking, organizational improvement.

---

## Phase UX — Visual & Interaction Polish

Status: **open** (findings from UX audit comparing to Figma, Notion, Codex, Claude Cowork)

### UX-V: Visual Enhancements

- [ ] **UX-V1 — Unified spacing system.**
  Establish consistent 8px base grid across all panels. Current state:
  LayerPanel uses `p-2.5`, AnimationPanel uses `p-3`, Toolbar uses
  asymmetric `mx-3 mb-2 mt-3`. Standardize to 2-3 spacing tokens.

- [ ] **UX-V2 — Typography scale consistency.**
  Define 4-5 typographic sizes and apply uniformly. Current state: mix of
  `text-[13px]`, `text-[11px]`, `text-[10px]`, `text-xs` across panels.
  Use semantic tokens (body, caption, label, heading).

- [ ] **UX-V3 — Border and shadow standardization.**
  Reduce border opacity variants from 4+ (`border-border/80`, `/70`,
  `/60`, plain) to 2-3 levels. Normalize shadow values — ToolPanel's
  `shadow-[0_18px_45px]` is too heavy vs. other panels.

- [ ] **UX-V4 — Interactive state polish.**
  Replace `hover:opacity-80` on buttons with background color shifts.
  Standardize active states (currently inconsistent: some use
  `border-primary/40 bg-primary/6`, others use solid backgrounds).
  Make disabled states more obvious (add "Coming Soon" badge instead
  of just `opacity-50` for disabled tools).

- [ ] **UX-V5 — Timeline scrubber affordance.**
  Playhead line is currently 1px — increase to 3-4px with subtle glow.
  Add play/pause icons to replace text-only "Play"/"Pause" buttons.

- [ ] **UX-V6 — Preset card interaction polish.**
  Animation panel preset cards need hover lift effect or accent highlight.
  Current flat `rounded-xl border border-border/80` doesn't communicate
  interactivity. Add `hover:shadow-md hover:-translate-y-0.5` or similar.

- [ ] **UX-V7 — Custom scrollbar styling.**
  Replace default browser scrollbars in ScrollArea panels with
  `scrollbar-thin scrollbar-thumb-rounded` matching Figma/Notion aesthetic.

- [ ] **UX-V8 — Sticky panel headers.**
  LayerPanel and other scrollable panels lose their headers on scroll.
  Add `sticky top-0 z-10 bg-background` to panel headers.

### UX-F: Flow & Interaction Fixes

- [ ] **UX-F1 — Replace `window.prompt()` with inline editing.**
  TimelineEditor uses `window.prompt()` for keyframe value editing.
  Replace with a focused number input field with validation and
  escape-to-cancel behavior.

- [ ] **UX-F2 — Easing picker live preview.**
  Changing easing on tracks shows no real-time transition preview.
  Add a mini animation preview in the easing picker dropdown showing
  the curve's effect on a sample element.

- [ ] **UX-F3 — Morph readiness actionable guidance.**
  `MorphReadinessIndicator` shows red/yellow/green but doesn't say
  what to do. Add actionable buttons: "Auto-fix bindings", "Switch to
  crossfade", or link to relevant documentation.

- [ ] **UX-F4 — Keyboard navigation for layer panel.**
  Add arrow-key traversal through layers, F2 to rename, Delete to
  remove. Currently mouse-only. Expected by Figma/Notion users.

- [ ] **UX-F5 — Context menu positioning safety.**
  Timeline context menus use raw `position: fixed` that can go
  off-screen. Use a proper popover with collision detection
  (Radix `Popover` or `DropdownMenu`).

- [ ] **UX-F6 — Export action discoverability.**
  "Export SVG Package" and "Export React Library" are buried 2+ levels
  deep in dropdowns. Surface primary export actions at the top level of
  the toolbar or as a dedicated panel section.

- [ ] **UX-F7 — Onboarding empty states.**
  Layer panel shows text "Use Pen tool (P) or Shape tool (U)" but no
  visual cues or highlighted tools. Add pulsing indicators on relevant
  tools or a quick-start overlay for first-time users.

- [ ] **UX-F8 — Unsaved changes indicator with timestamp.**
  "Saved" badge doesn't show when last saved. Add "Last saved 2m ago"
  style indicator like Notion. Also warn when switching icons with
  unsaved changes.

- [ ] **UX-F9 — Visual zoom feedback.**
  Zoom in/out buttons lack confirmation. Show an animated zoom level
  indicator (e.g., "150%" briefly overlaid on canvas) when zoom changes.

- [ ] **UX-F10 — Transition panel cognitive load reduction.**
  TransitionPanel manages transitions, easing, timeline, and layer
  bindings in one panel. Split into collapsible sections or tabbed
  sub-views to reduce cognitive load.

---

## Recently Completed

- [x] **2026-03-21 — Editor timeline preview now renders interpolated frames.**
  `components/editor/TimelineEditor.tsx` now builds the same resolved
  transition preview payload used by the inspector preview flow, so
  scrubbing or playing a transition in the editor timeline sends
  interpolated values to the canvas instead of an empty frame map.
  Regression coverage was added in
  `tests/timeline-editor-preview.test.ts`.

- [x] **2026-03-20 — Explorer/editor UX flow pass.**
  The workspace surface now exposes import at the top level, project cards
  open on single click, project empty states surface import/new-icon CTAs,
  the editor toolbar separates icon creation from project/file actions, and
  the editor now shows a dedicated empty state when no icon is active.
  Canonical follow-up items were refreshed in
  `docs_canonical/UX_AUDIT_TASKS.md`.

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

- [x] **3.1 — Wire `useSyncExternalStore` in ConivaIcon.**
  `IconDriver` now exposes `subscribe()` for `useSyncExternalStore`
  compatibility. `ConivaIcon` tracks driver state via
  `useSyncExternalStore(subscribe, getSnapshot, serverSnapshot)`,
  eliminating stale-closure issues during rapid prop changes.

- [x] **3.2 — Prop-driven state changes in ConivaIcon.**
  The state transition effect now compares `currentDriverState`
  (from `useSyncExternalStore`) against the resolved prop state.
  Rapid prop changes during active transitions are handled correctly:
  the driver cancels the active scheduler and starts a new transition.
  `animate={false}` destroys and recreates the driver at the new state.

- [x] **3.3 — Integration tests for ConivaIcon controlled/uncontrolled flows.**
  `tests/runtime-react.test.tsx` — 9 tests covering:
  - Container dimensions (default and custom size)
  - Color and className pass-through
  - Variant resolution by size number, id string, and unknown fallback
  - Custom style composition
  - `useIconState` hook return shape

- [x] **3.4 — End-to-end demo icon path in the web app.**
  `app/demo/runtime/page.tsx` — renders two icons (Hamburger/Close
  and Chevron) with `ConivaIcon`, state toggle button, animate checkbox,
  and a "Export Chevron → Runtime JSON" button that validates the full
  Editor → Export → Runtime → React pipeline in the browser.

---

## Phase 4 — CI/CD & Operational Hardening

Status: **completed** (verified 2026-03-18).

### 4A — CI Workflows

- [x] **4A.1 — Web app CI workflow.**
  `.github/workflows/web-app-ci.yml` now runs on shared web/runtime path
  changes and executes install, `format:check`, `type-check`, `lint`,
  `test:phase-a:coverage`, `check:coverage`, and `build`.

- [x] **4A.2 — Desktop app CI workflow.**
  `.github/workflows/desktop-ci.yml` now runs on `desktop/**` plus the
  shared root app/runtime paths that feed the desktop static export.
  It installs root and desktop dependencies, runs `format:check`,
  `type-check`, `lint`, `test:phase-a`, and `desktop:build`, then
  uploads `desktop/build/` as an artifact.

- [x] **4A.3 — Test coverage reporting.**
  Bun coverage is enabled through `test:phase-a:coverage`, and
  `scripts/check-coverage.ts` now enforces a scoped Phase A runtime gate
  against LCOV paths under `lib/export/export-runtime-json.ts`,
  `lib/runtime-core/`, `lib/runtime-dom/`, and `lib/runtime-react/`.
  The initial enforced threshold is line coverage `>= 60%`; Bun's LCOV
  output does not currently provide function totals in this repo, so the
  function threshold is set to `0` until Bun emits stable function data.

### 4B — Code Quality

- [x] **4B.1 — Commit to a code formatter (Prettier or Biome).**
  The repo now uses Prettier via `.prettierrc.json`, `.prettierignore`,
  and root `format` / `format:check` scripts. The rollout is intentionally
  scoped to the new CI/tooling files for low churn while still giving the
  new workflows a stable formatter gate.

- [x] **4B.2 — Tighten `@typescript-eslint/no-explicit-any` to error.**
  `eslint.config.mjs` now treats explicit `any` as an error. Remaining
  `any` usage in the previously noisy desktop/runtime/editor slices was
  replaced with narrower structural types or `unknown`.

- [x] **4B.3 — Enable `eslint-plugin-react-hooks` exhaustive-deps as error.**
  `eslint.config.mjs` now treats `react-hooks/exhaustive-deps` as an
  error. The React component and runtime-react hook surfaces were updated
  so `bun run lint` passes cleanly under the stricter rule.

### 4C — Product Naming & Desktop Hardening

- [x] **4C.1 — Product naming consistency audit.**
  The desktop surface now uses `Coniva` across the app name, package
  metadata, runtime warning prefix, and desktop-facing labels. Legacy
  `.icophone.json` project files remain loadable for compatibility, and
  the release/update env vars still accept the older `ICOPHONE_*`
  names while preferring `CONIVA_*` when present.

- [x] **4C.2 — Desktop code signing/notarization hardening.**
  `desktop/SIGNING.md` now documents the required macOS and Windows
  signing/notarization secrets, the `ELECTROBUN_BUILD_ENV=stable`
  guardrail, and the release-time failure mode when secrets are missing.

- [x] **4C.3 — Desktop auto-update endpoint validation.**
  `desktop/scripts/release.ts` validates the generated manifest before
  writing `desktop/artifacts/latest.json`, and
  `desktop/scripts/validate-latest-json.ts` provides a standalone schema
  check for existing release manifests.

---

## Phase 5 — Platform & Adapter Foundation (R5-R6)

Status: **completed** (verified 2026-03-19).

### 5A — Platform Capability Layer (R5)

- [x] **5A.1 — Define target platform types.**
  `lib/platform/types.ts`: `TargetPlatform`, `DeliveryMode`,
  `PlatformCapability`, `PlatformCapabilityProfile`, `ExportOutcome`,
  `AdapterExportResult`. Built-in profiles: `REACT_CAPABILITIES` (full),
  `SWIFT_CAPABILITIES`, `FLUTTER_CAPABILITIES`, `WEB_COMPONENT_CAPABILITIES`.
  Tests: `tests/platform-types.test.ts`.

- [x] **5A.2 — Add downgrade reporting for unsupported features.**
  `PlatformDiagnostic` type and `checkPlatformCapabilities()` function
  in `lib/platform/types.ts`. Inspects `RuntimeVariantPayload` for morph,
  effects, draw, clip-paths, spring easing, variable draw, and track
  transitions against a platform profile.
  Tests: `tests/platform-types.test.ts` — diagnostic emission cases.

- [x] **5A.3 — Separate adapter transforms from sync connectors.**
  `docs/adapter-sync-boundary.md`: defines adapters as pure transforms
  (`RuntimeVariantPayload[] → ExportOutcome[]`), sync connectors as I/O
  orchestrators. Module placement: `lib/export/adapters/` for adapters,
  `lib/sync-service/connectors/` for connectors. Includes data flow
  diagram and import decision documentation.

### 5B — React Adapter Family (R6)

- [x] **5B.1 — Generate icons into generic React repos from runtime-json.**
  `lib/export/adapters/react-adapter.ts`: `generateReactFromRuntime()`
  accepts `Icon` + `RuntimeIconMeta` + `RuntimeVariantPayload[]`,
  generates per-icon `{ComponentName}.tsx` components wrapping
  `ConivaIcon` with typed `state`/`variant`/`effect` props, plus a
  barrel `index.ts`. Tests: `tests/react-adapter.test.ts`.

- [x] **5B.2 — Vendor or import runtime helpers for React hosts.**
  Decision: import from `@coniva/runtime-react` (published package).
  Configurable via `runtimePackage` option. Documented in
  `docs/adapter-sync-boundary.md`.

- [x] **5B.3 — Add deterministic stale-file cleanup and generated file manifests.**
  `lib/export/adapters/manifest-cleanup.ts`: `ConivaManifest` type,
  `MANIFEST_FILENAME`, `computeStaleFiles()`, `buildManifest()`,
  `parseManifest()`, `serializeManifest()`. Pure functions — I/O lives
  in sync connectors. Tests: `tests/manifest-cleanup.test.ts`.

- [x] **5B.4 — Thin host integration: Storybook preview.**
  `lib/export/adapters/storybook-generator.ts`:
  `generateStorybookStories()` generates `.stories.tsx` files with
  `Meta`, `StoryObj`, argTypes for size/color/state/variant/animate.
  Tests: `tests/storybook-generator.test.ts`.

---

## Phase 6 — Sync & Distribution (R7)

Status: **completed** (verified 2026-03-19).

- [x] **6.1 — Add target export config to project schema.**
  New `SyncTarget` type in `lib/schema/types.ts` captures: id, name,
  platform (`'react' | 'swift' | 'flutter' | 'web-component'`),
  deliveryMode (`'local-directory' | 'git-pr'`), adapterConfig
  (runtimePackage, typescript, outputDir), localDirectory (path),
  and gitPr (owner, repo, baseBranch, packagePath).
  `IconSet.syncTargets?: SyncTarget[]` stores per-project targets.
  Tests: `tests/phase6-sync-distribution.test.ts` — schema validation.

- [x] **6.2 — Build editor-side export/connections UI.**
  `components/export/SyncTargetPanel.tsx`: Dialog-based UI for
  configuring sync targets. Lists existing targets with platform/mode
  badges and path/repo info. "Add Target" dialog with form fields
  for name, platform, delivery mode, local directory path or GitHub
  repo config, and adapter settings (runtime package, output dir).
  Remove targets via inline delete buttons.

- [x] **6.3 — Implement local-directory sync.**
  `lib/sync-service/connectors/local-directory-connector.ts`:
  `syncLocalDirectory()` accepts target dir, platform, icons, and
  adapter config. Runs the configured adapter (currently React),
  writes generated files via injected `FileSystem` abstraction,
  reads previous `.coniva-manifest.json` for stale-file detection
  via `computeStaleFiles()`, removes stale files, writes updated
  manifest. Returns `{ written[], removed[], diagnostics[] }`.
  Tests: `tests/phase6-sync-distribution.test.ts` — writes files +
  manifest, removes stale files, handles first sync, passes
  diagnostics through.

- [x] **6.4 — Implement Git PR-based sync for adapter output.**
  `lib/sync-service/connectors/adapter-pr-connector.ts`:
  `syncAdapterPr()` runs the adapter, computes stale files from
  previous manifest, creates a feature branch, commits generated
  files (with stale-file deletion), and opens a PR with a changelog
  body (summary, diagnostics, file lists). Uses the existing
  `GitProvider` interface and `classifyGitHubError()` for typed
  errors. Returns manifest for the caller to store for next sync.
  Tests: `tests/phase6-sync-distribution.test.ts` — type-level
  validation, adapter config pass-through.

---

## Phase 7 — Cross-Platform Adapters (R8)

Status: **completed** (verified 2026-03-19).

- [x] **7.1 — Define Swift adapter capability mapping.**
  `lib/export/adapters/swift-adapter.ts`: `generateSwiftFromRuntime()`
  generates SwiftUI and UIKit components from `Icon` + `RuntimeIconMeta`
  + `RuntimeVariantPayload[]`. Capability mapping table in module header
  documents each feature mapping: Draw -> CAShapeLayer strokeEnd
  animation, transitions (replace) -> `withAnimation { state = newState }`
  via implicit SwiftUI animation, effects -> `withAnimation(.spring)` +
  modifiers. Morph transitions downgrade to crossfade, track transitions
  to snap, spring easing to ease-in-out, variable draw omitted. Clip
  paths and gradients are fully supported. Uses `checkPlatformCapabilities()`
  with `SWIFT_CAPABILITIES` profile for diagnostic emission.
  Generated output: per-icon `{Component}.swift` with state enum,
  SwiftUI `View` struct (or UIKit `UIView` subclass), SVG path parsing
  extension, and a barrel `ConivaIcons.swift`. Supports `framework`
  option (`'swiftui'` | `'uikit'`), `minimumDeploymentTarget`,
  `outputDir`, and `packageName` configuration.

- [x] **7.2 — Define Flutter adapter capability mapping.**
  `lib/export/adapters/flutter-adapter.ts`: `generateFlutterFromRuntime()`
  generates Dart/Flutter `StatefulWidget` components from the same input
  types. Capability mapping table in module header documents each feature
  mapping: Draw -> `CustomPainter` stroke animation with
  `AnimationController`, transitions (replace) -> `AnimatedSwitcher`
  with fade, effects -> `AnimationController` + `CurvedAnimation`. Morph
  transitions downgrade to crossfade, track transitions to snap, spring
  easing to `Curves.easeInOut`, variable draw and clip paths omitted.
  Gradients fully supported. Uses `checkPlatformCapabilities()` with
  `FLUTTER_CAPABILITIES` profile.
  Generated output: per-icon `{snake_name}.dart` with state enum,
  `StatefulWidget` + `State` + `CustomPainter` classes, accessibility
  via `Semantics` widget, and a barrel `coniva_icons.dart`. Supports
  `outputDir`, `packageName`, and `nullSafety` configuration.

- [x] **7.3 — Decide v1 downgrade rules for non-React targets.**
  `lib/export/adapters/downgrade-rules.ts`: defines `PlatformDowngradeConfig`
  per platform with built-in configs `SWIFT_DOWNGRADES`,
  `FLUTTER_DOWNGRADES`, `WEB_COMPONENT_DOWNGRADES`, `REACT_DOWNGRADES`.
  V1 rules: morph -> crossfade (Swift/Flutter), track -> snap
  (Swift/Flutter), spring -> ease-in-out fallback (Swift/Flutter),
  variable draw -> omit (Swift/Flutter), clip paths -> preserve (Swift)
  / omit (Flutter). `applyDowngradeRules()` inspects payload transitions,
  variable draw, and clip paths, records `DowngradeRule[]` entries, and
  emits `PlatformDiagnostic` entries for each applied downgrade.
  `needsDowngrade()` and `getFallbackEasing()` utility functions
  available for adapter consumption. React and web-component platforms
  preserve all features (no downgrades).

---

## Phase E — Adoption Readiness

These are table-stakes requirements that block adoption regardless of
animation quality. Phase E should be implemented before Phases A-D.

- [x] **E1 — SSR-safe rendering.**
  `ConivaIcon` now renders static SVG inline with `<path>` elements on the
  server using `getRenderableLayers()` and `resolvePaintToString()`.
  The `IconDriver` hydrates by mounting onto the existing SVG element
  via the `existingSvg` option. `renderToStaticMarkup(<ConivaIcon />)`
  produces real SVG content, not an empty div.

- [x] **E2 — Accessibility.**
  ConivaIcon: `label` prop sets `role="img"` + `aria-label` on the SVG.
  When omitted, `aria-hidden="true"` is set (decorative icon).
  `focusable="false"` is always set to prevent keyboard tab-stop.
  `DomRenderer.mount()` accepts `label` and applies accessibility
  attributes on the SVG root.

- [x] **E3 — `prefers-reduced-motion` support.**
  New `lib/runtime-core/motion-preference.ts`: `shouldReduceMotion()`,
  `getMotionPreference()`, `subscribeMotionPreference()`. ConivaIcon:
  `reduceMotion` prop (default `'system'`). Driver: when reduced motion
  is active, transitions snap via `setState()` (no scheduler created)
  and effects are suppressed.

- [x] **E4 — Generated component API (promote from Phase 5B).**
  The codegen pipeline should produce per-icon components:
  `export function ChevronRight(props) { return <ConivaIcon icon={data} {...props} /> }`.
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

Status: **completed** (verified 2026-03-18).

- [x] **A1 — Cubic-bezier custom easing.**
  `lib/runtime-core/easing.ts` now parses `cubic-bezier(x1,y1,x2,y2)`
  with Newton-Raphson solving plus binary-search fallback, and supports
  `steps(n, start|end)` alongside the existing preset shortcuts.
  Tests: `tests/runtime-core.test.ts` — cubic-bezier + steps assertions.

- [x] **A2 — Spring physics engine.**
  `lib/runtime-core/spring.ts` adds `SpringSolver`,
  `springProgress(config, elapsedMs)`, `estimateSpringDuration(config)`,
  and presets (`gentle`, `bouncy`, `stiff`, `slow`). Schema widened via
  `SpringConfig` in `lib/schema/types.ts`, and runtime schedulers/store
  now accept `string | SpringConfig` easings with duration caps.
  Tests: `tests/runtime-core.test.ts` — spring overshoot/duration and
  scheduler interruption coverage.

- [x] **A3 — Color interpolation.**
  `lib/runtime-core/color.ts` adds hex color interpolation for
  `#RGB`, `#RRGGBB`, and `#RRGGBBAA`. `TimelineTrack` now supports
  `fill` and `stroke` string keyframes. DOM and preview renderers apply
  animated color values directly to SVG attributes, and runtime/export
  contracts carry the widened track shape.
  Tests: `tests/runtime-core.test.ts` — `interpolateColor(...)`;
  `tests/runtime-dom.test.ts` — animated fill/stroke application.

- [x] **A4 — Guide point-aware Draw execution.**
  `lib/runtime-core/draw-executor.ts` now derives per-layer reveal
  windows from guide point `t` ranges and falls back to uniform timing
  when guide timing is absent or non-differentiated.
  Tests: `tests/runtime-core.test.ts` — guide timing range assertions.

- [x] **A5 — Per-layer stagger controls.**
  `lib/schema/types.ts` adds optional `delayMs` / `durationMs` to
  `LayerBinding` plus `Transition.stagger`. `lib/runtime-core/transition-resolver.ts`
  now honors explicit binding timing first, then stagger modes
  (`linear`, `from-center`, `from-edges`, `random`), then existing
  role-based fallback for non-track transitions.
  Tests: `tests/runtime-core.test.ts` — stagger and explicit override
  resolution coverage.

- [x] **A6 — Animation interruption with blend-out.**
  `lib/runtime-core/scheduler.ts` adds `interrupt(blendOutMs)` via a
  blend scheduler that eases captured values back toward rest, and
  `lib/runtime-dom/driver.ts` now interrupts active schedulers with an
  80ms blend when a new transition starts mid-flight, composing overlap
  frames in the driver.
  Tests: `tests/runtime-core.test.ts` — interrupt/blend scheduler
  coverage; runtime DOM suites remain green.

---

## Phase B — Runtime Capability Expansion

Status: **consolidated into Phase H** (SF Symbols Parity).

B1-B4 items are now tracked as H3, H2, H6, H7 respectively in Phase H
with updated priorities based on SF Symbols gap analysis.

---

## Phase C — Editor Animation Authoring

Status: **completed** (verified 2026-03-19).

- [x] **C1 — Visual bezier curve editor.**
  `components/editor/BezierCurveEditor.tsx`: interactive SVG canvas
  for dragging control points (x1,y1) and (x2,y2) on a unit square
  with real-time curve preview and numeric inputs. Preset sidebar
  includes Material Standard/Decelerate/Accelerate, Apple Ease, and
  Ease In Out Back. Spring mode provides stiffness/damping/mass sliders
  with real-time spring curve visualization, plus gentle/bouncy/stiff/slow
  presets from `SPRING_PRESETS`. Integrated into `EasingPicker.tsx` as
  a companion control alongside the preset dropdown.
  Tests: `tests/phase-c-editor-animation.test.ts` — cubic-bezier parsing.

- [x] **C2 — Manual layer binding controls.**
  `TransitionPanel.tsx`: expandable "Layer Bindings" section shows
  auto-resolved from→to mappings with dropdown selects to reassign
  source/target layers from each state's layer list. Add/remove
  explicit bindings via buttons. "Reset to Auto" clears explicit
  bindings and re-runs `buildDefaultLayerBindings()`.
  Tests: type-level validation in `phase-c-editor-animation.test.ts`.

- [x] **C3 — Per-track easing.**
  Schema: added optional `easing?: string | SpringConfig` to all
  `TimelineTrack` union members in `lib/schema/types.ts`.
  `TimelineEditor.tsx`: per-track `EasingPicker` in each timeline row.
  `lib/runtime-core/scheduler.ts`: `interpolateTrack()` applies
  per-track easing via `resolveTrackProgress()`, overriding
  transition-level easing when set.
  Tests: `phase-c-editor-animation.test.ts` — per-track easing
  modifies interpolation (ease-in at 0.5 → 0.25 for opacity).

- [x] **C4 — Stagger/delay controls per binding.**
  `TransitionPanel.tsx`: global stagger toggle with mode dropdown
  (`linear`, `from-center`, `from-edges`, `random`) and perLayerMs
  input. Each layer binding row has explicit delay (ms) and duration
  (ms) number inputs. Depends on A5 schema (`TransitionStagger`,
  `LayerBinding.delayMs/durationMs`).
  Tests: `phase-c-editor-animation.test.ts` — stagger and per-binding
  delay/duration schema validation.

- [x] **C5 — Custom effect builder.**
  `components/editor/CustomEffectBuilder.tsx`: full effect editor with
  kind selector (12 kinds including `custom`), duration/delay/repeat/
  direction/easing controls. When `kind: 'custom'`, shows a custom
  tracks editor where users compose effects from primitive transforms
  (opacity, rotate, translateX/Y, scale) with per-property keyframe
  arrays and per-track easing.
  Schema: added `'custom'` to `Effect.kind` union and
  `customTracks?: TimelineTrack[]` to `Effect` in `lib/schema/types.ts`.
  `lib/runtime-core/effect-scheduler.ts`: `computeCustomEffect()`
  handles `custom` kind via keyframe interpolation with per-track easing.
  `EffectDefinition.customTracks` type added.
  Tests: `phase-c-editor-animation.test.ts` — custom effect values,
  per-track easing in custom effects, empty/missing tracks edge cases.

- [x] **C6 — State interaction triggers.**
  Schema: added `StateTrigger` type (`{ event: 'hover' | 'tap' |
  'longPress' | 'focus' | 'auto' }`) and `triggers?: StateTrigger[]`
  to `Transition` in `lib/schema/types.ts`.
  `components/editor/TriggerEditor.tsx`: standalone component with
  toggle pill buttons for each trigger event, with tooltip descriptions.
  Also integrated inline in `TransitionPanel.tsx` for each transition.
  Advisory metadata for code generation — triggers tell generated
  components which DOM/native events should initiate the transition.
  Tests: `phase-c-editor-animation.test.ts` — StateTrigger type
  validation, Transition.triggers schema.

---

## Phase D — React API Enrichment

Status: **completed** (verified 2026-03-19).

- [x] **D1 — Imperative ref API.**
  `ConivaIcon` converted to `forwardRef<ConivaIconHandle>` in
  `lib/runtime-react/ConivaIcon.tsx`. `ConivaIconHandle` exposes:
  `transitionTo`, `triggerEffect`, `cancelEffect`, `cancelAllEffects`,
  `getCurrentState`, `setVariableDrawProgress`. Uses
  `useImperativeHandle` to delegate to the internal `IconDriver`.
  Tests: `tests/phase-d-react-api.test.tsx` — handle type shape,
  ref acceptance, combined with other props.

- [x] **D2 — Gesture props.**
  `ConivaIcon` now accepts: `hoverState`, `tapState`, `onHoverStart`,
  `onHoverEnd`, `onTapStart`, `onTapEnd`. Pointer events
  (`onPointerEnter/Leave/Down/Up`) are attached to the container
  div only when gesture props are present. Gesture state transitions
  are suppressed when an explicit `state` prop is set (precedence
  rule). On pointer-up, falls back to hover state if active, else
  to the rest state captured before the gesture began.
  Tests: `tests/phase-d-react-api.test.tsx` — gesture prop
  acceptance, explicit state precedence.

- [x] **D3 — Animation callbacks.**
  `onTransitionStart(from, to)`, `onTransitionComplete(from, to)`,
  `onEffectComplete(effectId)` props on `ConivaIcon` are wired to
  the driver's `onAnimationEvent` callback via stable `callbacksRef`.
  Callbacks are updated without driver re-creation. Already
  implemented in previous phases; Phase D verifies and tests the
  integration.
  Tests: `tests/phase-d-react-api.test.tsx` — callback acceptance,
  type-level validation.

- [x] **D4 — Animation progress visibility.**
  `onFrame?: (progress: number, stateId: string) => void` prop added
  to `ConivaIconProps` for per-frame progress reporting.
  New `useAnimationProgress` hook in
  `lib/runtime-react/useAnimationProgress.ts` returns
  `{ progress, isAnimating, currentState }` via `useSyncExternalStore`.
  Accepts a `driverRef` to subscribe to any compatible driver store.
  Exported from `lib/runtime-react/index.ts`.
  Tests: `tests/phase-d-react-api.test.tsx` — snapshot type shape,
  hook rendering with null driver, default values.

---

## Phase 8 — Cross-Icon Morphing & Advanced Transitions (R9)

Status: **completed** (verified 2026-03-19).

Research into SF Symbols 7, GSAP MorphSVG, Flubber, and production icon
patterns identifies three distinct transition categories requiring
different algorithms. All three categories are now implemented with
industry-class algorithms.

### 8.1 — Same-icon state morphing improvements

`strictMorph()` and `bestGuessMorph()` in `lib/runtime-core/morph.ts`
are fully implemented with production-quality algorithms.

- [x] **8.1a — Arc-to-cubic conversion.**
  `lib/runtime-core/arc-to-cubic.ts`: `arcToCubicSegments()` converts SVG
  arc commands to cubic bezier sequences using the standard pi/4 arc
  segment approximation (W3C algorithm). Handles degenerate cases (zero
  radius, same start/end, near-zero dtheta, zero denominator), radius
  correction when too small, and elliptical/rotated arcs. Last segment
  endpoint is snapped to exact target. Integrated into
  `normalizeToCubicPath()` in `morph.ts` so arcs are no longer rejected.
  Tests: `tests/phase-8-morph.test.ts` — simple arcs, degenerate arcs,
  large arcs, elliptical arcs, rotated arcs.

- [x] **8.1b — Rotational interpolation.**
  `lib/runtime-core/cross-icon-morph.ts`: `interpolateHandleRotational()`
  converts control point handles to polar coordinates (angle+length)
  relative to their anchor, interpolates angle via shortest-arc path
  (unwraps ±π boundary), interpolates length linearly. Prevents
  mid-morph kinks. Falls back to linear lerp when anchor points are
  within epsilon distance (< 0.001) to prevent amplified errors.
  Tests: `tests/phase-8-morph.test.ts` — t=0, t=1, midpoint, coincident.

- [x] **8.1c — Shape index optimization.**
  `findOptimalShapeIndex()` in `cross-icon-morph.ts` tests all rotation
  offsets (0..n-1) for closed paths, computing sum of squared distances
  for endpoints and control points (weighted 0.5). Picks the offset
  that minimizes total displacement. Applied in both `alignCubicPaths()`
  (morph.ts) and `crossIconMorph()` (cross-icon-morph.ts).
  Tests: open paths return 0, misaligned closed paths find non-zero offset.

### 8.2 — Cross-icon morphing (e.g., play→pause, search→close)

`lib/runtime-core/cross-icon-morph.ts`: complete 5-step pipeline for
morphing between different icons. Integrated into the transition resolver
as a third-tier fallback after strictMorph and bestGuessMorph.

- [x] **8.2a — Sub-path matching.**
  `matchSubPaths()` scores all from→to sub-path pairs by centroid
  proximity (35%), bounding box similarity (30%), area similarity (10%),
  segment count similarity (5%), and closed status bonus (20%). Greedy
  matching by best score first. Winding order is normalized to clockwise
  before matching via `ensureClockwise()` (shoelace formula).

- [x] **8.2b — Segment-level De Casteljau subdivision.**
  `subdivideCubicSegments()` and `splitCubicSegment()` use De Casteljau's
  algorithm to split cubic bezier segments at equal parameter intervals.
  Arc-length aware subdivision distributes extra splits to the longest
  segments first using `estimateCubicArcLength()` (chord+control-polygon
  heuristic). Distribution: `stepsPerSegment = longer / shorter`.

- [x] **8.2c — Shape index for each sub-path pair.**
  Applied per matched sub-path pair in `crossIconMorph()`. For closed
  paths, `findOptimalShapeIndex()` tests all offsets and picks minimum
  displacement. `rotateSubPathSegments()` reorders segments by offset.

- [x] **8.2d — Unmatched sub-path handling.**
  `createCentroidCollapsedSubPath()` creates degenerate sub-paths at
  the centroid with the same segment count as the template. Coordinated
  easing: disappearing sub-paths use `easeInCubic(t)`, appearing
  sub-paths use `easeOutCubic(t)` for natural fade-in/fade-out timing.

### 8.3 — Line-to-solid icon transitions (topology-incompatible)

`lib/runtime-core/topology-detection.ts`: SF Symbols-inspired approach.
Integrated into the transition resolver — topology analysis runs before
binding resolution and overrides morph bindings to crossfade when
topology is incompatible.

- [x] **8.3a — Topology incompatibility detection.**
  `analyzeTopologyCompatibility()` detects: subpath-count-mismatch,
  closed-open-mismatch, fill-mode-change, stroke-to-fill-change,
  path-type-mismatch. Auto-selects 'morph', 'crossfade', or
  'draw-crossfade' strategy. Results attached to `ResolvedTransition`
  as `topologyAnalysis`.
  Tests: compatible topology, stroke-to-fill detection, subpath mismatch.

- [x] **8.3b — Coordinated crossfade with emphasis.**
  `computeCrossfadeFrame()`: outgoing fades out linearly (1→0), incoming
  fades in with easeOutCubic (delayed start at t=0.1), incoming scale
  pulse (1.0→1.12→1.0 via easeOutBack * sin(π*t)) for tactile feedback.
  Tests: t=0, t=1, midpoint visibility, scale overshoot.

- [x] **8.3c — Draw-coordinated crossfade (SF Symbols 7 style).**
  `computeDrawCrossfadeFrame()`: when draw annotation available, outgoing
  uses Draw Off (1→0, slightly ahead via 1.2x speed), incoming uses
  Draw On (0→1, delayed 15%). `shouldUseDrawCrossfade()` requires
  annotation with 2+ layers. Without annotation, draw progress stays
  at 1 (no draw animation, just opacity crossfade).
  Tests: with/without annotation, t=0 initial state, outgoing/incoming
  progress at various t values.

### 8.4 — Editor topology validation

- [x] **8.4a — Geometry change warnings.**
  `components/editor/GeometryChangeWarning.tsx`: `GeometryChangeWarning`
  component and `useGeometryValidation` hook. `detectGeometryBreaks()`
  pure function compares previous and current path d-strings via
  `canonicalizePath()`, detecting: subpath-count-changed,
  closed-status-changed, command-signature-changed, point-count-changed.
  Warns which transitions are affected and offers "Downgrade to crossfade"
  action. Tests: `tests/phase-8-morph.test.ts` — all break types, empty
  paths, identical paths.

- [x] **8.4b — Morph readiness indicator in TransitionPanel.**
  `components/editor/MorphReadinessIndicator.tsx`: `MorphReadinessIndicator`
  shows green/yellow/red score indicator with breakdown of all 6 readiness
  dimensions (commands, sub-paths, closed/open, bbox, centroid, role).
  Displays recommended strategy badge and topology warnings inline.
  Uses `computeReadiness` from `transition-resolver.ts` and
  `analyzeTopologyCompatibility` from `topology-detection.ts`.

- [x] **8.4c — Morph quality preview.**
  `MorphPreview` component in `MorphReadinessIndicator.tsx`: renders SVG
  path at 0%, 25%, 50%, 75%, 100% progress using the morph interpolator.
  Falls back to snap (from→to at 50%) when no interpolator is provided.
  Configurable size and viewBox.
  Tests: `tests/phase-8-morph.test.ts` — type-level import validation.

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
- SF Symbols 5-7 animation model (Draw, Variable Draw, Magic Replace, replace effects, gradient rendering)
- Framer Motion / Motion API patterns (spring physics, gesture-driven animation)
- GSAP MorphSVG, Flubber, and SVG Morpheus morphing algorithm research
- After Effects trim paths, Lottie animation model, Rive state machine architecture
- UX audit comparing to Figma, Notion, Codex, Claude Cowork (2026-03-23)
- Closed vs open vector animation research (industry-standard dual model)

## Known Conflicts / Notes

- Some legacy plan items are already partially or fully implemented in code, so they should not be copied forward blindly as untouched backlog.
- This file intentionally favors repository-stability and operational needs over product feature speculation.
- Phase numbering: 1-8 align with R0-R9 from `IMPLEMENTATION.md`; Phases A-D are animation architecture phases not in the original roadmap.
- Phase E (adoption readiness) should be implemented before Phases A-D. Phases A and 8 can run in parallel. Phase C depends on A. Phase D depends on B.
- Phase F (cross-icon transitions) depends on Phase 8 (cross-icon morphing). The morph engines are ready; changes are at schema/resolver/UI layers.
- Phase G (closed/open path strategy) is independent and can run in parallel with Phase F.
- Phase H consolidates Phase B items (B1→H3, B2→H2, B3→H6, B4→H7) and adds SF Symbols 5-7 gap items.
- Phase UX visual items (UX-V*) can be worked on independently of runtime phases. Flow items (UX-F*) may depend on component architecture changes.
