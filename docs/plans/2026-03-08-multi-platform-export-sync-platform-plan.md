---
status: partially-implemented
last-reviewed: 2026-03-18
---

# Multi-Platform Export Sync Platform Plan

## Goal

Turn Cuneiform into a platform that can export and sync icon systems into multiple application ecosystems from one authoring source:

- React codebases
- Swift / SwiftUI apps
- Flutter apps

The editor remains the authoring system. The platform layer is responsible for translating one canonical icon contract into ecosystem-specific outputs and syncing them into downstream repos safely.

## Core Decision

Do not design the system around one delivery target such as:

- an npm package
- a Storybook repo
- a Sanity repo

Those are only adapters.

The correct large-picture architecture is:

Editor -> Canonical Export IR -> Platform Adapter -> Sync Connector -> Target Repository / Package / App

That gives you one stable authoring model and many delivery modes.

## Platform Model

The platform should have five layers:

1. Editor authoring model
2. Canonical export IR
3. Capability model
4. Platform adapters
5. Sync connectors

### 1. Editor authoring model

Owns:

- geometry
- states
- transitions
- effects
- SF Symbols-style semantics such as Draw and continuity metadata

This remains product-facing and editor-specific.

### 2. Canonical export IR

Owns:

- deterministic runtime-json
- static SVG fallback data
- semantic animation metadata
- diagnostics about what can and cannot be exported

This is the stable contract between the editor and every downstream adapter.

### 3. Capability model

Owns:

- what each target ecosystem can render natively
- what it can emulate
- what it cannot support
- what must be downgraded during export

Without a capability layer, the platform will either over-promise or fork the editor model per target.

### 4. Platform adapters

Own:

- transforming canonical IR into target-native code/assets
- generating runtime helpers where necessary
- shaping outputs to match the target repo conventions

Examples:

- React adapter
- Swift adapter
- Flutter adapter

### 5. Sync connectors

Own:

- writing files into local repos
- opening branches and commits
- creating PRs
- publishing packages when needed
- summarizing diffs and diagnostics

This separates export logic from transport and repo automation.

## Canonical IR Direction

The canonical IR should remain the internal source format for all delivery modes.

Use the existing deterministic runtime-json direction as the base:

- `index.json`
- `meta.json`
- per-variant payloads

Then expand it only where cross-platform export actually needs more semantic precision:

- Draw annotations
- Variable Draw participation
- continuity / preserved enclosure metadata
- gradient paint descriptors
- export diagnostics

The IR should not be React-specific, Swift-specific, or Flutter-specific.

## Capability Model

Add an explicit target capability model.

```ts
type TargetPlatform =
  | 'react'
  | 'swiftui'
  | 'flutter';

type ExportCapability = {
  draw: 'native' | 'emulated' | 'unsupported';
  variableDraw: 'native' | 'emulated' | 'unsupported';
  magicReplace: 'native' | 'emulated' | 'unsupported';
  gradients: 'native' | 'emulated' | 'unsupported';
  pathMorph: 'native' | 'emulated' | 'unsupported';
  runtimeEffects: 'native' | 'emulated' | 'unsupported';
};
```

Why this matters:

- React can likely support most features through vendored runtime helpers.
- Swift may map some semantics into native symbol-style APIs and others into custom rendering.
- Flutter may need a fully generated runtime implementation for some effects.

The platform should export with explicit downgrade rules, not silent feature loss.

## Adapter Families

### React adapter family

Targets:

- app repos
- design-system repos
- Storybook repos
- CMS/admin repos using React

Outputs:

- generated TS icon data
- generated React components
- vendored or imported runtime helpers
- optional stories, registries, preview helpers

This should be the first adapter family because the current repo is already TypeScript/React-based.

### Swift adapter family

Targets:

- SwiftUI apps
- UIKit-based apps
- Apple-platform design system repos

Possible outputs:

- generated Swift structs or enums for icon registry
- SVG/path asset bundles where appropriate
- generated animation descriptors
- a small runtime package in Swift for exported semantics that do not map directly to native APIs

Important planning rule:

