---
status: proposed
last-reviewed: 2026-03-29
---

# Installable Codebase Platform Design

Date: 2026-03-29

## Goal

Make Hiero adoptable as a repo-native icon authoring system: a team installs it into an existing codebase, runs a repo-local authoring workflow, and commits canonical icon source plus code-facing outputs back into that same repository.

The key shift is from "Hiero as a standalone destination app that publishes outward" to "Hiero as a local control plane for icon authoring inside the host repo."

The product model also changes:

- Hiero should not model one icon as many authored states
- each icon keeps only meaningful variants, such as size and fill vs outline style
- animation becomes a runtime concern centered on icon-to-icon transitions

## Problem Framing

The current architecture already has the hard parts for this move:

- a canonical authoring model in `lib/schema/`
- deterministic source export in `lib/sync-source/`
- platform adapters in `lib/export/adapters/`
- connectors for local directory sync, git PR sync, and npm publish

What it does not yet have is an installable product boundary for downstream teams. Today Hiero is primarily "the app." For repo-native adoption, it needs to become:

- a repo-installed CLI and config model
- a repo-local storage and codegen contract
- a small set of installable host integrations
- an editor that can target the current repository as the default source of truth

## Approaches

### 1. Full cloud workspace with thin repo export

Users author in a hosted or standalone app. The host repo only receives exported files.

Pros:

- lowest change to the current app shell
- easiest central account model

Cons:

- feels unlike the repo-native tools teams already trust
- introduces remote-state drift against the host repo
- weaker PR ergonomics and offline workflows

### 2. Fully embedded host-app UI first

The editor becomes a component/plugin mounted directly inside every host app from day one.

Pros:

- strongest "native inside the codebase" feeling
- great for deeply integrated workflows

Cons:

- highest compatibility burden across many host stacks too early
- forces routing/auth/build concerns too early
- much slower path to adoption

### 3. Recommended: repo-local control plane with installable integrations

Users install Hiero packages into their repo, commit a repo config, and run a local Hiero workflow against that repo. The full editor can launch as a repo-aware dev surface first, with optional embedded host integrations later.

Pros:

- matches the "installed into your repo" mental model
- keeps Git as the team source of truth
- reuses the existing source export and adapter architecture
- supports both local-only and PR-driven workflows

Cons:

- requires packaging and boundary extraction work
- needs careful separation between local working state and committed source

## Recommended Product Model

Hiero should become a three-layer installable platform:

1. `@hiero/cli`
   Bootstraps config, launches the repo-local editor, validates source, runs codegen, runs a live watcher, and performs release sync when needed.
2. `@hiero/core` family
   Reuses the existing schema, sync-source, export adapters, validation, and runtime logic as publishable library boundaries.
3. Host codebase integration
   A generic React/Next codebase integration surface that lets Hiero operate directly against the current repo.

The editor remains a first-party surface, but its default mode becomes "opened for this repo" instead of "opened as an isolated app."

## Live-First Integration Model

The current `Local / GitHub / npm` model should no longer be the primary authoring path.

Instead, Hiero should use two separate lanes:

### 1. Live integration lane

This is the default during authoring.

Flow:

1. user edits an icon in Hiero
2. Hiero saves canonical source into `hiero/`
3. a local watcher incrementally recompiles only the changed icons
4. the host app integration invalidates its module graph
5. the host app or optional reference environment reflects the change immediately

This is the behavior users expect from tools like Sanity.

### 2. Release sync lane

This is optional and used for:

- pushing changes to another repo
- publishing a package
- creating a review PR
- generating a frozen snapshot for CI or release builds

In other words:

- `live` is for feedback
- `sync` is for transport and release

## Product Contract Change

`SyncTarget` should stop being the main abstraction for host integration.

The new top-level model should distinguish:

- `HostTarget`: where the app reflects changes live during development
- `ReleaseTarget`: where artifacts are pushed or published for review and deployment

Recommended shape:

```ts
type HostTarget = {
  kind: 'react-app' | 'reference-app';
  mode: 'live';
  sourceDir: string;
  runtimeMode: 'in-memory' | 'cache-dir' | 'vendored';
};

type ReleaseTarget = {
  kind: 'local-directory' | 'git-pr' | 'npm-registry';
  sourceDir: string;
  outputMode: 'snapshot';
};
```

This keeps live feedback separate from packaging and transport.

## Data Storage Strategy

### Storage principles

- Team-shared state must be file-based and Git-friendly.
- Local working state may be cached, but it must never be the only durable source.
- Secrets must remain outside the repo.
- Generated outputs must be reproducible from committed canonical source.

### Recommended storage layers

#### 1. Team source of truth: committed canonical source

Keep the existing source-export model and make it the installable default:

- `hiero/icons/<icon-name>/icon.json`
- `hiero/icons/<icon-name>/preview.svg`
- `hiero/manifest.json`

This layer should be the shared durable artifact in the host repo. It is already aligned with `lib/sync-source/` and should remain the only input to code generation and CI validation.

#### 2. Repo configuration: committed install config

Add a committed root config file:

```ts
// hiero.config.ts
export default {
  sourceDir: 'hiero',
  hostTargets: [
    {
      kind: 'react-app',
      mode: 'live',
      runtimeMode: 'cache-dir',
      cacheDir: '.hiero/cache/app',
    },
  ],
  releaseTargets: [
    {
      kind: 'local-directory',
      outputMode: 'snapshot',
      outputDir: 'src/icons/generated',
    },
  ],
};
```

This file is the contract between the editor, CLI, codegen, and CI.

