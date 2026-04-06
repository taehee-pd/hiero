# Contour — Contour

A Next.js-based icon authoring studio with SF Symbols-grade animation capabilities. Contour provides a single-screen workspace for creating, animating, and distributing production-ready icons.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Custom editor store with `useSyncExternalStore` (undo/redo history)
- Tailwind CSS + Radix UI
- IndexedDB persistence (auto-save)

## Getting Started

Prerequisites:

- Node.js 20+
- pnpm (primary package manager)
- Bun (test runner + CI lockfile)

Install dependencies:

```bash
pnpm install
```

Run the dev server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `pnpm dev` — start local development server
- `pnpm build` — production build
- `pnpm start` — run production server
- `pnpm lint` — run repository lint checks
- `pnpm format:check` — Prettier format check
- `bun test` — run Bun test suites
- `pnpm test:sync` — run sync/export integration-focused tests
- `pnpm validate:source-export` — validate canonical `icons/` + `manifest.json` source exports
- `pnpm compile:from-source -- --source <dir> --out <dir> --package-name <name> --package-version <version> [--generate-react]` — compile from canonical source export input

## Integration Guides

- [Framework Integration Playbook](docs/guides/framework-integration-playbook.md) — decision guide for choosing the right integration path, delivery modes, platform capabilities, and CI setup
- [React Integration Guide](docs/guides/react-integration.md) — full `<ContourIcon>` API reference (props, imperative handle, gestures, callbacks)
- [Swift Integration Guide](docs/guides/swift-integration.md) — SwiftUI and UIKit integration
- [Flutter Integration Guide](docs/guides/flutter-integration.md) — Dart widget integration
- [Figma Plugin Export](docs/guides/figma-plugin-export.md) — export icons from Figma into Contour

## Project Structure

```
app/                    # Next.js App Router — pages, API routes, layout
components/
├── editor/             # Editor: canvas, toolbar, panels, inspector, timeline
├── explorer/           # Icon library browser and collection explorer
├── studio/             # StudioLayout — single-screen workspace shell
├── export/             # Export workflow: PublishPanel, ReleasePanel, formats
├── persistence/        # AutoSaveProvider (IndexedDB)
├── runtime/            # Runtime preview components
├── ui/                 # shadcn/ui components (57 files)
└── kibo-ui/            # Kibo design system + color picker

lib/
├── schema/             # Icon, Variant, State, Layer, Transition types
├── runtime-core/       # autoMorph (unified automatic morph), intrinsic interpolation,
│                       # morph, topology, transition resolver, draw executor,
│                       # hybrid compositor, open-path guard, cubic weight interpolation
├── runtime-dom/        # DOM renderer, IconDriver
├── runtime-react/      # ContourIcon React component, hooks
├── runtime-sdk/        # Compiled icon rendering primitives
├── editor-core/        # Path editor, snap engine, keyboard, topology,
│                       # boolean ops, shape generation
├── editor-store/       # Custom store (state, actions, undo/redo)
├── editor-renderer-svg/# SVG rendering for editor
├── editor-overlay-canvas/ # Editor overlays (guides, selection)
├── import/             # SVG import, adapter SDK, built-in adapters
│                       # (Figma, Heroicons, Lucide, Material, Phosphor)
├── export/             # Runtime JSON, Lottie, compiled icons, React codegen
├── persistence/        # IndexedDB adapter, persistence manager, auto-save
├── live-sync/          # Real-time publish transport
├── sync-service/       # GitHub PR sync orchestrator + connectors
├── sync-source/        # Source-of-truth export and reconstruction
├── install-config/     # Installation configuration for icon packages
├── platform/           # Web platform bridge and route helpers
├── rendering/          # Layer style resolution, auto-gradient
├── animation/          # Animation utilities
├── compiler-contracts/ # Export format types and validators
└── integrations/       # External service integration points

packages/contour-cli/    # @contour/cli — command-line icon operations
figma-plugin/           # Figma plugin for exporting to Contour
scripts/                # Build, compile, validate, release scripts
tests/                  # Bun test files (102+ test files)
specs/                  # Spec-kit documentation (21 specs)
docs/                   # Guides, plans, architecture notes
docs_canonical/         # Canonical reference documentation
```

## Runtime Consumption APIs

### Generated React component API

