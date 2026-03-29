# Runtime JSON Format

**Status:** Proposed product-model rewrite
**Primary future files:** `lib/export/export-runtime-json.ts`

## Overview

The runtime JSON format is the export boundary between Coniva authoring data and runtime icon behavior in product code.

The old format assumed variants contained states and transitions. The reviewed direction changes that:

- variants contain authored geometry and style families
- runtime transitions are icon-to-icon concerns

So the runtime export should describe:

- icon metadata
- authored variants
- layer geometry and paint data
- runtime-facing transition payloads when requested

## Goals

- export deterministic icon payloads for React runtime consumption
- preserve the geometry needed for morphing and line animation
- stop depending on per-icon authored state machines

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
  layers: Record<string, RuntimeLayer>;
  topology?: RuntimeTopologyContract;
  effects?: Record<string, RuntimeEffect>;
  draw?: RuntimeDrawAnnotation;
  variableDraw?: RuntimeVariableDraw;
};
```

### RuntimeTransitionPayload

```typescript
type RuntimeTransitionPayload = {
  fromIconId: string;
  toIconId: string;
  fromVariantId: string;
  toVariantId: string;
  strategy: 'strictMorph' | 'bestGuessMorph' | 'lineAnimation' | 'replace';
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

### What should disappear

The new export format should not require:

- `defaultState`
- `states`
- transition references between authored states

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
