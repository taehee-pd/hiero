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

## Remaining roadmap

### Phase 2 - Stateful icons + runtime MVP
- [ ] Build `runtime-core` state machine, transition resolver, scheduler.
- [ ] Build `runtime-dom` renderer/drivers for track transitions.
- [ ] Build `runtime-react` (`<VibeIcon />`, hook wrapper).
- [ ] Add hamburger ↔ close reference icon + integration test.

### Phase 3 - Variants + rendering modes + tokens
- [ ] Variant coverage (12/16/24/48) + per-variant guides.
- [ ] Rendering modes across editor + runtime.
- [ ] Token resolution consistency + runtime-json exporter.

### Phase 4 - Morphing + topology lock
- [ ] Topology contract compute/validate in editor.
- [ ] Strict morph + best-guess morph + quality-based fallback.

### Phase 5 - Export + integrations
- [ ] Dedicated exporter packages (svg/react/runtime-json/lottie flag).
- [ ] Figma bridge/plugin payload/sync metadata.
- [ ] GitHub export PR automation.
- [ ] Desktop shell with bridge + file APIs.

---

## Suggested next implementation sequence

1. Stand up `runtime-core` with `track` + `replace` transition execution.
2. Add `runtime-dom` and `runtime-react` adapters with a single end-to-end stateful demo (hamburger/close).
3. Lock runtime-json/runtime SVG behavior with deterministic export snapshots.
4. Extend variant/rendering-mode/token workflows beyond the current editor/export groundwork.
5. Implement topology-locked morphing, then exporter/integration packages.
