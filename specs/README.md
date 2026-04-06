# Contour -- Specification Index

This directory contains structured specifications for the Contour's core systems. Each spec documents types, function signatures, behavior rules, and edge cases derived from the implementation source.

## Schema

| Spec | Description |
|------|-------------|
| [icon-schema.md](./schema/icon-schema.md) | Reviewed icon model: atomic icons, intrinsic variants, topology, and no per-icon multi-state authoring |
| [transition-schema.md](./schema/transition-schema.md) | Reviewed transition model: runtime-owned icon-to-icon transitions, line animation, morphing, and fallback strategy families |
| [install-config.md](./schema/install-config.md) | `contour.config.ts` contract: `sourceDir`, live `hostTargets`, and release `releaseTargets` |

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
| [editor-store.md](./editor/editor-store.md) | Reviewed editor-store direction: icon/variant/layer editing plus runtime transition preview, without authored state CRUD |
| [cross-icon-transitions.md](./editor/cross-icon-transitions.md) | Reviewed icon-to-icon transition preview UI with runtime strategy feedback |
| [animation-tab.md](./editor/animation-tab.md) | Reviewed animation-tab direction focused on icon-to-icon runtime preview rather than state-to-state authoring |
| [inspect-tab.md](./editor/inspect-tab.md) | Inspect tab redesign: variable value, topology, strategy badges, weight, gradient |

## Editor (Phase N)

| Spec | Description |
|------|-------------|
| [derived-variants.md](./editor/derived-variants.md) | Derived variant generation via path booleans: fill, slash, circle, square, badge |

## Runtime (Phase O)

| Spec | Description |
|------|-------------|
| [weight-interpolation-cubic.md](./runtime/weight-interpolation-cubic.md) | Fritsch-Carlson cubic monotone spline for smooth multi-control-point weight interpolation |

## UI

| Spec | Description |
|------|-------------|
| [screens.md](./ui/screens.md) | Complete screen inventory: Explorer, Editor, dialogs, and all user flows |
| [components.md](./ui/components.md) | Component catalog with props, variants, and property editor variation matrix |
| [repo-native-workflow.md](./ui/repo-native-workflow.md) | Figma ingress, Contour SSOT, repo-aware editing, direct React publish, and optional Figma back-sync |

## Export

| Spec | Description |
|------|-------------|
| [runtime-json-format.md](./export/runtime-json-format.md) | Reviewed runtime export boundary for atomic icons, intrinsic variants, and runtime-facing transition payloads |
| [lottie-export.md](./export/lottie-export.md) | Lottie 5.x JSON export: layer mapping, timeline tracks, morph approximation, downgrade rules |
| [repo-native-distribution.md](./export/repo-native-distribution.md) | Live integration lane vs release distribution lane for repo-native installable Contour workflows |
