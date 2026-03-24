# Tasks

**Last updated:** 2026-03-23
**Canonical product name:** Coniva

Phases I–L and all earlier phases are **completed**. Phases M–Q are
the active engineering backlog, planned 2026-03-23.

**Engineering review findings (2026-03-23):**
- Priority order revised: Q → M → N → (verify import demand) → P → O
- Token security: npm tokens must live in platform keychain only, never in schema
- Phase M: morph sampler must call `strictMorph()`/`bestGuessMorph()` interpolators
  directly — `interpolatePaths()` does not exist
- Phase M: frame count must be rounded to integer (`Math.round(durationMs / 1000 * fr)`)
- Phase M: lottie-web is a regular `dependency` (not peer dep) — add as optional dynamic
  import with a feature flag to avoid bundle bloat
- Phase M: downgrade diagnostics go in `lib/export/lottie-downgrade.ts` (not
  `downgrade-rules.ts`, which is coupled to TargetPlatform)
- Phase N: Paper.js boolean ops are async and browser-only — tests/derived-variants.test.ts
  must mock `booleanOp`; see tests/boolean-ops.test.ts for the existing mock pattern
- Phase N: add `isDeriving: boolean` to editor store (task N2b — see below)
- Phase N: `Icon.meta.derivedSpecs` requires a schema migration task (N0 — see below)
- Phase O: `WeightControlPoints` type change is a breaking change — all callers of
  `validateWeightControlPoints` need null-check updates
- Phase P: import adapters need a build-time manifest (like lucide-source.ts) for
  web deployment — direct filesystem access to node_modules not available in browser
- Phase P: Phosphor weight names (thin/light/regular/bold) don't map 1:1 to Coniva
  weight names (ultralight/regular/black) — explicit mapping table required
- Phase P: SF Symbols adapter (P4) requires legal review before shipping — Apple's
  SF Symbols license may prohibit exporting symbols to non-Apple platforms
- Phase Q: add explicit prerequisite task Q0 (SyncConnector interface)
- Phase Q: `npm publish` via `child_process.exec` requires a new RPC method in
  `lib/platform/bridge.ts` — this is a desktop-specific dependency
- Phase Q: Q5 web proxy must match existing security posture (server-side token,
  not client-side) — see GitHub sync proxy for the established pattern
- Phase Q: Q4 auto-publish needs an explicit cancel/abort mechanism before shipping

---

## Phase M — Lottie Export

Status: **planned** (enable export to the Lottie JSON format for
cross-platform animated icon delivery)

The schema reserves `ExportProfile.format: 'lottie'` but no exporter
exists. Lottie is the de-facto standard for animated icons on Android,
iOS web, and React Native — adding it dramatically expands Coniva's
distribution surface.

### Priority 1 — Core Exporter

- [ ] **M1 — Build `export-lottie.ts` exporter.**
  Create `lib/export/export-lottie.ts`. Convert a compiled Coniva icon
  to a Lottie 5.x JSON object. Map `Variant.viewBox` to `w`/`h`/`fr`.
  Set `fr: 60`, `ip: 0`, `op: Math.round(durationMs / 1000 * fr)` derived
  from the longest transition (round to integer frame count to avoid
  fractional `op` values, which are invalid in some Lottie runtimes).
  Entry point: `exportLottie(icon: Icon, variantId: string): LottieJson`.

- [ ] **M2 — Map layer geometry to Lottie shape layers.**
  For each `Layer`, emit a Lottie shape layer with a `sh` (path) shape.
  Convert the SVG `d` string to Lottie's `ks` bezier format (vertices,
  in-tangents, out-tangents, closed). Use the normalized cubic commands
  already produced by `path-normalization.ts` — no new parsing needed.
  Map `style.fill` → `fl` shape, `style.stroke` → `st` shape. Map
  `PaintRef.mode === 'linearGradient'` → `gf` Lottie gradient fill.

- [ ] **M3 — Map TimelineTrack keyframes to Lottie animated properties.**
  For each `TimelineTrack` on a `LayerBinding`, emit Lottie animated
  properties (`ks.o` for opacity, `ks.r` for rotation, `ks.p` for
  position, `ks.s` for scale). Convert `keyframes: number[]` with
  `durationMs` to Lottie time-based keyframe arrays. Map easing strings
  to Lottie cubic-bezier `o`/`i` handle pairs.

- [ ] **M4 — Map morph keyframes to Lottie shape-path animation.**
  When a binding uses `strictMorph` or `bestGuessMorph`, emit the
  interpolated path at multiple sampled t-values as Lottie shape-path
  keyframes on `ks.sh`. This approximates smooth morph within Lottie's
  keyframe model. **Note:** `interpolatePaths()` does not exist in the
  codebase. The correct API is `strictMorph(fromD, toD)` and
  `bestGuessMorph(fromD, toD)` (from `lib/runtime-core/morph.ts`), which
  return `MorphInterpolator` closures `(t: number) => string`. Call the
  returned interpolator at `t = [0, 1/steps, 2/steps, ..., 1]`. Number
  of steps is controlled by `morphQuality: 'low'|'medium'|'high'|'max'`
  (maps to 5/10/30/60 steps, clamped to [3, 60]).

