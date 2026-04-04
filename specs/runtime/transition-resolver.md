# Transition Resolver

**Status:** Implemented
**Files:** `lib/runtime-core/transition-resolver.ts`, `lib/runtime-core/auto-morph.ts`

## Overview

The transition resolver is the runtime boundary that turns an icon-to-icon transition intent into a concrete animation plan.

This is now more important than before because the reviewed product direction removes authored state-to-state transitions from the icon model.

The resolver should own:

- icon and variant endpoint resolution
- layer matching
- morph readiness scoring
- line-animation selection
- fallback selection when morphing is invalid

## Goals

- make runtime the owner of icon-to-icon transition behavior
- classify transitions predictably
- support line animation and morphing as first-class paths
- avoid ad hoc fallback behavior

## Types

### TransitionEndpointContext

```typescript
type TransitionEndpointContext = {
  sourceIconId: string;
  sourceVariantId: string;
  targetIconId: string;
  targetVariantId: string;
};
```

### MorphReadiness

```typescript
type MorphReadiness = {
  score: number;
  commandCompatibility: number;
  subpathCompatibility: number;
  closedCompatibility: number;
  bboxSimilarity: number;
  centroidSimilarity: number;
  semanticRoleMatch: number;
  recommendedStrategy: 'strictMorph' | 'bestGuessMorph' | 'lineAnimation' | 'fallback';
  reasons: string[];
};
```

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
};

type FallbackMode = 'fade-through' | 'scale-through' | 'slide-through' | 'replace-with-delay';
type AnimationType = 'strictMorph' | 'bestGuessMorph' | 'lineAnimation' | 'replace';
```

### ResolvedTransition

```typescript
type ResolvedTransition = {
  durationMs: number;
  easing: string | SpringConfig;
  layerBindings: ResolvedLayerBinding[];
  diagnostics: string[];
  topologyAnalysis?: TopologyAnalysis;
  direction?: 'downUp' | 'upUp' | 'offUp' | 'automatic';
};
```

## Resolution Pipeline

```text
icon endpoints
  -> variant endpoints
  -> layer matching
  -> readiness scoring
  -> strategy family selection
  -> morph attempt or line-animation path
  -> deterministic fallback if needed
```

## Layer Matching

Recommended passes:

1. explicit bindings if present
2. semantic role matching
3. layer name matching
4. geometry/readiness matching
5. unmatched layers become replace/fade behavior

## Strategy Decision

### `strictMorph`

Choose when command signatures and topology are strongly compatible.

### `bestGuessMorph`

Choose when normalization makes the pair plausible.

### `lineAnimation`

Choose when the visual continuity is best explained by stroke reveal or line progression, not geometric morphing.

### `fallback`

Choose when no acceptable morph or line path exists.

## Research Requirement

The resolver work should start with transition-family research, not just code edits.

Research should cover representative transitions such as:

- plus to close
- hamburger to close
- arrow direction changes
- line continuation or reversal
- outline to fill family changes
- geometry-preserving morphs
- geometry-breaking replacements

The implementation should document which resolver path each family uses and why.

## Edge Cases

- some icon pairs may use morphing for one layer and line animation for another
- some icon pairs may be same icon, different style variant
- some icon pairs should skip morphing entirely
- fallback must be stable across repeated runs

## Related Specs

- [Transition Schema](../schema/transition-schema.md)
- [Morph Interpolation](./morph-interpolation.md)
- [Draw Executor](./draw-executor.md)
- [Topology Detection](./topology-detection.md)
