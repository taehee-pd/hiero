---
status: design-phase
last-reviewed: 2026-03-18
---

# SF Symbols-Style Export Plan

## Decision

The better implementation path is to treat SF Symbols 7 as an export-semantics model, not just an animation inspiration.

Based on Apple's WWDC25 session and SF Symbols 7 overview, the export feature should prioritize these concepts in order:

1. Draw annotations
2. Variable Draw participation
3. Enhanced Magic Replace continuity
4. Gradient rendering parity
5. Generic runtime effects after those semantics are stable

This changes the earlier generic runtime-first emphasis. The exporter should carry the semantic information that makes those behaviors possible, rather than expecting the runtime to infer them later.

## Why This Is The Better Path

Apple describes Draw as depending on:

- a symbol's layer structure
- annotation and timing choreography
- guide point placement along the intended draw route

Apple also states that:

- guide points control how a path draws from beginning to end
- Variable Draw depends on Draw-capable symbols and participating layers
- Magic Replace preserves shared enclosures and integrates Draw Off / Draw On for the remaining layers
- gradients are part of the rendered symbol model, not an afterthought

That means the correct contract boundary is:

- editor authors semantic animation intent
- exporter materializes those semantics explicitly
- runtime executes them deterministically

It is weaker to export only raw layers and a generic transition graph, then ask the runtime to rediscover enclosure matching, draw direction, or participating layers.

## Export-First Feature Scope

### 1. Draw

The exporter should support SF Symbols-style Draw as a first-class runtime annotation, not only as a generic `lineDrawOn` effect.

Use the editor's existing `GuideItem` draw points as the seed model, then export draw metadata per layer:

```ts
type RuntimeDrawGuidePoint = {
  t: number;
  direction?: 'forward' | 'reverse';
  kind?: 'start' | 'corner' | 'end';
};

type RuntimeDrawAnnotation = {
  mode: 'wholeSymbol' | 'byLayer' | 'individually';
  layers: Record<
    string,
    {
      guidePoints: RuntimeDrawGuidePoint[];
      bidirectional?: boolean;
      adaptiveEndCaps?: boolean;
      attachments?: Array<{
        layerId: string;
        atGuidePointIndex: number;
      }>;
    }
  >;
};
```

Implementation direction:

- export at least two ordered guide points per drawable layer
- preserve per-layer ordering explicitly
- validate that layers with Draw enabled have enough guide points
- keep Draw playback mode in the runtime payload so the runtime does not invent timing choreography

### 2. Variable Draw

Variable Draw should not be implemented as a generic effect preset. It should be a rendering capability derived from Draw participation.

Export shape:

```ts
type RuntimeVariableDraw = {
  participatingLayerIds: string[];
  defaultProgress?: number;
};
```

Implementation direction:

- only layers with valid Draw annotations may opt into Variable Draw
- runtime should drive progress by trimming the exported draw path order, not by guessing from raw path length alone
- the React API can later expose `progress` as an input

### 3. Magic Replace

Magic Replace should not begin as generic morphing between all states.

Instead, export explicit continuity metadata:

```ts
type RuntimeMagicReplace = {
  preserveLayerIds?: string[];
  enclosureLayerIds?: string[];
  drawIntegrated?: boolean;
};
```

Implementation direction:

- preserve enclosure layers when a transition moves between related states
- export continuity groups or explicit preserve-layer IDs
- when Draw annotations exist, transitions may compose Draw Off for outgoing layers and Draw On for incoming layers
- use crossfade or replace for the remaining layers until morphing is intentionally added later

This is much closer to Apple's "preserve shared enclosure, animate the rest" model than jumping straight to flubber-based morphing.

### 4. Gradients

Gradient parity belongs in v1 of the exporter because Apple positions gradients as part of the symbol rendering model.

Implementation direction:

- preserve resolved gradient metadata in runtime-json
- do not flatten gradients into single fixed fills for runtime export
- keep runtime behavior visually aligned with static SVG export

This means `RuntimeLayer.fill` cannot remain only a flat string if gradients are in scope. The runtime schema should allow either solid paint or gradient paint descriptors.

## Recommended Runtime JSON Evolution

Keep the approved file structure:

- `index.json`
- `meta.json`
- per-variant payload files

But evolve the per-variant payload beyond only `states`, `transitions`, and `effects`:

```ts
type RuntimeVariantPayload = {
  variant: {
    id: string;
    size: number;
    viewBox: [number, number, number, number];
    defaultState: string;
  };
  states: Record<string, RuntimeState>;
  transitions: Record<string, RuntimeTransition>;
  effects?: Record<string, RuntimeEffect>;
  draw?: RuntimeDrawAnnotation;
  variableDraw?: RuntimeVariableDraw;
  magicReplace?: Record<string, RuntimeMagicReplace>;
};
```

The exact field names can change during implementation, but the payload needs explicit animation semantics for Draw and Magic Replace.

## What To Defer

Defer these until after export semantics are working:

- generic arbitrary effect library expansion
- strict path morphing as a headline feature
- package publish automation
- registry versioning policy
- IDE integrations

These are useful, but they are not the core of "SF Symbols-style export."

## Concrete Implementation Order

### Step 1

Extend the runtime export schema to support:

- draw annotations
- variable draw participation
- enclosure preservation / continuity metadata
- gradient paint descriptors

### Step 2

Implement exporter validation for:

- minimum guide point counts
- guide point order stability
- valid variable-draw participation
- enclosure preservation references
- gradient serialization determinism

### Step 3

Implement runtime execution in this order:

- Draw On / Draw Off
- Variable Draw progress
- Magic Replace with preserved enclosures and Draw integration
- generic `track` transitions
- generic `replace`

### Step 4

Only after that, add:

- morphing
- codegen pipeline
- sync/publish automation

## How This Changes The Existing Plan

The repo should treat the export feature as the first major runtime milestone, with this priority:

1. deterministic runtime-json export
2. Draw-capable annotation export
3. Variable Draw support
4. Magic Replace continuity export
5. gradients in runtime payload
6. runtime execution
7. target-codebase generation for Storybook, Sanity, and React repos
8. optional package publishing

That is the cleaner implementation path for an SF Symbols-style system.

## Sources

- [What’s new in SF Symbols 7 - WWDC25 Session 337](https://developer.apple.com/videos/play/wwdc2025/337/)
- [SF Symbols 7 overview](https://developer.apple.com/sf-symbols/)