The React codegen path emits per-icon wrapper components that call `ContourIcon` and embed each icon payload.

Generated components expose icon-specific TypeScript unions for:
- variant IDs and sizes
- state IDs
- effect IDs

This is the primary consumer API; consumers should import generated components rather than raw schema objects.

### Vanilla JS API

Use `createIcon(container, iconData, options)` from `lib/runtime-dom` to mount and drive icons without React.

```ts
import { createIcon } from '@/lib/runtime-dom';

const driver = createIcon(containerEl, iconData, {
  variant: 24,
  initialState: 'default',
  reduceMotion: 'system',
});

driver.transitionTo('active');
driver.triggerEffect('pulse');
```

### CSS transition fallback

For track transitions that only animate `opacity` and transform properties (`rotate`, `translateX`, `translateY`, `scale`), runtime-dom now prefers CSS transitions.

JS frame scheduling is still used for:
- morph interpolation (`d`)
- draw/pathLength animation
- fallback crossfade/magic-replace visuals

### Runtime size budget check

Run:

```bash
bun run check:runtime-size
```

This enforces:
- runtime-core source bundle proxy: `<10KB` gzipped
- per-icon compiled fixture payload: `<2KB` gzipped

## Compiler Pipeline (end-to-end)

Data flow is intentionally linear and deterministic:

1. **Editor model (`Project`)** -> `exportSourcePayload` (canonical source files)
2. **Source export** (`icon.json` + `manifest.json`) -> `projectFromSourceFiles` (adapter)
3. **Reconstructed Project** -> `compileProject` -> compiled icons + manifest
4. **Compiled icons + manifest** -> `generateReactIconComponents` (runtime-ready React files)
5. Optional: **previous + current compiled build** -> `diffCompiledIcons` (`IconChangeRecord` files)

### Post-merge build (canonical path)

After a PR sync merges source files, this is the only build path used in CI:

```bash
bun scripts/compile-from-source.ts \
  --source . \
  --out ./.artifacts/icons \
  --package-name @contour/icons \
  --package-version 1.0.0 \
  --generate-react
```

### Local development / test fixtures

For compiling directly from a project/workspace JSON file (editor-local only, not for CI):

```bash
bun scripts/compile-icons.ts \
  --project tests/fixtures/e2e/compiler-project.json \
  --out ./.artifacts/icons \
  --package-name @contour/icons \
  --package-version 1.0.0 \
  --generate-react
```

### Source of truth

Canonical source export files (`icons/` + `manifest.json`) are the single authoritative build input after PR merge. Raw project/workspace JSON is editor-internal and must not be used as a direct CI build input. See `lib/sync-source/source-of-truth.ts` and `docs_canonical/ARCHITECTURE.md` for guardrails and schema boundary documentation.

### Schema evolution notes

- Breaking compiled schema changes must bump the `$schema` **major** version.
- Runtime loader migration is selected by schema version (manifest/package schema context + compiled `$schema`), then routed through the migration hook in `parseCompiledIconJson`.
- Mixed compiled icon schema versions in one manifest are rejected.

## Production Icon Package Sync

The production sync flow builds a publishable icon package from source project data using the existing compile pipeline:

1. `Project/Workspace` fixture or source JSON is compiled to `icons/*.compiled.json`.
2. `icons.manifest.json` is generated and validated.
3. React component entry files and `package.exports.generated.json` are generated.
4. A publish-ready `dist/icons-package/package.json` is created with merged exports.

Generated artifacts are written to `dist/icons-package/` by default.

### Local build

```bash
ICONS_PACKAGE_VERSION=1.2.3 bun run build:icons:package
```

### Local validation

```bash
bun run validate:icons:package --package-name @contour/icons --package-version 1.2.3
```

### Local release dry-run

```bash
bun run release:icons:dry-run --package-version 1.2.3 --package-name @contour/icons
```

This dry-run builds, validates, and runs `npm pack --dry-run` against `dist/icons-package`.

### CI publish flow

Workflow: `.github/workflows/icons-package-release.yml`

- Runs on push to `main` when compiler/export/release paths change.
- Also supports manual dispatch with explicit `package_version`.
- Always builds + validates before packaging.
- Publishes only on manual dispatch when `publish=true` and `NPM_TOKEN` is available.

### Versioning strategy

This repository uses explicit version input for package publishing.

