# Editor Store

**Status:** Proposed product-model rewrite
**Primary future files:** `lib/editor-store/store.ts`, `lib/editor-store/types.ts`

## Overview

This spec defines the reviewed editor-store direction after the product-model change.

The old store centered heavily on:

- `currentStateId`
- authored state CRUD inside a variant
- state-based transition preview

The reviewed direction removes per-icon multi-state authoring from the product contract.

The new store should center on:

- workspace and icon-set management
- current icon and current variant selection
- layer editing
- variant management for size and style families
- previewing runtime icon-to-icon transitions without making them authored state documents

## Goals

- keep the editor focused on icon authoring
- remove state-management complexity that no longer belongs in the product
- preserve transition preview as a runtime-facing capability
- simplify tab, selection, and mutation logic

## Non-Goals

- the editor store should not own an authored many-states-per-icon workflow
- the editor store should not preserve old state CRUD purely for compatibility

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

Important difference:

- `currentStateId` should not remain a first-class product concept

### TransitionPreview

```typescript
type TransitionPreview = {
  fromIconId: string;
  toIconId: string;
  fromVariantId: string;
  toVariantId: string;
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

## Removed Product Concepts

The reviewed product direction should remove:

- add state
- rename state
- duplicate state
- current state selection as a core editing primitive
- state-to-state transition CRUD as a core authoring feature

## Behavior

### Dirty State

Any mutation to icons, variants, or layers marks the store dirty until saved.

### Undo/Redo

Undo/redo stays important, but should operate over:

- icon edits
- variant edits
- layer edits

not over state-machine authoring flows that no longer belong in the product.

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
