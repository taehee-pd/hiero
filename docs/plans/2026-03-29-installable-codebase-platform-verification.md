---
status: verified-proposal
last-reviewed: 2026-03-29
---

# Installable Codebase Platform Verification

Date: 2026-03-29

## Verification Scope

This verification checks whether the reviewed installable Cuneiform plan is consistent with the repository's canonical architecture, the new repo-native product boundary, the rewritten spec-kit documents, and the current code surfaces that will need implementation work.

## What is already aligned

### 1. Canonical source as shared truth is already real

Verified against:

- [docs_canonical/ARCHITECTURE.md](/Users/taehee/Cuneiform/docs_canonical/ARCHITECTURE.md)
- [scripts/compile-from-source.ts](/Users/taehee/Cuneiform/scripts/compile-from-source.ts)
- [scripts/validate-source-export.ts](/Users/taehee/Cuneiform/scripts/validate-source-export.ts)

Why it matters:

- The repo already treats `icon.json` + `preview.svg` + `manifest.json` as canonical input for compile/validation.
- That means the live-first plan does not need a new shared storage model.
- It only needs a new dev-time consumption model.

### 2. Direct codebase publish can build on existing export boundaries

Verified against:

- [lib/export/export-runtime-json.ts](/Users/taehee/Cuneiform/lib/export/export-runtime-json.ts)
- [lib/export/adapters/react-adapter.ts](/Users/taehee/Cuneiform/lib/export/adapters/react-adapter.ts)
- [lib/export/export-react/generate-component.ts](/Users/taehee/Cuneiform/lib/export/export-react/generate-component.ts)

Why it matters:

- The repo already has a meaningful export boundary between icon data and React-facing output.
- That makes direct React codebase publish an evolution of existing code, not a greenfield rewrite.

### 3. Existing React-facing export logic still helps, but Storybook should remain reference-only

Verified against:

- [lib/export/adapters/storybook-generator.ts](/Users/taehee/Cuneiform/lib/export/adapters/storybook-generator.ts)
- [tests/storybook-generator.test.ts](/Users/taehee/Cuneiform/tests/storybook-generator.test.ts)

Why it matters:

- The repo already has React-facing generation logic and Storybook-specific references.
- That is useful implementation context, but it should not turn Storybook into a product target.

## Plan corrections made during verification

### 1. Repo config should be the only long-term install boundary

Issue:

- Earlier drafts still treated target configuration as a first-class product surface inherited from the old sync-first direction.

Fix:

- The reviewed direction centers repo-root `cuneiform.config.ts` and removes `project.syncTargets` rather than migrating it.

Verified in:

- [2026-03-29-installable-codebase-platform-design.md](/Users/taehee/Cuneiform/docs/plans/2026-03-29-installable-codebase-platform-design.md)
- [2026-03-29-installable-codebase-platform-implementation-plan.md](/Users/taehee/Cuneiform/docs/plans/2026-03-29-installable-codebase-platform-implementation-plan.md)

### 2. The product model needed a clean break from per-icon multi-state authoring

Issue:

- The old schema, editor store, runtime, and export surfaces centered on `variant.defaultState`, `variant.states`, and authored state-to-state transitions inside one icon.

Fix:

- The reviewed direction removes authored per-icon states from the product contract.
- Icons keep intrinsic variants such as size and style.
- Animation becomes a runtime-owned icon-to-icon concern.

Verified against current surfaces:

- [lib/schema/types.ts](/Users/taehee/Cuneiform/lib/schema/types.ts#L16)
- [lib/editor-store/store.ts](/Users/taehee/Cuneiform/lib/editor-store/store.ts)
- [lib/runtime-core/transition-resolver.ts](/Users/taehee/Cuneiform/lib/runtime-core/transition-resolver.ts)
- [lib/export/export-runtime-json.ts](/Users/taehee/Cuneiform/lib/export/export-runtime-json.ts)

### 3. Animation planning needed to move from authored states to runtime research

Issue:

- Earlier planning still risked treating transitions as editor-authored state graphs instead of runtime behavior.

Fix:

- The reviewed plan now explicitly requires runtime transition research covering major icon transition families, line start and line end style animation, morphing quality rules, and replace or fallback behavior when morphing is invalid.

## Verified architectural decisions

### Decision: keep file-based source of truth

Status: verified

Reason:

- It matches the current source export and compile guardrails.
- It supports PR review and deterministic builds.
- No competing database layer is required for the installable model.

### Decision: keep the v1 path narrower than the original live-first framing

Status: revised

Reason:

- The v1 contract is Figma ingress, Cuneiform SSOT in repo, repo-root config, and direct React codebase publish.
- Optional watch mode can come later, but should not define the first implementation.

### Decision: keep Storybook as a reference, not a target

Status: verified

Reason:

- The user explicitly clarified that Storybook is methodology and reference, not export destination.
- The core product must publish directly against the host codebase.

### Decision: remove backward compatibility constraints now

Status: verified

Reason:

- The user explicitly does not want backward compatibility to shape the design.
- `project.syncTargets` can be removed instead of migrated.
- The product model can be rewritten cleanly before any external users depend on it.

## Remaining open decisions

These are not blockers for the design, but they should be resolved before implementation starts:

- Which concrete transition families will v1 support first, and what are the acceptance fixtures for each family?
- Which runtime heuristics determine `strictMorph` vs `bestGuessMorph` vs `lineAnimation` vs `replace`?
- Which generated files are owned by Cuneiform in direct React publish mode, and how is stale-output cleanup enforced?
- Should optional watch mode trigger on explicit save or on every accepted canonical-source write?

## Recommendation

The plan is directionally sound and consistent with the current repo architecture.

The safest execution order is:

1. rewrite schema, store, runtime, and export around atomic icons plus variants
2. remove `project.syncTargets` and move install behavior to `cuneiform.config.ts`
3. research and codify runtime icon-to-icon transition strategies
4. implement deterministic direct React codebase publish with changed-icon-only writes
5. add optional watch mode only after the publish path is solid