- [ ] **M5 — Map trim path tracks to Lottie trim shape.**
  When `trimStart`/`trimEnd`/`trimOffset` tracks are present, emit a
  Lottie `tm` (trim) modifier on the containing shape group. Map
  `compoundTrimMode === 'simultaneously'` → `m: 1`, `'individually'`
  → `m: 2` (matches After Effects behaviour).

### Priority 2 — Effect & Preview Integration

- [ ] **M6 — Map Effect kinds to Lottie shape layer animations.**
  Convert Coniva Effect kinds to Lottie equivalents:
  `bounce` → scale oscillation keyframes, `pulse` → opacity keyframes,
  `breathe` → scale breathe keyframes, `rotate` → rotation keyframes,
  `lineDrawOn` / `lineDrawOff` → trim-path animation.
  `custom` effects emit their `customTracks` as Lottie animated
  properties.

- [ ] **M7 — Add Lottie export to ExportPanel UI.**
  In `components/export/`, add a "Lottie" option to the export format
  dropdown. On export, call `exportLottie()`, serialise to JSON, and
  trigger a `.json` download. Show a warning badge when the icon uses
  features with no Lottie equivalent (e.g. `variableValue`, weight
  interpolation, `crossfade` strategy without morph fallback). Use the
  existing downgrade-rules pattern from `lib/export/adapters/
  downgrade-rules.ts`.

- [ ] **M8 — Lottie preview in ExportPanel.**
  Add `lottie-web` as a regular `dependency` (not a peer dep — this is
  a Next.js app, not a library). Lazy-import it with `dynamic(() =>
  import('lottie-web'), { ssr: false })` to keep it out of the initial
  bundle. Render the exported JSON in a 128×128 `<canvas>` preview so
  authors can verify the animation before downloading. Gate the preview
  pane itself behind a feature flag `LOTTIE_PREVIEW_ENABLED` (env var)
  to allow disabling without removing the dependency.

### Priority 3 — Roundtrip & Tests

- [ ] **M9 — Export determinism test.**
  Add `tests/lottie-export.test.ts`. Assert that
  `exportLottie(icon, variantId)` produces identical JSON across
  multiple calls (snapshot test). Cover: static icon (no transitions),
  track animation, morph transition, trim animation, cross-icon
  transition fallback.

- [ ] **M10 — Downgrade diagnostics for Lottie.**
  Create `lib/export/lottie-downgrade.ts` (do NOT modify
  `downgrade-rules.ts` — that file is coupled to `TargetPlatform` and
  is unrelated to Lottie format conversion). Export:
  `collectLottieDowngrades(icon, variantId): LottieDowngradeDiagnostic[]`.
  Flag: `variableValue` (not representable), `bestGuessMorph` with
  mismatched command counts (falls back to crossfade), `spring`
  easing (approximated as cubic-bezier), `radialGradient` fills
  (limited player support). Surface diagnostics in ExportPanel M7.

---

## Phase N — Derived Variant Generation

Status: **planned** (complete the SF Symbols variant system by
generating fill/circle/square/slash/badge variants via path booleans)

`lib/schema/variant-derivation.ts` has metadata scaffolding
(`canDeriveVariant`, `availableModifiers`, `createDerivedVariantSpec`)
but explicitly defers "actual generation" to a future phase (the
comment reads: "path boolean operations which are deferred to a future
phase"). `lib/editor-core/boolean-ops.ts` provides the Paper.js boolean
primitive (`booleanOp`). This phase wires them together.

### Priority 0 — Prerequisites

- [ ] **N0 — Add `meta.derivedSpecs` to Icon schema with migration.**
  Add `derivedSpecs?: DerivedVariantSpec[]` to `Icon.meta` in
  `lib/schema/types.ts`. This is a new optional field — existing
  projects that don't have it will read as `undefined` (no migration
  needed for read path). Add a schema migration test to
  `tests/schema-migrations.test.ts` asserting that an icon without
  `derivedSpecs` loads and saves without error. **Must be done before
  N7 (re-derive warning) which reads this field.**

- [ ] **N0b — Add `isDeriving` flag to editor store.**
  Add `isDeriving: boolean` to `EditorState` in `lib/editor-store/
  store.ts`, default `false`. Wrap the `applyDerivedVariant()` dispatch
  in the store action with `set({ isDeriving: true })` / `set({
  isDeriving: false })` in a finally block. In the UI (N5), read
  `isDeriving` to disable all Derive buttons while in progress.
  This prevents Paper.js scope corruption from concurrent boolean ops.

