# Icon Studio - IMPLEMENTATION.md

This document tracks implementation progress against the planned architecture and phased roadmap.

## Current status

- **Phase 1 (Foundation/editor authoring):** Complete and covered by deterministic/integration tests.
- **Phase 2 (Stateful runtime packages):** Not started in this repo structure yet.
- **Phase 3/5 editor-side groundwork:** Partially implemented in the editor and export/import stack (guides, gradients, boolean ops, alignment/distribution, SVG IO).

---

## Implemented so far (mapped to plan)

### `schema`
- [x] Canonical project/icon/state/layer/transition/effect types are defined.
- [x] Runtime guards exist for project + key model validation.
- [x] Public schema re-export entrypoint exists.
- [x] Guide master, clip-mask, import metadata, and gradient paint types are defined.

### `editor-store`
- [x] Zustand vanilla store implemented with editor state slices.
- [x] Temporal history integration is wired.
- [x] Project load/new + active icon/variant/state switching implemented.
- [x] Layer patching, selection, viewport, and tool switching actions implemented.
- [x] Selector helpers for current icon/variant/state/layers are implemented.
- [x] Explicit history boundary helpers (`pauseHistory`, `resumeHistory`, `commitHistory`) are implemented.
- [x] Legacy guide-set migration into project guide masters is implemented on load.
- [x] Guide master CRUD, per-icon custom guide editing, clip-mask actions, and shape-tool settings are implemented.

### `editor-renderer-svg`
- [x] SVG renderer module exists and is used by editor canvas.
- [x] Active variant `viewBox` + layer rendering are applied.
- [x] Layer style and transform application are implemented.
- [x] Deterministic per-layer attributes are emitted for editor targeting.
- [x] Gradient paint defs/references are emitted for editor rendering.

### `editor-overlay-canvas`
- [x] Canvas overlay controller/hooks exist.
- [x] Grid/guides rendering path exists.
- [x] Selection overlay rendering path exists.
- [x] Guide presets (safe zone + keyline circle/square) and custom guide-set drawing are implemented.
- [x] Active snap-guide feedback is published during direct-select/pen interactions.

### `editor-core`
- [x] Path model + SVG parse/serialize utilities exist.
- [x] Imperative `PathEditor` interaction entrypoint exists.
- [x] Keyboard shortcuts are integrated at editor shell level.
- [x] Baseline pen/direct-select anchor + handle workflow is implemented (point insertion + anchor dragging).
- [x] Pointer-session history boundary semantics now commit on pointer-up.
- [x] Boolean path ops are implemented via Paper runtime integration.
- [x] Snap engine collects grid, guide, viewBox-center, and layer-bound candidates with nearest-match resolution.
- [x] Layer align/distribute math is implemented for editor selections.
- [x] Point-level align/distribute, multi-point delete, bbox extraction, and bbox remap math are implemented.
- [x] Shape primitive path generation exists for line/rect/ellipse/polygon/star tools.

### `import`
- [x] SVG import normalizes supported primitive elements into path layers.
- [x] Presentation attributes, simple transforms, and unsupported metadata capture are implemented.
- [x] Gradient refs/href chains resolve into internal paint refs during import.

### `export`
- [x] Deterministic SVG export exists.
- [x] Token paint resolution, gradient defs, and clip-path emission are implemented.

### `apps/web`
- [x] Editor shell layout with side panels and canvas is implemented.
- [x] File open/save project flow is implemented.
- [x] SVG export action is implemented.
- [x] Layer panel, tool panel, inspector panel scaffolds are implemented.

### `tests`
- [x] Deterministic save/load, export, and parse/serialize regression coverage exists.
- [x] Integration coverage now exists for boolean ops, snapping, alignment/distribution, shape primitives, SVG import, gradients, point transforms, and guide masters.
- [x] Vector command coverage includes multi-point delete/nudge/align/distribute/bbox scenarios.

---

## Remaining roadmap (last reviewed: 2026-03-18)

Detailed runtime planning now lives in [docs/plans/2026-03-08-runtime-library-implementation-plan.md](docs/plans/2026-03-08-runtime-library-implementation-plan.md), [docs/plans/2026-03-08-runtime-json-export-design.md](docs/plans/2026-03-08-runtime-json-export-design.md), [docs/plans/2026-03-08-sf-symbols-style-export-plan.md](docs/plans/2026-03-08-sf-symbols-style-export-plan.md), [docs/plans/2026-03-08-target-codebase-export-plan.md](docs/plans/2026-03-08-target-codebase-export-plan.md), and [docs/plans/2026-03-08-multi-platform-export-sync-platform-plan.md](docs/plans/2026-03-08-multi-platform-export-sync-platform-plan.md).

### Phase R0 - Repo preparation
- [x] Replace placeholder package metadata with real package naming.
- [x] Formalize the active test runner/scripts used by the repo. (Bun test; scripts in package.json)
- [x] Add shared runtime payload types for exporter + runtime modules. (`lib/compiler-contracts/types.ts`)
- [x] Define in-repo module boundaries for `runtime-core`, `runtime-dom`, and `runtime-react`. (`lib/runtime-core/`, `lib/runtime-dom/`, `lib/runtime-react/`)

