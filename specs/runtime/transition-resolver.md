# Transition Resolver

**Status:** Implemented
**Files:** `lib/runtime-core/transition-resolver.ts`

## Overview

The transition resolver converts a schema `Transition` into a `ResolvedTransition` with concrete interpolators, morph functions, and animation metadata for each layer pair. It handles both intra-variant transitions (same icon, ID-based layer matching) and cross-icon transitions (different icons, semantic multi-pass layer matching). The resolver integrates topology analysis, morph readiness scoring, and directional replace strategies.

## Types

### CrossIconContext

```typescript
type CrossIconContext = {
  sourceIconId: string;
  sourceVariantId: string;
  targetIconId: string;
  targetVariantId: string;
};
```

### MorphReadiness

```typescript
type MorphReadiness = {
  score: number;                    // Weighted composite 0-1
  commandCompatibility: number;     // 0-1, proportion of matching commands
  subpathCompatibility: number;     // 0 or 1, subpath count match
  closedCompatibility: number;      // 0-1, proportion of matching closed[] flags
  bboxSimilarity: number;           // 0-1, bbox dimension similarity
  centroidSimilarity: number;       // 0-1, centroid proximity normalized by span
  semanticRoleMatch: number;        // 0 or 1, role string equality
  recommendedStrategy: 'strictMorph' | 'bestGuessMorph' | 'crossIconMorph' | 'fallback';
  reasons: string[];
};
```

Score weights: `commandCompatibility * 0.3 + subpathCompatibility * 0.15 + closedCompatibility * 0.15 + bboxSimilarity * 0.15 + centroidSimilarity * 0.15 + semanticRoleMatch * 0.1`.

### ResolvedLayerBinding

```typescript
type ResolvedLayerBinding = {
  fromLayer?: Layer;
  toLayer?: Layer;
  tracks: TimelineTrack[];
  morph?: MorphInterpolator;
  fallback?: FallbackMode;
  animationType?: AnimationType;
  readiness?: MorphReadiness;
  delayMs?: number;
  durationMs?: number;
  easing?: string | SpringConfig;
  diagnostics?: string[];
  preserved?: boolean;      // Magic Replace: layer maintains continuity
};

type FallbackMode = 'fade-through' | 'scale-through' | 'slide-through' | 'replace-with-delay';
type AnimationType = 'morph' | 'fade-out' | 'fade-in' | 'scale' | 'translate' | 'rotate' | 'replace';
```

### ResolvedTransition

```typescript
type ResolvedTransition = {
  strategy: Transition['strategy'];
  durationMs: number;
  easing: string | SpringConfig;
  layerBindings: ResolvedLayerBinding[];
  diagnostics: string[];
  topologyAnalysis?: TopologyAnalysis;
  direction?: Transition['direction'];
};
```

## Functions

### resolveTransition

```typescript
function resolveTransition(
  transition: Transition,
  fromState: State,
  toState: State,
  options?: ResolveTransitionOptions,
): ResolvedTransition
```

Main entry point. Steps:

1. **Topology analysis** -- Runs `analyzeTopologyCompatibility` before resolving individual bindings.
2. **Binding resolution** -- Matches layers between states (see binding resolution below).
3. **Stagger computation** -- Orders bindings according to stagger mode.
4. **Per-binding resolution** -- Selects morph strategy, attempts morphing, assigns fallbacks.
5. **Preserved layer marking** -- Layers in `preserveLayerIds` skip morph/crossfade (Magic Replace).
6. **Topology override** -- When topology is incompatible, morph bindings are overridden with crossfade.

## Behavior

### Layer Binding Resolution

**Intra-variant (same icon):**
1. Honour explicit author-defined bindings.
2. Match remaining layers by morph readiness score (greedy: best pair first).
3. Unmatched layers become standalone fade-in/fade-out entries.

