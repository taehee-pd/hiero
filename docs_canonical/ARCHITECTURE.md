# Architecture

## System Overview

This repository is a Next.js web application for icon design and animation authoring. Authoring data flows through a shared schema and editor store, then into import, export, compile, and runtime layers. All persistence is via IndexedDB with auto-save.

## Primary Runtime Surfaces

- Studio surface: `app/page.tsx` renders `components/studio/StudioLayout.tsx` — a Sanity Studio-style single-screen workspace combining navigation, icon list, and embedded editor.
- Editor surface: `app/editor/page.tsx` and `app/editor/[iconId]/page.tsx` render the focused authoring workspace.
- Demo surface: `app/demo/runtime/page.tsx` renders runtime execution demos.

## Core Module Boundaries

### Schema and Documents

`lib/schema/` is the canonical document and type boundary.

- `types.ts` defines the core product model.
- `guards.ts` validates `Project` and `Workspace` inputs.
- `workspace.ts` handles workspace/project conversion and icon-set selection.

All higher layers depend on this model.

### Editor State and Authoring Logic

`lib/editor-store/` is the application state boundary for authoring.

- owns loaded `workspace` and active `project`
- tracks current icon, variant, state, selection, tabs, favorites, and dirty state
- exposes editing actions, history boundaries, and view state

`lib/editor-core/` contains lower-level editing and geometry logic:

- path parsing and serialization
- point and layer editing commands
- snapping, topology, boolean ops, and shape generation
- keyboard handling and viewport math

### Rendering

- `lib/editor-renderer-svg/`: renders authored state into SVG for the editor and preview use cases.
- `lib/editor-overlay-canvas/`: renders non-exported overlays such as guides, selection affordances, and editor feedback.

These modules support the editor UI but do not define the canonical document shape.

### Import and Export

- `lib/import/`: converts SVG input into schema-compliant icon data and
  hosts the external adapter SDK plus built-in source adapters
  (Lucide, Heroicons, Phosphor, Material Symbols, Figma).
- `app/api/import/figma/route.ts`: Figma import API (PAT per-request, never stored).
- `figma-plugin/export-to-contour/`: Figma plugin for exporting components to Contour.
- `docs_canonical/IMPORT_ADAPTER_SDK.md`: canonical import-adapter lifecycle and testing requirements.
- `lib/export/`: produces SVG, runtime JSON, Lottie JSON, compiled icon
  artifacts, package manifests, change diffs, and generated component outputs.
- `lib/export/adapters/`: platform-specific code generators (React, Swift, Flutter) and downgrade rules for cross-platform export.
- `lib/compiler-contracts/`: validates compiled/exported artifact shapes.

### Persistence

- `lib/persistence/`: IndexedDB adapter, persistence manager, and auto-save hook.
- `components/persistence/AutoSaveProvider.tsx`: mounted in `app/layout.tsx` for automatic workspace persistence.

### Distribution

- `lib/live-sync/`: real-time publish transport with local-directory, git-pr, and npm-registry connectors.
- `lib/install-config/`: installation configuration for icon packages.
- `packages/contour-cli/`: `@contour/cli` command-line tool for icon operations.
- `components/export/PublishPanel.tsx`: UI for Lane 1 live sync publishing.
- `components/export/ReleasePanel.tsx`: UI for Lane 2 versioned releases.

### Sync and Source Export

- `lib/sync-source/`: exports editor state into a versioned, deterministic canonical source format (`icon.json` + `manifest.json` + `preview.svg` per icon).
- `lib/sync-service/`: orchestrates GitHub PR-based sync: source-level diff, conflict detection, branch creation, and file commits.
- `lib/sync-source/source-to-project.ts`: adapter layer that reconstructs a `Project` from merged source files for compilation.
- `lib/sync-source/source-of-truth.ts`: guardrails that prevent mixing input sources.

#### Sync Service Internals

The sync service (`lib/sync-service/`) is a layered module:

| File | Responsibility |
|------|---------------|
| `git-provider.ts` | Abstract provider interface (GitHub, GitLab, etc.) |
| `github-provider.ts` | GitHub REST API implementation (server-side only) |
| `sync-pr.ts` | 11-step orchestrator: validate → diff → conflicts → branch → commit → PR |
| `contracts.ts` | Request/response types and payload validation |
| `diff-source.ts` | Byte-for-byte source-level diffing engine |
| `conflicts.ts` | Optimistic concurrency (6 conflict kinds, machine-readable codes, suggested actions) |
| `errors.ts` | 9 typed error classes with HTTP status codes and `classifyGitHubError` |
| `metadata.ts` | PR title/body generation, CI summary, review comments |
| `analytics.ts` | Structured observability: 10 events, pluggable sinks, debug mode, timeline diagnostics |
| `permissions.ts` | Least-privilege audit, preflight permission checks, token format validation |
| `feature-flags.ts` | Environment-variable-based rollout control (kill switch, dry-run, repo allow-list) |

