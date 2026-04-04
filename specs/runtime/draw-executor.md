# Draw Executor

**Status:** Implemented
**Files:** `lib/runtime-core/draw-executor.ts`, `lib/runtime-core/open-path-guard.ts`

## Overview

The draw executor computes `pathLength` animation values for Draw On / Draw Off effects and trim path values for Lottie-style stroke trimming. It distributes overall animation progress across participating layers according to guide-point ordering and supports two compound trim modes for multi-subpath paths: `simultaneously` (single continuous range across all subpaths) and `individually` (same proportional trim per subpath).

### Draw Animation Effect (kind: 'draw')

The `draw` effect provides trim-based path drawing animation using `trimStart`/`trimEnd`/`trimOffset`. It is only applicable to open (non-closed) vector paths with a stroke style. Three modes are supported:

- **reveal** — `trimEnd` animates from 0 to 1 (stroke draws from start to end)
- **erase** — `trimStart` animates from 0 to 1 (stroke erases from start to end)
- **slide** — a fixed-width visible window slides along the path

Eligibility is enforced by `open-path-guard.ts` at both authoring time (editor dims/disables draw presets) and runtime (effect player/store filter to eligible layers only). A layer is eligible if ALL subpaths are open (no Z command) and the layer has a stroke with positive width.

## Types

### DrawAnnotation

```typescript
type DrawAnnotation = {
  mode: 'byLayer';
  layers: Record<
    string,
    {
      guidePoints: Array<{ t: number; direction?: 'forward' | 'reverse' }>;
    }
  >;
};
```

### VariableDrawConfig

```typescript
type VariableDrawConfig = {
  participatingLayerIds: string[];
};
```

### TrimValues

```typescript
type TrimValues = {
  dashArray: string;    // SVG stroke-dasharray value
  dashOffset: string;   // SVG stroke-dashoffset value
};
```

### CompoundTrimResult

```typescript
type CompoundTrimResult = {
  subPathTrims: TrimValues[];   // One per subpath, matching subpath order in the d string
};
```

## Functions

### computeDrawOnValues

```typescript
function computeDrawOnValues(draw: DrawAnnotation, progress: number): InterpolatedValues
```

Computes per-layer `pathLength` values for a Draw On animation. Each layer reveals from 0 to 1 in sequence. The overall progress (0-1) is distributed across layers according to guide-point timing windows.

### computeDrawOffValues

```typescript
function computeDrawOffValues(draw: DrawAnnotation, progress: number): InterpolatedValues
```

Same as Draw On but reversed: layers hide from 1 to 0, preserving guide timing windows.

### computeVariableDrawValues

```typescript
function computeVariableDrawValues(config: VariableDrawConfig, progress: number): InterpolatedValues
```

Distributes progress evenly across `participatingLayerIds`. Each layer fully reveals (0 to 1) before the next layer begins. The per-layer progress window is `1 / layerCount`.

### computeTrimValues

```typescript
function computeTrimValues(
  trimStart: number,   // 0-1, where visible stroke begins
  trimEnd: number,     // 0-1, where visible stroke ends
  trimOffset: number,  // 0-1, rotates start/end positions
  pathLength: number,  // Total measured SVG path length
): TrimValues
```

Converts normalized trim parameters to SVG `stroke-dasharray` and `stroke-dashoffset`. Handles wrap-around when `trimStart > trimEnd`.

### computeCompoundTrim

```typescript
function computeCompoundTrim(
  trimStart: number,
  trimEnd: number,
  trimOffset: number,
  subPathLengths: number[],
  mode: CompoundTrimMode,
): CompoundTrimResult
```

Computes per-subpath trim values for compound paths.

## Behavior

### Layer Range Resolution

Guide-point `t` values define per-layer timing windows. When all layers have valid, distinct guide-point ranges (at least 2 points with different `t` values), those ranges are used directly. Otherwise, layers are distributed evenly across the [0, 1] progress range.

### Simultaneously Mode

All non-zero-length subpaths are treated as one continuous path:
1. Compute total length = sum of all subpath lengths.
2. Map the trim range to absolute positions along the total length.
3. Walk each subpath and compute the overlap between its span and the visible range.
4. Handle wrap-around: when the visible range crosses the total length boundary, it splits into two intervals and both overlaps are computed.

### Individually Mode

Each subpath is trimmed independently using `computeTrimValues` with its own length. All subpaths receive the same normalized `trimStart`, `trimEnd`, and `trimOffset`.

### Trim Math

```
visibleLength = (trimEnd >= trimStart)
  ? (trimEnd - trimStart) * pathLength
  : (1 - trimStart + trimEnd) * pathLength

dashOffset = -(trimStart + trimOffset) * pathLength
dashArray = "{visibleLength} {pathLength}"
```

## Edge Cases

- Zero-length subpaths are skipped in compound trim computation and receive invisible defaults (`dashArray: "0 {length}"`).
- No participating layers in `computeVariableDrawValues` returns an empty object.
- No layers in `DrawAnnotation` returns an empty `InterpolatedValues`.
- All progress values are clamped to [0, 1].
- When guide points have fewer than 2 entries, the layer falls back to even distribution.

## Related Specs

- [Transition Schema](../schema/transition-schema.md) -- `CompoundTrimMode` and `trimStart`/`trimEnd`/`trimOffset` tracks
- [Hybrid Compositor](./hybrid-compositor.md) -- trim strategy rendering
- [Topology Detection](./topology-detection.md) -- draw-coordinated crossfade
- [Runtime JSON Format](../export/runtime-json-format.md) -- draw annotation export
