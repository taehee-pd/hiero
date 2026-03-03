# Icon Studio - IMPLEMENTATION.md

This document tracks implementation progress against the planned architecture and phased roadmap.

## Current status

- **Phase 1 (Foundation):** In progress (**mostly complete for core web authoring flow**).
- **Phase 2+ (Stateful runtime, export ecosystem, integrations):** Not started in this repo structure yet.

---

## Implemented so far (mapped to plan)

### `schema`
- [x] Canonical project/icon/state/layer/transition/effect types are defined.
- [x] Runtime guards exist for project + key model validation.
- [x] Public schema re-export entrypoint exists.

### `editor-store`
- [x] Zustand vanilla store implemented with editor state slices.
- [x] zundo temporal history integration is wired.
- [x] Project load/new + active icon/variant/state switching implemented.
- [x] Layer patching, selection, viewport, and tool switching actions implemented.
- [x] Selector helpers for current icon/variant/state/layers are implemented.
- [x] Explicit history boundary helpers (`pauseHistory`, `resumeHistory`, `commitHistory`) are implemented.

### `editor-renderer-svg`
- [x] SVG renderer module exists and is used by editor canvas.
- [x] Active variant `viewBox` + layer rendering are applied.
- [x] Layer style and transform application are implemented.
- [x] Deterministic per-layer attributes are emitted for editor targeting.

### `editor-overlay-canvas`
- [x] Canvas overlay controller/hooks exist.
- [x] Grid/guides rendering path exists.
- [x] Selection overlay rendering path exists.
- [x] Guide presets (safe zone + keyline circle/square) and custom guide-set drawing are implemented.

### `editor-core`
- [x] Path model + SVG parse/serialize utilities exist.
- [x] Imperative `PathEditor` interaction entrypoint exists.
- [x] Keyboard shortcuts are integrated at editor shell level.
- [x] Baseline pen/direct-select anchor + handle workflow is implemented (point insertion + anchor dragging).
- [x] Pointer-session history boundary semantics now commit on pointer-up.

### `apps/web`
- [x] Editor shell layout with side panels and canvas is implemented.
- [x] File open/save project flow is implemented.
- [x] SVG export action is implemented.
- [x] Layer panel, tool panel, inspector panel scaffolds are implemented.

---

## Remaining roadmap

### Phase 1 completion checklist
- [x] Add explicit zundo history boundary controls (`pause`, `resume`, `commit`).
- [x] Complete direct-select + pen editing baseline interactions in `editor-core` (anchor handles, point dragging, point insertion, pointer-up commit).
- [x] Add deterministic regression checks for static save/load + SVG export + path round-trip stability (`bun test`).

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

1. Close remaining Phase 1 interaction/history gaps.
2. Stand up `runtime-core` with `track` + `replace` transition execution.
3. Add DOM runtime adapter and a single end-to-end stateful demo (hamburger/close).
4. Lock deterministic runtime-json + svg exports with snapshot tests.
5. Expand into variants/rendering modes/tokens, then morphing and integrations.
