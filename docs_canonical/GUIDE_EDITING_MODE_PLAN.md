# Guide Editing Mode + Shape Tool Upgrades — Plan

**Branch:** `claude/add-guide-editing-mode-uQ5cs`
**Status:** Validated — passed `/plan-eng-review` and Codex second opinion. Ready to implement.
**Date:** 2026-04-17

## Problem statement

Today, guide masters are authored by typing parameters into the left-pane Guide panel. This is slow and disconnected from the visual intent of a guide. We want:

1. **Guide editing mode** — a dedicated canvas mode entered from the guide panel. While active, shapes drawn on the canvas create guide items (rect / ellipse / hline / vline) rather than icon layers. Snapping to guide outlines remains available.
2. **Guide visibility gates guide snapping** — toggling guide visibility off from the toolbar should also disable guide snapping. With guides hidden, the snap toggle only affects pixel/grid snapping.
3. **Shape tools in the toolbar** — expose Ellipse, Polygon, and Star alongside Rectangle, with a chevron dropdown next to the shape button (always visible, not only when the shape tool is active).
4. **Polygon / Star per-layer properties** — selecting a polygon or star layer should show a Points input in the property panel, letting users change the number of sides/points after creation.

## Current state of the codebase (verified)

- `components/editor/ToolPanel.tsx:97-107` — `SHAPE_SUB_TOOLS` already lists `rectangle | ellipse | polygon | star | line`.
- `components/editor/ToolPanel.tsx:296-343` — chevron dropdown already implemented, but gated on `isShapeTool && isActive`; i.e. chevron only appears once the shape tool is active.
- `lib/editor-store/store.ts` — `shapeSubTool`, `shapePolygonSides`, `shapeStarPoints`, `guidesVisible`, `snapEnabled` all present.
- `lib/editor-core/path-shapes.ts` — `createRectPath`, `createEllipsePath`, `createPolygonPath`, `createStarPath`, `createLinePath` all exist and are used at creation.
- `lib/editor-core/snap-engine.ts:90-96` — `collectGuideTargets` is called unconditionally when a guide master has items; **no `guidesVisible` gate**.
- `lib/schema/types.ts:190-217` — `Layer` stores only a baked SVG `path.d`; no parametric primitive descriptor.
- `lib/schema/types.ts:401-411` — `GuideItem` is `hline | vline | rect | ellipse | drawPoint`. No polygon/star representation for guides.
- `components/editor/GuideMasterPanel.tsx` — panel exists with visibility toggle; no canvas-editing entry point.

So roughly ~60% of the "shape tools" request is already wired; the real work is (a) the chevron visibility change, (b) guide editing mode, (c) per-layer primitive metadata, and (d) the snap-gate fix.

## Implementation plan

### A. Toolbar chevron — always visible

- **File:** `components/editor/ToolPanel.tsx`
- Change the shape-tool chevron condition from `isShapeTool && isActive` to `isShapeTool`, so the chevron renders regardless of active state.
- Apply the same treatment to the select-tool chevron at line 245.
- When a sub-tool is picked from the dropdown, continue calling `setShapeSubTool(...)` + `setTool('shape')` to activate.

### B. Polygon / Star per-layer points property

- **Files:** `lib/schema/types.ts`, `lib/editor-core/path-editor.ts`, `lib/editor-core/path-shapes.ts`, `lib/editor-store/store.ts`, `components/editor/InspectorPanel.tsx`.
- Extend `Layer` with an optional primitive descriptor:

  ```ts
  export type PrimitiveShape =
    | { kind: 'rectangle'; x: number; y: number; width: number; height: number; radius?: number }
    | { kind: 'ellipse'; cx: number; cy: number; rx: number; ry: number }
    | { kind: 'polygon'; cx: number; cy: number; r: number; sides: number; rotation?: number }
    | { kind: 'star'; cx: number; cy: number; outerR: number; innerR: number; points: number; rotation?: number }
    | { kind: 'line'; x1: number; y1: number; x2: number; y2: number };

  export type Layer = {
    /* …existing fields… */
    primitive?: PrimitiveShape;
  };
  ```

- On shape-tool creation in `path-editor.ts`, populate `primitive` alongside baked `path.d`.
- Add store action `setLayerPrimitive(layerId, next)` that regenerates `path.d` via the existing `path-shapes.ts` helpers — **no forked regen logic**.
- In `InspectorPanel.tsx`, when the selected layer has `primitive.kind === 'polygon' | 'star'`, render a `Sides` (polygon) / `Points` (star) number input. On change, dispatch `setLayerPrimitive`.
- **Invariant (hard rule, documented in code + tests):** `path.d` is canonical; `primitive` is optional metadata that is cleared whenever path topology is modified outside primitive-regeneration flows (node editing, boolean ops, import, etc.). All such mutations route through a single `updateLayerPath` chokepoint that clears `primitive` unless a new one is supplied.
- **Inspector affordance:** when a polygon/star layer's `primitive` has been cleared by a path mutation, the Inspector shows a short helper line (e.g. *"Shape was modified — regenerate to edit points"*) instead of silently hiding the control.

