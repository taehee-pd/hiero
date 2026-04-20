---
status: approved
last-reviewed: 2026-03-28
---

# Figma Plugin, Docs, Accessibility, And Desktop Release Hardening

Date: 2026-03-28

## Goal

Ship the next readiness slice by:

- adding a repo-local Figma plugin that exports selected nodes to a Hiero-friendly payload
- importing that payload through the existing Hiero SVG normalization pipeline
- improving consumer documentation
- tightening accessibility in the import flow and related touched UI
- hardening the desktop release path after the plugin/docs/a11y batch

## Approved Direction

- Build a narrow `Export to Hiero` Figma plugin, not a full file browser.
- Use selection-based export only.
- Import plugin payloads as JSON in Hiero and reuse the existing sanitize → normalize → convert pipeline.
- Scope accessibility fixes to the UI touched by this work.
- Treat desktop distribution as release-path hardening, not a full hosted signing deployment.

## Architecture

### Figma Plugin

- Add a local plugin workspace with:
  - `manifest.json`
  - `code.ts`
  - `ui.html`
- The plugin reads current selection, exports SVG for vector/component nodes, and returns a JSON payload:
  - `version`
  - `source`
  - `exportedAt`
  - `icons[]` with `name`, `nodeId`, `svgContent`, and provenance
- Unsupported nodes are reported back to the user instead of crashing the export.

### Hiero Import

- Extend `ImportIconDialog` with a new source mode for `Hiero Plugin`.
- Accept pasted JSON or uploaded `.json`.
- Parse and validate the payload.
- Import entries one by one through the existing SVG import path so all sanitization and normalization stays shared.

### Documentation

- Add a guide for the Figma plugin workflow.
- Expand existing React, Swift, and Flutter integration guides so they read like consumer-ready usage docs rather than stubs.

### Accessibility

- Add explicit labels, status regions, and alert semantics in the import flow.
- Ensure plugin-payload batch import reports progress accessibly.
- Keep fixes scoped to touched UI to avoid broad visual churn.

### Desktop Release Hardening

- Make stable-release intent explicit in the desktop release script.
- Validate signing prerequisites earlier and more clearly.
- Improve release documentation around stable builds, artifacts, and update manifest checks.

## Verification

- Add targeted tests for plugin-payload parsing/import helpers.
- Run targeted and full Bun test sweeps.
- Run lint, type-check, and build validation.
- Report any release-path steps that remain environment-dependent.
