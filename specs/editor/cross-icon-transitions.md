# Icon-to-Icon Transition Preview

**Status:** Proposed product-model rewrite
**Primary future files:** `components/editor/TransitionPanel.tsx`, `components/editor/AnimationStudioPanel.tsx`

## Overview

This spec describes the editor UI for previewing runtime icon-to-icon transitions.

The old UI mixed:

- intra-variant state-to-state transitions
- cross-icon transitions as a secondary mode

The reviewed direction removes authored state-to-state transitions from the product.

The new rule:

- transition preview is always icon-to-icon
- the editor previews runtime behavior
- the editor does not author a many-states-per-icon workflow

## Goals

- make icon endpoint selection the primary preview flow
- expose runtime strategy feedback clearly
- make morphing quality and fallback behavior visible
- keep the editor as a preview client for runtime behavior

## Non-Goals

- no intra-variant state authoring flow
- no state picker as a required UI primitive

## Types

```typescript
type CompatibilityStatus =
  | { tone: 'green'; label: 'Strict Morph' }
  | { tone: 'yellow'; label: 'Best Guess' }
  | { tone: 'orange'; label: 'Line Animation' }
  | { tone: 'red'; label: 'Replace / Fallback' };

type ActivePreview = {
  fromIconId: string;
  toIconId: string;
  fromVariantId: string;
  toVariantId: string;
  progress: number;
  playing: boolean;
  resolved: ResolvedTransition;
};
```

## UI Flow

### Endpoint Selection

The user picks:

1. source icon
2. source variant
3. target icon
4. target variant

The selection model is icon-centric, not state-centric.

### Strategy Feedback

The UI should show:

- morph readiness
- line-animation recommendation
- fallback recommendation when morphing is invalid

### Preview Playback

The preview player should support:

- scrub
- play / pause
- speed changes

But these are preview concerns only. They do not define persisted authored states.

## Behavior

### Transition Preview Creation

When a preview starts:

1. the editor resolves the selected source icon and variant
2. the editor resolves the selected target icon and variant
3. runtime resolution determines the strategy family
4. the preview renders the resolved runtime transition

### Binding Display

The bindings list should explain layer mapping with runtime language:

- `strict morph`
- `best guess morph`
- `line animation`
- `replace`

It should also show why a fallback was chosen when possible.

## Edge Cases

- identical icon pair should still preview deterministically
- same icon, different variant is valid
- same geometry with different style family is valid
- invalid morph pairs must degrade visibly and predictably

## Related Specs

- [Transition Schema](../schema/transition-schema.md)
- [Editor Store](./editor-store.md)
- [Transition Resolver](../runtime/transition-resolver.md)
