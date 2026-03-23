# Topology Detection

**Status:** Implemented
**Files:** `lib/runtime-core/topology-detection.ts`, `lib/runtime-core/path-normalization.ts`

## Overview

Topology detection analyzes the structural compatibility between source and target states to determine whether path morphing is viable or whether a crossfade fallback is needed. The system detects incompatibilities such as subpath count mismatches, closed/open status differences, and fill-mode changes. It also provides per-subpath strategy classification (morph, trim, or crossfade) for the hybrid compositor.

## Types

### GeometryStats

```typescript
type GeometryStats = {
  subpathCount: number;
  commandSignature: string[];   // Flat array of command letters (e.g. ['M','L','C','Z','M','L','Z'])
  closed: boolean[];            // Per-subpath closed status
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  centroid: { x: number; y: number };
  pointCount: number;
};
```

### CanonicalPath

```typescript
type CanonicalPath = {
  d: string;           // Canonicalized path string (absolute coordinates, normalized ordering)
  stats: GeometryStats;
};
```

### TopologyIncompatibility

```typescript
type TopologyIncompatibility =
  | 'subpath-count-mismatch'
  | 'closed-open-mismatch'
  | 'fill-mode-change'
  | 'stroke-to-fill-change'
  | 'path-type-mismatch';
```

### TopologyAnalysis

```typescript
type TopologyAnalysis = {
  compatible: boolean;
  incompatibilities: TopologyIncompatibility[];
  recommendedStrategy: 'morph' | 'crossfade' | 'draw-crossfade';
  details: string[];
  subPathStrategies?: SubPathStrategyResult[];
};
```

### SubPathStrategy and SubPathStrategyResult

```typescript
type SubPathStrategy = 'morph' | 'trim' | 'crossfade';

type SubPathStrategyResult = {
  fromIndex: number;
  toIndex: number | null;    // null = unmatched (added/removed subpath)
  strategy: SubPathStrategy;
  reason: string;
};
```

## Functions

### analyzeTopologyCompatibility

```typescript
function analyzeTopologyCompatibility(
  fromState: State,
  toState: State,
): TopologyAnalysis
```

Iterates all paired layers (matched by ID), checks each for topology issues, and aggregates results. Also detects cross-layer stroke-to-fill transitions.

Strategy recommendation:
- No incompatibilities: `'morph'`
- Stroke-to-fill change present: `'draw-crossfade'`
- Other incompatibilities: `'crossfade'`

### classifySubPathStrategies

```typescript
function classifySubPathStrategies(
  fromStats: GeometryStats,
  toStats: GeometryStats,
): SubPathStrategyResult[]
```

Per-subpath classification rules for matched subpath pairs (matched by index):

| From | To | Condition | Strategy |
|------|----|-----------|----------|
| closed | closed | -- | `'morph'` |
| open | open | Command signatures match | `'morph'` |
| open | open | Command signatures differ | `'trim'` |
| closed | open | -- | `'crossfade'` |
| open | closed | -- | `'crossfade'` |

Unmatched subpaths (when counts differ):
- Open subpaths: `'trim'`
- Closed subpaths: `'crossfade'`

### canonicalizeLayerPath

```typescript
function canonicalizeLayerPath(layer: Layer): CanonicalPath | null
```

Applies the layer's transform to all path coordinates, converts to absolute commands, normalizes subpath ordering, and computes `GeometryStats`. Returns `null` when the layer has no path data.

Transform application order: scale, rotate, translate.

## Behavior

### Crossfade Frames

When topology is incompatible, the system provides crossfade frame computation:

```typescript
type CrossfadeFrame = {
  outgoingOpacity: number;    // Linear fade 1 -> 0
  incomingOpacity: number;    // Delayed ease-out 0 -> 1 (starts at t=0.1)
  incomingScale: number;      // Spring-like pulse 1.0 -> 1.12 -> 1.0
};
```

### Draw-Coordinated Crossfade

When stroke-to-fill transitions are detected and draw annotations exist, the system uses draw-coordinated crossfade:
- Outgoing layers use Draw Off (stroke erases, slightly ahead of fade).
- Incoming layers use Draw On (stroke reveals, slightly behind).
- Creates the handwriting-style transition pattern.

### Command Signature Splitting

The flat `commandSignature` array is split into per-subpath signatures at each `'M'` command boundary. Each per-subpath signature is a concatenation of its command letters (e.g. `"MLCZ"`).

## Edge Cases

- A layer pair where one has path data and the other does not produces a `'path-type-mismatch'` incompatibility.
- Layers without both stroke and fill are detected via `isStrokedLayer`/`isFilledLayer` helpers (strokeWidth > 0 required for stroked, any fill mode for filled).
- When both layers lack path data, no incompatibility is reported.

## Related Specs

- [Morph Interpolation](./morph-interpolation.md) -- morph algorithms
- [Transition Resolver](./transition-resolver.md) -- consumes topology analysis
- [Hybrid Compositor](./hybrid-compositor.md) -- consumes per-subpath strategies
- [Draw Executor](./draw-executor.md) -- draw-coordinated crossfade
