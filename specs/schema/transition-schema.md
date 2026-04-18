# Transition Schema

**Status:** Proposed product-model rewrite
**Primary future files:** `lib/runtime-core/*`, `lib/export/*`

## Overview

This spec defines the reviewed transition model for Cuneiform.

The old schema mixed:

- state-to-state transitions inside a single icon
- icon-to-icon transitions across icons

The reviewed direction removes authored state-to-state transitions from the product contract.

The new rule is simple:

- authoring owns icons and their variants
- runtime owns transitions between icons

This keeps animation central to the product while removing the wrong authoring abstraction.

## Goals

- make icon-to-icon transition the primary transition model
- keep SF Symbols-inspired animation semantics first-class
- support line animation, morphing, and fallback replacement behavior
- keep transition ownership in runtime and export layers

## Non-Goals

- this schema does not require authored multi-state icons
- this schema does not guarantee that every icon pair can morph
- this schema does not force one transition algorithm for all icon pairs

## Types

### RuntimeTransitionIntent

This is the reviewed product-level concept, even if the exact type name changes during implementation.

```typescript
type RuntimeTransitionIntent = {
  id: string;
  fromIconId: string;
  toIconId: string;
  fromVariantId: string;
  toVariantId: string;
  strategy: 'strictMorph' | 'bestGuessMorph' | 'lineAnimation' | 'replace';
  durationMs: number;
  easing?: string | SpringConfig;
  direction?: 'downUp' | 'upUp' | 'offUp' | 'automatic';
};
```

The important point is not the final field names. The important point is:

- transitions reference icon endpoints
- transitions do not assume authored states inside one icon

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
  };
  compoundTrimMode?: CompoundTrimMode;
};
```

Layer binding remains useful because runtime needs to express:

- which layers map to each other
- where line animation is applied
- where fallback replace behavior is needed

### TimelineTrack

```typescript
type TimelineTrack =
  | { property: 'opacity'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'rotate'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'translateX'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'translateY'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'scale'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'pathLength'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'trimStart'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'trimEnd'; keyframes: number[]; easing?: string | SpringConfig }
  | { property: 'trimOffset'; keyframes: number[]; easing?: string | SpringConfig };
```

These remain central for line start / line end style behavior.

### CompoundTrimMode

```typescript
type CompoundTrimMode = 'simultaneously' | 'individually';
```

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

## Strategy Families

### `strictMorph`

Use when command signatures and topology are strongly compatible.

### `bestGuessMorph`

Use when geometry is close enough after normalization.

### `lineAnimation`

Use when the important visual behavior is line start/end progression, handwriting-style motion, or trim-based reveal.

### `replace`

Use when morphing is invalid or visually wrong.

This may include:

- directional replace
- crossfade
- scale/fade hybrids

## Runtime Rules

### Runtime owns transition resolution

Transition resolution should happen after authoring, not inside the authoring document.

That means runtime is responsible for:

- matching icons and variants
- choosing the correct strategy family
- deciding when morphing is invalid
- choosing the fallback path

### Research is part of the plan

The implementation plan must explicitly include research into major icon transition families, not just code changes.

Research output should classify transitions such as:

- line continuation or line reversal
- outline to filled form
- plus to close
- hamburger to close
- arrow direction changes
- geometry-preserving morphs
- geometry-breaking replacements

## Edge Cases

- some icon pairs will need line animation, not morphing
- some icon pairs will need morphing on some layers and replace on others
- some icon pairs will not have a visually acceptable morph at all
- fallback behavior must be deterministic, not ad hoc

## Related Specs

- [Icon Schema](./icon-schema.md)
- [Morph Interpolation](../runtime/morph-interpolation.md)
- [Draw Executor](../runtime/draw-executor.md)
- [Transition Resolver](../runtime/transition-resolver.md)