Do not assume all editor semantics map 1:1 to native SF Symbols APIs. The adapter must choose:

- native mapping when possible
- generated runtime execution when necessary
- downgrade with diagnostics when unsupported

### Flutter adapter family

Targets:

- Flutter apps
- shared design system packages

Possible outputs:

- generated Dart icon data files
- generated widget wrappers
- a small Flutter runtime/render layer for animation semantics

Same rule:

- native where possible
- generated runtime where needed
- explicit downgrade diagnostics when not possible

## Delivery Modes

Each adapter family should support multiple delivery modes.

```ts
type DeliveryMode =
  | 'local-codegen'
  | 'repo-sync'
  | 'package'
  | 'asset-bundle';
```

Examples:

- React + local-codegen into a design-system repo
- React + repo-sync via PR automation
- Swift + asset-bundle into an iOS app repo
- Flutter + package output into an internal Dart package

This keeps platform and transport concerns separate.

## Sync Connector Model

Connectors should be independent from adapters.

```ts
type SyncConnector =
  | 'local-filesystem'
  | 'git-repo'
  | 'package-registry';
```

Recommended first implementation order:

1. local filesystem sync
2. git repo branch/commit/PR sync
3. package registry publishing

That sequence lowers risk and keeps debugging local first.

## Export Outcomes

Every export should produce a structured outcome:

```ts
type ExportOutcome = {
  targetPlatform: TargetPlatform;
  deliveryMode: DeliveryMode;
  writtenFiles: string[];
  removedFiles: string[];
  warnings: string[];
  downgrades: Array<{
    feature: string;
    reason: string;
    affectedIcons: string[];
  }>;
};
```

This is critical for multi-platform trust. Users need to know what exported cleanly and what was degraded.

## Planning Priorities

### Priority 1: Canonical IR quality

Before expanding adapters, make the IR and diagnostics correct.

### Priority 2: React adapter family

Use React as the proving ground because:

- the repo already runs there
- the runtime will be easiest to validate
- Storybook/Sanity/custom React repos all fall under one family

### Priority 3: Platform capability system

Add explicit downgrade and compatibility rules before Swift/Flutter work starts.

### Priority 4: Swift and Flutter design spikes

Do short adapter-design spikes before heavy implementation:

- what maps natively
- what needs a generated runtime
- what should be out of scope for v1

### Priority 5: Sync automation

Only after local codegen works cleanly should the platform automate repo sync and publishing.

## Recommended Roadmap

### Phase P0 - Platform foundations

- formalize canonical IR types
- formalize export diagnostics
- formalize target capability types
- separate adapter logic from sync logic

### Phase P1 - React platform family

- implement local codegen for generic React apps
- then add Storybook-specific and CMS-specific helper outputs as optional sub-adapters
- validate SF Symbols-style semantics through the React runtime

### Phase P2 - Sync connectors

- local filesystem writer
- git branch/commit/PR flow
- generated diff summaries

### Phase P3 - Swift adapter design and prototype

- capability mapping study
- minimal generated output proof
- decide native-vs-custom runtime boundary

### Phase P4 - Flutter adapter design and prototype

- capability mapping study
- minimal generated output proof
- decide native-vs-custom runtime boundary

### Phase P5 - Package and asset distribution modes

- optional npm/package output for React
- optional Swift package output
- optional Dart package output
- asset bundle mode where runtime code is not desired

## What This Means For Current Plans

The earlier target-codebase plan is still useful, but only as one slice of the React adapter family.

Storybook and Sanity should be reframed as:

- examples of React-host integrations
- not the primary architecture

The primary architecture is now:

- one canonical export platform
- many adapter families
- many sync modes

## Immediate Next Steps

1. keep strengthening `runtime-json` as the canonical IR
2. define `TargetPlatform`, `DeliveryMode`, `ExportCapability`, and `ExportOutcome` types
3. build one generic React adapter first, not a Storybook-only adapter
4. make Storybook/Sanity thin host integrations on top of that React adapter
5. design Swift and Flutter adapter boundaries before committing to implementation details