### C. Guide editing mode

- **Store (`lib/editor-store/store.ts`):** add
  ```ts
  guideEditingMode: { active: boolean; masterId: string | null }
  ```
  with actions `enterGuideEditingMode(masterId)` / `exitGuideEditingMode()`.
- **Guide panel (`components/editor/GuideMasterPanel.tsx`):** add an "Edit on canvas" toggle per master. Disable when the master has no owning variant size or the project has no master for the current variant.
- **Canvas shape creation (`lib/editor-core/path-editor.ts`):** when `guideEditingMode.active`, branch shape drags to emit `GuideItem`s on the active master instead of creating layers. Commit only on a successful `pointerup` — `Esc` / pointer-cancel must abort without mutating the master (GuideItem has no `id`, it's identified by index, so duplicates are especially costly).
- **Shape sub-tool filtering (`components/editor/ToolPanel.tsx`):** while `guideEditingMode.active`, filter `SHAPE_SUB_TOOLS` in the dropdown to `rectangle | ellipse | line` (polygon/star have no `GuideItem` variant).
- **Overlay (`lib/editor-overlay-canvas/use-overlay.ts`):** render simple drag handles on the active master's items while mode is active.
- **Exit (lifecycle safety):** the mode must auto-exit on any of: Escape keypress, toggling the panel button off, icon or icon-state change, variant-size switch (guide masters are size-keyed), or deletion of the bound master. Covered by store subscriptions + explicit reset in the relevant actions.

### D. Guide visibility gates guide snapping

- **File:** `lib/editor-core/snap-engine.ts` (lines 90 + 94).
- Gate `collectGuideTargets(...)` behind `state.guidesVisible` for both the guide master items and `icon.customGuides`.
- Grid / viewbox-center / edge / anchor collection is unchanged; those continue to respect only `snapEnabled`.

## Scope cuts (deferred)

- Polygon/star rotation handles on canvas.
- Inner-radius ratio slider for Star beyond the numeric Points field.
- Dedicated keyboard shortcut for guide editing mode (can reuse `G` later; for now entry is via the panel only).
- Dedicated `hline` / `vline` insertion hotkeys — Codex confirms: line tool + axis snapping is sufficient for this phase; track as a follow-up UX task.
- Snapping to polygon vertices / star points beyond current center/edge targets.
- Guide item IDs (stay index-based; revisit if drag UX requires it).

## Review output (`/plan-eng-review`)

### Step 0 — Scope

- ~8 files touched. At complexity threshold but mostly data additions + conditional branches — no new services, no new infra.
- ~60% of the "new shape tools" already exists; real work is guide editing mode + primitive metadata.
- Completeness: AI-assisted marginal cost is low enough to include the full test matrix below.

### Architecture findings

| Priority | Conf. | Finding | Resolution |
|---|---|---|---|
| **P1** | 9/10 | `primitive` on `Layer` creates drift risk: path edits / boolean ops mutate `path.d` but leave `primitive` stale. A polygon that has been booleanized still advertises itself as a polygon. | Route all path mutations through a single chokepoint (`updateLayerPath`) that **clears `primitive`** unless the caller provides a new one. Inspector hides the Sides/Points input when `primitive` is absent. |
| **P2** | 8/10 | The existing disabled `tool: 'guide'` entry already toggles `guidesVisible`. Introducing a second "guide mode" risks confusion. | Keep `tool: 'guide'` as a visibility-only toggle (current behaviour). New `guideEditingMode` is a **separate** state, entered from the guide panel only. Comment the distinction. |
| **P2** | 7/10 | Polygon/Star have no `GuideItem` representation, so the dropdown must not offer them in guide mode. | Filter `SHAPE_SUB_TOOLS` to `rectangle | ellipse | line` while `guideEditingMode.active`. |
| **P3** | 6/10 | `GuideItem` has no `id` — canvas-drag creates new items rather than updating an in-progress one. | Commit the new guide item only on pointerup. During drag, preview via overlay without mutating state. |

### Code quality

| Priority | Conf. | Finding | Resolution |
|---|---|---|---|
| **P2** | 8/10 | DRY: update path must use the same `createPolygonPath`/`createStarPath` helpers as creation. | Single chokepoint; no forked regen. |
| **P2** | 7/10 | "Edit on canvas" button must disable when there's no guide master for the current variant size. | Gate button by `selectCurrentGuideMaster(state) != null`; show disabled hint. |
| **P3** | 6/10 | Always-visible chevron may squeeze the dock layout. | Visual QA pass; no code change if padding is fine. |

### Test coverage plan

- **Store** — `enter/exitGuideEditingMode` transitions; selection preserved across transitions.
- **Snap engine** — (a) guides contribute targets when `guidesVisible=true` (regression guard); (b) guides contribute no targets when `guidesVisible=false`; (c) `snapEnabled=false` still disables everything.
- **Shape creation**
  - Polygon layer create populates `primitive.kind === 'polygon'` with the configured sides.
  - Star layer create populates `primitive.kind === 'star'` with configured points.
  - `setLayerPrimitive` with changed `sides`/`points` regenerates `path.d` using the same helpers as creation.
  - Boolean op on a polygon clears `primitive`; Inspector hides Sides input.
- **Guide editing mode**
  - Dragging a rectangle while mode active creates a `rect` `GuideItem`, not a `Layer`.
  - Dragging with sub-tool set to `polygon` or `star` is a no-op or filtered from the menu.
  - Drag creates exactly one `GuideItem` (committed on pointerup), not N mid-drag items.
- **Toolbar**
  - Shape chevron visible and clickable when shape tool is not active.
  - Selecting a sub-tool activates shape tool.
- **GuideMasterPanel**
  - "Edit on canvas" disabled when no master exists for current variant.
  - Toggling it enters `guideEditingMode`; toggling off exits.

### Performance / security

- No hot-path concerns; snap engine already caches candidates. Adding the `guidesVisible` check is a single boolean read per call.
- No new attack surface (no user-supplied code paths, no eval/parsing of untrusted input).

### Verdict

Proceed with the 3 architectural tightenings:

1. `updateLayerPath` chokepoint that clears `primitive` on path mutation unless a new primitive is supplied.
2. Keep `tool: 'guide'` as visibility-only; introduce a separate `guideEditingMode` state reachable from the guide panel.
3. Filter `SHAPE_SUB_TOOLS` to rect/ellipse/line while `guideEditingMode.active`.

All other findings are covered by the test plan or deferred-with-rationale.

## Verification steps (before push)

```bash
bun install                       # Keep bun.lock in sync
bun install --frozen-lockfile     # CI parity
bun run format:check
bun run lint
pnpm test                          # test:core + test:dom
pnpm build
```

## Open questions for Codex

1. Is the `primitive` + `updateLayerPath` chokepoint the right level of abstraction, or should we instead split primitive layers into their own `Layer` subtype (discriminated union) to make the invariant unforgeable?
2. Should guide editing mode also allow adding `hline` / `vline` guides via a dedicated hotkey, or is "line tool with snapping to axis" sufficient?
3. Is there a cleaner way to surface "this layer was created as a polygon/star" than adding `primitive` — e.g., a side-table keyed by `layerId` to avoid touching the core `Layer` type?

## Codex validation (2026-04-17)

**Outcome: validated with minor clarifications.** The plan is implementable within the current architecture and aligns with all four stated requirements (separate guide editing mode, guide visibility gating guide snapping, always-visible chevron, polygon/star point editing in Inspector).

### Decisions on the open questions

1. **Keep `primitive` + `updateLayerPath` chokepoint.** Change stays local — avoids a broad discriminated-union migration across every layer creation/update callsite. Encode one hard invariant (in both code comment and tests): **`path.d` is canonical; `primitive` is optional metadata that is cleared whenever path topology is modified outside primitive-regeneration flows.** Revisit a strict `Layer` union only when future features require richer primitive semantics (corner-radius editing, parametric transforms, etc.).
2. **Do not add `hline` / `vline` hotkeys in this phase.** The line tool + axis snapping covers the requirement; dedicated horizontal/vertical guide insertion is a follow-up UX task.
3. **Extend `Layer` with optional `primitive` rather than using a side-table.** Side-tables introduce sync hazards on copy/duplicate/delete/undo. Localising metadata on `Layer` keeps history, serialization, and clipboard flows coherent with the existing state mechanics. The stale-data risk is already handled by the chokepoint-clearing rule above.

### Additional implementation guardrails (Codex additions)

- **Mode lifecycle safety** — exit `guideEditingMode` automatically on:
  - icon / icon-state change,
  - variant-size switch (current guide master is size-keyed),
  - deletion of the master that the mode is bound to.
- **Pointer semantics** — cancelling a drag (`Esc` / pointer-cancel event) must **not** commit a `GuideItem`. Commit only on a valid `pointerup` that completes the drag.
- **Inspector affordance** — when polygon / star controls are unavailable because `primitive` was cleared by a path mutation, show a short helper line (e.g. *"Shape was modified — regenerate to edit points"*) instead of silently hiding the field with no explanation.

### Acceptance checklist (used to validate implementation)

- [ ] With Guide editing mode active, drawing a shape creates a `GuideItem` only — **no** `Layer` is added.
- [ ] With Guide editing mode inactive, drawing a shape creates a `Layer` only — **no** `GuideItem` is added.
- [ ] `guidesVisible=false` removes guide snap targets while preserving pixel/grid snap behaviour under `snapEnabled`.
- [ ] Shape chevron is visible even when the shape tool is inactive; selecting a menu item activates the shape tool.
- [ ] Polygon / Star layer Inspector shows editable sides/points and regenerates `path.d` through the shared `path-shapes.ts` helpers (no forked regeneration).
- [ ] Non-primitive path operations (node edit, boolean ops, path imports) clear `primitive` and the polygon / star controls hide with the helper text above.
- [ ] Guide editing mode exits on icon/state change, variant-size switch, and guide master deletion.
- [ ] `Esc` / pointer-cancel during a guide-mode drag commits nothing.