**Cross-icon (different icons):**
1. Honour explicit author-defined bindings.
2. **Pass 1 -- Role matching:** Match by semantic role (`primary`/`secondary`/`tertiary`).
3. **Pass 2 -- Name matching:** Match by layer ID equality (semantic name).
4. **Pass 3 -- Geometry matching:** Match remaining by full morph readiness score.
5. Unmatched layers become standalone fade-in/fade-out entries.

Binding sort order: explicit bindings preserve authored order; auto-matched bindings are sorted deterministically by `fromLayer.id|toLayer.id`.

### Strategy Decision Cascade

The runtime strategy for each binding is decided by `decideRuntimeStrategy`:

| Declared Strategy | Readiness Condition | Runtime Strategy |
|---|---|---|
| `'replace'` or `'track'` | -- | Use readiness recommendation |
| `'strictMorph'` | `commandCompatibility < 1` | Use readiness recommendation |
| `'bestGuessMorph'` | `score < 0.45` and `centroidSimilarity >= 0.3` | `'crossIconMorph'` |
| `'bestGuessMorph'` | `score < 0.45` and `centroidSimilarity < 0.3` | `'fallback'` |
| Any other | -- | Use declared strategy |

### Readiness-Based Strategy Recommendation

| Condition | Recommended |
|---|---|
| All exact match + bbox >= 0.85 + centroid >= 0.8 | `'strictMorph'` |
| subpath match + commands >= 0.8 + centroid >= 0.45 + bbox >= 0.4 | `'bestGuessMorph'` |
| centroid >= 0.3 | `'crossIconMorph'` |
| Otherwise | `'fallback'` |

### Morph Attempt Cascade

For each binding, morphs are attempted in order:
1. `strictMorph` -- if strategy calls for it
2. `bestGuessMorph` -- if strategy calls for it
3. `attemptCrossIconMorph` -- as third-tier fallback when bestGuessMorph fails or when explicitly selected
4. Fallback mode assignment -- if all morph attempts fail

### Directional Replace

Replace transitions use the `direction` field to control visual motion:
- `'downUp'` -- Outgoing slides down, incoming slides up.
- `'upUp'` -- Both outgoing and incoming slide up.
- `'offUp'` -- Outgoing scales out, incoming slides up.
- `'automatic'` -- Direction determined by state ordering.

### Magic Replace (Preserved Layers)

When `preserveLayerIds` is provided:
- Matching layers are marked `preserved: true`.
- Morph and fallback are cleared.
- Animation type is set to `'replace'`.
- These layers maintain visual continuity across the transition.

### Delay Computation

Binding delay is computed in priority order:
1. Explicit `binding.delayMs` (if set).
2. Stagger delay: `staggerIndex * perLayerMs`.
3. Role-based defaults: primary=0ms, secondary=24ms, others=16ms + 8ms per index.
4. Fade-in layers get reverse-ordered delay: `(total - staggerIndex) * 12ms`.

### Stagger Modes

| Mode | Ordering |
|------|----------|
| `'linear'` | Sequential index order |
| `'from-center'` | Distance from center, ties broken by index |
| `'from-edges'` | Distance from nearest edge, ties broken by index |
| `'random'` | Deterministic hash of layer ID |

## Edge Cases

- Track-strategy bindings with explicit tracks skip morphing to avoid double-animation.
- Bindings with no `fromD` get `'replace-with-delay'` fallback; no `toD` gets `'fade-through'`.
- When both states have zero layers, the resolved transition has no bindings.
- Fallback modes cycle through the list: `fade-through`, `scale-through`, `slide-through`, `replace-with-delay`.

## Related Specs

- [Transition Schema](../schema/transition-schema.md) -- input data model
- [Morph Interpolation](./morph-interpolation.md) -- morph algorithms
- [Topology Detection](./topology-detection.md) -- compatibility analysis
- [Cross-Icon Transitions](../editor/cross-icon-transitions.md) -- UI integration
