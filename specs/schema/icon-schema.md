# Icon Schema

**Status:** Implemented
**Files:** `lib/schema/types.ts`

## Overview

The icon schema defines the canonical data model for icon projects. All geometry is stored as SVG path `d` strings. The schema is organized hierarchically: a `Workspace` contains `IconSet`s, each of which contains `Icon`s. Each icon has variants, transitions, effects, and components. Variants contain states, and states contain layers -- the fundamental visual building blocks.

## Types

### Icon

```typescript
type Icon = {
  id: string;
  name: string;
  category?: string;
  tags?: string[];
  customGuides?: GuideItem[];
  variants: Record<string, Variant>;
  transitions: Record<string, Transition>;
  effects?: Record<string, Effect>;
  components?: Record<string, SymbolComponent>;
  meta?: {
    externalImport?: IconExternalImportMeta;
  };
};
```

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
  defaultState: string;
  states: Record<string, State>;
};
```

- `size` is the canonical pixel size (e.g. 24).
- `viewBox` is `[minX, minY, width, height]`.
- `defaultState` references the initial state id shown before any transition.
- `weight` is one of: `'ultralight' | 'thin' | 'light' | 'regular' | 'medium' | 'semibold' | 'bold' | 'heavy' | 'black'`.
- `scale` is one of: `'small' | 'medium' | 'large'`.

### State

```typescript
type State = {
  id: string;
  layers: Record<string, Layer>;
  topology?: TopologyContract;
};
```

The `topology` field is an optional locked contract that records the expected path topology for all layers in this state, enabling strict morph validation.

### Layer

```typescript
type Layer = {
  id: string;
  role?: 'primary' | 'secondary' | 'tertiary' | string;
  visible?: boolean;
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
  isClipMask?: boolean;
  clipPathLayerId?: string;
  importMeta?: SvgImportLayerMeta;
};
```

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

## Behavior

### RenderingMode and Layer Roles

Layer roles (`primary`, `secondary`, `tertiary`) interact with `RenderingMode` to determine visual presentation:

| Mode | Role Behavior |
|------|--------------|
| `monochrome` | All layers use `currentColor`. Role is ignored. |
| `hierarchical` | Role determines opacity: primary=1.0, secondary=0.6, tertiary=0.3. All layers use `currentColor`. |
| `palette` | Each role maps to a distinct user-defined color slot from `TokenSet.colors`. |
| `multicolor` | Layers use their authored `style.fill`/`style.stroke` values directly. Role is ignored. |

### Layer Clipping

- When `clipPathLayerId` is set on a layer, that layer is clipped by the referenced layer's path.
- When `isClipMask` is `true`, the layer itself serves as a clip path definition and is not rendered directly.

### Transform Application Order

Layer transforms are applied in order: scale, rotate, then translate (`x`, `y`).

## Edge Cases

- A layer with no `path` is valid (used for grouping or placeholder purposes).
- When `visible` is `false` or omitted, the layer defaults to visible.
- `fillRule` defaults to `'nonzero'` if omitted.
- Gradient stops must have `offset` in [0, 1] range.

## Related Specs

- [Transition Schema](./transition-schema.md) -- transitions between states
- [Editor Store](../editor/editor-store.md) -- layer manipulation actions
- [Runtime JSON Format](../export/runtime-json-format.md) -- export format
