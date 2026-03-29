# Animation Tab

**Status:** Proposed product-model rewrite
**Primary future files:** `components/editor/AnimationStudioPanel.tsx`, `components/editor/TransitionPanel.tsx`, `components/editor/TimelineEditor.tsx`

## Overview

The Animation tab remains the main surface for previewing and understanding Coniva's animation model.

The old design assumed state-to-state authoring inside one icon. The reviewed direction rejects that.

The new direction:

- icons remain atomic authored units
- variants remain intrinsic icon variants only
- the Animation tab previews runtime icon-to-icon transitions and effects

## Goals

- keep SF Symbols-inspired animation central
- expose line animation, morphing, and fallback logic clearly
- make runtime behavior inspectable without reintroducing authored state machines

## Core Modes

1. **Transition Preview** — icon-to-icon transition preview and strategy explanation
2. **Effects** — standalone effects that still belong to an icon or variant
3. **Variable Value** — progressive fill or visibility behavior where applicable

## Architecture

```text
Animation Tab
  -> source icon / variant picker
  -> target icon / variant picker
  -> runtime strategy analysis
  -> layer binding breakdown
  -> timeline-style preview controls
```

## Runtime Strategy Categories

The Animation tab should surface these categories explicitly:

- `strict morph`
- `best guess morph`
- `line animation`
- `replace / fallback`

## Timeline Behavior

Timeline UI should emphasize runtime interpretation, not authored state storage.

Examples:

- line animation shows trim or path-length style tracks
- morph shows progress and compatibility, even if keyframes are not directly authored
- replace shows direction and opacity / motion behavior

## What Should Be Removed

- source state picker
- target state picker
- intra-variant transition scope as a product concept
- UI copy that implies one icon contains interaction states

## Edge Cases

- all-morph case should simplify the UI
- all-line-animation case should simplify the UI
- mixed binding cases should show per-layer explanation
- invalid morph cases must show the fallback, not hide it

## Related Specs

- [Transition Schema](../schema/transition-schema.md)
- [Editor Store](./editor-store.md)
- [Transition Resolver](../runtime/transition-resolver.md)
