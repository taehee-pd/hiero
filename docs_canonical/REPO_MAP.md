# Repository Map

## Purpose

This repository contains a Next.js-based icon authoring application with a single-screen Studio workspace:

- Studio surface at `/` — Sanity Studio-style layout combining navigation, icon list, and embedded editor (`components/studio/StudioLayout.tsx`)
- Editor surface at `/editor` and `/editor/[iconId]` — focused authoring workspace

The repo also contains export, compile, runtime, integration code, and a CLI for turning authored icons into SVG, runtime JSON, compiled icon packages, and React-ready outputs.

## Top-Level Areas

- `app/`: Next.js App Router entrypoints, API routes, and global app setup.
- `components/`: React UI, split into product surfaces (`editor/`, `explorer/`, `studio/`, `export/`, `persistence/`, `runtime/`), the cross-feature DS layer (`ds/`), and shadcn/Radix primitives (`ui/`).
- `lib/`: domain logic and non-route code.
- `packages/hiero-cli/`: `@hiero/cli` command-line tool for icon operations.
- `figma-plugin/`: Figma plugin for exporting to Hiero.
- `scripts/`: repository-level helper scripts, including icon compilation and validation.
- `tests/`: Bun test suites (102+ files), snapshots, fixtures, and helpers.
- `specs/`: technical specification documents (21 specs).
- `docs/`: guides, plans, architecture notes, and user guide.
- `docs_canonical/`: canonical repository knowledge layer for agents and future contributors.
- `DESIGN.md`: root-level design-system prompt for UI-coding agents.
- `tokens/`: source tokens for DS component chrome and alternate `data-theme` visual directions.

## Key Entry Points

- `app/page.tsx`: Studio layout entry (mounts `StudioLayout`).
- `app/editor/page.tsx`: editor entry (no icon selected).
- `app/editor/[iconId]/page.tsx`: editor entry (specific icon).
- `app/layout.tsx`: global app shell, theme setup, `AutoSaveProvider`.
- `app/runtime-demo/page.tsx`: Phase 4 runtime validation demo.
- `app/demo/runtime/page.tsx`: runtime execution demo.
- `packages/hiero-cli/src/bin.ts`: CLI entry point.
- `scripts/compile-icons.ts`: CLI wrapper around the compile/export pipeline.
- `scripts/compile-from-source.ts`: CI build path from canonical source exports.
- `tokens/style-dictionary.config.mjs`: DS component-token build entry point.

## Core Modules

- `lib/schema/`: canonical data model, guards, sample data, and workspace helpers.
- `lib/editor-store/`: custom editor store with `useSyncExternalStore`, actions, history, and selectors.
- `lib/editor-core/`: geometry parsing, editing commands, snapping, topology, keyboard handling, boolean ops, and shape generation.
- `lib/editor-renderer-svg/`: SVG rendering for the editor surface and transition preview.
- `lib/editor-overlay-canvas/`: overlay rendering for guides, selections, and editor-only affordances.
- `lib/import/`: SVG import/normalization plus external adapter SDK and built-in adapters for Figma, Lucide, Heroicons, Phosphor, and Material Symbols.
- `lib/export/`: SVG export, runtime JSON export, Lottie export, compiled package generation, and diffing.
- `lib/export/adapters/`: platform-specific code generators (React, Swift, Flutter), downgrade rules, storybook generation, and manifest cleanup.
- `lib/animation/`: runtime effect player and built-in effect presets.
- `lib/compiler-contracts/`: compiled artifact types and validators.
- `lib/runtime-core/`: unified autoMorph with automatic strategy selection and intrinsic interpolation (Sederberg 1993), morph interpolation (intrinsicStrict/strict/bestGuess/crossIcon), arc-to-cubic conversion, topology detection, open-path guards, easing (cubic-bezier/spring/steps), scheduling, draw execution, effect playback, state-machine behavior, and cubic weight interpolation.
- `lib/runtime-dom/`, `lib/runtime-react/`, `lib/runtime-sdk/`: runtime and rendering layers for exported icons.
- `lib/persistence/`: IndexedDB adapter, persistence manager, and auto-save hook.
- `lib/live-sync/`: real-time publish transport with connectors.
- `lib/install-config/`: installation configuration for icon packages.
- `lib/integrations/`: GitHub API client and icon sync orchestration.
- `lib/sync-service/`: GitHub PR sync orchestrator, conflict detection, analytics.
- `lib/sync-service/connectors/`: local-directory, git-pr, and npm-registry delivery connectors.
- `lib/sync-source/`: source-of-truth export, reconstruction, and guardrails.
- `lib/sync-ui/`: UI layer for sync operations (state, hooks, analytics).
- `lib/platform/`: web platform bridge and route helpers.
- `lib/rendering/`: layer style resolution and auto-gradient generation.
- `lib/theme/`: `data-theme` helpers and first-paint boot script for token-based redesign themes.
- `app/api/import/`: server-side adapter import routes (Figma, Heroicons, Lucide, Material Symbols, Phosphor).
- `app/api/publish-npm/`: npm publish proxy route.
- `app/api/github-sync/`: GitHub PR sync route.

## Dependency Shape

High-level flow:

1. `schema` defines the document shape used by the editor and exports.
2. `editor-store` owns loaded workspace/project state and coordinates authoring actions.
3. `editor-core`, renderers, and components provide authoring behavior and visualization.
4. `import` converts external SVG into the internal schema.
5. `export` and `compiler-contracts` generate downstream artifacts.
6. `export/adapters` transform runtime payloads into platform-native components (React, Swift, Flutter) with downgrade rules.
7. `runtime-*` packages consume exported or compiled icon data for rendering/animation.
8. `persistence` handles IndexedDB storage and auto-save.
9. `live-sync` and `sync-service` handle distribution to external targets.

## Current Data Model Surface

The repo currently supports both:

- `Project` documents with `version: "1.0"`
- `Workspace` documents with `version: "2.0"`

Workspace support is implemented in the schema and editor store.

## Known Conflicts / Notes

- Legacy operational docs were normalized to repository-relative links.
- Product name is `Hiero`. Root package metadata uses `hiero`.
- Legacy docs in `docs/plans/` contain historical design material. Use `docs/plans/STATUS.md` as the entrypoint, and treat canonical docs as repository truth.
- The `desktop/` directory retains build artifacts but is no longer part of the active source architecture. The `docs/desktop-*.md` files were removed on 2026-04-13.
- Superseded planning docs (`docs_canonical/LAYOUT_REVAMP.md`, `docs_canonical/EXPORT_GAP_PLAN.md`, `docs_canonical/UX_AUDIT_TASKS.md`, `docs_canonical/notion-ia-screens.md`, `docs/IA-REDESIGN.md`) were removed on 2026-04-13 after their scope fully shipped. The archived production-readiness gap analysis lives in `docs_canonical/PLAN.md`.
