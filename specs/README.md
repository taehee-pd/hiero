# Icon Authoring Tool -- Specification Index

This directory contains structured specifications for the icon authoring tool's core systems. Each spec documents types, function signatures, behavior rules, and edge cases derived from the implementation source.

## Schema

| Spec | Description |
|------|-------------|
| [icon-schema.md](./schema/icon-schema.md) | Icon, Variant, State, Layer, PaintRef, and RenderingMode data model |
| [transition-schema.md](./schema/transition-schema.md) | Transition, LayerBinding, TimelineTrack, CompoundTrimMode, and TopologyContract types |

## Runtime

| Spec | Description |
|------|-------------|
| [morph-interpolation.md](./runtime/morph-interpolation.md) | strictMorph, bestGuessMorph, and crossIconMorph path interpolation algorithms |
| [topology-detection.md](./runtime/topology-detection.md) | Topology compatibility analysis and per-subpath strategy classification |
| [transition-resolver.md](./runtime/transition-resolver.md) | Schema-to-runtime transition resolution with layer matching and morph readiness scoring |
| [draw-executor.md](./runtime/draw-executor.md) | Draw On/Off pathLength animation and Lottie-style compound trim path computation |
| [hybrid-compositor.md](./runtime/hybrid-compositor.md) | Per-subpath mixed morph+trim+crossfade animation frame composition |

## Editor

| Spec | Description |
|------|-------------|
| [editor-store.md](./editor/editor-store.md) | Zustand editor state, actions (layer rename, transition preview), and undo/redo |
| [cross-icon-transitions.md](./editor/cross-icon-transitions.md) | Cross-icon transition UI: endpoint pickers, direction selector, and preview integration |
| [animation-tab.md](./editor/animation-tab.md) | Animation tab redesign: trim path UI, per-subpath strategy display, variable value preview |

## Export

| Spec | Description |
|------|-------------|
| [runtime-json-format.md](./export/runtime-json-format.md) | Runtime JSON export structure, paint resolution, strategy simplification, and deterministic output |
