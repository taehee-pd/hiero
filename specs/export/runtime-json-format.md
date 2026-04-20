# Runtime JSON Format

**Status:** Active
**Primary files:** `lib/export/export-runtime-json.ts`

## Overview

The runtime JSON format is the export boundary between Hiero authoring data and runtime icon behavior in product code.

The runtime export describes:

- icon metadata
- authored variants
- layer geometry and paint data
- runtime-facing transition payloads when requested

## Goals

- export deterministic icon payloads for React runtime consumption
- preserve the geometry needed for morphing and line animation

## Types

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
    style?: string;
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
    style?: string;
  };
  layers: RuntimeLayer[];
  topology?: RuntimeTopologyContract;
  effects?: Record<string, RuntimeEffect>;
  draw?: RuntimeDrawAnnotation;
  variableDraw?: RuntimeVariableDraw;
};
```

### RuntimeTransition

Note: the actual type name in the codebase is `RuntimeTransition`, not `RuntimeTransitionPayload`.

```typescript
type RuntimeTransition = {
  fromIconId: string;
  toIconId: string;
  fromVariantId: string;
  toVariantId: string;
  strategy: 'track' | 'morph' | 'replace' | 'lineAnimation'; // 'auto' resolves to 'morph' at export time
  durationMs: number;
  easing: string | SpringConfig;
  layerBindings: RuntimeLayerBinding[];
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
  compoundTrimMode?: 'simultaneously' | 'individually';
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

## Behavior

### Export Boundary

Runtime export should preserve:

- authored geometry
- paint resolution
- topology data needed for transition quality
- variant identity such as size and style family

### Compatibility Fields

Note: `states` and `transitions` fields are still present in the export types for compatibility. The export format does not require them for core rendering, but they are preserved when present in the source data.

### Determinism

Output must remain deterministic for:

- diffability
- code review
- repeated publish runs

### Diagnostics

Diagnostics should still exist for:

- invalid paints
- missing tokens
- malformed geometry
- unsupported transition payload requests

## Edge Cases

- icons with one variant are valid
- icons with many size/style variants are valid
- transition payload generation may be omitted when only icon geometry is needed
- geometry that is valid for rendering may still be invalid for morphing

## Related Specs

- [Icon Schema](../schema/icon-schema.md)
- [Transition Schema](../schema/transition-schema.md)
- [Transition Resolver](../runtime/transition-resolver.md)
- [Draw Executor](../runtime/draw-executor.md)
