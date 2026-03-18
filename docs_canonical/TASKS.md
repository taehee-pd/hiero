# Tasks

## Purpose

This file records the current engineering backlog that can be justified from the existing codebase and legacy documentation. It is not a product roadmap replacement and should avoid speculative items that are not grounded in repository evidence.

## Priority 0: Harness and Repository Hygiene

Status: completed.

- Root package metadata was formalized to `icon-authoring-tool`, reducing placeholder naming drift at the repository root.
- Repository-level lint/test entrypoints are now explicit (`lint` and `test` in the root package scripts).
- Canonical and legacy operational docs were reconciled with implemented workspace support, CI workflow presence, and compile/export/runtime behavior.

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

Status: in progress.

- Harden GitHub sync and downstream export integrations already present in the codebase.
- Continue desktop-native UX and bridge improvements without breaking the shared web/desktop surface boundary.
- ✅ Revisited planning docs under `docs/plans/` and added a maintained status/disposition index in `docs/plans/STATUS.md`.


## Priority 3: Documentation Portability and Provenance Hygiene

Status: completed.

- Replaced machine-local absolute documentation links with repository-relative links in active legacy operations docs and README.
- Kept historical planning docs intact while fixing broken internal cross-links so archival context stays navigable.
- Reduced environment-specific path leakage in contributor-facing docs to improve portability across machines and CI.

## Source Basis

This backlog is derived from:

- current code and module presence
- `IMPLEMENTATION.md`
- desktop build/release docs
- dated planning docs in `docs/plans/`

## Known Conflicts / Notes

- Some legacy plan items are already partially or fully implemented in code, so they should not be copied forward blindly as untouched backlog.
- This file intentionally favors repository-stability and operational needs over product feature speculation.
