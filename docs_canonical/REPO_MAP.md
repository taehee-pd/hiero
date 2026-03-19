# Repository Map

## Purpose

This repository contains a Next.js-based icon authoring application with two primary user surfaces:

- a library/explorer at `/`
- an editor workspace at `/editor`

The same product codebase also supports a desktop shell through Electrobun. In addition to interactive editing, the repo contains export, compile, runtime, and integration code for turning authored icons into SVG, runtime JSON, compiled icon packages, and React-ready outputs.

## Top-Level Areas

- `app/`: Next.js App Router entrypoints and global app setup.
- `components/`: React UI, split into product surfaces (`editor/`, `explorer/`, `export/`, `platform/`) and shared UI (`ui/`, `kibo-ui/`).
- `lib/`: domain logic and non-route code.
- `desktop/`: Electrobun desktop shell, native bridge, build scripts, and packaging config.
- `scripts/`: repository-level helper scripts, including icon compilation and desktop startup helpers.
- `tests/`: Bun test suites, snapshots, fixtures, and helpers.
- `docs/`: legacy product, build, release, user-guide, and planning documents.
- `docs_canonical/`: canonical repository knowledge layer for agents and future contributors.

## Key Entry Points

- `app/page.tsx`: explorer entry.
- `app/editor/page.tsx`: editor entry.
- `app/layout.tsx`: global app shell, theme setup, analytics, and desktop bridge mounting.
- `desktop/src/bun/index.ts`: desktop main process.
- `desktop/src/mainview/index.ts`: desktop webview bootstrap.
- `scripts/compile-icons.ts`: CLI wrapper around the compile/export pipeline.

## Core Modules

- `lib/schema/`: canonical data model, guards, sample data, and workspace helpers.
- `lib/editor-store/`: central editor state, actions, history, and selectors.
- `lib/editor-core/`: geometry parsing, editing commands, snapping, topology, keyboard handling, and shape generation.
- `lib/editor-renderer-svg/`: SVG rendering for the editor surface and transition preview application.
- `lib/editor-overlay-canvas/`: overlay rendering for guides, selections, and editor-only affordances.
- `lib/import/`: SVG import and normalization.
- `lib/export/`: SVG export, runtime JSON export, compiled package generation, React generation, and diffing.
- `lib/compiler-contracts/`: compiled artifact types and validators.
- `lib/runtime-core/`, `lib/runtime-dom/`, `lib/runtime-react/`, `lib/runtime-sdk/`: runtime and rendering layers for exported icons.
- `lib/platform/`: desktop bridge and route helpers shared with the web app.

## Dependency Shape

High-level flow:

1. `schema` defines the document shape used by the editor and exports.
2. `editor-store` owns loaded workspace/project state and coordinates authoring actions.
3. `editor-core`, renderers, and components provide authoring behavior and visualization.
4. `import` converts external SVG into the internal schema.
5. `export` and `compiler-contracts` generate downstream artifacts.
6. `runtime-*` packages consume exported or compiled icon data for rendering/animation.
7. `desktop/` wraps the shared app and exposes native capabilities through the platform bridge.

## Current Data Model Surface

The repo currently supports both:

- `Project` documents with `version: "1.0"`
- `Workspace` documents with `version: "2.0"`

Workspace support is not only planned; it is implemented in the schema and editor store.

## Known Conflicts / Notes

- Legacy operational docs were normalized to repository-relative links to avoid machine-specific path assumptions.
- Product naming is still mixed in a few compatibility surfaces, but the desktop shell now uses `Coniva` as the canonical product name. Legacy `icophone` identifiers remain only where the release/update and project-file compatibility layers still need them.
- Root package metadata now uses `icon-authoring-tool`, while the desktop package metadata has been normalized to `coniva-desktop`.
- Legacy docs in `docs/plans/` contain future-state design material. Use `docs/plans/STATUS.md` as the entrypoint, and treat canonical docs as repository truth.
