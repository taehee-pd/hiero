# Guide Editing Mode + Shape Tool Upgrades — Revised Plan (v2)

**Branch:** `claude/add-guide-editing-mode-uQ5cs`
**Status:** v2 — pending sign-off. Supersedes v1 (committed as `ff40fca` + `83e3539`).
**Date:** 2026-04-17

## What changed from v1

v1 treated guide editing as a lightweight *annotation* mode: the icon stayed visible, shape-tool drags branched to emit `GuideItem`s, the shape sub-tool dropdown was filtered to rect/ellipse/line, and we built bespoke ghost previews and drag handles for the `GuideItem[]` schema.

That's not what was wanted. The correct design:

> Guide editing mode is a **temporary editing surface**. On enter, the icon disappears. The user edits the guide master *as if it were an icon* — same toolbar, every sub-tool (rectangle / ellipse / polygon / star / line), pen, select, direct-select, Inspector, Layer panel. On exit, the icon reappears.

In other words: **the guide master holds layers, not a constrained `GuideItem` list, while being edited.** The existing `GuideItem[]` (hline / vline / rect / ellipse / drawPoint) remains for lightweight snap-only guides you can create from the side panel, but the canvas is layer-based.

## Goals

1. **Hidden icon, visible master.** Entering guide editing mode swaps the canvas context: the icon's layers are hidden; the bound master's layers become the editable subject.
2. **Identical toolbar.** The floating toolbar is unchanged — Rectangle / Ellipse / Polygon / Star / Line all available via the Shape tool's chevron dropdown. No filtering.
3. **Identical editing experience.** Select, direct-select, pen, shape, Inspector, Layer panel — all operate on the master's layers via the existing store actions. No specialised canvas code path.
4. **Shapes drawn in guide editing mode land on the master, not on any icon.**
5. **Snap-to-guide-outline** continues to work: `GuideItem[]` contribute snap targets (as today), and the master's layers contribute edge/anchor targets via the existing layer-bounds logic.
6. **Turning off Guide visibility from the toolbar** still disables guide snapping (v1's `snap-engine.ts:guidesVisible` gate is preserved).
7. **Polygon / Star layer property panel** still exposes editable points (v1's `primitive` metadata is preserved — it works on master layers too since it's per-Layer).

## Data model delta

`lib/schema/types.ts`:

```ts
export type GuideMaster = {
  id: string;
  name: string;
  targetSize: number;
  viewBox: [number, number, number, number];
  /** Simple parametric guides — hline / vline / rect / ellipse / drawPoint.
   *  Authored via the Guide panel by parameter. Render as dashed overlays,
   *  contribute snap targets. Unchanged from today. */
  items: GuideItem[];
  /** Layers — full `Layer` records authored on canvas via Guide editing
   *  mode. Rendered as part of the guide overlay when the master is not
   *  being edited; contribute snap targets via the usual layer-bounds
   *  logic. On enter of guide editing mode, these are the subject of
   *  editing. */
  layers: Record<string, Layer>;
};
```

Existing masters have no `layers` field; migration is `layers: {}`.

## Architecture

### One invariant

> While `state.guideEditingMode.active === true`, the "current type" — what the Canvas, Inspector, Layer panel, snap engine, and every tool reads — **is the bound master's `layers`**, not the icon variant's layers.

Implementing that invariant at the selector boundary means **every existing editor surface keeps working without changing its call sites**.

### Selector redirection

In `lib/editor-store/selectors.ts`:

- `selectCurrentType(s)` — when `guideEditingMode.active`, return a `LayerSnapshot` built from `master.layers` with a synthetic `id: 'guide-master'` and the master's `viewBox`. Else: today's behaviour.
- `selectCurrentVariant(s)` — when active, return a synthetic `Variant` wrapping the master (`size: master.targetSize`, `viewBox: master.viewBox`, `layers: master.layers`, no `types`, no `transitions`).
- `selectCurrentIcon(s)` — returns `null` when active (there is no icon context). Panels that require an icon show a "editing guides" state or gray themselves out. The few places that do need the icon (e.g., "add symbol tag" in Inspector) check `guideEditingMode.active` and skip.
- `selectCurrentLayers`, `selectLayerById`, `selectCurrentLayerPanelRows` — inherit from the above.

### Writer redirection

Layer-mutating store actions (`patchLayer`, `renameLayer`, `setLayerVisibility`, `setClipMask`, `removeSelectedLayers`, `duplicateSelectedLayers`, `copySelectedLayers`, `pasteLayers`, `reorderSelectedLayers`, `moveLayerToIndex`, `setLayerPrimitive`, `setTopology`) get a one-line branch at the top:

```ts
if (state.guideEditingMode.active && state.guideEditingMode.masterId) {
  return patchMasterLayer(state.guideEditingMode.masterId, layerId, patch);
}
// …existing icon-variant path…
```

`patchMasterLayer` (and counterparts for rename/remove/duplicate/etc.) mutate `state.project.guideMasters[masterId].layers` using the same shape as their variant counterparts.

The `patchLayer` invariant (`path` without `primitive` clears `primitive`, stamps `formerPrimitiveKind`) is preserved in both paths.

### Shape tool path

`PathEditor.beginShapePlacement` no longer branches on `guideEditingMode`. Shape drags always create a `Layer`. When in guide mode, the layer lands on `master.layers` because `patchLayer` is routed there. Polygon/star work as normal Layers. No ghost preview needed — the normal live-path patching already renders the shape as it's drawn.

### Overlay

When `guideEditingMode.active`:
- Canvas renders the master's layers (same SVG path rendering used for icons).
- The master's `items` (simple guides) render dashed as reference, using the existing `drawGuideItems`.
- Layers from *other* places (e.g., the outgoing icon) do **not** render.

When inactive:
- Canvas renders the current icon's layers as today.
- The bound master's `items` and `layers` render as the guide overlay (dashed/subtle).

### Snap

- `items` feed `collectGuideTargets` as today (gated on `guidesVisible`).
- Master's `layers` automatically contribute edge / anchor snap targets through the existing `collectLayerTargets` code path because `selectCurrentType` returns them. Also gated on `guidesVisible` via the same branch.

### Lifecycle (carry over from v1)

- `enterGuideEditingMode(masterId)` — saves previous `{ currentIconId, currentVariantId, currentTypeId, selection }` into a new `savedIconContext` field so exit can restore them; clears selection; sets `guideEditingMode = { active: true, masterId }`.
- `exitGuideEditingMode()` — restores `savedIconContext`; clears it; sets `guideEditingMode.active = false`.
- Auto-exit on: icon/variant change via an explicit user action (v1 wiring stays), guide master deletion, and `Esc` with no drag in progress.

## What v1 code is removed

All of these exist only because v1 tried to author `GuideItem[]` from canvas; they are obsolete once the master holds a layer list:

- `state.guideShapePreview` + `setGuideShapePreview` action.
- `PathEditor.beginGuideItemDrag` / `updateGuideItemDrag` / `commitGuideItemDrag` / `cancelGuideItemDrag`.
- `hitTestGuideItemHandle`, `applyGuideItemHandleDrag` helpers.
- `primitiveToGuideItem` helper.
- `ShapePlacement.guideMasterId` branch inside `beginShapePlacement` + the guide-mode code path in `updateShapePreview` and `commitShapePlacement`.
- `GuideShapePreview` type and related ghost-rendering in `use-overlay.ts` (`drawGuideShapePreview`, `drawGuideItemHandles`).
- `GUIDE_COMPATIBLE_SHAPES` filtering in `ToolPanel.tsx` (so polygon/star are always available).
- Strong-style guide promotion in overlay while `guideEditingActive` (overlay draws the master's layers as first-class content now).

## What v1 code stays

- `Layer.primitive` + `formerPrimitiveKind` + `patchLayer` invariant + `setLayerPrimitive`.
- Always-visible shape chevron in `ToolPanel.tsx`.
- Inspector's Sides / Points field + helper line when primitive is cleared.
- Snap engine's `guidesVisible` gate on `collectGuideTargets`.
- Guide-panel per-master "Edit on canvas" toggle (now enters the new mode).
- Lifecycle auto-exit on icon/variant change and master deletion.
- Banner in the Guide panel while editing.

## Files touched (high level)

New file: none; v2 is mostly deletions + a few selector / action edits.

| File | Change |
|---|---|
| `lib/schema/types.ts` | Add `layers: Record<string, Layer>` to `GuideMaster`. |
| `lib/editor-store/store.ts` | Add `savedIconContext`; rewire `enter/exit`; route layer-mutating actions through the mode branch; migrate masters (`layers ??= {}`) on load; remove `guideShapePreview` state + action. |
| `lib/editor-store/selectors.ts` | Redirect `selectCurrentType`, `selectCurrentVariant`, `selectCurrentLayers`, `selectLayerById`, `selectCurrentLayerPanelRows`, `selectCurrentIcon` while mode is active. |
| `lib/editor-store/hooks.ts` | Drop `setGuideShapePreview`. |
| `lib/editor-core/path-editor.ts` | Remove the guide branches in `beginShapePlacement`/`updateShapePreview`/`commitShapePlacement`/`cancelShapePlacement`; remove all `guideItemDrag` plumbing; remove `primitiveToGuideItem`, `hitTestGuideItemHandle`, `applyGuideItemHandleDrag`, and the `ShapePlacement.guideMasterId` field. |
| `lib/editor-core/index.ts` | Drop exports of the removed helpers. |
| `lib/editor-overlay-canvas/use-overlay.ts` | Drop `guideShapePreview` / `guideEditingActive` option and the two render helpers; continue rendering `guideSet.items` as today. |
| `components/editor/ToolPanel.tsx` | Drop `GUIDE_COMPATIBLE_SHAPES` filter. Dropdown shows every sub-tool in every mode. |
| `components/editor/Canvas.tsx` | Drop the `guideEditingActive` / `guideShapePreview` props to the overlay. |
| `components/editor/GuideMasterPanel.tsx` | Keep the "Edit on canvas" toggle and the banner (already in place). |
| `components/editor/InspectorPanel.tsx`, `LayerPanel.tsx`, etc. | No change required — they consume `selectCurrentType` & co. |
| `tests/guide-editing-mode.test.ts` | Rewrite: drop the `GuideItem`-authoring tests; replace with: (a) enter/exit lifecycle; (b) shape tool creates a Layer on `master.layers` when mode active; (c) polygon/star sub-tools work; (d) the redirected selectors return the master's layers; (e) Inspector edits master layer's primitive via the routed `setLayerPrimitive`; (f) lifecycle auto-exit; (g) snap still works (`items` gate + master layer bounds). |

## Non-goals / scope cuts

- Migrating existing `items: GuideItem[]` into `layers` on load. Items stay as-is; user can re-draw if they want them as full layers. Flagged as a possible later UX.
- A dedicated keyboard shortcut to enter guide editing mode. Entry is via the panel toggle.
- A "library" of reusable guide-layer snippets.
- Editing items (hline / vline / rect / ellipse / drawPoint) on canvas. Those remain panel-parameter-driven.

## Acceptance checklist

- [ ] Entering guide editing mode hides the icon on canvas; only the master's layers + its `items` render.
- [ ] The toolbar in guide mode is visually and functionally identical to the normal toolbar, including all Shape sub-tools.
- [ ] Drawing a Rectangle / Ellipse / Polygon / Star / Line in guide mode adds a Layer to `master.layers`, **not** to any icon's variant.
- [ ] Direct-select, pen, Inspector, Layer panel all work against the master's layers.
- [ ] Polygon / star layers created in guide mode show editable Sides / Points in the Inspector.
- [ ] Exiting the mode restores the icon and its selection; the master's layers keep their edits.
- [ ] `guidesVisible=false` removes guide snap targets while preserving pixel/grid snap.
- [ ] Entering mode hides the layer-mutating actions' effects from the outgoing icon — no layer is leaked.
- [ ] Auto-exit on icon change / variant-size switch / master deletion.
- [ ] `Esc` with no drag in progress exits the mode; `Esc` during a drag cancels the drag without committing.

## Review questions (for Codex / second opinion)

1. Is the "selector redirection + writer branch" pattern preferable to an isolated "edit scope" abstraction (`state.editScope: IconScope | GuideMasterScope`) that every action reads explicitly? Redirection is a smaller diff; scope is more explicit and future-proof.
2. Should we migrate the existing panel-authored `items: GuideItem[]` into equivalent `layers` on first enter, so users can edit them on canvas? Or keep items immutable-on-canvas and let the user re-draw?
3. `selectCurrentIcon` returning `null` in guide mode — how should the handful of icon-dependent actions (symbol-component tagging, variant matrix generation, clipboard paste *into* an icon, sync/publish) behave while the mode is active? Grey them out, no-op, or auto-exit before running?

## Decisions (locked 2026-04-17)

1. **Explicit `state.editScope`** — replaces `guideEditingMode`. Shape:

   ```ts
   export type EditScope =
     | { kind: 'icon'; iconId: string; variantId: string; typeId: string | null }
     | { kind: 'guideMaster'; masterId: string };
   ```

   `currentIconId` / `currentVariantId` / `currentTypeId` stay on the state and always reflect the last-active icon (acting as a resume point). `editScope.kind` tells every action *what to operate on right now*. Entering a master flips `editScope.kind` to `'guideMaster'` without touching the icon fields; exiting rebuilds `editScope` from them.

2. **Migrate `items` → `layers` on enter** — on the first enter of a given master, the `hline` / `vline` / `rect` / `ellipse` entries in `master.items` are converted to `Layer`s (with matching `primitive` metadata) and the original entries are dropped from `items`. `drawPoint` entries stay in `items` (they reference an icon layer and have no geometric footprint). The migration is idempotent because subsequent enters find no convertible entries.

3. **Icon-dependent actions no-op in guide scope** — `applyComponentTag`, `generateVariantMatrix`, `upsertSymbolComponent`, `removeSymbolComponent`, clipboard paste into an icon, publish / sync actions, etc. each early-return when `editScope.kind !== 'icon'`. No tooltip noise required; the UI surfaces that already live on icon-only panels (e.g., symbol tools in the Inspector) simply do nothing when invoked in guide scope.
