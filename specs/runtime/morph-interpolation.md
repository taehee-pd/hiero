# Morph Interpolation

**Status:** Implemented
**Files:** `lib/runtime-core/auto-morph.ts`, `lib/runtime-core/morph.ts`, `lib/runtime-core/intrinsic-interpolation.ts`, `lib/runtime-core/cross-icon-morph.ts`, `lib/runtime-core/arc-to-cubic.ts`

## Overview

The morph system provides path interpolation between SVG `d` strings at varying levels of compatibility. The primary entry point is `autoMorph()`, which automatically selects the best strategy for any pair of paths using a 5-level cascade:

1. **Identity** — identical paths after normalization (no interpolation needed)
2. **Intrinsic Strict** — exact command signature match, using Sederberg 1993 intrinsic interpolation (edge lengths + turning angles) to eliminate rotation shrinkage
3. **Best Guess** — same topology with different segment counts, normalized to cubic beziers with degenerate padding
4. **Point-Sampled** — different topologies, handled via arc-length sampling, Gauss-Legendre quadrature, sub-path matching, De Casteljau subdivision, and Catmull-Rom reconstruction
5. **Fallback** — returns null; caller uses crossfade

The three legacy strategies (`strictMorph`, `bestGuessMorph`, `crossIconMorph`) remain available as explicit overrides for backward compatibility.

### Intrinsic Interpolation (Sederberg 1993)

`intrinsicStrictMorph()` replaces the linear control-point lerp used in the original `strictMorph()`. Instead of interpolating absolute (x, y) coordinates (which causes shapes to shrink ~30% at t=0.5 during rotational transitions), it decomposes each segment into polar coordinates (edge length + angle) and intrinsic handle positions (tangent/normal ratios relative to the segment chord), interpolates those separately, then reconstructs absolute coordinates. This preserves edge lengths and angles throughout the morph. The original command stream is preserved (M stays M, L stays L, etc.).

## Types

```typescript
type MorphInterpolator = (t: number) => string;

type CubicSegment = {
  c1: Point;   // First control point
  c2: Point;   // Second control point
  end: Point;  // End anchor
};

type CubicSubPath = {
  start: Point;
  segments: CubicSegment[];
  closed: boolean;
};

type CubicPath = CubicSubPath[];
```

## Functions

### strictMorph

```typescript
function strictMorph(fromD: string, toD: string): MorphInterpolator
```

Requires exact command signature match between `from` and `to`. Canonicalizes both paths to absolute coordinates, verifies that the command sequence and per-command value counts are identical, then returns an interpolator that lerps every coordinate value.

**Throws** if signatures or value counts differ.

### bestGuessMorph

```typescript
function bestGuessMorph(fromD: string, toD: string): MorphInterpolator | null
```

1. Normalizes both paths to `CubicPath` representation (arcs to cubics, quadratics to cubics, lines to degenerate cubics).
2. Aligns subpath counts by creating degenerate (collapsed) subpaths at the last known point.
3. Pads segment counts within each subpath pair.
4. Finds optimal shape index rotation for closed subpath pairs.
5. Serializes aligned paths and delegates to `strictMorph`.

Returns `null` if normalization or alignment fails.

### attemptCrossIconMorph

```typescript
function attemptCrossIconMorph(fromD: string, toD: string): MorphInterpolator | null
```

Entry point for cross-icon morphing. Normalizes both SVG `d` strings to `CubicPath`, then delegates to `crossIconMorph`. Returns `null` when either path cannot be normalized.

### crossIconMorph (Phase 8.2)

```typescript
function crossIconMorph(from: CubicPath, to: CubicPath): MorphInterpolator | null
```

Pipeline:

1. **Winding normalization** -- Ensures all subpaths have clockwise winding (positive signed area via Shoelace formula). Counter-clockwise subpaths are reversed with control points swapped.

2. **Sub-path matching** -- Greedy matching by similarity score. Candidates scored by:
   - Centroid proximity: 35% weight
   - BBox similarity: 30% weight
   - Area similarity (Shoelace): 10% weight
   - Segment count similarity: 5% weight
   - Closed compatibility bonus: 20% weight

3. **Segment equalization** -- De Casteljau subdivision to match segment counts within pairs. Subdivisions distributed proportionally by arc length (largest-remainder method for exact total).

4. **Shape index optimization** -- For closed subpath pairs, finds the rotation offset that minimizes total point displacement (endpoint + weighted control point distances).

5. **Unmatched subpath handling** -- Unmatched source subpaths collapse to centroid (easeInCubic). Unmatched target subpaths expand from centroid (easeOutCubic).

6. **Interpolation** -- Per-segment interpolation uses rotational handle interpolation: control points are interpolated in polar coordinates (angle + length) relative to their anchor points. Falls back to linear lerp when anchor distance is below epsilon (0.001).

## Behavior

### Arc-to-Cubic Conversion

Arc commands (`A`) are converted to one or more cubic bezier segments via the standard parametric arc decomposition. Degenerate arcs (zero radii) produce a straight-line segment.

### Alignment Rules

- Missing subpaths are filled with degenerate subpaths collapsed to the last known point.
- Missing segments within a subpath are padded with zero-length segments at the last endpoint.
- Closed/open mismatch between paired subpaths causes `bestGuessMorph` to return `null`.

### Interpolator Boundary Behavior

All interpolators clamp at boundaries:
- `t <= 0` returns the original `fromD` string.
- `t >= 1` returns the original `toD` string.
- Intermediate values return the computed interpolation.

### Number Formatting

All output coordinates are rounded to 3 decimal places. Negative zero is normalized to `"0"`.

## Edge Cases

- Empty paths (`from.length === 0 && to.length === 0`) cause `crossIconMorph` to return `null`.
- Single-segment subpaths skip shape index optimization.
- Open subpaths skip shape index optimization (only closed paths are rotated).
- When all subpaths are unmatched, the morph degenerates to a centroid collapse/expand animation.

## Related Specs

- [Transition Schema](../schema/transition-schema.md) -- strategy declaration
- [Topology Detection](./topology-detection.md) -- compatibility analysis
- [Transition Resolver](./transition-resolver.md) -- morph strategy selection
- [Hybrid Compositor](./hybrid-compositor.md) -- per-subpath mixed strategies
