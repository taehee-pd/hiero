# Workflows

## Development Workflow

Standard local web workflow:

1. Install dependencies with `corepack pnpm install`.
2. Start the web app with `corepack pnpm dev`.
3. Open the explorer at `http://localhost:3000`.
4. Navigate to `/editor` for the editor surface.

Desktop local workflow:

1. Run `corepack pnpm desktop:dev` from the repository root.
2. If a Next dev server is already running on port 3000, the desktop helper reuses it.
3. Otherwise, the helper starts the web dev server and then launches Electrobun.

## Build Processes

Web build:

- `corepack pnpm build`

Desktop build:

- `corepack pnpm desktop:build`: static-export the Next app, stage the output into `desktop/.generated/mainview`, then run the Electrobun build.
- `corepack pnpm desktop:dist`: same flow, but build distribution/installable artifacts.

Compile/export pipeline:

- `bun scripts/compile-icons.ts --project <file> --out <dir> --package-name <name> --package-version <version> [--previous-out <dir>] [--built-at <iso>] [--generate-react]`
- `bun scripts/compile-from-source.ts --source <dir> --out <dir> --package-name <name> --package-version <version> [--previous-out <dir>] [--built-at <iso>] [--generate-react]`
- `bun scripts/validate-source-export.ts --source <dir> [--summary <md>] [--preview-out <dir>] [--job-summary <md>]`

Root script entrypoints mirror these operations as `compile:from-source` and `validate:source-export` for operational consistency.

This pipeline accepts either a legacy project/workspace file or canonical source-export files and emits deterministic compiled artifacts.

Cross-platform adapter generation:

Adapters in `lib/export/adapters/` generate platform-native components from runtime payloads. They are invoked by sync connectors (`lib/sync-service/connectors/`) during local-directory or Git PR sync. Supported platforms: React (`react-adapter.ts`), Swift/SwiftUI/UIKit (`swift-adapter.ts`), Flutter/Dart (`flutter-adapter.ts`). Downgrade rules (`downgrade-rules.ts`) handle features unsupported on each platform (e.g., morph -> crossfade on Swift/Flutter).

## Deployment and Release

Desktop release flow exists in-repo:

- `bun run desktop/scripts/release.ts --version <semver> --notes "<notes>"`
- `bun run desktop/scripts/validate-latest-json.ts [--file <path>]`

The release script:

- bumps `desktop/package.json`
- rebuilds the static export
- stages the Electrobun mainview bundle
- runs the desktop distribution build
- validates the generated `latest.json` manifest schema before writing it
- writes `desktop/artifacts/latest.json`

Signing and notarization expectations live in `desktop/SIGNING.md`.

## CI/CD Status

Repository CI workflows are present under `.github/workflows/`:

- `icons-pr-validate.yml`: validates sync/export source files and runs targeted test suites on pull requests.
- `icons-post-merge-build.yml`: validates and compiles merged source files on `main`.
- `icons-package-release.yml`: builds/validates icon package artifacts on `main` changes and supports manual npm publish dispatch.
- `web-app-ci.yml`: runs formatter, type-check, lint, Phase A coverage, coverage threshold enforcement, and `build` for shared web/runtime path changes.
- `desktop-ci.yml`: runs formatter, type-check, lint, Phase A tests, and `desktop:build` for desktop changes plus the shared root paths that feed the desktop export.

Practical implication:

- compile/export and package verification is automated for icon-pipeline changes
- web application and desktop app CI now have dedicated workflows
- the Phase A runtime/export surface has a scoped LCOV threshold gate via `scripts/check-coverage.ts`
- local build and test verification still matters for areas outside the current CI slice or formatter scope

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
- manual or scripted desktop build verification for desktop-specific changes
- `corepack pnpm build` for application build checks

## Known Conflicts / Notes

- Repository lint and test entrypoints are explicitly defined in root scripts (`lint`, `test`).
- Legacy docs describe release and build steps well for desktop, but there is no equivalent committed web deployment pipeline.
