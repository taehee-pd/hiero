# Inspect Tab

**Status:** Specification (Phase L -- surface runtime behavior, topology, and advanced authoring in the Inspect panel)
**Primary file:** `components/editor/InspectorPanel.tsx`
**Secondary surface:** `components/editor/EditorShell.tsx` (RightSidebar, compact inspect view)

---

## Overview

The Inspect tab is the right-sidebar panel that surfaces layer properties,
variant configuration, topology status, and vector editing controls. It
currently handles basic authoring (fill, stroke, transform, path editing,
boolean operations, clipping, alignment, variant management). Phase L extends
it to surface computed runtime behavior (variable value opacity, per-subpath
animation strategy classification, auto-gradient preview) and enable advanced
authoring controls (topology locking in its natural location, weight control
point management).

Two implementations of the inspect surface exist today:

1. **`InspectorPanel.tsx`** -- the full-featured panel rendered inside
   `EditorShell.tsx` when the Inspect tab is active. Contains variant
   management, topology display, style editing, vector point editing,
   transform controls, boolean/clipping operations, alignment/distribute,
   component tagging, and the TransitionPanel embed.

2. **`EditorShell.tsx` `RightSidebar`** -- a compact "wire-frame" inspect
   view inside the editor shell. Shows document-level metadata (name, variant,
   size, rendering mode, guides) when no layer is selected, or a compact
   layer inspector (role, fill/stroke mode, color pickers, stroke width,
   position/rotation) when a layer is selected.

Phase L additions target `InspectorPanel.tsx` exclusively. The compact
`RightSidebar` view in `EditorShell.tsx` is intentionally left unchanged --
it serves as a quick-glance surface and should remain lightweight.

---

## Current Architecture

### Component Hierarchy

```
EditorShell.tsx
 +-- RightSidebar (compact inspect + animation tabs)
 |    +-- [rightTab === 'inspect']
 |    |    +-- Layer inspector (role, fill, stroke, position, rotation)
 |    |    +-- Document inspector (name, variant, size, rendering, guides)
 |    +-- [rightTab === 'animation']
 |         +-- Transition list, draft form, preview controls
 +-- InspectorPanel.tsx (full inspect panel -- standalone component)
      +-- "Nothing selected" empty state
      +-- Header (kicker + title)
      +-- ScrollArea
           +-- Section: Variants (list, weight/scale/variableValue controls, add/matrix)
           +-- Section: Components (badge/slash/enclosure tagging)
           +-- TransitionPanel (embedded)
           +-- Section: Shape Tool (conditional -- when shape tool active)
           +-- Section: Topology (conditional -- when the current variant has topology)
           +-- Section: Layer (ID, role) -- when layer selected
           +-- Section: Clipping (make/release clip mask)
           +-- Section: Boolean (unite/subtract/intersect/exclude)
           +-- Section: Align (6 align + 2 distribute actions)
           +-- Section: Path (d string, fill rule)
           +-- Section: Style (fill, stroke, stroke width, lineCap, lineJoin, opacities)
           +-- Section: Vector (point align/distribute, X/Y, type, radius, handles)
           +-- Section: Transform (X, Y, rotate, scaleX, scaleY)
```

### Data Flow

```
EditorStore (zustand-like singleton)
 |
 +-- useEditorStore(selector) -----> InspectorPanel reads:
 |   - tool, shapeSubTool, shapePolygonSides, shapeStarPoints
 |   - currentIconId, currentVariantId
 |   - currentIcon (derived), currentVariant (derived)
 |   - selection (layerIds, pointIds)
 |   - project.tokenSet.colors
 |
 +-- current variant selector -----> current variant payload (layers, topology)
 |
 +-- useSelection() ---------------> selection.layerIds, selection.pointIds
 |
 +-- useEditorActions() -----------> addVariant, removeVariant, setCurrentVariant,
 |                                   setStateTopology, setClipMask, releaseClipMask,
 |                                   generateVariantMatrix, upsertSymbolComponent,
 |                                   removeSymbolComponent, setShapeSubTool, etc.
 |
 +-- editorStore.getState() -------> direct access for patching (patchVariant,
                                     patchLayer -- used in helper functions)
```

