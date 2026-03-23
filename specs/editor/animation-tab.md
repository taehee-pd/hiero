# Animation Tab

**Status:** Specification (UI redesign to surface runtime capabilities)
**Files:** `components/editor/AnimationStudioPanel.tsx`, `components/editor/TransitionPanel.tsx`, `components/editor/TimelineEditor.tsx`

## Overview

The Animation tab is the primary surface for authoring transitions and effects
on icon symbols. It must bridge the gap between the fully-implemented runtime
(morph, trim, hybrid composition, cross-icon transitions, variable value,
weight interpolation) and the editor UI, which currently only exposes
state-to-state transitions with 6 of 13 supported timeline track types.

The redesigned Animation tab follows SF Symbols animation semantics:
- **Closed vectors** → geometric morphing (shape A interpolates to shape B)
- **Open vectors** → trim/draw animation (stroke reveal via trimStart/trimEnd/trimOffset)
- **Mixed** → per-subpath strategy with hybrid compositor
- **Cross-icon** → Icon A transitions to Icon B with semantic layer matching

## Architecture

### Tab Structure

```
┌─ Animation ─────────────────────────────────────────────┐
│                                                          │
│  ┌─ Mode ─────────────────────────────────────────────┐  │
│  │  [ Transitions ]  [ Effects ]  [ Variable Value ]  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─ Transition Editor ────────────────────────────────┐  │
│  │  Scope:  [ Intra-Variant ]  [ Cross-Icon ]        │  │
│  │                                                    │  │
│  │  Source: icon / variant / state                    │  │
│  │  Target: icon / variant / state                    │  │
│  │                                                    │  │
│  │  Strategy: [ auto | morph | trim | replace ]       │  │
│  │  Direction: [ auto | downUp | upUp | offUp ]       │  │
│  │  Duration: 300ms    Easing: ease-out               │  │
│  │                                                    │  │
│  │  ┌─ Layer Bindings ─────────────────────────────┐  │  │
│  │  │  ● bg-circle → bg-circle  [morph] ✓ 0.94    │  │  │
│  │  │  ● chevron → arrow        [trim]  ↗ open    │  │  │
│  │  │  ● dot (added)            [fade]  ○ new     │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  │                                                    │  │
│  │  ┌─ Timeline ───────────────────────────────────┐  │  │
│  │  │  ▶ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 300ms│  │  │
│  │  │  bg-circle                                   │  │  │
│  │  │    opacity    ◆━━━━━━━━━━━━━━━━━━━◆         │  │  │
│  │  │    morph      ◆━━━━━━━━━━━━━━━━━━━◆         │  │  │
│  │  │  chevron                                     │  │  │
│  │  │    trimStart  ◆━━━━━━━━━━━━━━━━━━━◆         │  │  │
│  │  │    trimEnd    ◆━━━━━━━━━━━━━━━━━━━◆         │  │  │
│  │  └──────────────────────────────────────────────┘  │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

### Three Modes

1. **Transitions** — state-to-state or icon-to-icon animation authoring
2. **Effects** — standalone repeating effects (bounce, pulse, wiggle, variableColor)
3. **Variable Value** — progressive layer fill control (0.0–1.0 slider with live canvas preview)

## Types

### Timeline Track Properties (13 total)

```typescript
type NumericTrackProperty =
  // Transform (existing)
  | 'opacity' | 'rotate' | 'translateX' | 'translateY' | 'scale'
  // Draw (existing)
  | 'pathLength'
  // Trim (Phase G2 — missing from UI)
  | 'trimStart' | 'trimEnd' | 'trimOffset'
  // Style (Phase H3 — missing from UI)
  | 'strokeWidth' | 'fillOpacity' | 'strokeOpacity';

// Color tracks (deferred — complex UI)
type ColorTrackProperty = 'fill' | 'stroke';
```

### Per-Binding Animation Strategy

```typescript
type BindingAnimationType =
  | 'morph'        // closed subpaths — geometry interpolation
  | 'trim'         // open subpaths — stroke reveal via dasharray
  | 'crossfade'    // incompatible — opacity transition
  | 'preserved';   // Magic Replace — layer persists unchanged

