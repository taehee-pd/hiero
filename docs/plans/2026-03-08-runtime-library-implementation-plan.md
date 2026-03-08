# Runtime Library Implementation Plan

## Goal

Turn the current editor-first repo into the source of truth for an animated icon system that can be exported directly into a target application codebase:

- editor authors icon states, transitions, and effects
- exporter materializes deterministic `runtime-json`
- target adapters generate host-ready files inside Storybook, Sanity, or other React repos
- optional package publishing remains available later, but is not the primary path

This plan reflects the external runtime-library architecture document, adjusted to match decisions already made in this repo:

- runtime-json is exported as self-contained per-variant payloads
- icon-level transitions and effects remain editor-authored, then are validated and materialized per variant at export time
- the current repo is a single Next.js application, so package extraction must be staged rather than assumed
- SF Symbols-style export semantics are prioritized ahead of a generic effects library
- target-codebase export is prioritized ahead of standalone package publishing

## Constraints From Current Repo

- The repo currently contains one application package with editor code under `app/`, `components/`, and `lib/`
- There is no workspace, package build pipeline, Storybook, generator CLI, or publish automation yet
- The editor schema already supports:
  - icon-level transitions/effects
  - variant-local states
  - token references
  - deterministic SVG export
- Existing tests cover editor, import, and SVG export behavior, but there is no runtime package test harness yet

That means the implementation sequence must begin with export and runtime primitives, not packaging or sync automation.

## Planning Decisions

### Runtime JSON Contract

Use the export contract defined in [2026-03-08-runtime-json-export-design.md](/Users/taehee/IconStudio/docs/plans/2026-03-08-runtime-json-export-design.md):

- `icons/index.json` for discovery
- `icons/<icon>/meta.json` for static icon metadata and variant manifest
- `icons/<icon>/v24.json` for one executable variant payload

This supersedes the external document's earlier "single `RuntimeIcon` object with global states" shape. The per-variant contract is a better fit for deterministic export and SF Symbols-style animation semantics.

### SF Symbols-Style Priority

Follow the direction captured in [2026-03-08-sf-symbols-style-export-plan.md](/Users/taehee/IconStudio/docs/plans/2026-03-08-sf-symbols-style-export-plan.md):

- Draw annotations come before generic effect presets
- Variable Draw is exported as semantic participation data, not as an inferred effect
- Magic Replace begins as enclosure-preserving continuity metadata, not as arbitrary global morphing
- gradients stay in runtime payloads rather than being flattened away

### Delivery Strategy

Do not optimize first for a standalone icon package.

Stage delivery like this:

1. implement the exporter and runtime modules inside the existing repo
2. generate files directly into a target codebase
3. prove the adapter flow against Storybook and Sanity-style targets
4. add standalone package generation only as an optional later output mode

This keeps the first production path aligned with how consuming teams actually review and ship code.

### Runtime Scope for MVP

The MVP runtime should support:

- static render from exported variant payload
- Draw On / Draw Off from exported guide-point annotations
- Variable Draw progress for participating layers
- Magic Replace continuity with preserved enclosures
- `replace` and `track` transitions
- one-shot and looping effects with additive layer transforms/opacities
- a React wrapper using `useSyncExternalStore`

It should explicitly defer:

- morphing
- flubber integration
- git sync and registry publish
- changesets/version automation
- IDE extensions and code mods

## Target Architecture

### Layer 1: Editor

Current responsibility:

- author icons, variants, states, transitions, and effects
- manage project schema and validation inputs

Required additions:

- runtime-json export action
- publish diagnostics for invalid runtime transitions
- eventually, connections/sync settings

### Layer 2: Exporter

Primary module:

- `lib/export/export-runtime-json.ts`

Responsibilities:

- resolve tokens
- normalize transforms
- strip editor-only metadata
- validate icon-level transitions against each variant
- emit deterministic runtime-json files and manifest

### Layer 3: Runtime Layer

Target package boundaries after extraction:

- `runtime-core`
- `runtime-dom`
- `runtime-react`

Near-term in-repo boundaries can begin as:

- `lib/runtime-core/`
- `lib/runtime-dom/`
- `lib/runtime-react/`

The runtime must consume exported files only, never raw editor project JSON.

### Layer 4: Target Adapters and Sync

Primary later-stage modules:

- `lib/export/generate-target-codebase.ts`
- `lib/export/targets/storybook-react.ts`
- `lib/export/targets/sanity-studio.ts`
- repo write/sync helpers

Optional later-stage modules:

- `packages/cli`
- generated npm package output

This is intentionally different from the earlier package-first framing because the target host repo is now the primary delivery artifact.

## Implementation Phases

### Phase R0 - Repo Preparation

Objective:

- create a stable runway for runtime work without overcommitting to a workspace split

Tasks:

- rename the root package from placeholder metadata to real project/package naming
- formalize the test runner setup that current tests already assume
- add runtime-specific script targets
- define a shared runtime types module for exported payloads

Deliverables:

- working test command
- documented runtime module layout
- runtime type exports that both editor and future runtime packages can consume

### Phase R1 - Runtime JSON Exporter

Objective:

- make the editor produce deterministic runtime artifacts before building the runtime

Tasks:

- implement `lib/export/export-runtime-json.ts`
- define `RuntimeIconManifest`, `RuntimeIconMeta`, `RuntimeVariantPayload`, and diagnostics types
- reuse existing SVG export normalization logic where possible
- export Draw annotations from guide points
- export Variable Draw participation metadata
- export Magic Replace continuity or preserved-enclosure metadata
- preserve gradient paint descriptors in runtime payloads
- materialize only valid transitions/effects per variant
- add deterministic serialization helpers
- expose an in-memory export API first

