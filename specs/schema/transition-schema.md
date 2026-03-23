# Transition Schema

**Status:** Implemented
**Files:** `lib/schema/types.ts`

## Overview

Transitions define animated changes between states within an icon or across different icons. Each transition specifies a strategy (track, morph, or replace), a duration, easing, and layer bindings that control how individual layers animate. The schema supports both intra-variant transitions (between states of the same variant) and cross-icon transitions (between states across different icons).

## Types

### Transition

```typescript
type Transition = {
  id: string;
  from: string;                         // State ID within current variant
  to: string;                           // State ID within current variant
  fromEndpoint?: TransitionEndpoint;     // Cross-icon source (when set, overrides from)
  toEndpoint?: TransitionEndpoint;       // Cross-icon target (when set, overrides to)
  strategy: 'track' | 'strictMorph' | 'bestGuessMorph' | 'replace';
  durationMs: number;
  easing?: string | SpringConfig;
  stagger?: TransitionStagger;
  layerBindings: LayerBinding[];
  triggers?: StateTrigger[];
  direction?: 'downUp' | 'upUp' | 'offUp' | 'automatic';
};
```

### TransitionEndpoint

Used for cross-icon transitions to reference a state in a different icon/variant.

```typescript
type TransitionEndpoint = {
  iconId: string;
  variantId: string;
  stateId: string;
};
```

### LayerBinding

```typescript
type LayerBinding = {
  fromLayerId?: string;
  toLayerId?: string;
  tracks?: TimelineTrack[];
  delayMs?: number;
  durationMs?: number;
  morph?: {
    topology: 'strict' | 'bestGuess';
    mixer?: 'native' | 'flubber';
  };
  compoundTrimMode?: CompoundTrimMode;
};
```

### TimelineTrack

A discriminated union over animatable properties:

```typescript
type TimelineTrack =
  | { property: 'opacity'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'rotate'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'translateX'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'translateY'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'scale'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'pathLength'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'fill'; keyframes: string[]; easing?: string | SpringConfig }
  | { property: 'stroke'; keyframes: string[]; easing?: string | SpringConfig }
  | { property: 'strokeWidth'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'fillOpacity'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'strokeOpacity'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'trimStart'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'trimEnd'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'trimOffset'; keyframes: number[]; easing?: string | SpringConfig };
```

### CompoundTrimMode

```typescript
type CompoundTrimMode = 'simultaneously' | 'individually';
```

- `'simultaneously'`: All subpaths are treated as one continuous path; the trim range maps across the combined total length. Mirrors After Effects "Trim Multiple Shapes" behavior.
- `'individually'`: Each subpath is trimmed independently using the same normalized start/end/offset values.

### SpringConfig

```typescript
type SpringConfig = {
  type: 'spring';
  stiffness: number;
  damping: number;
  mass?: number;
  velocity?: number;
};
```

### TransitionStagger

```typescript
type TransitionStagger = {
  mode: 'linear' | 'from-center' | 'from-edges' | 'random';
  perLayerMs: number;
  easing?: string;
};
```

### StateTrigger

```typescript
type StateTrigger = {
  event: 'hover' | 'tap' | 'longPress' | 'focus' | 'auto';
};
```

### Direction (Replace Strategy)

The `direction` field controls the visual motion of replace transitions:

| Direction | Behavior |
|-----------|----------|
| `'downUp'` | Outgoing slides down, incoming slides up |
| `'upUp'` | Both outgoing and incoming slide up |
| `'offUp'` | Outgoing scales out, incoming slides up |
| `'automatic'` | Determined by state ordering at runtime |

## Behavior

### Strategy Selection

- `'track'` -- Animate via explicit timeline tracks only. No path morphing. Used for transform-based animations (rotation, translation, opacity).
- `'strictMorph'` -- Requires exact SVG command signature match between from/to paths. Lerps control point coordinates directly.
- `'bestGuessMorph'` -- Converts arcs to cubics, pads mismatched subpath counts, then attempts morphing. Falls back to crossfade on failure.
- `'replace'` -- No morphing. Uses directional slide/fade animation controlled by `direction`.

### Cross-Icon Transitions

When `fromEndpoint` and `toEndpoint` are set:
- The `from`/`to` state IDs still serve as keys within the owning icon.
- The endpoints specify which icon, variant, and state to source the geometry from.
- Layer matching switches from ID-based equality to semantic matching (role, name, geometry similarity).

### Easing

Easing can be either a CSS timing function string (e.g. `'ease-in-out'`, `'cubic-bezier(0.4, 0, 0.2, 1)'`) or a `SpringConfig` object for physics-based animation.

## Edge Cases

- A `LayerBinding` with neither `fromLayerId` nor `toLayerId` is valid but produces no animation.
- Keyframes arrays with fewer than 2 entries are treated as static values.
- When `durationMs` on a binding exceeds the parent transition duration, it is clamped.
- `delayMs` of 0 is distinct from omitting `delayMs` (omitted uses auto-calculated delay).

## Related Specs

- [Icon Schema](./icon-schema.md) -- parent data model
- [Transition Resolver](../runtime/transition-resolver.md) -- runtime resolution
- [Morph Interpolation](../runtime/morph-interpolation.md) -- morph implementation
- [Draw Executor](../runtime/draw-executor.md) -- trim path execution
