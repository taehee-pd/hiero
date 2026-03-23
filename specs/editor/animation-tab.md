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
  // Transform (6 — exposed in UI)
  | 'opacity' | 'rotate' | 'translateX' | 'translateY' | 'scale'
  // Draw (1 — exposed in UI)
  | 'pathLength'
  // Trim (3 — Phase G2, missing from UI)
  | 'trimStart' | 'trimEnd' | 'trimOffset'
  // Style (3 — Phase H3, missing from UI)
  | 'strokeWidth' | 'fillOpacity' | 'strokeOpacity';

// Color tracks (2 — schema+runtime exist, missing from UI)
// Require color keyframe editor (hex/swatch per keyframe, not numeric input)
type ColorTrackProperty = 'fill' | 'stroke';

// Total: 14 track types (6 exposed, 8 missing from UI)
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

## Strategy Lifecycle

Classification triggers and override behavior:

1. **Auto-classification** runs at: transition creation, binding addition, source/target layer edit
2. **Re-classification** triggers when: layer path geometry changes, subpath count changes
3. **Override persistence**: user overrides stored in `LayerBinding.strategyOverride`
4. **Override validation**: warn if override conflicts with current topology (e.g., override to
   "morph" for closed↔open pair). Clear stale overrides when source/target layers are deleted.

## Rendering Pipeline

### HybridFrame → SVG Bridge

The `composeHybridFrame()` output must be consumed by a rendering bridge:

```
classifySubPathStrategies() → per-subpath strategies
         │
composeHybridFrame(fromPath, toPath, strategies, progress)
         │
         ▼
┌─ HybridFrame ──────────────────────────────────┐
│  morphedPaths[] → update <path d="...">        │
│  trimmedPaths[] → update stroke-dasharray/offset│
│  crossfadePaths[] → update opacity              │
└─────────────────────────────────────────────────┘
         │
  applyHybridFrameToSVG(frame, svgElement)
```

Implementation: `lib/editor-renderer-svg/hybrid-frame-bridge.ts`

### Cross-Icon Preview

Cross-icon preview requires loading layers from two icons simultaneously.
`TransitionPreview` already carries `baseIconId`/`targetIconId` (Phase F3).
The canvas renderer must:

1. Resolve layers from source icon's state
2. Resolve layers from target icon's state
3. Scope layer IDs to prevent collisions: `{iconId}:{layerId}`
4. Render both sets with morph/trim/crossfade applied per binding strategy

### Stagger + Trim Interaction

When using `individually` stagger mode with trim tracks:
- Each binding's trim animation starts after the previous completes
- Timeline shows offset start positions per binding
- Trim preview accounts for stagger delay when computing dasharray values

## Inspect Tab (Companion)

The Inspect tab displays the selected layer's properties. It must surface:

### Current Implementation
- Layer role (primary/secondary/tertiary) with rendering-mode context
- Fill/stroke mode and color (with ColorPickerPopover)
- Transform (x, y, rotation)
- Stroke width, guides toggle

### Gaps to Address
- **Variable value indicator**: Show computed opacity at current `variableValue`
  alongside the layer's authored opacity
- **Topology status**: Display subpath count, command signature, closed status
  from `GeometryStats` for the selected layer
- **Animation strategy badge**: When a transition is active, show which
  strategy (morph/trim/crossfade/preserved) applies to the selected layer
- **Weight control points**: If variant uses weight interpolation, show
  current weight and which control points are available
- **Auto-gradient preview**: Show gradient stops applied to current fill
  when auto-gradient mode is active

## Edge Cases

- **Empty state transitions**: Show warning if source or target state has no layers
- **Single-subpath layers**: Skip subpath breakdown, show binding-level strategy only
- **All-morph transitions**: Simplify UI — hide trim controls, show morph-only view
- **All-trim transitions**: Simplify UI — show trim controls prominently
- **Cross-icon with no matching layers**: All bindings become crossfade; show warning
  with suggestion to switch to replace strategy with direction
- **Direction on non-replace strategy**: Direction selector hidden when strategy ≠ replace
- **Variable value at boundaries (0.0 or 1.0)**: All layers fully visible or hidden
- **Stale strategy override**: Warn when override conflicts with current topology
- **Cross-icon layer ID collision**: Scope IDs with icon prefix

## Engineering Review Notes

Based on gstack /plan-eng-review (2026-03-23):
- **Critical**: HybridFrame rendering bridge must be built before J3/J4
- **Consolidation**: I4-I7 (binding display) should share `useBindingStrategies()` hook
- **Consolidation**: J6-J7 (variable value) share same computation pipeline
- **Missing prerequisite**: K3 (weight preview) needs control point authoring task
- **DRY**: Extract binding strategy visualization from MorphReadinessIndicator

## Related Specs

- [Transition Schema](../schema/transition-schema.md)
- [Transition Resolver](../runtime/transition-resolver.md)
- [Topology Detection](../runtime/topology-detection.md)
- [Draw Executor](../runtime/draw-executor.md)
- [Hybrid Compositor](../runtime/hybrid-compositor.md)
- [Cross-Icon Transitions](./cross-icon-transitions.md)