### Key Derived State

| Derived value            | Source                                       | Used in              |
|--------------------------|----------------------------------------------|----------------------|
| `layer`                  | `currentState.layers[selectedLayerId]`        | Style/Vector/Transform sections |
| `pointContext`           | `getSelectedPointContext(layer, pointIds)`    | Vector section       |
| `currentTopology`        | `computeTopology(currentVariant)` (memoized) | Topology section     |
| `isTopologyLocked`       | `currentVariant.topology?.locked === true`   | Topology section     |
| `multipleLayersSelected` | `selection.layerIds.length > 1`               | Boolean/Align/Clip sections |
| `hasBooleanableSelection`| All selected layers have `path.d`             | Boolean section      |

### Current Section Visibility Rules

| Section        | Visible when                                    |
|----------------|-------------------------------------------------|
| Variants       | `currentIcon` exists                            |
| Components     | `currentIcon` exists                            |
| TransitionPanel| `currentIcon` exists                            |
| Shape Tool     | `tool === 'shape'`                              |
| Topology       | `currentVariant && currentTopology` exist        |
| Layer          | `layer` is selected                             |
| Clipping (make)| `multipleLayersSelected` AND 2+ path layers     |
| Clipping (release)| Single layer is clip mask or has clipPathLayerId |
| Boolean        | `multipleLayersSelected`                        |
| Align          | `multipleLayersSelected`                        |
| Path           | `layer.path` exists                             |
| Style          | `layer` is selected                             |
| Vector         | `layer` is selected (empty msg if no points)    |
| Transform      | `layer` is selected                             |
| Empty state    | No layer selected AND not shape tool            |

### No Layer Selected

When no layer is selected and no shape tool is active, but `currentIcon` exists,
the panel shows:
- Variants section (full variant list with weight/scale/variableValue controls)
- Components section
- TransitionPanel
- Topology section (if the current variant has topology data)
- Empty state card: "Choose a layer to inspect it"

### Multiple Layers Selected

When multiple layers are selected, the panel shows:
- All icon-level sections (Variants, Components, TransitionPanel, Topology)
- Layer section (shows first selected layer's ID and role)
- Clipping section (make clip mask)
- Boolean section (unite/subtract/intersect/exclude)
- Align section (6 alignment + 2 distribution actions)
- Style section (edits apply to first selected layer only)
- Vector section
- Transform section

---

## Proposed Additions (Phase L)

### L1 -- Variable Value Opacity Indicator

**Goal:** Show the computed opacity at the current `variableValue` next to
each layer's authored opacity in the Style section.

**What exists:**
- `computeVariableValue()` in `lib/runtime-core/variable-value.ts` -- takes
  `Record<string, {role?: string; visible?: boolean}>` and `variableValue: number`,
  returns `Record<string, {opacity: number; visible: boolean}>`.
- `Variant.variableValue` (0.0-1.0) is already exposed in the Variants section
  with a slider and numeric display.
- Layer `role` field (`'primary' | 'secondary' | 'tertiary'`) is displayed
  in the Layer section.

**Behavior:**
1. When a layer is selected AND `currentVariant.variableValue` is defined (not
   `undefined` / not 1.0), compute the variable-value result for the current
   variant's layers.
2. In the Style section, next to the "Fill Opacity" NumberField, display a
   read-only badge showing the computed effective opacity:
   `authored * variableValue_computed`.
3. Below the badge, show the role threshold range as helper text:
   - primary: "visible at 0-33%"
   - secondary: "visible at 33-66%"
   - tertiary: "visible at 66-100%"
   - no role: "always visible (primary)"
4. If computed visibility is `false`, show a muted "Hidden by variable value"
   indicator.

**Types needed:** None new -- `VariableValueResult` already exists.

**Data flow:**
```
currentVariant.variableValue
         |
         v
computeVariableValue(currentVariant.layers, variableValue)
         |
         v
result[selectedLayerId] --> { opacity, visible }
         |
         v
Display alongside authored fillOpacity in Style section
```

**Edge cases:**
- `variableValue` is `undefined` or exactly `1.0` -- skip indicator entirely.
- Layer has no role -- treat as primary, show "(primary)" in threshold text.
- Layer is explicitly hidden (`visible: false`) -- show "Explicitly hidden"
  instead of variable-value computation.

**Files touched:** `InspectorPanel.tsx` (add import of `computeVariableValue`,
add UI elements in Style section).

---

### L2 -- Topology Status Display

**Goal:** Show the selected layer's geometry stats (subpath count, command
signature per subpath, closed/open status) in a collapsible section below
the Layer section.