### Priority 1 — Variant Generation Engine

- [ ] **N1 — Implement `applyDerivedVariant()` for fill variants.**
  In `lib/schema/variant-derivation.ts`, add:
  `applyDerivedVariant(icon: Icon, spec: DerivedVariantSpec): Icon`.
  For `modifier === 'fill'`: iterate each layer in the base variant's
  default state; if the layer has a stroke paint and no fill, produce
  a filled copy by duplicating the path and switching `style.fill` to
  `style.stroke`'s value and clearing `style.stroke`. No boolean ops
  needed — this is a style transformation only.

- [ ] **N2 — Implement `applyDerivedVariant()` for slash variants.**
  For `modifier === 'slash'`: find the `SymbolComponent` of kind
  `'slash'` in `icon.components`. Retrieve its layer paths. Use
  `booleanOp('subtract', ...)` from `boolean-ops.ts` to subtract the
  slash shape from each primary layer path in the derived state.
  Return the modified icon with a new variant whose states contain the
  slashed geometry.

- [ ] **N3 — Implement `applyDerivedVariant()` for circle/square variants.**
  For `modifier === 'circle'` / `'square'`: find the `SymbolComponent`
  of kind `'enclosure'`. Union all primary layer paths with the
  enclosure shape using `booleanOp('unite', ...)`. The result becomes
  the derived variant's layer geometry. The enclosure component layers
  are hidden (set `visible: false`) in the derived state since they are
  now merged.

- [ ] **N4 — Implement `applyDerivedVariant()` for badge variants.**
  For `modifier === 'badge'`: find the `SymbolComponent` of kind
  `'badge'`. Subtract the badge component shape from the base layers
  using `booleanOp('subtract', ...)` where the badge overlaps, then
  add the badge layers as additional visible layers in the derived
  variant's state at their prescribed position.

### Priority 2 — Editor UI

- [ ] **N5 — Derive Variant panel in Inspector.**
  In `components/editor/InspectorPanel.tsx`, add a "Derive Variant"
  section (collapsed by default) below the existing symbol component
  tags. Show available modifiers from `availableModifiers()` as
  action buttons. On click, call `applyDerivedVariant()` and dispatch
  `addVariant` to the editor store. Disable buttons that return false
  from `canDeriveVariant()`. Show a spinner during generation (boolean
  ops are synchronous but can take ~50ms for complex paths).

- [ ] **N6 — Derived variant badge in ExplorerShell.**
  In the icon list / explorer view, show a small "variants" pill on
  icons that have derived variants (e.g. "fill", "circle"). Allow
  switching between base and derived in the variant selector. Derived
  variants are read-only by default (no geometry editing — edits must
  be made on the base and re-derived).

- [ ] **N7 — Re-derive on base change.**
  When a layer's geometry changes in the base variant and derived
  variants exist, show a "Re-derive variants" warning banner above the
  canvas. On confirmation, re-run `applyDerivedVariant()` for all
  derived specs stored on the icon. Store derivation specs in
  `Icon.meta.derivedSpecs?: DerivedVariantSpec[]`.

### Priority 3 — Tests

- [ ] **N8 — Boolean variant tests.**
  Add `tests/derived-variants.test.ts`. **Important:** Paper.js boolean
  ops are async and browser-only (`booleanOp` rejects outside a browser
  context). See `tests/boolean-ops.test.ts` for the existing mock pattern
  — use the same `mockBooleanOp` helper. Test: fill derivation produces
  correct style flip (mock not needed — fill is a pure style transform),
  slash derivation calls `booleanOp('subtract', ...)` with correct args,
  circle derivation calls `booleanOp('unite', ...)`, badge derivation
  preserves badge layers. Use simple rectangle path `d` strings for
  deterministic argument matching.

---

## Phase O — Cubic Weight Interpolation

Status: **planned** (upgrade piecewise-linear weight interpolation to
cubic monotone spline for smooth cross-weight rendering)

`interpolateWeight()` in `lib/runtime-core/weight-interpolation.ts`
uses piecewise linear interpolation between three control points
(ultralight=100, regular=400, black=900). This produces a kink at
weight 400 and poor accuracy for intermediate weights (thin, light,
medium, semibold). H9 explicitly deferred "cubic interp" to a future
phase.

### Priority 1 — Cubic Monotone Spline

- [ ] **O1 — Implement Fritsch-Carlson monotone cubic interpolation.**
  In `weight-interpolation.ts`, add `cubicMonotoneInterpolate(points:
  Array<{x: number; y: number}>, t: number): number`. Implements the
  Fritsch-Carlson algorithm: compute slopes at each control point,
  apply monotone constraints (no overshooting), compute Hermite spline
  coefficients per segment. Returns smoothly interpolated scalar.