**Error handling boundary:** Steps 1-6 of the sync pipeline are read-only. Steps 7-10 mutate the remote and are individually wrapped with typed error classification. Partial failures (e.g., branch created but PR creation failed) report the orphan branch in the error response.

**Token boundary:** The GitHub token is injected server-side via `GITHUB_SYNC_TOKEN`. It is never exposed to the client, never included in analytics events, and never logged. The `GitHubProvider` constructor rejects empty tokens.

**Conflict model:** Optimistic concurrency using `baseSha` tracking. Before any mutations, the pipeline checks for base-SHA drift, remote icon changes, remote icon deletions, manifest conflicts, branch name collisions, and auth expiry. Each conflict carries a machine-readable error code and a list of suggested recovery actions.

### Export Adapters

`lib/export/adapters/` contains platform-specific code generators that transform runtime icon payloads into native components:

| File | Platform | Output |
|------|----------|--------|
| `react-adapter.ts` | React/TypeScript | `ContourIcon`-wrapping `.tsx` components with typed props |
| `swift-adapter.ts` | Swift (SwiftUI/UIKit) | `.swift` views with state enums, SVG path parsing |
| `flutter-adapter.ts` | Flutter/Dart | `StatefulWidget` classes with `CustomPainter`, `AnimatedSwitcher` |
| `downgrade-rules.ts` | All non-React | Platform-specific feature downgrade configs and rule application |
| `storybook-generator.ts` | React (Storybook) | `.stories.tsx` files with argTypes |
| `manifest-cleanup.ts` | All | Deterministic stale-file detection and manifest management |

Adapters are pure transforms (`Icon + RuntimeVariantPayload[] -> GeneratedFile[]`). They do not perform I/O; sync connectors in `lib/sync-service/connectors/` handle file writing. Each adapter checks platform capabilities via `checkPlatformCapabilities()` and applies downgrade rules for unsupported features (e.g., morph -> crossfade on Swift/Flutter, spring easing -> ease-in-out). The architecture boundary between adapters and connectors is documented in `docs/adapter-sync-boundary.md`.

### Runtime Consumption

The repository contains multiple runtime-focused layers:

- `lib/runtime-core/`: unified autoMorph (automatic strategy selection with intrinsic interpolation), transition resolution, easing, scheduling, morph interpolation, cross-icon morphing, topology detection, open-path guards, state-machine behavior, and cubic weight interpolation
- `lib/runtime-dom/`: DOM renderer/driver for runtime icons
- `lib/runtime-react/`: React wrapper components (`ContourIcon` with `forwardRef`), hooks (`useIconState`, `useAnimationProgress`), and imperative handle API
- `lib/runtime-sdk/`: compiled icon rendering primitives and renderer logic

These layers consume icon data after authoring/export rather than participating in editor state directly.

#### Morphing and Transition Pipeline

The runtime-core morphing pipeline resolves how icon state transitions are animated:

| Module | Responsibility |
|--------|---------------|
| `auto-morph.ts` | `autoMorph()` — unified entry point with automatic strategy cascade: identity → intrinsicStrict → bestGuess → pointSampled → fallback |
| `intrinsic-interpolation.ts` | Sederberg 1993 intrinsic interpolation: polar decomposition, angle-preserving lerp, handle decompose/reconstruct |
| `morph.ts` | `intrinsicStrictMorph()` (rotation-preserving same-command paths), `strictMorph()` (linear lerp legacy), `bestGuessMorph()` (normalized cubics), `attemptCrossIconMorph()` (cross-icon fallback) |
| `cross-icon-morph.ts` | Sub-path matching, De Casteljau subdivision, shape index optimization, rotational interpolation, winding normalization |
| `arc-to-cubic.ts` | SVG arc (A) → cubic bezier (C) conversion using pi/4 segment approximation |
| `open-path-guard.ts` | Draw animation eligibility: open-path detection, stroke validation, layer filtering |
| `path-normalization.ts` | Canonical path representation, geometry stats (subpath count, bbox, centroid), transform application |
| `topology-detection.ts` | Incompatibility detection (stroke→fill, subpath mismatch, closed/open), crossfade strategy selection |
| `transition-resolver.ts` | Orchestrates layer binding resolution; delegates to `autoMorph()` for `'auto'` strategy, falls back to legacy cascade for explicit strategies |

The default morph strategy is now `'auto'`, which delegates to `autoMorph()`. The automatic cascade is: identity (identical paths) → `intrinsicStrictMorph` (same command signature, Sederberg 1993 intrinsic interpolation that preserves edge lengths during rotation) → `bestGuessMorph` (normalized cubic alignment) → `crossIconMorph` (sub-path matching + subdivision) → fallback (crossfade). Explicit strategies (`strictMorph`, `bestGuessMorph`, `crossIconMorph`) remain available as overrides. Topology detection runs before binding resolution and overrides morph bindings to crossfade when topology is incompatible.

### Platform Boundary

Contour is a web-only application. Platform abstraction is minimal:

