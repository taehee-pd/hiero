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

This pipeline accepts either a legacy project file or a workspace file and emits deterministic compiled artifacts.

## Deployment and Release

Desktop release flow exists in-repo:

- `bun run desktop/scripts/release.ts --version <semver> --notes "<notes>"`

The release script:

- bumps `desktop/package.json`
- rebuilds the static export
- stages the Electrobun mainview bundle
- runs the desktop distribution build
- writes `desktop/artifacts/latest.json`

## CI/CD Status

There is no repository CI configuration in `.github/` at the time of writing.

Practical implication:

- build and release workflows are currently documented and scriptable
- automated verification/publishing policy is not defined in-repo
- any CI behavior should be treated as external unless committed into the repository

## Agent Task Lifecycle

Recommended repository task loop for agents working in this repo:

1. Read the relevant documents in `docs_canonical/`.
2. Confirm current behavior against the codebase when a claim could be stale or disputed.
3. Prefer the smallest viable change that preserves file paths, conventions, and existing behavior.
4. Run targeted verification for the area changed.
5. Run broader validation when a change crosses module boundaries.
6. Update canonical documentation when repository behavior or operating knowledge changes materially.

## Verification Expectations

Observed repository practice favors targeted verification:

- module/unit tests with `bun test`
- snapshot coverage for deterministic exports and runtime rendering
- manual or scripted desktop build verification for desktop-specific changes
- `corepack pnpm build` for application build checks

## Known Conflicts / Notes

- There is a documented `lint` script in the root `package.json`, but no repo-level ESLint configuration was found during this redesign pass.
- Legacy docs describe release and build steps well for desktop, but there is no equivalent committed web deployment pipeline.