type BindingDisplay = {
  fromLayerId: string;
  toLayerId: string | null;
  strategy: BindingAnimationType;
  readiness: MorphReadiness;      // per-binding scoring
  subPathStrategies?: SubPathStrategyResult[];  // per-subpath breakdown
  compoundTrimMode?: CompoundTrimMode;
};
```

### Cross-Icon Transition Flow

```typescript
type TransitionScope = 'intra-variant' | 'cross-icon';

// Endpoint picker state
type EndpointSelection = {
  iconId: string;
  variantId: string;
  stateId: string;
};
```

## Behavior

### Transition Creation

1. User selects scope (intra-variant or cross-icon)
2. User picks source endpoint and target endpoint
3. System auto-classifies each layer binding:
   - Both layers have **closed** subpaths → `morph` strategy
   - Both layers have **open** subpaths with matching commands → `morph`
   - Both layers have **open** subpaths with mismatched commands → `trim`
   - One **closed**, one **open** → `crossfade`
   - Layer only in source → outgoing `crossfade` (fade out)
   - Layer only in target → incoming `crossfade` (fade in)
4. User can override per-binding strategy
5. System shows morph readiness score per binding and per subpath
6. Timeline auto-populates default keyframes based on strategy

### Timeline Track Behavior

**Morph bindings:** Timeline shows a single "morph" track (non-editable keyframes;
controlled by morph interpolator). The morph track progress goes from 0 to 1.

**Trim bindings:** Timeline shows trimStart/trimEnd/trimOffset tracks with
editable keyframes. Default: trimEnd from 0→1 (draw on) or 1→0 (draw off).
Compound trim mode (simultaneously/individually) selectable per binding.

**Crossfade bindings:** Timeline shows opacity track with default fade (1→0
outgoing, 0→1 incoming).

**Preserved bindings (Magic Replace):** No timeline tracks — layer persists
unchanged. Shown as "preserved" badge in bindings list.

### Variable Value Preview

When the Variable Value slider is moved:
1. Compute `computeVariableValue()` for all layers at the current value
2. Apply `applyVariableValue()` to each layer's resolved style
3. Update canvas rendering in real-time
4. Show per-layer visibility indicators (dim layers that are invisible)

### Direction Preview

When direction is set on a replace transition:
1. Preview shows directional slide+fade effect
2. Outgoing layers slide in the specified direction
3. Incoming layers slide from the opposite direction
4. 8px slide offset (matching SF Symbols)

### Per-Subpath Strategy Display

For layers with multiple subpaths, show a breakdown:
```
bg-circle (2 subpaths)
  ├── subpath 0: morph (both closed, score: 0.94)
  └── subpath 1: trim (both open, mismatched commands)
```

Color coding:
- 🟢 Green — morph (high readiness)
- 🟡 Yellow — trim (compatible but different topology)
- 🔴 Red — crossfade (incompatible)

## Edge Cases

- **Empty state transitions**: Show warning if source or target state has no layers
- **Single-subpath layers**: Skip subpath breakdown, show binding-level strategy only
- **All-morph transitions**: Simplify UI — hide trim controls, show morph-only view
- **All-trim transitions**: Simplify UI — show trim controls prominently
- **Cross-icon with no matching layers**: All bindings become crossfade; show warning
- **Direction on non-replace strategy**: Direction selector hidden when strategy ≠ replace
- **Variable value at boundaries (0.0 or 1.0)**: All layers fully visible or hidden

## Related Specs

- [Transition Schema](../schema/transition-schema.md)
- [Transition Resolver](../runtime/transition-resolver.md)
- [Topology Detection](../runtime/topology-detection.md)
- [Draw Executor](../runtime/draw-executor.md)
- [Hybrid Compositor](../runtime/hybrid-compositor.md)
- [Cross-Icon Transitions](./cross-icon-transitions.md)