- Local/CI build requires `ICONS_PACKAGE_VERSION` or `--package-version`.
- Manual publish requires `package_version` workflow input.
- No implicit/ambiguous auto-version publish path is allowed.

### Consumer usage (React / Next.js)

```tsx
import { IcChevronRight } from '@contour/icons';
import Play24 from '@contour/icons/sizes/24/IcPlay';
import { IcPlay } from '@contour/icons/collections/media';
```

Per-icon import:

```tsx
import IcChevronRight from '@contour/icons/icons/IcChevronRight';
```

## Repo-Native Distribution

Contour supports a two-lane distribution model:

- **Lane 1 — Live Sync:** Real-time publish transport (`lib/live-sync/`) with local-directory, git-pr, and npm-registry connectors. UI via `PublishPanel`.
- **Lane 2 — Release:** Versioned releases with changelog generation via `ReleasePanel`. Supports `@contour/cli` for CI integration.
- **CLI:** `packages/contour-cli/` — `@contour/cli` command-line tool for icon operations.

## GitHub PR Sync Pipeline

The sync pipeline pushes icon source files from the editor to a GitHub repository via Pull Requests.

### Architecture

```
Editor -> exportSourcePayload -> POST /api/github-sync/pr -> syncPr orchestrator
                                                              |
                                 +----------------------------+
                                 v                            v
                           GitProvider                  Conflict detection
                           (GitHub REST)               (optimistic concurrency)
                                 |
                    +------------+----------------+
                    v            v                 v
              Create branch   Write files     Create PR
```

**Key modules:**
- `lib/sync-service/sync-pr.ts` — 11-step orchestrator
- `lib/sync-service/git-provider.ts` — abstract provider interface
- `lib/sync-service/github-provider.ts` — GitHub REST API implementation
- `lib/sync-service/conflicts.ts` — optimistic concurrency and conflict detection
- `lib/sync-service/analytics.ts` — structured observability (10 event types)
- `lib/sync-service/feature-flags.ts` — env-based rollout control
- `lib/sync-service/permissions.ts` — least-privilege audit and preflight check
- `lib/sync-ui/use-sync-pr.ts` — React hook for UI integration
- `app/api/github-sync/pr/route.ts` — Next.js API route (server-side token)

### Token and Permission Setup

The sync token is **server-side only** — stored in `GITHUB_SYNC_TOKEN` and never sent to the browser.

**Minimum permissions (fine-grained PAT recommended):**
- Repository access: target repo only
- Contents: Read and write
- Pull requests: Read and write
- Metadata: Read (implicit)

See `docs_canonical/SYNC_TROUBLESHOOTING.md` for detailed auth and permission troubleshooting.

### Feature Flags

Environment-variable-based rollout control:

| Variable | Default | Purpose |
|----------|---------|---------|
| `SYNC_ENABLED` | `true` | Kill switch |
| `SYNC_DRY_RUN_ONLY` | `false` | Validate without creating PRs |
| `SYNC_MAX_FILES` | `500` | Payload size limit |
| `SYNC_ALLOWED_REPOS` | all | Repo allow-list |
| `SYNC_PREFLIGHT_CHECK` | `true` | Pre-sync permission check |

### Known Limitations

1. **No real-time collaboration.** Export-then-push model; two concurrent users will conflict.
2. **One commit per file.** GitHub Contents API limitation.
3. **No commit signing.** Requires GitHub App with signing configured.
4. **Heuristic remote conflict detection.** Uses file-count comparison, not content hashing.
5. **Orphan branches on partial failure.** Reported in error response for manual cleanup.
6. **No automatic token refresh.** Short-lived tokens must be rotated externally.
7. **Single base branch.** Multi-branch workflows require separate sync requests.
8. **No partial sync.** Full canonical state is always exported.

## Figma Import

Contour supports importing icons directly from Figma:

- **Figma plugin** (`figma-plugin/export-to-contour/`) exports selected components
- **API route** (`app/api/import/figma/route.ts`) accepts Figma PATs per-request (never stored server-side)
- **Import dialog** in the editor UI for batch import with preview

## Legacy planning docs status

Legacy implementation/design plans under `docs/plans/` are now indexed in `docs/plans/STATUS.md` with dispositions and canonical replacements. Treat canonical docs under `docs_canonical/` as authoritative.
