# Editor Store

**Status:** Active
**Primary files:** `lib/editor-store/store.ts`, `lib/editor-store/types.ts`

## Overview

This spec defines the editor store architecture.

The store centers on:

- workspace and icon-set management
- current icon, current variant, and current state selection
- layer editing
- variant management for size and style families
- state management (add, rename, duplicate, delete)
- previewing runtime icon-to-icon transitions

## Goals

- keep the editor focused on icon authoring
- support state management as an active editing workflow
- preserve transition preview as a runtime-facing capability
- simplify tab, selection, and mutation logic

## Core State

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
  favorites: string[];
  openTabs: EditorTab[];
  activeTabId: string | null;
};
```

`currentStateId` remains a first-class field in EditorState and is actively used for state selection in the UI.

### TransitionPreview

```typescript
type TransitionPreview = {
  transitionId: string;
  baseIconId: string;
  baseVariantId: string;
  targetIconId: string;
  targetVariantId: string;
  progress: number;
  resolvedTransition: ResolvedTransition;
  interpolatedValues: InterpolatedValues;
};
```

The preview remains useful, but it previews runtime icon-to-icon transitions.

### EditorTab

```typescript
type EditorTab = {
  id: string;
  iconSetId: string;
  iconId: string;
  variantId: string | null;
};
```

Tabs should focus on icons and variants, not state documents.

## Key Actions

### Layer Operations

These remain central:

- patch layer
- rename layer
- set visibility
- assign clip masks

### Variant Operations

These become more important:

- add variant
- duplicate variant
- remove variant
- derive fill/slash/circle/square/badge variants

### Transition Preview Operations

The editor should still support:

- start transition preview between icons
- update transition preview progress
- stop transition preview

But these previews should resolve runtime transition behavior, not mutate authored state records.

### Additional Actions

Additional actions not listed here include effects management (`addEffect`, `removeEffect`, `patchEffect`), guide masters (`addGuideMaster`, `updateGuideMaster`, `removeGuideMaster`), collections, sync targets, boolean operations, icon tabs (`openIconTab`, `closeIconTab`), variant matrix generation, undo/redo infrastructure (`pauseHistory`, `resumeHistory`, `commitHistory`).

## State Management

State CRUD actions are active: `addState()`, `removeState()`, `renameState()`, `duplicateState()`, `setCurrentState()`. These were shipped as part of Phase R3 and remain first-class editor operations.

## Behavior

### Dirty State

Any mutation to icons, variants, or layers marks the store dirty until saved.

### Undo/Redo

Undo/redo stays important and operates over:

- icon edits
- variant edits
- layer edits
- state edits

### Transition Preview Boundary

Preview is still an editor concern.

Transition definition and strategy choice are runtime concerns.

That means the store should hold preview session state, not the long-term animation model itself.

## Edge Cases

- removing a variant must always leave the icon in a valid state
- previewing icon-to-icon transitions must work even when morphing is invalid and fallback is chosen
- loading a workspace should reset preview UI and selection state cleanly

## Related Specs

- [Icon Schema](../schema/icon-schema.md)
- [Transition Schema](../schema/transition-schema.md)
- [Cross-Icon Transitions](./cross-icon-transitions.md)
- [Transition Resolver](../runtime/transition-resolver.md)
