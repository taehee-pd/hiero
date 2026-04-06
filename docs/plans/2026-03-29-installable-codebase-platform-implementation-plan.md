---
status: proposed
last-reviewed: 2026-03-29
---

# Installable Codebase Platform Implementation Plan

Date: 2026-03-29

## Outcome

Ship Contour as an installable, repo-local platform that teams can add to their existing codebase and use to import icons from Figma, make Contour the source of truth, and publish directly into the current React codebase.

## Phase 0: Lock the product contract

### Deliverables

- Approve the repo-installed product model
- Approve the storage contract:
  - committed canonical source in `contour/`
  - gitignored local drafts in `.contour/local/`
  - disposable live build cache in `.contour/cache/`
  - generated outputs in host-specific directories for snapshot mode
- Approve package names and config shape
- Approve the abstraction split between `HostTarget` and `ReleaseTarget`
- Approve removal of `project.syncTargets` without backward compatibility work
- Approve the model shift away from per-icon multi-state authoring

### Notes

This phase matters because package boundaries and storage shape will cascade through the rest of the work.

## Phase 1: Introduce install config and repo identity

### Work

- Create `contour.config.ts` schema and loader
- Add repo identity resolution so local cache and editor sessions can bind to the current host repo
- Add validation errors for missing or invalid target directories
- Remove `project.syncTargets` from the product plan instead of migrating it

### Suggested modules

- `lib/install-config/types.ts`
- `lib/install-config/load-config.ts`
- `lib/install-config/validate-config.ts`

### Exit criteria

- CLI and app can resolve one canonical config file
- repo-level config, not project-local sync state, defines publish behavior

## Phase 2: Separate shared source from local working state

### Work

- Formalize the committed source directory contract around existing `lib/sync-source/`
- Add a repo-local draft persistence adapter for `.contour/local/`
- Keep IndexedDB as a browser cache mirror, not authoritative storage
- Add recovery and dirty-state reconciliation on app launch
- ensure local drafts do not reintroduce per-icon multi-state assumptions

### Suggested modules

- `lib/persistence/repo-draft-adapter.ts`
- `lib/persistence/indexeddb-mirror.ts`
- `lib/persistence/reconcile-source-and-draft.ts`

### Exit criteria

- user can crash or refresh without losing draft work
- user can always rebuild generated outputs from `contour/` alone

## Phase 3: Build the CLI shell

### Work

- Create `contour init`
- Create `contour dev`
- Create `contour watch`
- Create `contour codegen`
- Create `contour validate`
- Create `contour sync`

### Command behavior

- `init` writes config, ignore rules, and starter directories
- `dev` launches the existing app in repo-aware mode
- `watch` incrementally compiles canonical source into live runtime cache and emits host invalidation events
- `codegen` reads canonical source and writes deterministic snapshot outputs
- `validate` runs source and config checks for CI
- `sync` performs filesystem or git-based delivery actions

### Suggested package

- `packages/contour-cli`

### Exit criteria

- a fresh repo can install and bootstrap Contour without manual file scaffolding

## Phase 4: Reshape the product model and extract reusable boundaries

### Work

- Remove per-icon multi-state authoring from the product model
- Keep only size and style variants, for example fill vs outline, inside an icon
- Move animation ownership to runtime icon-to-icon transitions
- Research major icon transition patterns worth supporting in v1
- Design and validate the right runtime algorithms for:
  - line start / line end style animations
  - icon-to-icon morphing
  - fallback replace / crossfade behavior when morphing is not valid
- Extract schema, source export, export adapters, runtime helpers, and validation into publishable packages
- Keep the existing app consuming those packages internally
- Minimize app-only imports from reusable layers

### Suggested package split

- `packages/contour-core`
- `packages/contour-runtime-react`
- `packages/contour-cli`

### Key refactor rule

Do not rewrite working logic. Move and stabilize boundaries around the modules already defined in `docs_canonical/ARCHITECTURE.md`.

### Exit criteria

- CLI and app both use the same published-or-publishable library boundaries
- the v1 product model no longer depends on per-icon multi-state authoring
- runtime transition research is explicit, not hand-waved

## Phase 5: Ship the direct React publish path

### Work

- Implement direct publish into the current React codebase
- Make changed-icon-only rebuilds and changed-output-only publish the default path
- Keep snapshot codegen and sync as explicit release actions
- Add generated file cleanup and manifest ownership rules for snapshot mode
- Remove old sync-target product behavior rather than carrying compatibility

### Suggested modules

- `lib/generated-files/ownership.ts`
- `lib/install-config/*`
- `lib/sync-source/*`
- `lib/export/*`
- `lib/runtime-core/*`

### Exit criteria

- Contour publishes directly into the current React codebase
- changed-icon-only work is the default path
- no product behavior depends on legacy `syncTargets`

