# Icon Schema

**Status:** Active
**Primary files:** `lib/schema/types.ts`

## Overview

This spec defines Contour's icon schema.

The core model is:

- a `Workspace` contains `IconSet`s
- an `IconSet` contains atomic `Icon`s
- an `Icon` contains meaningful `Variant`s (size or style families) and optional `transitions`
- animation happens at runtime as icon-to-icon transitions
- States remain as compatibility fields in the schema and are actively used in the UI. Phase R3 shipped full state management UI (add, rename, duplicate, delete).

This keeps the authoring model closer to the intended SF Symbols-inspired product direction while making React code publishing clearer.

## Goals

- make each icon an atomic authored unit
- keep only variants that belong to the icon itself
- keep enough geometry and topology information for runtime transition algorithms
- support states as compatibility fields for UI workflows

## Non-Goals

- this schema does not treat Figma as an equal source of truth
- this schema does not encode release targets or repo publish config

## Types

### Workspace

```typescript
type Workspace = {
  version: '2.0';
  meta: { name: string; createdAt: string; updatedAt: string };
  iconSets: Record<string, IconSet>;
  activeIconSetId?: string;
};
```

### IconSet

```typescript
type IconSet = {
  version: '1.0';
  meta: { name: string; createdAt: string; updatedAt: string };
  icons: Record<string, Icon>;
  guideMasters?: Record<string, GuideMaster>;
  tokenSet?: TokenSet;
  exportProfiles?: ExportProfile[];
  collections?: Record<string, Collection>;
};
```

### Icon

```typescript
type Icon = {
  id: string;
  name: string;
  category?: string;
  tags?: string[];
  customGuides?: GuideItem[];
  variants: Record<string, Variant>;
  transitions?: Record<string, Transition>;  // icon-level transition definitions
  effects?: Record<string, Effect>;  // includes 'draw' kind with DrawConfig
  components?: Record<string, SymbolComponent>;
  meta?: {
    externalImport?: IconExternalImportMeta;
    derivedSpecs?: DerivedVariantSpec[];
  };
};
```

The `transitions` field holds icon-level transition definitions. The `Transition` type is defined in `lib/schema/types.ts`.

### Variant

```typescript
type Variant = {
  id: string;
  name?: string;
  size: number;
  viewBox: [number, number, number, number];
  renderingMode?: RenderingMode;
  guideMasterId?: string;
  weight?: SymbolWeight;
  scale?: SymbolScale;
  style?: 'outline' | 'fill' | 'slash' | 'circle' | 'square' | 'badge' | string;
  defaultState?: string;
  states?: Record<string, State>;
  layers: Record<string, Layer>;
  topology?: TopologyContract;
  variableValue?: number;
  weightControlPoints?: {
    ultralight?: string;
    thin?: string;
    light?: string;
    regular?: string;
    medium?: string;
    semibold?: string;
    bold?: string;
    heavy?: string;
    black?: string;
  };
};
```

States remain as compatibility fields in the schema and are actively used in the UI. Phase R3 shipped full state management UI (add, rename, duplicate, delete). The `State` and `LayerSnapshot` types are defined in `lib/schema/types.ts`.

Variants exist for intrinsic icon families such as size and style:

- examples: `16`, `20`, `24`, `outline`, `fill`

### Layer

```typescript
type Layer = {
  id: string;
  role?: 'primary' | 'secondary' | 'tertiary' | string;
  visible?: boolean;
  drawOrder?: number;
  clipPathLayerId?: string;
  isClipMask?: boolean;
  groupId?: string;
  path?: { d: string; fillRule?: 'nonzero' | 'evenodd' };
  style: {
    fill?: PaintRef;
    stroke?: PaintRef;
    strokeWidth?: number;
    fillOpacity?: number;
    strokeOpacity?: number;
    lineCap?: 'butt' | 'round' | 'square';
    lineJoin?: 'miter' | 'round' | 'bevel';
  };
  transform?: {
    x?: number;
    y?: number;
    rotate?: number;
    scaleX?: number;
    scaleY?: number;
  };
  importMeta?: SvgImportLayerMeta;
};
```

### TopologyContract

```typescript
type TopologyContract = {
  locked: boolean;
  layerPairs: Array<{
    layerId: string;
    subpathCount: number;
    commandSignature: string[];
    closed: boolean[];
  }>;
};
```

This remains important because runtime icon-to-icon morphing depends on geometric compatibility checks.

### PaintRef

```typescript
type PaintRef =
  | { mode: 'currentColor' }
  | { mode: 'fixed'; value: string }
  | { mode: 'token'; token: string }
  | { mode: 'linearGradient'; stops: GradientStop[]; angle: number }
  | { mode: 'radialGradient'; stops: GradientStop[]; cx: number; cy: number; r: number };

type GradientStop = { offset: number; color: string; opacity?: number };
```

### RenderingMode

```typescript
type RenderingMode = 'monochrome' | 'hierarchical' | 'palette' | 'multicolor';
```

### SymbolComponent

```typescript
type SymbolComponent = {
  kind: 'badge' | 'slash' | 'enclosure';
  layerIds: string[];
  position?: 'topLeading' | 'topTrailing' | 'bottomLeading' | 'bottomTrailing' | 'center';
};
```

## Behavior

### RenderingMode and Layer Roles

| Mode | Role Behavior |
|------|--------------|
| `monochrome` | All layers use `currentColor`. Role is ignored. |
| `hierarchical` | Role determines opacity: primary=1.0, secondary=0.6, tertiary=0.3. |
| `palette` | Each role maps to a distinct user-defined color slot. |
| `multicolor` | Layers use authored paint values directly. |

### Variant Boundaries

Allowed variant families:

- size
- weight
- scale
- style family, for example fill vs outline
- deterministic derived forms, for example slash or badge

Interaction states (hover, pressed, focused, open/closed) are typically modeled as separate icons with runtime transitions between them, though per-variant states remain available via the `states` field for compatibility workflows.

### Runtime Transition Readiness

The schema preserves the information needed for runtime transition quality:

- layer roles
- path topology
- guide metadata where useful
- enough determinism for morph and line animation algorithms

## Edge Cases

- a layer with no `path` remains valid for grouping or placeholders
- `fillRule` defaults to `'nonzero'` when omitted
- gradient stops must stay in the `[0, 1]` range
- not every icon pair is morph-compatible, so schema fidelity must support fallback runtime behavior

## Related Specs

- [Transition Schema](./transition-schema.md)
- [Editor Store](../editor/editor-store.md)
- [Runtime JSON Format](../export/runtime-json-format.md)
