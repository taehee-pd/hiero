# Hiero -- Specification Index

This directory contains structured specifications for the Hiero's core systems. Each spec documents types, function signatures, behavior rules, and edge cases derived from the implementation source.

## Schema

| Spec | Description |
|------|-------------|
| [icon-schema.md](./schema/icon-schema.md) | Reviewed icon model: atomic icons, intrinsic variants, topology, and no per-icon multi-state authoring |
| [transition-schema.md](./schema/transition-schema.md) | Reviewed transition model: runtime-owned icon-to-icon transitions, line animation, morphing, and fallback strategy families |
| [install-config.md](./schema/install-config.md) | `hiero.config.ts` contract: `sourceDir`, live `hostTargets`, and release `releaseTargets` |
| [draft-checkpoint.md](./schema/draft-checkpoint.md) | DraftCheckpoint model — durable, append-only user-intentful snapshots between autosave and publish (Phase 1) |
| [version-snapshot.md](./schema/version-snapshot.md) | VersionSnapshot + RestoreEvent records — durable shape of release history and append-only restore audit trail (Phase 2/3) |
| [setup-health.md](./schema/setup-health.md) | Trust-boundary split between browser-safe config checks and server-side credential checks; `hiero init` wizard contract (Phase 4) |

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
| [repo-native-workflow.md](./ui/repo-native-workflow.md) | Figma ingress, Hiero SSOT, repo-aware editing, direct React publish, and optional Figma back-sync |
| [save-state-taxonomy.md](./ui/save-state-taxonomy.md) | Four-state save badge — Unsaved / Autosaved / Saved draft / Published vX.Y.Z — and the Cmd+S checkpoint binding (Phase 1) |
| [version-history.md](./ui/version-history.md) | `/history` route: list, compare, and restore-to-draft with three-button dirty-work confirm (Phase 3) |

## Export

| Spec | Description |
|------|-------------|
| [runtime-json-format.md](./export/runtime-json-format.md) | Reviewed runtime export boundary for atomic icons, intrinsic variants, and runtime-facing transition payloads |
| [lottie-export.md](./export/lottie-export.md) | Lottie 5.x JSON export: layer mapping, timeline tracks, morph approximation, downgrade rules |
| [repo-native-distribution.md](./export/repo-native-distribution.md) | Live integration lane vs release distribution lane for repo-native installable Hiero workflows |
| [publish-transaction.md](./export/publish-transaction.md) | Unified Publish flow: orchestrator outcome contract, PublishDialog UI, PR body enrichment with embedded JSON metadata block (Phase 2/4) |