## Phase 6: Add optional live watch after the publish loop is solid

### Work

- add optional watch mode only after direct publish is stable
- keep reference app exploration out of the product surface
- define a later exploration track for Storybook deploy strategy as a reference app, not a target

### Exit criteria

- optional watch mode exists without becoming the core product contract

## Phase 7: Explore reference environments and later integrations

### Work

- explore Storybook deploy strategy as a reference app
- evaluate whether Sanity deserves a later integration path
- keep both outside the v1 product boundary unless a real user need forces them in

### Exit criteria

- reference environments exist only as proof points, not as first-class product targets

## Phase 8: Add embedded host mode

### Work

- expose the editor shell as an embeddable route or component package
- support opening Contour within a host app for teams that want a Sanity-like integrated UI
- keep `contour dev` as the fallback for environments where embedding is costly

### Important rule

This is phase 8 because embedding is product polish, not the shortest path to installable adoption.

### Exit criteria

- at least one reference host can mount the Contour editor in-process

## Phase 9: CI, migration, and docs

### Work

- add `contour validate` to CI examples
- document repo install guides for generic React design-system repos
- document Storybook only as a reference app strategy if explored later
- add migration docs from standalone and npm-publish-first workflows
- document cache cleanup, recovery, and generated-file ownership
- document the new icon model clearly: variants stay, per-icon states are gone, transitions are runtime icon-to-icon concerns

### Exit criteria

- teams can adopt the tool without reading source code

## Testing Strategy

### Contract tests

- config loading and validation
- canonical source roundtrip
- draft cache reconciliation
- target adapter file outputs
- stale generated file cleanup
- schema rejects or stops depending on per-icon multi-state assumptions
- runtime icon-to-icon transition resolution covers morph, line animation, and fallback cases

### Integration tests

- fixture generic React design-system repo install
- local codegen against source export fixtures
- direct publish only rewrites changed icons and changed outputs

### End-to-end checks

- `contour init` on empty fixture repos
- `contour dev` launches against repo config
- `contour codegen` produces stable outputs
- `contour validate` passes in CI-mode fixtures
- Figma ingress to direct React publish works without manual SVG-to-code labor

## Recommended implementation order

1. config contract
2. local draft persistence
3. CLI bootstrap
4. product model cleanup, remove per-icon state assumptions
5. transition algorithm research and runtime contract
6. direct React codebase path
7. optional watch mode
8. snapshot/release sync cleanup
9. reference environment exploration
10. embedded mode

## Risks and mitigations

### Risk: package extraction creates churn

Mitigation:

- extract along existing architecture seams
- preserve app imports through thin compatibility barrels during transition

### Risk: local drafts drift from committed source

Mitigation:

- draft reconciliation on launch
- explicit "save to source" boundary
- generated outputs always built from canonical source, not raw draft state

### Risk: old multi-state assumptions remain buried in schema, editor, or export code

Mitigation:

- remove the old model explicitly instead of layering over it
- rewrite affected specs and tests to the new icon/variant/transition model
- do not preserve backward compatibility for unused product concepts

### Risk: runtime morphing quality is hand-waved and fails on real icon sets

Mitigation:

- research the major transition shapes before implementation
- define fallback behavior when morphing is geometrically invalid
- treat line animation and icon morphing as first-class runtime design work, not polish

### Risk: live update layer becomes reference-app-specific spaghetti

Mitigation:

- define one watcher contract and one host invalidation contract
- keep any future reference environments outside the v1 product surface

### Risk: HMR is fast in dev but CI/release outputs diverge

Mitigation:

- build live cache and snapshot outputs from the same canonical source
- add snapshot equivalence tests for live and release compilation paths

### Risk: current sync-target UI/model becomes dead weight during transition

Mitigation:

- keep compatibility reads for one release window
- add an explicit migration path in config loading
- only remove `SyncTarget`-first UI after live host targets are functional

### Risk: generated files clash with hand-written host code

Mitigation:

- generated directory ownership rules
- file banners
- stale-file manifest cleanup
- narrow, explicit adapter output paths

### Risk: reference apps distort the core product

Mitigation:

- keep the core product focused on repo-native React codebase publishing
- treat Storybook deployment as a proving ground, not a contract

## Definition of done for the initiative

This initiative is done when:

- a user installs Contour into an existing repo with one command
- shared icon source lives in Git under `contour/`
- local drafts survive refreshes and crashes without becoming the source of truth
- direct React codebase publishing works without Storybook-specific behavior
- runtime icon-to-icon transition behavior is part of the first-class product, not deferred
- sync targets are optional release channels, not required for basic app feedback
- CI can validate source and generated outputs deterministically

## Assumptions

- We are optimizing for installable adoption before real-time collaboration.
- Filesystem-first workflow is the desired default even when web hosting is available.
- The current standalone app remains valuable as the shell behind `contour dev`.