**What exists:**
- `computeGeometryStats()` in `lib/runtime-core/path-normalization.ts` --
  internal function called by `canonicalizeLayerPath()`. Returns `GeometryStats`.
- `canonicalizeLayerPath()` is the public entry point -- takes a `Layer`,
  returns `CanonicalPath` which includes `stats: GeometryStats`.
- `GeometryStats` type: `{ subpathCount, commandSignature: string[],
  closed: boolean[], bbox, centroid, pointCount }`.
- The existing Topology section in InspectorPanel shows state-level topology
  (tracked layers + subpath counts), not per-layer geometry stats.

**Behavior:**
1. When a single layer is selected AND it has `path.d`, add a new
   "Geometry" subsection below the Path section.
2. Show:
   - Subpath count (e.g., "3 subpaths")
   - Per-subpath: command signature (e.g., "MLCCCZ") and closed/open badge
   - Total point count
   - Bounding box (minX, minY, maxX, maxY) as read-only fields
3. Section is collapsible (starts collapsed) to avoid clutter.
4. Add a help tooltip: "Understanding your path's topology helps predict
   which morph strategies will be available."

**Types needed:** Import `GeometryStats` and `canonicalizeLayerPath` from
`lib/runtime-core/path-normalization.ts`. The `canonicalizeLayerPath` function
is currently not exported -- it needs to be exported (or `computeGeometryStats`
needs to be made public).

**Data flow:**
```
layer.path.d + layer.transform
         |
         v
canonicalizeLayerPath(layer)   // needs export
         |
         v
result.stats: GeometryStats
         |
         v
Display subpathCount, commandSignature[], closed[], pointCount, bbox
```

**Edge cases:**
- Layer has no `path.d` -- hide section entirely.
- Layer path is not directly editable (uses transforms that canonicalization
  resolves) -- still show stats, but note "Path has been normalized".
- Very long command signatures -- truncate with "..." and show full on hover.

**Files touched:** `InspectorPanel.tsx` (add collapsible section),
`lib/runtime-core/path-normalization.ts` (export `canonicalizeLayerPath`).

---

### L3 -- Animation Strategy Badge

**Goal:** When a transition is selected in the Animation tab and the
inspected layer participates in a binding, show a colored badge indicating
the classified strategy.

**What exists:**
- `classifySubPathStrategies()` in `lib/runtime-core/topology-detection.ts` --
  takes two `GeometryStats`, returns `SubPathStrategyResult[]`.
- `SubPathStrategy` type: `'morph' | 'trim' | 'crossfade'`.
- `TransitionPreview` in store includes `resolvedTransition` which contains
  per-layer binding info.
- `selectedTransitionId` in store tracks which transition is selected.
- The Inspect tab and Animation tab are separate tabs in `RightSidebar`
  (the compact view), but `InspectorPanel` embeds `TransitionPanel` directly.

**Behavior:**
1. When `selectedTransitionId` is set AND the currently inspected layer
   appears in the transition's `layerBindings`, show a strategy badge in
   the Layer section.