The important point is that live host wiring and release delivery are configured separately.

#### 3. Developer-local working state: uncommitted cache

Use a repo-local but gitignored working directory for autosave, recovery, and view state:

- `.hiero/local/workspace.json`
- `.hiero/local/recovery/*.json`
- `.hiero/local/session.json`

This stores the richer authoring `Workspace` document, unsaved drafts, open tabs, pane state, and crash recovery snapshots. It improves UX without competing with the committed source export.

On web-only launches where direct file access is unavailable, IndexedDB remains a mirror cache keyed by repo identity, but the user should still save back to `hiero/` through the CLI or host bridge.

#### 4. Generated delivery outputs: reproducible build artifacts

Write deterministic outputs into configured host directories, for example:

- `src/icons/generated/data/*`
- `src/icons/generated/components/*`
- `src/icons/generated/index.ts`
- `src/icons/generated/stories/*.stories.tsx`
- `sanity/lib/hiero/*`

These may be committed or ignored per team policy, but they must always be derivable from the canonical source layer.

For live integration, Hiero should also own a local build cache:

- `.hiero/cache/runtime/*`
- `.hiero/cache/generated/*`

This cache is disposable and should be used for incremental rebuilds and hot module invalidation, not as team-shared state.

#### 5. Secrets: never in repo state

Continue the current security posture:

- desktop tokens in OS keychain
- web/server tokens in env vars only
- no secrets in `Workspace`, `Project`, canonical source, or generated files

## Why file-based storage is the right default

For an installable tool, a database-first model adds the wrong coupling:

- makes Git diffs less meaningful
- complicates branch workflows
- introduces schema migration and local daemon requirements
- weakens offline and PR review ergonomics

Hiero should be local-first and Git-first. IndexedDB and desktop autosave are helpful caches, not authoritative storage.

## Authoring Model Shift

The current product has a per-icon multi-state model. The reviewed direction rejects that for the installable product.

v1 should instead use:

- icons as atomic authored units
- variants for size and style families only
- runtime icon-to-icon transitions for animation behavior

This means SF Symbols-inspired animation remains central, but it should be expressed as runtime transitions between icons, not as many states living inside one icon document.

## Runtime Transition Strategy

Animation remains a first-class product capability.

v1 should explicitly include runtime work for:

- line start / line end style path animations
- icon-to-icon morphing
- fallback replace or crossfade behavior when morphing is geometrically invalid

The plan should include research into the major icon transition patterns Hiero wants to support, followed by selection or design of the right algorithms for each category.

This should not be treated as polish. It is part of the product identity.

## Host Integration Strategy

### Generic React / Next / Design System repos

This is the actual first-class install surface.

Storybook and Sanity are references for methodology and future exploration, not export targets or required v1 integrations.

The install flow should provide:

- a repo-installed Hiero CLI/editor
- direct publish into the current React codebase
- deterministic code-facing outputs from canonical source
- room for later reference apps or deployment examples without making them product features

## Runtime Delivery Strategy

For installability, the default should be `live local runtime` first, `vendored snapshot` second, and package dependency third.

### Default: local live runtime

During development, the host app should not wait for manual sync.

Recommended behavior:

- Hiero writes canonical source on save
- `hiero watch` incrementally compiles a runtime-friendly cache
- the host integration plugin exposes a stable import such as a registry module
- file changes invalidate the host bundler and trigger HMR

This gives Sanity-like immediate reflection while keeping canonical source file-based.

### Secondary: vendored runtime helpers

Hiero writes a small runtime layer into the host repo, for example:

- `src/icons/generated/runtime/*`

Why this should be the default:

- one install, one PR, one review unit
- no extra registry setup during adoption
- easier rollback and debugging

### Optional: package-backed runtime

Once adoption is stable, teams can switch to:

- `runtimeMode: 'package'`

That mode imports helpers from a published `@hiero/runtime-react` package to reduce duplication.

## Implementation Boundary Changes

The current app should be split conceptually into:

- editor app surface
- reusable library packages
- install-time CLI and host adapters

Recommended package boundaries:

- `packages/hiero-cli`
- `packages/hiero-core`
- `packages/hiero-runtime-react`

The existing `lib/` modules are already close to these boundaries. The work is primarily extraction, packaging, and contract hardening rather than invention.

## Developer Workflow

Recommended day-to-day flow:

1. install Hiero into the host repo
2. run `hiero init`
3. commit `hiero.config.ts`
4. run `hiero dev` and `hiero watch` to open the repo-aware editor and live host bridge
5. author icons
6. save to canonical source in `hiero/`
7. see the host app or chosen reference environment update through the repo-native loop
8. run `hiero codegen` only when a snapshot or release artifact is needed
9. use release sync for PRs, package publish, or external repo updates

This is the closest match to how repo-native installable tools feel in practice.

## Migration Rule

The existing standalone app should not disappear. It should become:

- the internal development shell
- the desktop shell
- the basis for `hiero dev`

That lets Hiero keep shipping as a product while changing its adoption model.

## Success Criteria

This design is successful when a team can:

- add Hiero to an existing repo in under 15 minutes
- store shared icon source in Git without external infrastructure
- generate deterministic code-facing outputs directly into the host repo
- review icon changes and consuming code changes in one PR
- recover local drafts without making local cache the source of truth

## Assumptions

- The installable model is more important than multi-user real-time collaboration in the next phase.
- Storybook and Sanity are methodology references, not required product targets.
- File-based canonical source remains the strongest long-term fit for the current Hiero architecture.
