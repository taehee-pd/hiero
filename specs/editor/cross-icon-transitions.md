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

The `CompatibilityStatus` union has been **removed** from the user-facing
panel per `docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md` §2.2 — the editor no
longer surfaces green/yellow/orange/red morph tones because the morph
strategy is always automatic. The runtime model below still exists; it just
lives inside `lib/runtime-core/auto-morph.ts` instead of the panel.

```typescript
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

There is no user-facing strategy feedback. `autoMorph()` runs internally and
selects the best tier silently. Power users can open the **Advanced**
disclosure (collapsed by default) to see a read-only "Engine chose: …" pill
showing which tier was picked, plus an optional manual override that still
falls back gracefully if the requested algorithm cannot run on the current
shapes.

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

There is no per-binding strategy badge in the panel. Layer matching still
happens inside `buildDefaultLayerBindings()` (matched by layer id with
unmatched layers tagged as added/removed), but the user does not see a
runtime-language readout per row. Debugging that information is available via
`NEXT_PUBLIC_CONTOUR_DEBUG=1` and the dev-only badge in `TransitionPanel`.

## Edge Cases

- identical icon pair should still preview deterministically
- same icon, different variant is valid
- same geometry with different style family is valid
- invalid morph pairs must degrade visibly and predictably

## Related Specs

- [Transition Schema](../schema/transition-schema.md)
- [Editor Store](./editor-store.md)
- [Transition Resolver](../runtime/transition-resolver.md)
