# Hybrid Compositor

**Status:** Implemented
**Files:** `lib/runtime-core/hybrid-compositor.ts`

## Overview

The hybrid compositor consumes per-subpath strategy classifications from the topology detection system and composes a single animation frame that combines geometric morphing, trim/draw animation, and opacity crossfade. Each subpath within a path transition can use a different animation technique, enabling smooth transitions between paths with mixed topology (some subpaths morphable, others requiring trim or crossfade).

## Types

### HybridFrame

```typescript
type HybridFrame = {
  /** Subpaths rendered via geometric morph (interpolated path d). */
  morphedPaths: Array<{
    d: string;
    fromIndex: number;
    toIndex: number;
  }>;
  /** Subpaths rendered via trim (stroke-dasharray animation). */
  trimmedPaths: Array<{
    d: string;
    dashArray: string;
    dashOffset: string;
    fromIndex: number;
    isOutgoing: boolean;   // true = fading out, false = fading in
  }>;
  /** Subpaths that crossfade (opacity transition). */
  crossfadePaths: Array<{
    d: string;
    opacity: number;
    fromIndex: number;
    isOutgoing: boolean;
  }>;
};
```

## Functions

### composeHybridFrame

```typescript
function composeHybridFrame(
  fromPath: string,
  toPath: string,
  strategies: SubPathStrategyResult[],
  progress: number,
): HybridFrame
```

Main compositor entry point. Parses both SVG path `d` strings into per-subpath representations, then iterates through the strategy list to produce the appropriate frame data for each subpath pair.

## Behavior

### Per-Strategy Rendering

**Morph (`strategy: 'morph'`):**
- Linearly interpolates every coordinate between the `from` and `to` subpath commands.
- When commands differ in type or value count, falls back to emitting the `from` subpath geometry (graceful degradation).
- Unmatched subpaths (only `from` or only `to`) emit their geometry at full without interpolation.

**Trim (`strategy: 'trim'`):**
- Outgoing subpath: stroke-dasharray animation from fully visible to hidden. `trimEnd` goes from 1 to 0 as progress increases.
- Incoming subpath: stroke-dasharray animation from hidden to fully visible. `trimEnd` goes from 0 to 1 as progress increases.
- Both outgoing and incoming are emitted as separate entries in `trimmedPaths`.
- Path length is approximated using chord-length sum for cubic/quadratic segments and control-polygon-length heuristic for cubics.

**Crossfade (`strategy: 'crossfade'`):**
- Outgoing subpath: opacity = `1 - progress`.
- Incoming subpath: opacity = `progress`.
- Both outgoing and incoming are emitted as separate entries in `crossfadePaths`.

### SVG Path Parsing

The compositor includes its own SVG path parser that:
1. Tokenizes the `d` string into command letters and numbers.
2. Converts all relative commands to absolute coordinates.
3. Converts `H`/`V` shorthand to full `L` commands.
4. Splits at `M` commands into per-subpath groups.
5. Tracks current point and subpath start for `Z` commands.

### Path Length Approximation

Used for trim dash computation:

| Command | Approximation |
|---------|--------------|
| `M` | No length contribution |
| `L` | Euclidean distance |
| `C` | `(chord + controlPolygonLength) / 2` |
| `Q` | `(chord + controlPolygonLength) / 2` |
| `A` | Chord length (rough approximation) |
| `Z` | Skipped |

Minimum path length is clamped to 1 to avoid division by zero.

### Number Formatting

Output coordinates are rounded to 3 decimal places. Negative zero is normalized to `"0"`.

## Edge Cases

- Missing subpaths (index out of range) are silently skipped.
- Morph with mismatched command types emits `from` geometry as-is per command (no crash).
- Trailing commands from the longer subpath are emitted verbatim.
- Progress is clamped to [0, 1].
- Morph at `t=0` returns serialized `from`; at `t=1` returns serialized `to`.

## Related Specs

- [Topology Detection](./topology-detection.md) -- produces `SubPathStrategyResult[]` input
- [Draw Executor](./draw-executor.md) -- `computeTrimValues` used for trim dash computation
- [Morph Interpolation](./morph-interpolation.md) -- full morph pipeline (compositor uses simplified lerp)
- [Transition Resolver](./transition-resolver.md) -- decides overall strategy before hybrid composition