- `lib/platform/bridge.ts`: web-only environment abstraction
- `lib/platform/routes.ts`: route helpers
- `lib/platform/types.ts`: platform type definitions

### Registry Distribution Boundary

- `lib/sync-service/contracts.ts`: shared `SyncConnector` interface
- `lib/sync-service/connectors/npm-connector.ts`: npm-registry delivery connector
- `app/api/publish-npm/route.ts`: web-side secure publish proxy using
  a server-side `NPM_PUBLISH_TOKEN`
- `lib/sync-service/auto-publish.ts`: debounced auto-publish scheduler/cancel manager
- `lib/live-sync/publish-transport.ts`: real-time publish transport
- `lib/install-config/`: installation configuration for icon packages
- `packages/contour-cli/`: `@contour/cli` CLI for CI integration
- `components/export/PublishPanel.tsx`: Lane 1 live sync UI
- `components/export/ReleasePanel.tsx`: Lane 2 versioned release UI

## High-Level Data Flow

Authoring flow:

1. A project or workspace document is loaded through the editor store.
2. Editor components read state through `lib/editor-store/` selectors and hooks.
3. Editing actions call into store actions and `lib/editor-core/` utilities.
4. The editor renderer and overlay layers visualize current authored state.

Import/export flow:

1. SVG input is normalized into the schema through `lib/import/`.
2. Export modules serialize the current model into SVG, runtime JSON, or compiled artifacts.
3. Compile pipeline code writes deterministic files for downstream consumers.
4. Runtime layers render authored or compiled icon data outside the editor.

PR sync and post-merge build flow:

1. Editor exports canonical source files via `lib/sync-source/export-source-payload.ts`.
2. `lib/sync-service/sync-pr.ts` diffs, creates a branch, commits changed files, and opens a PR.
3. After merge, `scripts/compile-from-source.ts` reads source files from the repo.
4. `lib/sync-source/source-to-project.ts` reconstructs a `Project` via the adapter layer.
5. `lib/export/compile-pipeline.ts` compiles the project into the runtime package.

## Architectural Constraints

- Shared model first: editor, exports, and runtime-related code are anchored to the schema layer.
- Dual-document compatibility: legacy `Project` files and newer `Workspace` files must both remain readable.
- Deterministic outputs: compile and export code sorts and serializes data in stable ways for repeatable artifacts and tests.
- Web-only: all persistence via IndexedDB, all tokens via server-side env vars.
- Single source of truth for builds: see "Schema Boundaries" below.

## Schema Boundaries and Source of Truth

Three distinct schema layers exist. Each has a clear owner and must not be used as a substitute for another:

| Layer | Schema | Owner | Files |
|-------|--------|-------|-------|
| **Editor document** | `Project` / `Workspace` (`lib/schema/types.ts`) | Editor store | `.json` project files (editor-local, never committed to target repo) |
| **Canonical source export** | `IconSourceFile` / `SyncSourceManifest` (`lib/sync-source/types.ts`) | PR sync pipeline | `icons/<name>/icon.json`, `icons/<name>/preview.svg`, `manifest.json` |
| **Compiled runtime output** | `CompiledIcon` / `PackageManifest` (`lib/compiler-contracts/types.ts`) | Compile pipeline | `icons/*.compiled.json`, `icons.manifest.json`, `generated/*.tsx` |

**Post-merge builds use source export files exclusively.** The adapter in `lib/sync-source/source-to-project.ts` reconstructs a `Project` in memory for the compile pipeline. No project/workspace JSON is read from or persisted in the target repo.

Guardrails (`lib/sync-source/source-of-truth.ts`) enforce this at build time:
- `compile-from-source.ts` fails fast if a `project.json` exists alongside source export files.
- `compile-icons.ts` warns if source export files exist alongside the given project file.
- `validate-source-export.ts` checks for conflicting input sources before running any validation.

## Known Conflicts / Notes

- Some legacy docs under `docs/plans/` describe runtime/export work as future phases, but all phases are now shipped.
- The `desktop/` directory retains build artifacts but has no source code; it is no longer part of the active architecture.

## Sync Pipeline Known Limitations

The PR sync pipeline is designed for single-user-at-a-time icon publishing workflows. It is not a real-time collaboration system.

- **No concurrent editing:** Two users editing the same icon set will conflict on the second sync. The first sync to push wins; the second must re-export.
- **One commit per file:** The Contents API creates sequential commits. Large changesets produce many commits on the feature branch.
- **Heuristic remote conflict detection:** Remote icon changes are detected by file-count comparison, not content hashing. False positives are possible.
- **No automatic token refresh:** Short-lived tokens (GitHub App installation) must be rotated externally.
- **Orphan branches on partial failure:** If steps 8-10 fail, the branch created in step 7 remains. The error response includes the branch name for cleanup.

See `docs_canonical/SYNC_TROUBLESHOOTING.md` for the full troubleshooting guide and `README.md` for the operational runbook.