Tests:

- byte-stable output
- token resolution
- transform normalization
- invalid transition filtering
- manifest generation
- parity with static SVG styling for supported properties

Exit criteria:

- one sample project can export a complete runtime package in memory with no editor-only data

### Phase R2 - Runtime Core

Objective:

- build the state machine and frame scheduler against exported payloads

Tasks:

- implement `IconRuntime`
- add state transition lookup and fallback behavior
- execute Draw On / Draw Off from exported annotation metadata
- support Variable Draw progress on draw-capable layers
- support Magic Replace continuity with preserved enclosure layers
- support `replace` strategy with deterministic crossfade snapshots
- support `track` strategy for:
  - `opacity`
  - `rotate`
  - `translateX`
  - `translateY`
  - `scale`
  - `pathLength`
- add easing resolution for named easings and cubic-bezier strings
- implement effect playback state and compositing rules

Tests:

- state transition sequencing
- transition interruption behavior
- effect start/stop behavior
- snapshot output at frame checkpoints

Exit criteria:

- the runtime can drive a known icon through state changes without React or DOM dependencies

### Phase R3 - Runtime DOM Renderer

Objective:

- render runtime snapshots into real SVG efficiently

Tasks:

- implement `IconRenderer`
- map snapshot layers to `<path>` nodes
- update only changed attributes on animation frames
- support viewBox, size, opacity, transform, dash props, and currentColor-style overrides

Tests:

- mount/unmount lifecycle
- DOM attribute updates across transitions
- renderer stability under rapid state changes

Exit criteria:

- a small non-React demo can mount an exported icon and animate it in the browser

### Phase R4 - Runtime React Wrapper

Objective:

- provide the consumer-facing React API

Tasks:

- implement `<Icon />`
- implement `useIcon`
- subscribe via `useSyncExternalStore`
- support external prop-driven state/effect changes
- expose animation callbacks and accessibility props

Tests:

- prop change behavior
- state transition callbacks
- disabled animation mode
- controlled/uncontrolled usage edges

Exit criteria:

- the editor app or a demo page can render exported icons through the same React surface intended for target-codebase generation

### Phase R5 - Target Codebase Generation

Objective:

- generate host-ready source files directly into target repositories from exported runtime-json

Tasks:

- add target adapter generation entrypoints
- generate vendored runtime helpers for host repos
- generate typed icon data files and React wrappers
- generate Storybook stories where applicable
- generate Sanity preview/registry helpers where applicable
- add stale-file cleanup and deterministic file manifesting

Exit criteria:

- sample exported icons can be written into a local Storybook or Sanity-style repo with runnable generated files

### Phase R6 - Repo Sync and Host Integration

Objective:

- connect target-codebase generation to real repo write and review flows

Tasks:

- add target export config to the project schema
- add local directory export flow
- add branch/commit automation against the target repo
- add host-repo validation hooks and generated-file summaries

Exit criteria:

- exporting from the editor can update a checked-out target repo in a reviewable way

### Phase R7 - Optional Package Mode

Objective:

- add standalone package generation for teams that want a reusable library after the direct-export flow is already working

Tasks:

- extract stable runtime pieces into package boundaries if useful
- add generator CLI packaging mode
- add package export maps and publish metadata
- optionally add registry publish flow

Exit criteria:

- the same runtime-json source can produce either direct target-codebase output or package output

### Phase R8 - Morphing and Advanced Animation

Objective:

- add topology-aware morphing after the core runtime is already shipping

Tasks:

- implement strict/best-guess morph execution
- integrate a path interpolator only if native logic is insufficient
- compute and validate topology contracts in the editor
- define fallback to `replace` when morph validity is missing

Exit criteria:

- complex icon transitions can morph predictably without weakening the export contract

## Recommended Execution Order

Build in this order:

1. R0 repo preparation
2. R1 runtime-json exporter with Draw, Variable Draw, Magic Replace continuity, and gradients
3. R2 runtime-core
4. R3 runtime-dom
5. R4 runtime-react
6. R5 target-codebase generation
7. R6 repo sync and host integration
8. R7 optional package mode
9. R8 morphing

This differs from the earlier package-first framing by moving direct target-codebase output ahead of package generation. That is deliberate and matches the requested delivery model.

## First Concrete Milestone

The first milestone worth coding toward is:

- exported runtime-json for one icon
- runtime-core can load it with Draw-capable metadata
- runtime-dom can animate `replace` and `track`
- runtime-react renders a demo icon in this app

Use one reference icon pair for validation:

- a hamburger/close icon pair with multiple layers and at least one track-based transition

If this milestone works cleanly, the rest of the system boundaries are likely correct.

## Open Technical Decisions

These should be resolved during implementation, not before:

- whether clip-path support belongs in runtime-json v1 or is deferred
- whether runtime layer ordering alone is sufficient for all z-order cases
- whether effect composition should be additive-only or allow effect-specific property ownership
- whether generated icon entrypoints should ship raw JSON, typed TS objects, or both
- whether versioning should use Changesets only rather than deriving versions from editor timestamps

None of these block R1 through R4.

## Non-Goals for the First Pass

- direct npm publish from the editor
- GitHub/GitLab integration UI
- Storybook as a hard dependency
- schema migration code generators
- consumer IDE extensions

Those belong after the runtime contract and rendering path are stable.
