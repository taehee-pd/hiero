# Runtime JSON Format

**Status:** Implemented
**Files:** `lib/export/export-runtime-json.ts`

## Overview

The runtime JSON format is the primary export format for consuming icon animations at runtime. It serializes an icon's variants, states, transitions, effects, and draw annotations into a deterministic JSON structure. The export pipeline resolves paint references, builds layer bindings with track data, and produces a self-contained payload suitable for the runtime player.

## Types

### RuntimeCoreJson (Legacy)

```typescript
type RuntimeCoreJson = {
  id: string;
  name: string;
  variants: Record<string, {
    size: number;
    viewBox: [number, number, number, number];
  }>;
  states: Record<string, RuntimeCoreState>;
  transitions: Record<string, {
    from: string;
    to: string;
    strategy: Transition['strategy'];
    durationMs: number;
    easing?: string | SpringConfig;
    layerBindings: RuntimeLayerBinding[];
  }>;
  tokens?: {
    colors: Record<string, string>;
  };
};
```

### RuntimeIconMeta

```typescript
type RuntimeIconMeta = {
  id: string;
  name: string;
  category?: string;
  tags?: string[];
  variants: Record<string, {
    size: number;
    viewBox: [number, number, number, number];
    defaultState: string;
  }>;
};
```

### RuntimeVariantPayload

```typescript
type RuntimeVariantPayload = {
  variant: {
    id: string;
    size: number;
    viewBox: [number, number, number, number];
    defaultState: string;
  };
  states: Record<string, RuntimeState>;
  transitions: Record<string, RuntimeTransition>;
  effects?: Record<string, RuntimeEffect>;
  draw?: RuntimeDrawAnnotation;
  variableDraw?: RuntimeVariableDraw;
};
```

### RuntimeTransition

```typescript
type RuntimeTransition = {
  from: string;
  to: string;
  strategy: 'track' | 'morph' | 'replace';   // Simplified from schema strategies
  durationMs: number;
  easing: string | SpringConfig;
  layerBindings: RuntimeLayerBinding[];
  magicReplace?: RuntimeMagicReplace;
  direction?: 'downUp' | 'upUp' | 'offUp' | 'automatic';
};
```

### RuntimeLayerBinding

```typescript
type RuntimeLayerBinding = {
  fromLayerId?: string;
  toLayerId?: string;
  tracks?: RuntimeTrack[];
  delayMs?: number;
  durationMs?: number;
  morph?: { topology: 'strict' | 'bestGuess' };
};
```

### RuntimeTrack

```typescript
type RuntimeTrackProperty =
  | 'opacity' | 'rotate' | 'translateX' | 'translateY' | 'scale'
  | 'pathLength' | 'fill' | 'stroke' | 'strokeWidth'
  | 'fillOpacity' | 'strokeOpacity'
  | 'trimStart' | 'trimEnd' | 'trimOffset';

type RuntimeTrack = {
  property: RuntimeTrackProperty;
  keyframes: number[] | string[];
};
```

### RuntimeLayer

```typescript
type RuntimeLayer = {
  id: string;
  d: string;
  fillRule?: 'nonzero' | 'evenodd';
  fill: RuntimePaint;
  stroke: RuntimePaint;
  strokeWidth?: number;
  fillOpacity?: number;
  strokeOpacity?: number;
  lineCap?: string;
  lineJoin?: string;
  transform?: string;
  clipPath?: RuntimeClipPath;
};
```

### RuntimePaint

```typescript
type RuntimePaint =
  | { kind: 'none' }
  | { kind: 'currentColor' }
  | { kind: 'solid'; color: string }
  | { kind: 'linearGradient'; angle: number; stops: GradientStop[] }
  | { kind: 'radialGradient'; cx: number; cy: number; r: number; stops: GradientStop[] };
```

### RuntimeDrawAnnotation

```typescript
type RuntimeDrawAnnotation = {
  mode: 'byLayer';
  layers: Record<string, {
    guidePoints: Array<{ t: number; direction?: 'forward' | 'reverse' }>;
  }>;
};
```

### RuntimeMagicReplace

```typescript
type RuntimeMagicReplace = {
  preserveLayerIds?: string[];
  drawIntegrated?: boolean;
};
```

### RuntimeExportDiagnostic

```typescript
type RuntimeExportDiagnostic = {
  level: 'warning' | 'error';
  code: 'missing-token' | 'invalid-transition' | 'invalid-effect'
      | 'invalid-draw-layer' | 'invalid-guide-master';
  iconId: string;
  variantId?: string;
  transitionId?: string;
  effectId?: string;
  message: string;
};
```

## Functions

### exportRuntimeJson (Legacy)

```typescript
function exportRuntimeJson(
  icon: RuntimeJsonExportIcon,
  options?: { variants?: string[]; states?: string[] },
): string
```

Exports a single icon as a JSON string using the `RuntimeCoreJson` format. Resolves paint tokens to concrete colors. Supports filtering by variant and state IDs.

### exportRuntimeIconVariant

```typescript
function exportRuntimeIconVariant(
  project: Project,
  iconId: string,
  variantId: string,
): { meta: RuntimeIconMeta; variant: RuntimeVariantPayload; diagnostics: RuntimeExportDiagnostic[] }
```

Exports a single variant of an icon with full runtime data including states, transitions, effects, draw annotations, and variable draw configuration. Returns diagnostics for missing tokens, invalid transitions, etc.

## Behavior

### Strategy Simplification

Schema strategies are simplified for the runtime:
- `'strictMorph'` and `'bestGuessMorph'` both become `'morph'` in the export.
- `'track'` and `'replace'` pass through as-is.

### Paint Resolution

Schema `PaintRef` values are resolved to `RuntimePaint`:
- `{ mode: 'currentColor' }` becomes `{ kind: 'currentColor' }`.
- `{ mode: 'fixed', value }` becomes `{ kind: 'solid', color: value }`.
- `{ mode: 'token', token }` resolves via `TokenSet.colors`. If the token is missing, a diagnostic is emitted.
- Gradient modes pass through with their stops.
- `undefined` paint becomes `{ kind: 'none' }`.

### Deterministic Output

The JSON output is serialized with consistent key ordering to produce deterministic output across exports. This enables reliable diffing of exported artifacts.

### Track Property Filtering

Only properties in the `SUPPORTED_TRACK_PROPERTIES` set are included in the runtime output. Unsupported track properties are silently dropped.

### Clip Path Resolution

When a layer has `clipPathLayerId`, the referenced clip layer's path is resolved and included as a `RuntimeClipPath` on the layer. The clip layer itself is excluded from the exported `layers` array.

## Edge Cases

- Icons with no variants produce an empty `variants` record.
- Transitions referencing non-existent states are excluded and produce a diagnostic.
- Layers without path data emit an empty string for `d`.
- Token references to missing colors emit a `'missing-token'` diagnostic and fall back to transparent.
- Effects with unrecognized `kind` values are included but may produce runtime warnings.

## Related Specs

- [Icon Schema](../schema/icon-schema.md) -- source data model
- [Transition Schema](../schema/transition-schema.md) -- transition data
- [Draw Executor](../runtime/draw-executor.md) -- draw annotation consumption
- [Transition Resolver](../runtime/transition-resolver.md) -- transition resolution