### Phase R1 - Runtime JSON exporter (complete)
- [x] Implement `lib/export/export-runtime-json.ts`.
- [x] Emit deterministic `index.json`, `meta.json`, and per-variant payload files.
- [x] Add explicit Draw annotation export from editor guide points. (`buildDrawAnnotation()` + test coverage in `tests/runtime-json-export.test.ts:97-177`)
- [x] Add Variable Draw participation export for draw-capable layers. (`variableDraw.participatingLayerIds` + test at line 178-180)
- [x] Add Magic Replace continuity metadata for preserved enclosure layers. (`getPreservedLayerIds()` + `magicReplace` emission + test at line 182-189)
- [x] Preserve gradient paint descriptors in runtime payloads.
- [x] Materialize only valid icon-level transitions/effects per variant.
- [x] Add exporter diagnostics for invalid runtime transitions. (`RuntimeExportDiagnostic` with 5 codes + test at lines 197-244)
- [x] Add deterministic export coverage for runtime-json. (`tests/export-runtime-json.test.ts`, `tests/runtime-json-export.test.ts`)

### Phase R2 - Runtime core (complete)
- [x] Build `IconRuntime` state machine and frame scheduler. (`lib/runtime-core/`)
- [x] Execute Draw On / Draw Off from exported annotation data. (`lib/runtime-core/draw-executor.ts` + tests)
- [x] Support Variable Draw progress on participating layers. (`computeVariableDrawValues()` + tests)
- [x] Support Magic Replace continuity with preserved enclosures. (`resolveTransition` `preserveLayerIds` option + tests)
- [x] Implement `replace` and `track` transition strategies. (verified with unmatched-layer fallback test)
- [x] Support named easings and cubic-bezier parsing.
- [x] Add effect playback and snapshot composition. (`lib/runtime-core/effect-scheduler.ts` — bounce, pulse, rotate, breathe, wiggle, scale, appear, disappear, lineDrawOn/Off + tests)
- [x] Add frame checkpoint tests for state changes and interruptions. (`tests/runtime-core.test.ts`)

### Phase R3 - Runtime DOM (complete)
- [x] Build SVG renderer for runtime snapshots. (`lib/runtime-dom/`)
- [x] Support efficient DOM updates across animated frames. (diff-based `setState` + test for shared-layer identity preservation)
- [x] Add browser-level tests for mount/update/unmount behavior. (`tests/runtime-dom.test.ts`, `tests/runtime-svg-renderer.test.tsx`)

### Phase R4 - Runtime React (complete)
- [x] Build `<Icon />` and `useIcon` on top of the runtime store. (`lib/runtime-sdk/`)
- [x] Wire `useSyncExternalStore` subscriptions and prop-driven state changes. (`lib/runtime-react/VibeIcon.tsx` + `IconDriver.subscribe()` in `lib/runtime-dom/driver.ts`)
- [x] Add integration coverage for controlled and uncontrolled animation flows. (`tests/runtime-react.test.tsx` — 9 tests)
- [x] Add a demo icon path in the app for end-to-end validation. (`app/demo/runtime/page.tsx` — Hamburger/Close + Chevron + export pipeline validation)

### Phase R5 - Platform capability layer
- [ ] Define target platform, delivery mode, capability, and export-outcome types.
- [ ] Add explicit downgrade reporting for unsupported target features.
- [ ] Separate adapter transforms from sync connectors.

### Phase R6 - React adapter family
- [ ] Generate icons into generic React repos from runtime-json.
- [ ] Vendor or import runtime helpers for React hosts.
- [ ] Add thin host integrations such as Storybook or CMS previews on top of the generic React adapter.
- [ ] Add deterministic stale-file cleanup and generated file manifests.

### Phase R7 - Sync connectors
- [ ] Add target export config to project schema.
- [ ] Build editor-side export / connections UI.
- [ ] Implement local-directory sync into downstream repos.
- [ ] Implement Git PR-based sync flow.
- [ ] Add optional package/registry connectors later.

### Phase R8 - Swift and Flutter adapter design
- [ ] Define Swift adapter capability mapping and runtime boundary.
- [ ] Define Flutter adapter capability mapping and runtime boundary.
- [ ] Decide v1 downgrade rules for non-React targets.

### Phase R9 - Morphing and advanced transitions
- [ ] Add topology contract validation in the editor.
- [ ] Implement strict and best-guess morph execution.
- [ ] Fallback invalid morphs to deterministic replace behavior.

---

## Suggested next implementation sequence

1. Complete Phase R0 so runtime work has stable scripts, types, and module boundaries.
2. Build Phase R1 first: lock the runtime-json export contract, especially Draw / Variable Draw / Magic Replace metadata, before runtime rendering work.
3. Stand up Phase R2 + R3 with Draw-capable exported payloads first, then add generic `track` and `replace` transitions.
4. Add Phase R4 React adapters with a single end-to-end stateful demo icon.
5. Add the platform capability layer before adapter work hardens.
6. Build one generic React adapter family, then sync connectors.
7. Design Swift and Flutter adapters from explicit capability contracts before implementing them.
8. Add morphing after the platform boundaries are stable.