- [ ] **O2 — Apply per-coordinate cubic interpolation to path commands.**
  Upgrade `interpolateWeight()` to use `cubicMonotoneInterpolate` per
  coordinate value across all supplied control points instead of
  piecewise linear. The function signature stays backward-compatible:
  `interpolateWeight(controlPoints, targetWeight)` still returns
  `string | null`. Internally, build per-coordinate cubic splines from
  all available control points (2 or 3).

- [ ] **O3 — Support up to 9 weight control points.**
  Extend `WeightControlPoints` type to make all fields optional and add
  intermediate weights: `thin`, `light`, `medium`, `semibold`, `bold`,
  `heavy`. **Breaking change:** the current type in `weight-interpolation.ts`
  requires all three of `ultralight`, `regular`, `black` as non-optional
  strings. After this change, update ALL callers:
  - `interpolateWeight()` (internal — update validation call)
  - `validateWeightControlPoints()` (update minimum count to 2)
  - `InspectorPanel.tsx` weight control point display (update to show
    all 9 slots)
  Run `npx tsc --noEmit` to catch all TypeScript call sites.
  Update `Variant.weightControlPoints` in `lib/schema/types.ts` to match
  (note: schema already has these fields as optional — the gap is in
  `weight-interpolation.ts`'s own type declaration).

### Priority 2 — Editor Integration

- [ ] **O4 — Multi-control-point editor in InspectorPanel.**
  Extend the weight control point editor (L4) to show all 9 weight
  slots (ultralight → black) as a vertical list. Each slot shows a
  small path preview thumbnail and an "Assign" / "Clear" button.
  Use a drag-and-drop SVG upload or "Copy from current state" shortcut.
  The weight preview slider (K3) automatically benefits from cubic
  interpolation with no additional wiring.

- [ ] **O5 — Visual weight curve editor.**
  Add a `WeightCurveEditor` component. Renders the interpolated weight
  curve as a polyline (x = weight 100→900, y = first control-point
  coordinate value). Highlights the cubic spline vs. the old piecewise
  linear line to show improvement. Clicking a point on the curve opens
  an inline field to tweak that weight's path. Useful for quality
  checking before export.

### Priority 3 — Tests

- [ ] **O6 — Cubic interpolation correctness tests.**
  Add `tests/weight-interpolation-cubic.test.ts`. Assert:
  interpolated value equals control-point value exactly at each
  control-point weight; no overshoot when values are monotone; smooth
  (C1 continuous) at segment boundaries (check derivative
  discontinuity < 1e-10); matches expected output for a known
  three-point test fixture.

---

## Phase P — Import Adapter Ecosystem

Status: **planned** (expand the icon library import system beyond the
current Lucide + Raw SVG adapters)

The adapter SDK (`lib/import/adapter-sdk/`) is complete with a registry,
types, and a template. The existing `lucide-adapter.ts` demonstrates
the full pattern. This phase adds four high-demand adapters.

### Priority 1 — Heroicons & Phosphor

- [ ] **P1 — Heroicons adapter.**
  Create `lib/import/adapters/heroicons-adapter.ts` and
  `lib/import/adapters/heroicons-source.ts`. **Cannot use direct
  filesystem access to `node_modules` in a web deployment.** Follow
  the Lucide pattern: generate a build-time manifest (`heroicons-source.ts`)
  that lists all icon names and their SVG content as a JS module, then
  import from it at runtime. Capabilities: `searchable: true`, variants:
  `outline` and `solid` (map to Coniva size 24 / 20). Register in
  `registerBuiltinAdapters()`.

- [ ] **P2 — Phosphor Icons adapter.**
  Create `lib/import/adapters/phosphor-adapter.ts` and
  `lib/import/adapters/phosphor-source.ts` (build-time manifest, same
  pattern as Lucide). Source: `@phosphor-icons/core` npm package.
  Capabilities: `searchable: true`, 6 weights (`thin`, `light`,
  `regular`, `bold`, `fill`, `duotone`). **Weight name mapping:**
  Phosphor's `fill` is a rendering style (filled path), not a weight —
  skip it for `weightControlPoints`. Map: Phosphor `thin` → Coniva
  `ultralight`, `light` → `light`, `regular` → `regular`, `bold` →
  `bold`, `duotone` → skip (multi-layer style). Pre-fill
  `Variant.weightControlPoints` with the `ultralight` (`thin`),
  `regular`, and `bold` paths only.

- [ ] **P3 — Material Symbols adapter.**
  Create `lib/import/adapters/material-symbols-adapter.ts`. Source:
  `@material-symbols/svg-400` (Google's official npm package). Variants:
  outlined/rounded/sharp. Map to Coniva size 24. The package ships
  individual SVG files — generate a build-time manifest source module
  (same pattern as Lucide/Heroicons/Phosphor adapters) rather than
  reading the package directory at runtime. `searchable: true`.

### Priority 2 — SF Symbols SVG Import

### Priority 3 — Import UX Polish

- [ ] **P5 — Adapter capability display in ImportIconDialog.**
  In `components/editor/ImportIconDialog.tsx`, show per-adapter
  capability badges: "Searchable", "6 weights", "Variable value". When
  a Phosphor or SF Symbols icon is imported, show a toast: "Weight
  control points pre-filled — open Weight Interpolation in Inspector
  to preview."

- [ ] **P6 — Batch import from adapter.**
  Allow selecting multiple icons from a searchable adapter's results
  and importing them all at once. Add checkboxes to the search results
  list. "Import Selected (N)" button triggers sequential
  `importById()` calls with a progress indicator. Limit to 50 icons
  per batch to avoid UI freeze.

- [ ] **P7 — Adapter tests.**
  Add `tests/adapter-heroicons.test.ts`, `tests/adapter-phosphor.test.ts`,
  `tests/adapter-material-symbols.test.ts`, `tests/adapter-sf-symbols.test.ts`.
  Each test: load a fixture SVG, call `importById`, assert the resulting
  `Icon` has expected layer count, correct `Layer.role` assignments,
  correct variant count, and no unsupported feature warnings for
  standard icons.

---

## Phase Q — NPM Registry Distribution

Status: **planned** (allow teams to publish icon packages directly to
npm or a private registry from Coniva's sync targets)

Currently `SyncTarget.deliveryMode` supports `local-directory` and
`git-pr`. Teams who want to `npm install @acme/icons` need to publish
to a registry manually. This phase adds a `npm-registry` delivery mode
and an automated publish pipeline.

### Priority 0 — Prerequisites

- [ ] **Q0 — Add formal `SyncConnector` interface to `contracts.ts`.**
  Define `interface SyncConnector<TRequest, TResult>` with `push(req:
  TRequest): Promise<TResult>` and optional `validate(req: TRequest):
  string | null`. Retrofit `LocalDirectorySyncConnector` and
  `AdapterPrConnector` to implement it. This ensures `NpmConnector`
  (Q2) is consistent from the start and the dispatch in
  `SyncTargetPanel.tsx` becomes type-safe. **Must be done before Q2.**

- [ ] **Q0b — Add `npm-publish` RPC method to platform bridge.**
  `lib/platform/bridge.ts` defines the set of RPC methods available to
  the desktop app via Electrobun. Add `npm-publish: (args: { cwd: string;
  registry: string; tag?: string }) => Promise<{ exitCode: number; stdout:
  string; stderr: string }>`. The native side shells out to the `npm`
  CLI. **Desktop only.** Web callers use the Q5 proxy route instead.
  This is required by Q2's `push()` implementation.

### Priority 1 — Registry Sync Target

- [ ] **Q1 — `npm-registry` delivery mode schema.**
  Add `'npm-registry'` to `SyncTarget.deliveryMode` union in
  `lib/schema/types.ts`. Add `SyncTarget.npmRegistry?: { registry:
  string; scope?: string; packageName: string; tokenStored?: boolean }`.
  **No `token` field in the schema.** The token lives exclusively in
  the platform keychain (keyed by `syncTarget.id`). The schema has only
  `tokenStored: boolean` as a UI hint. This prevents tokens from being
  serialised into project JSON, which can be committed via the git-pr
  sync connector. Add `lib/platform/keychain.ts` with
  `getNpmToken(id)` / `setNpmToken(id, token)` / `clearNpmToken(id)`.

- [ ] **Q2 — NPM publish connector.**
  Create `lib/sync-service/connectors/npm-connector.ts`. Implements
  the `SyncConnector` interface. `push()` method:
  1. Runs the compile pipeline for the target's platform adapter.
  2. Builds a `package.json` with `name`, `version` (auto-incremented
     semver from the last published version), `exports` map.
  3. Calls `npm pack` → `npm publish` via the Node `child_process`
     exec API (desktop only) or a publish-proxy API endpoint (web).
  4. Returns a `SyncResult` with the published version and registry URL.

- [ ] **Q3 — Version management UI.**
  In `components/export/SyncTargetPanel.tsx`, for npm-registry targets,
  show: last published version badge, "Bump patch / minor / major"
  dropdown before publish, changelog auto-generated from icon diff
  (`diff-compiled-icons.ts`). The changelog surfaces added, modified,
  removed icon names as human-readable release notes.

- [ ] **Q4 — Automated publish trigger with cancel.**
  In `SyncTarget`, add `autoPublish?: { on: 'save' | 'manual'; semver:
  'patch' | 'minor' }`. When `on: 'save'` and icons change, queue a
  debounced publish (300 s) after the save. **Must include a cancel
  mechanism:** show a "Pending publish in 5:00 — [Cancel]" countdown
  badge in the tab bar. Clicking Cancel clears the debounce timer.
  Without an explicit cancel path, an accidental geometry change on
  `on: 'save'` mode queues an automatic publish to a public registry
  with potentially broken icons.

### Priority 2 — Web Proxy & Auth

- [ ] **Q5 — Publish proxy API route (web app).**
  The web app cannot shell out to `npm` CLI directly. Add an API route
  `app/api/publish-npm/route.ts`. Accepts a multipart POST with the
  tarball and registry config. Calls the npm registry REST API
  (`PUT /<package>`) with the auth token. **Security posture:** follow
  the existing GitHub sync proxy pattern — the token is stored server-side
  as an env var (`NPM_PUBLISH_TOKEN`), NOT passed from the client on
  each request. The client sends `syncTargetId`; the server resolves the
  token from env. This is consistent with `GITHUB_SYNC_TOKEN` usage and
  avoids the token traveling over the wire on every publish call.

- [ ] **Q6 — Private registry support (Verdaccio / GitHub Packages / JFrog).**
  Ensure the connector works with non-public registries by honoring the
  `registry` field (default `https://registry.npmjs.org`). Test against
  GitHub Packages (`https://npm.pkg.github.com`) by adding a fixture
  test that mocks the registry PUT endpoint.

### Priority 3 — Tests & Safety

- [ ] **Q7 — Dry-run mode.**
  Add `SyncTarget.dryRun?: boolean`. When true, the connector runs the
  full build pipeline and validates the package.json but skips the
  actual `npm publish` call. Returns a `SyncResult` with
  `status: 'dry-run'` and the would-be package tarball path.
  Surface as a "Preview publish" button in the UI.

- [ ] **Q8 — NPM connector tests.**
  Add `tests/npm-connector.test.ts`. Mock `npm publish` (or the
  registry PUT). Assert: correct `package.json` fields for React
  adapter, version bump logic (patch/minor/major), changelog includes
  correct icon diff, dry-run does not invoke network calls.

---

## Phase I — Animation Tab Surface

Status: **completed** (bridge gap between runtime capabilities and editor UI)

The runtime implements 14 timeline track types (6 transform, 3 trim, 3 style,
2 color), per-subpath strategy classification, trim path computation, and
hybrid frame composition. The Animation tab currently exposes only 6 track
types (transform + pathLength) and no trim, style, color, or subpath UI.
This phase surfaces all existing runtime capabilities in the editor.

Spec: [`specs/editor/animation-tab.md`](../specs/editor/animation-tab.md)

### Priority 1 — Track Completeness

- [x] **I1 — Add trim path tracks to TimelineEditor.**
  Add `trimStart`, `trimEnd`, `trimOffset` to the `TRACKS` array in
  `components/editor/TimelineEditor.tsx`. These are numeric 0-1 tracks
  with rest values defined in `scheduler.ts` (trimStart=0, trimEnd=1,
  trimOffset=0). Enables authoring stroke-reveal and traveling-segment
  animations for open paths.

- [x] **I2 — Add style tracks to TimelineEditor.**
  Add `strokeWidth`, `fillOpacity`, `strokeOpacity` to the `TRACKS`
  array. These were added in Phase H3 at the schema/runtime level but
  never exposed in the editor. All are numeric tracks with standard
  interpolation.

- [x] **I2b — Add color tracks to TimelineEditor.**
  Add `fill` and `stroke` to the timeline as color-type tracks. These
  are already defined in the `TimelineTrack` union in `lib/schema/types.ts`
  and handled by the runtime interpolation path in `scheduler.ts` and
  `store.ts`. Unlike numeric tracks, color tracks need a color keyframe
  editor (hex input or color picker per keyframe) instead of a numeric
  input. Implementation: add a `ColorTrackRow` component alongside the
  existing numeric `TrackRow`, with color swatch keyframes that open
  `ColorPickerPopover` on click.

- [x] **I3 — Smart track suggestions based on path topology.**
  When a user adds a track to a layer binding, suggest appropriate
  tracks based on the layer's subpath classification:
  - Closed subpaths → suggest morph-related tracks (opacity, scale)
  - Open subpaths → suggest trim tracks (trimStart, trimEnd, trimOffset)
  - All layers → suggest transform tracks (translateX/Y, rotate, scale)
  Show suggestions as a categorized dropdown with section headers.

### Priority 2 — Per-Binding Strategy Display

- [x] **I4 — Show per-binding animation strategy in layer binding list.**
  In `TransitionPanel.tsx`, display the classified strategy (morph/trim/
  crossfade/preserved) next to each layer binding with color-coded
  badges. Use `classifySubPathStrategies()` from topology-detection.ts
  to compute. Green=morph, Yellow=trim, Red=crossfade, Blue=preserved.

- [x] **I5 — Show per-binding morph readiness scores.**
  Expand the layer binding list to show `MorphReadiness` score per
  binding (not just global compatibility badge). Display score components:
  commandCompatibility, subpathCompatibility, closedCompatibility,
  bboxSimilarity, centroidSimilarity. Show recommended strategy with
  one-line explanation.

- [x] **I6 — Per-subpath strategy breakdown for compound paths.**
  When a layer has multiple subpaths, show a collapsible breakdown:
  `subpath 0: morph (both closed, score: 0.94)` /
  `subpath 1: trim (both open, mismatched commands)`.
  Use `classifySubPathStrategies()` output. Only shown for layers
  with > 1 subpath.

- [x] **I7 — Per-binding strategy override.**
  Allow users to override the auto-classified strategy per binding.
  Add a strategy selector dropdown to each binding in the list.
  Override persists in the LayerBinding schema (add optional
  `strategyOverride?: 'morph' | 'trim' | 'crossfade'`).

### Priority 3 — Trim Path UI

- [x] **I8 — Compound trim mode selector.**
  When a binding has trim tracks, show a `CompoundTrimMode` dropdown
  (`simultaneously` / `individually`) in the binding detail view.
  Wire to `LayerBinding.compoundTrimMode`. Default to `simultaneously`.

- [x] **I9 — Trim path visual preview in timeline.**
  When trim tracks are active, show a miniature path preview next to
  the track rows indicating the visible stroke range. Update in
  real-time as the playhead scrubs. Use `computeTrimValues()` to
  compute the dasharray/dashoffset for the preview.

- [x] **I10 — Default trim keyframes auto-population.**
  When the system classifies a binding as `trim` strategy, auto-populate
  default keyframes: `trimEnd: [0, 1]` (draw on) with the transition's
  easing. User can edit or remove these defaults.

---

## Phase J — Animation Preview & Composition

Status: **completed** (live preview integration for cross-icon, direction, variable value)

### Priority 0 — Rendering Infrastructure (from eng review)

- [x] **J0 — Build HybridFrame → SVG rendering bridge.**
  Create `lib/editor-renderer-svg/hybrid-frame-bridge.ts` with
  `applyHybridFrameToSVG(frame: HybridFrame, svgElement: SVGElement)`.
  Routes morph paths to d-attribute updates, trim paths to
  stroke-dasharray/dashoffset CSS, crossfade paths to opacity.
  **Blocks J3 and J4.** Wire into the canvas preview pipeline alongside
  existing `applyTransitionPreview()`.

### Priority 1 — Cross-Icon Preview

- [x] **J1 — Cross-icon transition preview in timeline.**
  When a cross-icon transition is selected, load layers from both
  source and target icons simultaneously. Render the interpolated
  frame on the canvas using `resolveTransition()` with
  `crossIconContext`. The timeline should show source layers fading
  out and target layers fading in with morph/trim tracks overlaid.

- [x] **J2 — Cross-icon layer matching visualization.**
  In the layer binding list, show which source layer matched to which
  target layer and why (role match, name match, geometry match).
  Display the 3-pass matching result from the resolver with a brief
  label per binding: "matched by role", "matched by name",
  "matched by geometry (score: 0.82)".

### Priority 2 — Direction & Composition Preview

- [x] **J3 — Direction preview in canvas.**
  When direction is set on a replace transition, the canvas preview
  should show the directional slide+fade effect during scrubbing.
  Apply `buildDirectionalReplaceSnapshot()` transform values
  (translateY offset, scale) to the rendered SVG layers.

- [x] **J4 — Hybrid frame preview in canvas.**
  When a transition has mixed strategies (morph + trim + crossfade),
  render the hybrid frame using `composeHybridFrame()`. Split the
  SVG rendering into: morphed paths (interpolated d attribute),
  trimmed paths (dasharray animation), crossfaded paths (opacity).
  Show which rendering mode each subpath uses via a toggle overlay.

- [x] **J5 — Stagger delay visualization in timeline.**
  Show computed stagger delays as offset indicators in the timeline.
  Each binding row should show its delay as an indented start position.
  For `individually` mode, each row starts after the previous completes.

### Priority 3 — Variable Value Integration

- [x] **J6 — Variable value live canvas preview.**
  Connect the variable value slider (in InspectorPanel) to the canvas
  rendering pipeline. When the slider moves, call
  `computeVariableValue()` and `applyVariableValue()` to update
  layer opacities in real-time on the canvas.

- [x] **J7 — Per-layer visibility indicators at current variable value.**
  In the layer panel, show dim/bright indicators per layer based on
  the current variable value. Primary layers (visible at value > 0),
  secondary (visible at value > 0.33), tertiary (visible at > 0.66).
  Use role badges already in the layer panel.

- [x] **J8 — Variable value keyframe track.**
  Add `variableValue` as an animatable track in the timeline editor.
  This allows authoring transitions where the variable value changes
  over time (e.g., wifi signal bars filling up during a transition).
  Schema: add `{ property: 'variableValue'; keyframes: number[] }` to
  TimelineTrack union.

---

## Phase K — Advanced Animation Authoring

Status: **completed** (advanced features building on Phase I and J)

### Priority 1 — Magic Replace & Topology

- [x] **K1 — Magic Replace UI (preserveLayerIds).**
  Add a "Preserve" toggle per layer binding in the binding list.
  When toggled, the binding is marked `preserved: true` and excluded
  from morph/trim/crossfade — the layer persists unchanged during the
  transition. Wire to the `preserveLayerIds` field on the transition.

- [x] **K2 — Topology contract locking UI.**
  Add a "Lock Topology" toggle in the state inspector. When locked,
  geometry edits that would change the command signature are blocked
  with a warning. Shows the current topology contract (subpath count,
  command signature, closed status per subpath). Wire to
  `State.topology.locked`.

### Priority 2 — Weight & Gradient

- [x] **K3 — Weight interpolation preview.**
  In the variant inspector, when 3 weight control points are available
  (ultralight, regular, black), show a weight slider (100-900) that
  previews interpolated paths on the canvas. Use `interpolateWeight()`
  and `validateWeightControlPoints()`.

- [x] **K4 — Auto-gradient rendering mode preview.**
  Add an "Auto Gradient" option to the rendering mode dropdown.
  When selected, apply `generateAutoGradient()` to each layer's fill
  color and render with linear gradient stops. Preview on canvas.

### Priority 3 — Animation Intelligence

- [x] **K5 — Auto-strategy recommendation engine.**
  When creating a transition, analyze all layer bindings and recommend
  the optimal transition strategy (track vs morph vs replace) based on
  aggregate morph readiness scores. Show a one-click "Apply recommended
  strategy" button with explanation.

- [x] **K6 — Animation preset library.**
  Create a library of reusable animation presets (e.g., "SF Symbols
  Replace Down-Up", "Lottie Draw-On", "Morph with Stagger") that
  pre-configure strategy, direction, stagger, and default keyframes.
  Store as JSON templates in the project or workspace.

---

## Phase L — Inspect Tab Redesign

Status: **completed** (surface runtime state and topology in layer inspector)

The Inspect tab currently shows basic layer properties (role, fill, stroke,
transform). It must surface computed runtime state (variable value opacity,
animation strategy, topology contract) and enable advanced authoring controls
(topology locking, weight control points, auto-gradient preview).

Spec: [`specs/editor/animation-tab.md`](../specs/editor/animation-tab.md) §Inspect Tab

- [x] **L1 — Variable value opacity indicator.**
  Show the computed opacity at the current `variableValue` next to the
  layer's authored opacity. Display the role threshold range
  (e.g., "secondary: visible at 33-66%") and current computed value.
  Use `computeVariableValue()` output for the selected layer.

- [x] **L2 — Topology status display.**
  Show the selected layer's `GeometryStats`: subpath count, command
  signature per subpath, closed/open status per subpath. Read from
  `computeGeometryStats()` in `path-normalization.ts`. Collapsible
  section below the Position fields. Helps users understand why
  certain morph strategies are recommended.

- [x] **L3 — Animation strategy badge.**
  When a transition is selected in the Animation tab and the currently
  inspected layer participates in a binding, show a badge indicating
  the classified strategy (morph/trim/crossfade/preserved) with
  color coding (green/yellow/red/blue). Read from `classifySubPathStrategies()`
  output cached in TransitionPreview.

- [x] **L4 — Weight control point editor.**
  When the variant uses weight interpolation, show the current weight
  value and a list of available control points (ultralight/regular/black).
  Allow uploading or assigning SVG paths as control point data for each
  weight. Store in `Variant.weightControlPoints` (new schema field).
  **Prerequisite for K3** (weight preview slider).

- [x] **L5 — Auto-gradient preview swatch.**
  When auto-gradient rendering mode is active, show gradient stop
  previews next to each layer's fill color in the inspector. Display
  the 3-stop gradient (lighten/original/darken) generated by
  `generateAutoGradient()`. Helps users understand how their solid
  colors will appear in gradient mode.

- [x] **L6 — Topology lock toggle.**
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
| I | **Animation Tab Surface** | 2026-03-23 | 14 track types, per-binding strategy, trim path UI |
| J | **Animation Preview & Composition** | 2026-03-23 | HybridFrame bridge, cross-icon preview, variable value track |
| K | **Advanced Animation Authoring** | 2026-03-23 | Magic Replace, auto-gradient mode, auto-strategy, presets |
| L | **Inspect Tab Redesign** | 2026-03-23 | Variable value indicator, topology, strategy badges, weight editor |

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
