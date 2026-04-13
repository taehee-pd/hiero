# Workflows

## Development Workflow

Standard local web workflow:

1. Install dependencies with `corepack pnpm install` (and `bun install` to
   regenerate `bun.lock`, which CI reads via `bun install --frozen-lockfile`).
2. Start the web app with `corepack pnpm dev`.
3. Open the Studio surface at `http://localhost:3000` (Sanity Studio-style
   single-screen workspace — `components/studio/StudioLayout.tsx`).
4. Navigate to `/editor/[iconId]` for the focused editor surface.

## Build Processes

Web build:

- `corepack pnpm build`

Compile/export pipeline:

- `bun scripts/compile-icons.ts --project <file> --out <dir> --package-name <name> --package-version <version> [--previous-out <dir>] [--built-at <iso>] [--generate-react]`
- `bun scripts/compile-from-source.ts --source <dir> --out <dir> --package-name <name> --package-version <version> [--previous-out <dir>] [--built-at <iso>] [--generate-react]`
- `bun scripts/validate-source-export.ts --source <dir> [--summary <md>] [--preview-out <dir>] [--job-summary <md>]`

Root script entrypoints mirror these operations as `compile:from-source` and `validate:source-export` for operational consistency.

This pipeline accepts either a legacy project/workspace file or canonical source-export files and emits deterministic compiled artifacts.

Cross-platform adapter generation:

Adapters in `lib/export/adapters/` generate platform-native components from runtime payloads. They are invoked by sync connectors (`lib/sync-service/connectors/`) during local-directory or Git PR sync. Supported platforms: React (`react-adapter.ts`), Swift/SwiftUI/UIKit (`swift-adapter.ts`), Flutter/Dart (`flutter-adapter.ts`). Downgrade rules (`downgrade-rules.ts`) handle features unsupported on each platform (e.g., morph -> crossfade on Swift/Flutter).

Lottie export flow:

- Core exporter: `lib/export/export-lottie.ts`
- Downgrade analysis: `lib/export/lottie-downgrade.ts`
- UI panel component: `components/export/LottieExportPanel.tsx`
- Dependency: `lottie-web` (lazy-loaded preview behind `NEXT_PUBLIC_LOTTIE_PREVIEW_ENABLED`)

Import-adapter flow:

- Server-side adapter routes live under `app/api/import/`
- Built-in adapters currently include Lucide, Heroicons, Phosphor, and Material Symbols
- Local verification entrypoint: `corepack pnpm test:import`

## Deployment and Release

Registry distribution flow exists in-repo:

- Delivery mode: `SyncTarget.deliveryMode === 'npm-registry'`
- Connector: `lib/sync-service/connectors/npm-connector.ts`
- Web publish path: `app/api/publish-npm/route.ts`
- Token: server-side via `NPM_PUBLISH_TOKEN` env var

## CI/CD Status

Repository CI workflows are present under `.github/workflows/`:

- `web-app-ci.yml`: runs formatter, type-check, lint, Phase A coverage, coverage threshold enforcement, and `build` for shared web/runtime path changes.
- `icons-pr-validate.yml`: validates sync/export source files and runs targeted test suites on pull requests.
- `icons-post-merge-build.yml`: validates and compiles merged source files on `main`.
- `icons-package-release.yml`: builds/validates icon package artifacts on `main` changes and supports manual npm publish dispatch.
- `cli-release.yml`: `@contour/cli` build + OIDC-provenance npm publish. Triggered by pushing a `cli-v*` tag or by manual `workflow_dispatch`. See `docs_canonical/ANIMATE_PANEL_REVAMP_PLAN.md` §3.2 for the full workflow rationale.

Practical implication:

- compile/export and package verification is automated for icon-pipeline changes
- web application CI has a dedicated workflow
- `@contour/cli` has a dedicated release workflow with npm provenance
- the Phase A runtime/export surface has a scoped LCOV threshold gate via `scripts/check-coverage.ts`
- local build and test verification still matters for areas outside the current CI slice or formatter scope


## Design System Prompt Workflow

This repository now includes a root-level `DESIGN.md` (Stitch-style) to guide AI-assisted UI implementation.

When making UI changes:

1. Read `DESIGN.md` before authoring visual changes.
2. Reuse existing component primitives and dark editor surface patterns.
3. Update `DESIGN.md` when visual language or interaction conventions materially change.
4. Keep `docs_canonical/DESIGN.md` as product architecture SSOT and `DESIGN.md` as UI styling/prompt SSOT for agents.

## Agent Task Lifecycle

Recommended repository task loop for agents working in this repo:

1. Read the relevant documents in `docs_canonical/`.
2. Confirm current behavior against the codebase when a claim could be stale or disputed.
3. Prefer the smallest viable change that preserves file paths, conventions, and existing behavior.
4. Run targeted verification for the area changed.
5. Run broader validation when a change crosses module boundaries.
6. Update `docs_canonical/TASKS.md` after each materially completed change so backlog status matches the implementation.
7. Update canonical documentation when repository behavior or operating knowledge changes materially.

## Verification Expectations

Observed repository practice favors targeted verification:

- module/unit tests with `bun test`
- snapshot coverage for deterministic exports and runtime rendering
- `corepack pnpm build` for application build checks

## Known Conflicts / Notes

- Repository lint and test entrypoints are explicitly defined in root scripts (`lint`, `test`).
- Desktop distribution was removed in Phase R1. The `desktop/` directory retains build artifacts only.
- There is no committed web deployment pipeline — web builds are verified by CI but deployment is manual.
- Both `pnpm-lock.yaml` and `bun.lock` must stay in sync. After adding or removing any dependency via `pnpm add`/`pnpm remove`, run `bun install` to regenerate `bun.lock`. CI uses `bun install --frozen-lockfile` and will fail if the two lockfiles drift.
