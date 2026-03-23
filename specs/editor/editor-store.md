# Editor Store

**Status:** Implemented
**Files:** `lib/editor-store/store.ts`, `lib/editor-store/types.ts`, `lib/editor-store/history.ts`, `lib/editor-store/hooks.ts`, `lib/editor-store/selectors.ts`

## Overview

The editor store is the central state management layer for the icon authoring tool. Built on Zustand with zundo for undo/redo history, it manages workspace data, current selections, viewport state, tool mode, and transition preview state. The store exposes a comprehensive action API for icon, variant, state, layer, transition, and guide manipulation.

## Types

### EditorState

```typescript
type EditorState = {
  workspace: Workspace | null;
  project: Project | null;
  activeIconSetId: string | null;
  isDirty: boolean;
  lastSavedAt: number | null;
  currentIconId: string | null;
  currentVariantId: string | null;
  currentStateId: string | null;
  selectedIconGuideIndex: number | null;
  selection: SelectionState;
  activeSnapGuides: SnapTarget[];
  snapEnabled: boolean;
  guidesVisible: boolean;
  guideStyle: 'subtle' | 'strong';
  viewport: ViewportState;
  tool: Tool;
  renderingMode: RenderingMode;
  shapeSubTool: ShapeType;
  shapePolygonSides: number;
  shapeStarPoints: number;
  pointMarquee: PointMarqueeState | null;
  pointTransformLabel: PointTransformLabelState | null;
  pendingPenHandle: PendingPenHandleState | null;
  transitionPreview: TransitionPreview | null;
  selectedTransitionId: string | null;
  favorites: string[];
  openTabs: EditorTab[];
  activeTabId: string | null;
};
```

### Supporting Types

```typescript
type Tool = 'select' | 'direct-select' | 'pen' | 'shape' | 'guide';
type ShapeType = 'rectangle' | 'ellipse' | 'polygon' | 'star' | 'line';

type SelectionState = {
  layerIds: string[];
  pointIds: string[];
  guideIndexes?: number[];
};

type ViewportState = {
  zoom: number;
  panX: number;
  panY: number;
};

type TransitionPreview = {
  transitionId: string;
  baseStateId: string;
  targetStateId: string;
  baseIconId?: string;         // Cross-icon source
  baseVariantId?: string;      // Cross-icon source variant
  targetIconId?: string;       // Cross-icon target
  targetVariantId?: string;    // Cross-icon target variant
  progress: number;
  resolvedTransition: ResolvedTransition;
  interpolatedValues: InterpolatedValues;
};

type EditorTab = {
  id: string;
  iconSetId: string;
  iconId: string;
  variantId: string | null;
  stateId: string | null;
};
```

## Key Actions

### Layer Operations

**`patchLayer(iconId, stateId, layerId, patch)`**
Shallow-merges `patch` into the specified layer. Used for updating style, transform, path, visibility, role, and clip mask assignments.

**`renameLayer(iconId, stateId, oldLayerId, newLayerId)`**
Renames a layer by re-keying it in `state.layers`. Also updates all references:
- `clipPathLayerId` on other layers pointing to the renamed layer.
- Layer bindings in all transitions referencing the old ID.
- Topology contract layer pairs.
- Guide draw points.
- Symbol component layer ID lists.

**`setLayerVisibility(iconId, stateId, layerId, visible)`**
Sets the `visible` flag on a layer.

**`setClipMask(clipLayerId, targetLayerIds)`**
Marks `clipLayerId` as a clip mask and sets `clipPathLayerId` on all target layers.

### Transition Operations

**`addTransition(iconId, transition)`**
Adds a transition to the icon's `transitions` record.

**`patchTransition(iconId, transitionId, patch)`**
Shallow-merges `patch` into the transition.

**`removeTransition(iconId, transitionId)`**
Removes a transition from the icon.

**`startTransitionPreview(iconId, transition, variantId, progress?, crossIconContext?)`**
Resolves the transition against source/target states (including cross-icon context), computes initial interpolated values, and sets `transitionPreview` in state.

**`updateTransitionPreview(progress)`**
Updates the progress value and recomputes interpolated values from the resolved transition.

**`stopTransitionPreview()`**
Clears `transitionPreview` to null.

### State Operations

**`addState(iconId, options?)`**
Creates a new state, optionally duplicating layers from `sourceStateId`. If `blank` is true, creates empty layers.

**`renameState(iconId, stateId, nextStateId)`**
Renames a state by re-keying in the variant's `states` record. Updates all transition `from`/`to` references.

**`duplicateState(iconId, stateId, nextStateId?)`**
Deep-clones a state with a new ID.

### Icon/Variant Operations

**`createBlankIcon(options?)`** -- Creates a new icon with a default variant and state.
**`duplicateIcon(iconId)`** -- Deep-clones an icon with new IDs.
**`addVariant(iconId, variant)`** -- Adds a variant to the icon.
**`generateVariantMatrix(iconId, options)`** -- Generates a matrix of variants from size/weight/scale combinations.

## Behavior

### Undo/Redo

History is managed via zundo middleware. Actions can be grouped:
- `pauseHistory()` -- Suspends history recording.
- `resumeHistory()` -- Resumes history recording.
- `commitHistory(label?)` -- Forces a history snapshot with optional label.

### Selection Management

- `setSelection(selection)` -- Replaces the current selection.
- `clearSelection()` -- Resets to empty selection (`{ layerIds: [], pointIds: [] }`).
- Selection is orthogonal to tool mode: a `select` tool selects layers, `direct-select` selects points.

### Tab Management

- `openIconTab(iconSetId, iconId, options?)` -- Opens a tab for an icon, optionally focusing it.
- `closeIconTab(tabId)` -- Removes the tab. Adjusts `activeTabId` if the closed tab was active.
- `setActiveTab(tabId)` -- Focuses a tab and updates `currentIconId`/`currentVariantId`/`currentStateId` from the tab data.

### Dirty State

The store tracks `isDirty` which is set to `true` on any data mutation and cleared by `markSaved()`.

## Edge Cases

- `renameLayer` is a complex operation that must update references in transitions, topology contracts, guides, and symbol components atomically within a single state update.
- `startTransitionPreview` with cross-icon context resolves states from different icons.
- Loading a workspace resets all UI state (selection, viewport, tool, preview) to defaults.
- Removing the current icon/variant/state adjusts selection to the next available entity.

## Related Specs

- [Icon Schema](../schema/icon-schema.md) -- data model
- [Transition Schema](../schema/transition-schema.md) -- transition data
- [Cross-Icon Transitions](./cross-icon-transitions.md) -- UI flow
- [Transition Resolver](../runtime/transition-resolver.md) -- preview resolution