2. Badge format: colored pill with strategy name:
   - `morph` -- green (#22c55e) -- "Morph"
   - `trim` -- yellow (#eab308) -- "Trim/Draw"
   - `crossfade` -- red (#ef4444) -- "Crossfade"
   - `preserved` -- blue (#3b82f6) -- "Preserved" (layer exists in both
     states with identical geometry)
3. If the layer has multiple subpaths with different strategies, show
   "Mixed" with a tooltip listing per-subpath strategies.
4. If the layer does not appear in the target state, show "Removed" (gray).
5. If the layer only appears in the target state, show "Added" (gray).

**Types needed:** Import `SubPathStrategy`, `SubPathStrategyResult` from
`lib/runtime-core/topology-detection.ts`.

**Data flow:**
```
selectedTransitionId
         |
         v
currentIcon.transitions[selectedTransitionId]
         |
         v
Find layerBinding where fromLayerId === selectedLayerId
         |
         v
If binding has morph topology --> canonicalize both layers -->
    classifySubPathStrategies(fromStats, toStats)
         |
         v
Display badge with dominant strategy + per-subpath breakdown
```

**Edge cases:**
- No transition selected -- hide badge.
- Layer not in any binding -- show "Unbound" (muted).
- Cross-icon transition -- binding references layers in different icons;
  resolve from the `TransitionPreview.baseIconId` / `targetIconId`.
- `replace` strategy transition -- all layers show "Replace" badge.

**Files touched:** `InspectorPanel.tsx` (add badge in Layer section, import
topology detection types and functions).

---

### L4 -- Weight Control Point Editor

**Goal:** When the variant uses weight interpolation, show the current weight
value and a list of available control points. Allow assigning SVG path data
as control point anchors for each weight stop.

**What exists:**
- `Variant.weight` field (`SymbolWeight` -- ultralight through black).
- Weight selector buttons already exist in the Variants section.
- No `weightControlPoints` field exists on `Variant` yet.

**Behavior:**
1. Add a new "Weight Control Points" subsection inside the Variants section,
   visible only when the variant has a `weight` value set.
2. Show a list of the 9 weight stops (ultralight through black). For each:
   - A label with the weight name and abbreviation.
   - A status indicator: "Has data" (green dot) or "Empty" (gray dot).
   - An "Assign" button to set the current state's layer paths as the
     control point data for that weight.
   - A "Clear" button to remove control point data.
3. Control point data structure:
   ```ts
   weightControlPoints?: Record<SymbolWeight, {
     layerPaths: Record<string, string>; // layerId -> SVG path d
   }>;
   ```
4. When a control point is assigned, snapshot all current layer paths
   from the active state.

**Types needed:** New field on `Variant`:
```ts
weightControlPoints?: Partial<Record<SymbolWeight, {
  layerPaths: Record<string, string>;
}>>;
```

**Schema change:** `lib/schema/types.ts` -- add `weightControlPoints` to `Variant`.

**Store change:** `lib/editor-store/store.ts` -- extend `VariantPatch` to include
`weightControlPoints`. Add or extend `patchVariant` to handle the new field.

**Data flow:**
```
currentVariant.weight (current active weight)
currentVariant.weightControlPoints (persisted control point data)
         |
         v
Display 9-weight list with status indicators
         |
[Assign] --> snapshot currentState.layers[*].path.d
         |     --> store in weightControlPoints[weight].layerPaths
         v
patchVariant(iconId, variantId, { weightControlPoints: ... })
```

**Edge cases:**
- Variant has no weight set -- hide section entirely.
- State has no layers with paths -- disable "Assign" button.
- Weight control points from a different topology -- show warning that
  control point layer IDs don't match current state layers.

**Files touched:** `InspectorPanel.tsx` (add section), `lib/schema/types.ts`
(add field), `lib/editor-store/store.ts` (extend `VariantPatch`).

**Prerequisite for:** K3 (weight preview slider in Animation tab).

---

### L5 -- Auto-Gradient Preview Swatch

**Goal:** When auto-gradient rendering mode is active, show a gradient
preview swatch next to each layer's fill color in the Inspect panel.

**What exists:**
- `generateAutoGradient()` in `lib/rendering/auto-gradient.ts` -- takes a
  hex color string and optional step count, returns `GradientStop[]`.
- `Variant.renderingMode` can be set to `'hierarchical'` (the mode that
  uses auto-gradient).
- `PaintField` component already renders gradient previews for explicit
  gradient paints (linearGradient, radialGradient) using `buildGradientPreview()`.

**Behavior:**
1. When `currentVariant.renderingMode` is `'hierarchical'` AND the selected
   layer has a solid fill (`fill.mode === 'fixed'`), display a gradient
   preview swatch below the fill color picker.
2. Generate the 3-stop auto-gradient from the layer's fill color using
   `generateAutoGradient(fillColor, 3)`.
3. Display as a horizontal gradient bar (reuse the existing gradient bar
   style from `PaintField`'s gradient editor).
4. Add a label: "Auto-gradient preview" with a tooltip explaining that
   hierarchical rendering applies this gradient automatically at runtime.
5. The swatch is read-only -- it previews what the runtime will generate.

**Types needed:** None new -- `GradientStop` already exists.

**Data flow:**
```
currentVariant.renderingMode === 'hierarchical'
AND layer.style.fill.mode === 'fixed'
         |
         v
generateAutoGradient(layer.style.fill.value, 3)
         |
         v
GradientStop[] --> buildGradientPreview(stops) --> CSS gradient string
         |
         v
Display as read-only gradient bar in Style section
```

**Edge cases:**
- Fill is `currentColor` or `none` -- no preview (auto-gradient only
  applies to fixed colors).
- Fill is already a gradient -- no preview (auto-gradient doesn't apply).
- `renderingMode` is not `'hierarchical'` -- hide preview entirely.
- Layer has no fill -- hide preview.

**Files touched:** `InspectorPanel.tsx` (add preview swatch in Style section,
import `generateAutoGradient`).

---

### L6 -- Topology Lock Toggle

**Goal:** Move topology locking to the Inspect tab's topology section (its
natural home), replacing the current separate implementation.

**What exists:**
- `lockTopology()` and `computeTopology()` in `lib/editor-core/topology.ts`.
- `State.topology?.locked` boolean field.
- `setStateTopology()` action in store.
- **The Topology section in InspectorPanel already has Lock/Unlock buttons.**
  This means L6 is largely already implemented.

**Current state of implementation:**
The existing Topology section (lines ~600-663 of InspectorPanel.tsx) already:
- Displays tracked layer count and subpath counts.
- Shows a "Locked" badge when `isTopologyLocked` is true.
- Provides "Lock Topology" and "Unlock" buttons.
- Calls `handleLockTopology` (which calls `lockTopology(currentState)` and
  `setStateTopology`) and `handleUnlockTopology`.

**Remaining work:**
1. When locked, show a lock icon (e.g., `Lock` from lucide-react) next to
   the "Locked" badge for additional visual weight.
2. Block geometry edits that would change the command signature when locked.
   This requires intercepting path edits in the patchLayer flow -- not an
   InspectorPanel concern but a store/editor-core concern.
3. Move this to be visible in the L2 per-layer Geometry section as well
   (not just the state-level Topology section).

**Files touched:** `InspectorPanel.tsx` (minor visual enhancement),
`lib/editor-store/store.ts` or `lib/editor-core` (enforce lock on geometry
edits -- out of scope for the Inspect tab spec, belongs in editor-core).

---

## Section Layout After Phase L

```
InspectorPanel (after L1-L6)
 |
 +-- Header (kicker + title)
 +-- ScrollArea
      +-- Section: Variants
      |    +-- Variant list (existing)
      |    +-- Weight / Scale / Variable Value controls (existing)
      |    +-- [L4] Weight Control Points (conditional: variant has weight)
      |    +-- Add Variant / Generate Matrix (existing)
      +-- Section: Components (existing)
      +-- TransitionPanel (existing)
      +-- Section: Shape Tool (conditional, existing)
      +-- Section: Topology (existing + L6 visual polish)
      +-- Section: Layer
      |    +-- ID, Role (existing)
      |    +-- [L3] Animation Strategy Badge (conditional: transition selected)
      +-- Section: Clipping (existing)
      +-- Section: Boolean (existing)
      +-- Section: Align (existing)
      +-- Section: Path (existing)
      +-- [L2] Section: Geometry (new, collapsible)
      |    +-- Subpath count, command signatures, closed/open status
      |    +-- Point count, bounding box
      |    +-- [L6] Per-layer topology lock status
      +-- Section: Style
      |    +-- Fill, Stroke, Stroke Width, etc. (existing)
      |    +-- [L1] Variable Value Opacity Indicator (conditional)
      |    +-- [L5] Auto-Gradient Preview Swatch (conditional)
      +-- Section: Vector (existing)
      +-- Section: Transform (existing)
```

---

## Types Summary

### New Types

```ts
// L4: Weight control point data (added to Variant)
type WeightControlPoints = Partial<Record<SymbolWeight, {
  layerPaths: Record<string, string>;  // layerId -> SVG path d string
}>>;

// Extend Variant in lib/schema/types.ts:
// weightControlPoints?: WeightControlPoints;
```

### Imported Types (already exist)

```ts
// L1
import { computeVariableValue, type VariableValueResult }
  from '@/lib/runtime-core/variable-value';

// L2
import { canonicalizeLayerPath, type GeometryStats }
  from '@/lib/runtime-core/path-normalization';
  // NOTE: canonicalizeLayerPath is not currently exported -- needs export.

// L3
import { classifySubPathStrategies, type SubPathStrategy, type SubPathStrategyResult }
  from '@/lib/runtime-core/topology-detection';

// L5
import { generateAutoGradient }
  from '@/lib/rendering/auto-gradient';
```

---

## Behavior Rules

1. **Progressive disclosure.** New sections (L1-L5) are visible only when
   their preconditions are met. The panel must not become overwhelming for
   simple editing tasks.

2. **Read-only runtime state.** L1 (variable value opacity), L3 (strategy
   badge), and L5 (auto-gradient preview) are read-only displays of computed
   state. They do not modify the project.

3. **Memoization.** Computed values (geometry stats, variable value results,
   auto-gradient stops) must be memoized with `useMemo` keyed on their
   inputs to avoid recomputation on every render.

4. **Consistency with existing patterns.** Use the existing `Section`,
   `ReadOnlyField`, `InlineMessage`, `InlineStat` components from
   InspectorPanel. Use the same `cn()` utility for conditional classes.

5. **No EditorShell changes.** The compact `RightSidebar` in EditorShell.tsx
   is intentionally excluded from Phase L. It remains a lightweight
   quick-glance surface.

---

## Dependencies on Other Phases

| L task | Depends on        | Nature                                    |
|--------|-------------------|-------------------------------------------|
| L1     | None              | Uses existing `computeVariableValue`      |
| L2     | None              | Uses existing `canonicalizeLayerPath` (needs export) |
| L3     | Phase F (done)    | Uses `selectedTransitionId` from store    |
| L4     | None (prerequisite for K3) | New schema field + store extension |
| L5     | None              | Uses existing `generateAutoGradient`      |
| L6     | Partially done    | Existing Lock/Unlock in Topology section  |

---

## Engineering Review (gstack Step 0)

### 1. What existing code already partially solves each sub-problem?

| Task | Existing code coverage | Gap |
|------|----------------------|-----|
| L1   | `computeVariableValue()` fully implemented; variableValue slider exists in Variants section | Need UI display in Style section only |
| L2   | `canonicalizeLayerPath()` and `GeometryStats` fully implemented; Topology section shows state-level topology | Need per-layer geometry display; need to export `canonicalizeLayerPath` |
| L3   | `classifySubPathStrategies()` fully implemented; `selectedTransitionId` exists in store | Need badge UI in Layer section; need to resolve binding for selected layer |
| L4   | Weight selector buttons exist; `Variant.weight` field exists | Need new schema field `weightControlPoints`, snapshot logic, and UI section |
| L5   | `generateAutoGradient()` fully implemented; `buildGradientPreview()` CSS helper exists in InspectorPanel | Need conditional swatch in Style section |
| L6   | Lock/Unlock buttons already exist in Topology section with full handler logic | Only visual polish needed (lock icon); enforcement logic belongs in editor-core, not here |

### 2. What is the minimum set of changes?

**L1:** ~30 lines added to InspectorPanel.tsx (1 import, 1 useMemo, 1 conditional UI block).

**L2:** ~50 lines added to InspectorPanel.tsx (section + collapsible logic). 1 line change in path-normalization.ts (add `export`).

**L3:** ~40 lines added to InspectorPanel.tsx (badge component + binding lookup logic). Requires reading `currentIcon.transitions` and `selectedTransitionId` -- both already available via store.

**L4:** ~80 lines added to InspectorPanel.tsx (weight control point list + assign/clear handlers). ~5 lines in types.ts (new field). ~3 lines in store.ts (extend VariantPatch).

**L5:** ~25 lines added to InspectorPanel.tsx (1 import, 1 useMemo, 1 conditional gradient bar).

**L6:** ~5 lines changed in InspectorPanel.tsx (add Lock icon import, render next to badge). The enforcement concern (blocking edits when locked) is an editor-core task, not an Inspect tab task.

### 3. Complexity check (touch >8 files = smell)

Files touched per task:

| Task | Files | List |
|------|-------|------|
| L1   | 1     | InspectorPanel.tsx |
| L2   | 2     | InspectorPanel.tsx, path-normalization.ts |
| L3   | 1     | InspectorPanel.tsx |
| L4   | 3     | InspectorPanel.tsx, types.ts, store.ts |
| L5   | 1     | InspectorPanel.tsx |
| L6   | 1     | InspectorPanel.tsx (visual only; enforcement is separate) |

**Total unique files across all L tasks: 4.** Well under the 8-file smell
threshold. The changes are concentrated in InspectorPanel.tsx with minimal
schema/store touchpoints.

### 4. Completeness check

**L6 is already ~90% implemented.** The current Topology section already has
Lock/Unlock buttons, locked badge, and handler functions. Only the lock icon
visual and the per-layer geometry section reference (L2) are missing.

**L1, L2, L3, L5 are pure UI additions** consuming existing, fully-tested
runtime functions. No new algorithms or computation logic needed.

**L4 is the only task requiring schema changes.** It introduces a new field
on `Variant`, which means:
- Schema migration consideration (existing projects without the field).
- The field is optional (`?`), so backwards compatibility is automatic.
- Export/import flows need no changes (JSON serialization handles undefined
  fields naturally).

### 5. Recommended implementation order

1. **L6** first (trivial, mostly done).
2. **L1** next (simplest new addition, high user value).
3. **L5** next (simple, similar pattern to L1).
4. **L2** next (introduces geometry section that L3 and L6 reference).
5. **L3** next (depends on understanding of L2's geometry concepts).
6. **L4** last (schema change, most complex, prerequisite chain).

### 6. Risk assessment

**Low risk:** L1, L5, L6 -- pure UI additions with no side effects.

**Medium risk:** L2, L3 -- need to export internal functions and correctly
resolve cross-references (transition bindings, canonicalization).

**Medium risk:** L4 -- schema change, though optional field makes it
backwards compatible. The "snapshot current paths" action needs careful
undo/redo integration (should go through `patchVariant` which already
participates in history tracking).
