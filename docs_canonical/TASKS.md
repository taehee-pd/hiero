# Tasks

## Purpose

This file records the current engineering backlog that can be justified from the existing codebase and legacy documentation. It is not a product roadmap replacement and should avoid speculative items that are not grounded in repository evidence.

## Priority 0: Harness and Repository Hygiene

- Formalize root package metadata and naming. The repository still mixes `my-project`, `Icophone`, `IconStudio`, and `Icon Studio`.
- Formalize repository-level lint and test entrypoints so operational workflows are explicit rather than inferred.
- Reconcile legacy docs with the actual presence of workspace support, runtime packages, and compile/export functionality.

## Priority 1: Workflow Hardening

- Decide and document the authoritative release/deployment model for web and desktop separately.
- Add or document repository CI behavior if automated verification is expected.
- Harden desktop release prerequisites around code signing, notarization, and update hosting, which are still partially placeholder-driven.

## Priority 1: Export and Runtime Stabilization

- Continue validating runtime JSON, compiled icon, and React export paths against deterministic tests.
- Clarify the relationship between authored project/workspace documents and downstream compiled/runtime artifacts in legacy docs.
- Keep compile/export package outputs stable as schema evolves.

## Priority 1: Workspace and Multi-Document UX

- Continue workspace and icon-set UX hardening already reflected in schema, store, and editor tab support.
- Validate bulk export, sync, and multi-icon-set workflows against the current implementation rather than only dated plans.

## Priority 2: Integration and Platform Work

- Harden GitHub sync and downstream export integrations already present in the codebase.
- Continue desktop-native UX and bridge improvements without breaking the shared web/desktop surface boundary.
- Revisit planning docs under `docs/plans/` and archive or supersede items whose implementation status has changed materially.

## Source Basis

This backlog is derived from:

- current code and module presence
- `IMPLEMENTATION.md`
- desktop build/release docs
- dated planning docs in `docs/plans/`

## Known Conflicts / Notes

- Some legacy plan items are already partially or fully implemented in code, so they should not be copied forward blindly as untouched backlog.
- This file intentionally favors repository-stability and operational needs over product feature speculation.
