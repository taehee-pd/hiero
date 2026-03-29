---
status: ready-for-implementation
last-reviewed: 2026-03-29
---

# Runtime Transition Rewrite Implementation Prompt

Use this prompt when implementing the reviewed Coniva product-model rewrite.

## Mission

Implement the reviewed v1 product direction for Coniva:

- Figma is ingress only
- Coniva becomes the source of truth inside the repo
- install behavior is defined at repo root via `coniva.config.ts`
- publish goes directly into the current React codebase
- Storybook is reference-only and must not become a product target
- backward compatibility is not required
- per-icon multi-state authoring must be removed
- icons keep intrinsic variants only, such as size and style
- animation becomes a runtime-owned icon-to-icon transition concern

## Specs changed in this session

These are the spec documents that were rewritten or added during this session and should be treated as the newest reviewed direction:

- [install-config.md](/Users/taehee/IconStudio/specs/schema/install-config.md)
- [repo-native-distribution.md](/Users/taehee/IconStudio/specs/export/repo-native-distribution.md)
- [repo-native-workflow.md](/Users/taehee/IconStudio/specs/ui/repo-native-workflow.md)
- [icon-schema.md](/Users/taehee/IconStudio/specs/schema/icon-schema.md)
- [transition-schema.md](/Users/taehee/IconStudio/specs/schema/transition-schema.md)
- [editor-store.md](/Users/taehee/IconStudio/specs/editor/editor-store.md)
- [cross-icon-transitions.md](/Users/taehee/IconStudio/specs/editor/cross-icon-transitions.md)
- [animation-tab.md](/Users/taehee/IconStudio/specs/editor/animation-tab.md)
- [inspect-tab.md](/Users/taehee/IconStudio/specs/editor/inspect-tab.md)
- [transition-resolver.md](/Users/taehee/IconStudio/specs/runtime/transition-resolver.md)
- [runtime-json-format.md](/Users/taehee/IconStudio/specs/export/runtime-json-format.md)
- [lottie-export.md](/Users/taehee/IconStudio/specs/export/lottie-export.md)
- [README.md](/Users/taehee/IconStudio/specs/README.md)

## Required reading

Read these files first and treat them as the source of truth for this implementation:

- [DESIGN.md](/Users/taehee/IconStudio/docs_canonical/DESIGN.md)
- [TASKS.md](/Users/taehee/IconStudio/docs_canonical/TASKS.md)
- [ARCHITECTURE.md](/Users/taehee/IconStudio/docs_canonical/ARCHITECTURE.md)
- [2026-03-29-installable-codebase-platform-design.md](/Users/taehee/IconStudio/docs/plans/2026-03-29-installable-codebase-platform-design.md)
- [2026-03-29-installable-codebase-platform-implementation-plan.md](/Users/taehee/IconStudio/docs/plans/2026-03-29-installable-codebase-platform-implementation-plan.md)
- [2026-03-29-installable-codebase-platform-verification.md](/Users/taehee/IconStudio/docs/plans/2026-03-29-installable-codebase-platform-verification.md)
- [taehee-codex-sync-repo-and-implement-tasks-design-20260329-142247.md](/Users/taehee/.gstack/projects/taehee-pd-icon-authoring-tool/taehee-codex-sync-repo-and-implement-tasks-design-20260329-142247.md)

Then read the updated spec-kit files listed in `Specs changed in this session`.

## Hard constraints

- Do not preserve `project.syncTargets` or related compatibility code unless needed purely as a temporary refactor step inside one PR.
- Do not ship or plan `export to Storybook`.
- Do not keep authored `defaultState`, `states`, or state-to-state transitions as product concepts.
- Do not reintroduce local database truth; canonical source stays file-based in the repo.
- Treat transition choice as a runtime concern.
- Keep changed-icon-only rebuilds and changed-output-only publish as the default path.

## Primary code surfaces to change

### Schema and source model

- [types.ts](/Users/taehee/IconStudio/lib/schema/types.ts)
- [workspace.ts](/Users/taehee/IconStudio/lib/schema/workspace.ts)
- [variant-derivation.ts](/Users/taehee/IconStudio/lib/schema/variant-derivation.ts)

Implementation goal:

- remove `Variant.defaultState`
- remove `Variant.states`
- remove authored state-centric transition assumptions
- keep icon variants for size and style families
- reshape `Icon.transitions` so it supports runtime icon-to-icon transition intent instead of per-icon state graphs

### Editor store and editor UI

