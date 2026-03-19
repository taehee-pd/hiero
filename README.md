# Icon Authoring Tool

A Next.js-based icon editor for authoring and inspecting SVG path layers across icon states and variants.

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- Zustand + zundo for editor state and undo/redo history
- Paper.js runtime (overlay rendering for selection/grid helpers)

## Getting Started

Prerequisites:

- Node.js 20+
- Corepack enabled

Install dependencies:

```bash
corepack pnpm install
```

Run the dev server:

```bash
corepack pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

- `corepack pnpm dev` - start local development server
- `corepack pnpm build` - production build
- `corepack pnpm start` - run production server
- `corepack pnpm lint` - run repository lint checks
- `corepack pnpm test` - run Bun test suites
- `corepack pnpm test:sync` - run sync/export integration-focused tests
- `corepack pnpm validate:source-export` - validate canonical `icons/` + `manifest.json` source exports from repo root
- `corepack pnpm compile:from-source -- --source <dir> --out <dir> --package-name <name> --package-version <version> [--generate-react]` - compile from canonical source export input
- `corepack pnpm desktop:dev` - start the web dev server if needed and launch the Electrobun desktop app
- `corepack pnpm desktop:build` - build the desktop app bundle
- `corepack pnpm desktop:dist` - build desktop distribution artifacts

## Desktop Development

The desktop shell lives under `desktop/` and wraps the same app with native menus, file dialogs, and desktop file I/O.

The shell is branded as Coniva. Legacy `.icophone.json` files and
`ICOPHONE_*` release env vars still work for compatibility while the
desktop path finishes its rename.

Use:

```bash
corepack pnpm desktop:dev
```

That command:

- reuses an existing Next dev server on `http://localhost:3000` when present
- otherwise starts the Next dev server
- launches the desktop app through the repaired Electrobun CLI path

### Electrobun vendor patch

This repo currently applies a small postinstall patch in [desktop/scripts/patch-electrobun-wrapper.cjs](desktop/scripts/patch-electrobun-wrapper.cjs).

Why it exists:

- the published `electrobun` package's binary wrapper was failing for this project with opaque `Bundle failed` errors
- the published source CLI also ships missing source-side modules needed for `dev` and `build`
- the patch restores those missing pieces and reroutes the wrapper to the working source CLI

The patch is reapplied automatically on `pnpm --dir desktop install`.

## Project Structure

- `app/` - Next.js app router entrypoints
- `components/editor/` - editor shell, toolbar, panels, and canvas
- `lib/editor-store/` - Zustand store, selectors, hooks, history integration
- `lib/editor-renderer-svg/` - SVG geometry rendering
- `lib/editor-overlay-canvas/` - editor-only overlay drawing (grid, selection, guides)
- `lib/schema/` - canonical project/icon schema types and sample project
- `public/vendor/paper-core.min.js` - Paper.js browser runtime loaded by overlay hook
- `desktop/` - Electrobun shell, native bridge, and desktop build scripts

## Notes

- The overlay canvas is editor-only; it does not affect SVG export output.
- Geometry source-of-truth remains SVG `d` path data in the schema layer model.


## Runtime Consumption APIs (Phase E4–E7)

### Generated React component API (E4)

The React codegen path emits per-icon wrapper components that call `VibeIcon` and embed each icon payload.

Generated components expose icon-specific TypeScript unions for:
- variant IDs and sizes
- state IDs
- effect IDs

This is the primary consumer API; consumers should import generated components rather than raw schema objects.

### Vanilla JS API (E6)

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

### CSS transition fallback (E7)

For track transitions that only animate `opacity` and transform properties (`rotate`, `translateX`, `translateY`, `scale`), runtime-dom now prefers CSS transitions.

JS frame scheduling is still used for:
- morph interpolation (`d`)
- draw/pathLength animation
- fallback crossfade/magic-replace visuals

### Runtime size budget check (E5)

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
  --package-name @coniva/icons \
  --package-version 1.0.0 \
  --generate-react
```

### Local development / test fixtures

For compiling directly from a project/workspace JSON file (editor-local only, not for CI):

```bash
bun scripts/compile-icons.ts \
  --project tests/fixtures/e2e/compiler-project.json \
  --out ./.artifacts/icons \
  --package-name @coniva/icons \
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
bun run validate:icons:package --package-name @coniva/icons --package-version 1.2.3
```

### Local release dry-run

```bash
bun run release:icons:dry-run --package-version 1.2.3 --package-name @coniva/icons
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
import { IcChevronRight } from '@coniva/icons';
import Play24 from '@coniva/icons/sizes/24/IcPlay';
import { IcPlay } from '@coniva/icons/collections/media';
```

Per-icon import:

```tsx
import IcChevronRight from '@coniva/icons/icons/IcChevronRight';
```

## GitHub PR Sync Pipeline

The sync pipeline pushes icon source files from the editor to a GitHub repository via Pull Requests.

### Architecture

```
Editor → exportSourcePayload → POST /api/github-sync/pr → syncPr orchestrator
                                                              │
                                 ┌────────────────────────────┤
                                 ▼                            ▼
                           GitProvider                  Conflict detection
                           (GitHub REST)               (optimistic concurrency)
                                 │
                    ┌────────────┼────────────────┐
                    ▼            ▼                 ▼
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

