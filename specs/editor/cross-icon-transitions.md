# Cross-Icon Transitions

**Status:** Implemented
**Files:** `components/editor/TransitionPanel.tsx`

## Overview

The cross-icon transition UI enables authoring transitions that span two different icons. The TransitionPanel provides a mode toggle between intra-variant and cross-icon modes, cascading endpoint pickers for source and target icons/variants/states, direction selection for replace strategies, and visual badges on transition cards indicating cross-icon status.

## Types

```typescript
type TransitionMode = 'intra-variant' | 'cross-icon';

type CompatibilityStatus =
  | { tone: 'green'; label: 'Compatible' }
  | { tone: 'yellow'; label: 'Best Guess' }
  | { tone: 'red'; label: 'Incompatible -- will crossfade' };

type ActivePreview = {
  transitionId: string;
  baseStateId: string;
  targetStateId: string;
  originalStateId: string;
  speed: number;
  progress: number;
  playing: boolean;
  resolved: ResolvedTransition;
};
```

## UI Flow

### Mode Toggle

The "Add Transition" form includes a mode selector:
- **Intra-Variant** (default): Selects `from` and `to` states from the current variant's state list via dropdown.
- **Cross-Icon**: Reveals two endpoint picker sections (source and target), each with cascading Icon, Variant, and State selects.

### Cross-Icon Endpoint Pickers

Each endpoint (source and target) presents three cascading selects:

1. **Icon Select** -- Lists all icons in the project (`projectIcons`). Changing the icon resets the variant and state selections.
2. **Variant Select** -- Lists variants for the selected icon. Changing the variant resets the state selection.
3. **State Select** -- Lists states for the selected variant.

The derived lists are computed via `useMemo` from `projectIcons`:
```
iconEntries = Object.values(projectIcons).map(icon => ({ id, name }))
srcVariants = projectIcons[srcIconId].variants (when srcIconId is set)
srcStates = Object.keys(projectIcons[srcIconId].variants[srcVariantId].states)
tgtVariants/tgtStates = analogous for target endpoint
```

### Direction Selector

Visible for all transitions. Options:

| Value | Label |
|-------|-------|
| `'automatic'` | Automatic |
| `'downUp'` | Down -> Up |
| `'upUp'` | Up -> Up |
| `'offUp'` | Off -> Up |

### Strategy Selection

Available strategies:
- `strictMorph`
- `bestGuessMorph`
- `track`
- `replace`

### Compatibility Badge

Each transition card shows a compatibility indicator computed from topology analysis:
- **Green (Compatible):** `strictMorph` possible, exact command signature match.
- **Yellow (Best Guess):** `bestGuessMorph` viable, some topology differences.
- **Red (Incompatible):** Will fall back to crossfade.

### Cross-Icon Badge

Transition cards with `fromEndpoint` or `toEndpoint` set display a cross-icon badge indicating the transition spans multiple icons.

## Behavior

### Creating a Cross-Icon Transition

When submitting in cross-icon mode:
1. The transition's `from` and `to` are set to the source and target state IDs.
2. `fromEndpoint` is populated with `{ iconId: srcIconId, variantId: srcVariantId, stateId: srcStateId }`.
3. `toEndpoint` is populated with `{ iconId: tgtIconId, variantId: tgtVariantId, stateId: tgtStateId }`.

### Preview Integration

The preview system handles cross-icon transitions by:
1. Resolving source state from `fromEndpoint.iconId > fromEndpoint.variantId > fromEndpoint.stateId`.
2. Resolving target state from `toEndpoint.iconId > toEndpoint.variantId > toEndpoint.stateId`.
3. Passing `CrossIconContext` to `startTransitionPreview` which forwards it to `resolveTransition`.
4. The `TransitionScheduler` drives playback with configurable speed (0.25x, 0.5x, 1x, 2x).

### Transition Card Sections

Each transition card is collapsible and shows:
- From/To state labels
- Strategy badge
- Duration and easing controls
- Stagger configuration (mode, perLayerMs)
- Trigger configuration (hover, tap, longPress, focus, auto)
- Layer bindings (expandable)
- Direction selector (for replace strategy)

### Default Values

When opening the "Add Transition" form:
- `formFrom` defaults to `currentStateId` (if available in the variant) or the first state.
- `formTo` defaults to the first state that differs from `formFrom`.
- `formStrategy` defaults to `'bestGuessMorph'`.
- `formDuration` defaults to `'240'` (ms).
- `formEasing` defaults to `'ease-in-out'`.
- `formDirection` defaults to `'automatic'`.

## Edge Cases

- If the source and target icons are the same, the transition is still stored with endpoints but the resolver detects `sourceIconId === targetIconId` and falls back to intra-variant matching.
- Endpoint pickers show empty dropdowns when no icons exist in the project.
- Changing the source icon clears the source variant and state selections to prevent stale references.
- Speed multiplier affects only preview playback, not the persisted `durationMs`.

## Related Specs

- [Transition Schema](../schema/transition-schema.md) -- `TransitionEndpoint` type
- [Editor Store](./editor-store.md) -- `startTransitionPreview` action
- [Transition Resolver](../runtime/transition-resolver.md) -- cross-icon layer matching