- [store.ts](/Users/taehee/IconStudio/lib/editor-store/store.ts)
- [types.ts](/Users/taehee/IconStudio/lib/editor-store/types.ts)
- [selectors.ts](/Users/taehee/IconStudio/lib/editor-store/selectors.ts)
- [hooks.ts](/Users/taehee/IconStudio/lib/editor-store/hooks.ts)
- [InspectorPanel.tsx](/Users/taehee/IconStudio/components/editor/InspectorPanel.tsx)
- [TransitionPanel.tsx](/Users/taehee/IconStudio/components/editor/TransitionPanel.tsx)
- [AnimationStudioPanel.tsx](/Users/taehee/IconStudio/components/editor/AnimationStudioPanel.tsx)

Implementation goal:

- remove `currentStateId` and state CRUD flows
- make the editor operate on icon, variant, and layer editing
- keep transition preview, but make it preview runtime icon-to-icon behavior
- keep inspect and animation panels aligned with the new model

### Runtime transition engine

- [transition-resolver.ts](/Users/taehee/IconStudio/lib/runtime-core/transition-resolver.ts)
- [cross-icon-morph.ts](/Users/taehee/IconStudio/lib/runtime-core/cross-icon-morph.ts)
- [morph.ts](/Users/taehee/IconStudio/lib/runtime-core/morph.ts)
- [draw-executor.ts](/Users/taehee/IconStudio/lib/runtime-core/draw-executor.ts)
- [inspection.ts](/Users/taehee/IconStudio/lib/runtime-core/inspection.ts)
- [weight-interpolation.ts](/Users/taehee/IconStudio/lib/runtime-core/weight-interpolation.ts)
- [state-machine.ts](/Users/taehee/IconStudio/lib/runtime-core/state-machine.ts)

Implementation goal:

- make runtime choose among `strictMorph`, `bestGuessMorph`, `lineAnimation`, and `replace`
- research and encode the main icon transition families worth supporting in v1
- prefer runtime resolution over authored transition graphs
- remove or rename state-machine concepts that no longer match the product

### Export and direct React publish

- [export-runtime-json.ts](/Users/taehee/IconStudio/lib/export/export-runtime-json.ts)
- [export-react-components.ts](/Users/taehee/IconStudio/lib/export/export-react-components.ts)
- [react-adapter.ts](/Users/taehee/IconStudio/lib/export/adapters/react-adapter.ts)
- [generate-component.ts](/Users/taehee/IconStudio/lib/export/export-react/generate-component.ts)
- [generate-library.ts](/Users/taehee/IconStudio/lib/export/export-react/generate-library.ts)
- [write-library.ts](/Users/taehee/IconStudio/lib/export/export-react/write-library.ts)
- [compile-from-source.ts](/Users/taehee/IconStudio/scripts/compile-from-source.ts)
- [validate-source-export.ts](/Users/taehee/IconStudio/scripts/validate-source-export.ts)

Implementation goal:

- export atomic icons plus variants
- emit runtime transition payloads without authored state payloads
- keep deterministic output
- support direct React codebase publish with changed-icon-only writes

### Install config and repo-native publish path

- [SyncTargetPanel.tsx](/Users/taehee/IconStudio/components/export/SyncTargetPanel.tsx)

Implementation goal:

- replace sync-target-first UI and types with repo-root install config
- remove `project.syncTargets` product behavior
- keep direct publish focused on the current React codebase

## Suggested execution order

1. Rewrite schema types and fixtures first.
2. Rewrite editor-store types and selectors to remove state-centric assumptions.
3. Rewrite runtime transition resolution around icon-to-icon strategies.
4. Rewrite runtime JSON export and React export to consume the new schema.
5. Remove sync-target UI and replace it with repo install config handling.
6. Update tests and snapshots only after the new code path is coherent.

## Verification checklist

Before calling the work done, verify all of the following:

- `rg -n "defaultState|states: Record|currentStateId|syncTargets" lib components tests` only returns temporary refactor leftovers or intentionally historical comments
- runtime transition tests cover morph success, morph fallback, line animation, and replace
- export tests prove no authored state payload is emitted
- direct publish rewrites only changed icons and changed outputs
- Storybook-specific code is not part of the product path

## Commands to run

Run these from [/Users/taehee/IconStudio](/Users/taehee/IconStudio):

```bash
bun test
bun run lint
bun run format:check
pnpm build
```

If dependencies change, also run:

```bash
bun install
bun install --frozen-lockfile
```

## Expected output

The implementation should end with:

- updated schema, store, runtime, and export code matching the rewritten specs
- updated tests proving the new product model
- removal of old state-centric and sync-target-centric product assumptions
- a concise note listing any deferred work, especially optional watch mode or later reference-app exploration