### Sync Lifecycle

1. **Export** — editor serializes project state to canonical source files (`icon.json` + `preview.svg` + `manifest.json`)
2. **Diff** — byte-for-byte comparison with previous sync to identify changed files only
3. **Validate** — path traversal checks, schema compliance, source-of-truth guardrails
4. **Conflict check** — optimistic concurrency: detects base-SHA drift, remote icon changes, branch collisions, auth expiry
5. **Branch** — creates a uniquely-named feature branch from the base branch HEAD
6. **Commit** — writes changed files and deletes removed files via the Contents API
7. **PR** — opens a pull request with structured body (icon delta table, validation checklist, schema version)
8. **CI** — `icons-pr-validate` workflow validates source export, runs compile dry-run, uploads preview artifacts

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

### Failure Modes

| Phase | Error Code | Recovery |
|-------|-----------|----------|
| Auth | `AUTH_FAILURE` | Regenerate and set `GITHUB_SYNC_TOKEN` |
| Permission | `REPO_PERMISSION_FAILURE` | Grant contents + PR write scope |
| Conflict | `CONFLICT_DETECTED` | Re-export from latest base, or force-sync |
| Branch creation | `BRANCH_CREATION_FAILURE` | Check base branch exists and token has write access |
| File write | `FILE_WRITE_FAILURE` | Check repo isn't in read-only mode; retry |
| PR creation | `PR_CREATION_FAILURE` | Check PR limit not exceeded; retry |

Steps 7-10 (branch, files, PR) can leave an **orphan branch** on partial failure. The error response includes `orphanBranch` so the caller or admin can clean it up.

### Operational Runbook

**Disable sync during an incident:**
```bash
SYNC_ENABLED=false  # set in platform env config, no deploy needed
```

**Roll out to a staging repo first:**
```bash
SYNC_ALLOWED_REPOS=myorg/icons-staging
SYNC_DRY_RUN_ONLY=false
```

**Investigate a failed sync:**
1. Check server logs for the `sync_failed` analytics event — it includes `failedPhase`, `errorCode`, and `orphanBranch`.
2. If an orphan branch exists, delete it: `git push origin --delete <branch-name>`
3. Check the troubleshooting guide: `docs_canonical/SYNC_TROUBLESHOOTING.md`

**Monitor sync health:**
- `sync_completed` events indicate successful syncs
- `sync_failed` events with `failedPhase` pinpoint which step broke
- `sync_conflict_detected` events show how often users hit stale-base conflicts
- Use `formatSyncTimeline()` in debug mode for detailed timing breakdown

### Known Limitations

1. **No real-time collaboration.** The sync model is export-then-push, not live co-editing. Two users editing the same icon set concurrently will see conflict errors on the second sync attempt. The recommended workflow is: one user syncs at a time, or use the `force` flag after reviewing the diff.

2. **One commit per file.** The Contents API creates one commit per file write/delete. For large changesets this produces many commits on the feature branch. This is a GitHub REST API limitation — batched tree commits would require switching to the low-level Git Data API.

3. **No commit signing.** Commits are unsigned unless the token belongs to a GitHub App with signing configured. Repos that require signed commits will block the PR merge.

4. **Conflict detection is heuristic for remote icon changes.** Base-SHA drift is exact, but detecting *which* icons changed remotely uses file-count comparison rather than content hashing. A false positive is possible if files were added/removed without changing icon content.

5. **Orphan branches on partial failure.** If a file write or PR creation fails after the branch is created, the branch remains on the remote. The error response reports it as `orphanBranch` for manual cleanup.

6. **Token expiration is not auto-refreshed.** If using a short-lived token (GitHub App installation tokens expire after 1 hour), the server process must refresh it externally. The sync pipeline does not handle token rotation.

7. **Single base branch.** Each sync targets one base branch. Multi-branch workflows (e.g., syncing to both `main` and `release`) require separate sync requests.

8. **No partial sync.** You cannot sync a subset of icons — the payload always represents the full canonical state. Unchanged files are skipped via diffing, but the payload must include everything.


## Legacy planning docs status

Legacy implementation/design plans under `docs/plans/` are now indexed in `docs/plans/STATUS.md` with dispositions and canonical replacements. Treat canonical docs under `docs_canonical/` as authoritative.
