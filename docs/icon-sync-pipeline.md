# Icon Sync & Release Pipeline

This document describes how icons flow from the editor through source export, GitHub PR sync, validation, and the compile/package/release pipeline.

## Architecture Overview

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────┐     ┌─────────────────┐
│   Editor     │────>│  Source Export    │────>│  GitHub PR     │────>│  Compile &      │
│  (Project)   │     │  (icon.json +    │     │  Sync Service  │     │  Package Build  │
│              │     │   manifest.json)  │     │  (API route)   │     │  (post-merge)   │
└─────────────┘     └──────────────────┘     └───────────────┘     └─────────────────┘
```

## Data Model Layers

The system uses four distinct data layers, each serving a specific purpose:

| Layer | Format | Purpose | Location |
|-------|--------|---------|----------|
| **Editor** | `Project` / `Workspace` | Full editor state with metadata | In-app store |
| **Source** | `IconSourceFile` + `SyncSourceManifest` | Canonical versioned source | Target repo (`icons/`) |
| **Compiled** | `CompiledIcon` + `PackageManifest` | Pre-resolved runtime data | Build output |
| **Component** | React `.tsx` + TypeScript | Consumable components | npm package |

### Source Layer (Canonical Repo Source)

After a PR merge, source export files are the **canonical source of truth** in the target repository:

```
<repo-root>/
  manifest.json              # Index of all icons with metadata
  icons/
    chevron/
      icon.json              # Canonical icon source (no editor metadata)
      preview.svg            # SVG preview of default state
    star/
      icon.json
      preview.svg
```

The source layer strips editor-only metadata (`importMeta`, `isClipMask`, `groupId`, `guideMasterId`, `customGuides`, `components`) that is not needed for compilation or versioning.

## Source Export Model

### Export Flow

```typescript
import { exportSourcePayload } from '@/lib/sync-source';

const payload = exportSourcePayload(project);
// payload.files: Array<{ path: string; contents: string }>
// payload.manifest: SyncSourceManifest
```

### What Gets Exported

- **`icon.json`** per icon: Canonical source with schema version, variants, states, layers, transitions, effects
- **`preview.svg`** per icon: SVG render of default state for visual diffing
- **`manifest.json`**: Index with icon count, sizes, categories, paths

### Schema Versions

- `ICON_SOURCE_SCHEMA_VERSION`: `"1.0.0"` — bump when `icon.json` format changes
- `SYNC_SOURCE_MANIFEST_SCHEMA_VERSION`: `"1.0.0"` — bump when `manifest.json` format changes

## PR Sync Flow

### Creating a PR

1. Editor exports source payload via `exportSourcePayload()`
2. Client-side diff (`diffSourcePayloads`) computes changed icons
3. Client calls `POST /api/github-sync/pr` with source files
4. Server-side service creates branch, commits files, opens PR

### Request/Response

```
POST /api/github-sync/pr
  → SyncPrRequest { owner, repo, files, actor, baseSha?, force? }
  ← SyncPrResponse { branch, commitSha, pr: { number, url }, iconChanges }
  ← SyncConflictResponse (409) { conflicts, remoteHeadSha }
  ← { kind: 'no-op' } (200) — no changes detected
```

### Conflict Detection

The service checks for:
- **Base SHA drift**: Remote branch has moved since last sync
- **Remote icon changes**: Icons modified by someone else
- **Remote icon deletions**: Icons deleted from repo
- **Manifest changes**: External manifest modifications
- **Branch collisions**: Preferred branch name already exists (auto-resolves with suffix)

### State Machine

The UI tracks sync progress through these phases:

```
not_connected → ready → exporting → validating → creating_pr → pr_created
                  ↑          ↓           ↓             ↓
                  └── changes_not_synced  │             │
                  └── conflict_detected ←─┘             │
                  └── validation_failed ←───────────────┘
                  └── auth_expired ←────────────────────┘
```

## Validation Flow

### PR Validation (CI)

Triggered on pull requests that modify `icons/`, `manifest.json`, or pipeline code.

**Workflow**: `.github/workflows/icons-pr-validate.yml`

Checks:
1. Unit tests (sync-source, sync-service, compile-pipeline)
2. Source export validation (schema, manifest, previews, determinism, duplicates, paths)
3. Compile pipeline dry run (from project fixture)
4. Source-to-compile dry run (from merged source files)

### Validation Script

```bash
bun scripts/validate-source-export.ts --source <dir> [--project <json>] [--summary <md>]
```

Runs 7 checks:
1. Schema compliance
2. Manifest consistency
3. Preview presence
4. Deterministic serialization
5. Duplicate detection
6. Path safety
7. Compile pipeline (optional)

## Release Flow (Post-Merge)

### How It Works

After a PR merges to `main`, the post-merge workflow rebuilds the icon package:

**Workflow**: `.github/workflows/icons-post-merge-build.yml`

```
Merged source files → Validate → Compile → Package → Upload artifacts
```

### Merge-to-Build Adapter

The adapter layer (`lib/sync-source/source-to-project.ts`) bridges source export files to the compile pipeline:

```typescript
import { projectFromSourceDir } from '@/lib/sync-source';
import { compileProject } from '@/lib/export/compile-pipeline';

// Reconstruct a Project from merged source files
const project = await projectFromSourceDir('./icons-source-dir', {
  name: '@hiero/icons',
  tokenColors: { accent: '#38bdf8' },
});

// Feed into existing compile pipeline — no changes needed
const result = compileProject(project, {
  package: { name: '@hiero/icons', version: '2.0.0', builtAt: new Date().toISOString() },
  generateReact: true,
});
```

### CLI Script

```bash
bun scripts/compile-from-source.ts \
  --source <icons-dir> \
  --out <out-dir> \
  --package-name <name> \
  --package-version <version> \
  [--token-colors <tokens.json>] \
  [--generate-react]
```

### Post-Merge CI Steps

1. **Validate** merged source files
2. **Compile** icons from source → compiled JSON + React components
3. **Validate** compiled package (manifest present, icons compiled)
4. **Dry-run** publish with build summary
5. **Upload** artifacts for downstream consumption

## Key Design Decisions

### Source Files as Canonical Source

After merge, `icon.json` files are the authoritative input for builds. This means:
- No need to maintain a `project.json` in the target repo
- Source files are human-reviewable in PRs
- Git history tracks granular per-icon changes
- The editor roundtrip is intentionally lossy for editor-only metadata

### Adapter Pattern (Not Rewrite)

The merge-to-build adapter reconstructs a `Project` from source files so the existing compile pipeline works **unchanged**. This:
- Preserves the existing package contract (CompiledIcon, PackageManifest, React components)
- Avoids rewriting the compiler to accept a new input format
- Makes the source export layer a clean boundary between editor and build

### Deterministic Serialization

All source and compiled files use deterministic JSON serialization (sorted keys, no undefined values). This ensures:
- Identical input always produces identical output
- Git diffs are minimal and meaningful
- Content hashes are stable for change detection

## File Reference

| File | Purpose |
|------|---------|
| `lib/sync-source/export-source-payload.ts` | Project → source payload |
| `lib/sync-source/source-to-project.ts` | Source files → Project (adapter) |
| `lib/sync-source/export-icon-source.ts` | Icon → IconSourceFile |
| `lib/sync-source/validate.ts` | Pre/post export validation |
| `lib/sync-service/sync-pr.ts` | Sync orchestrator |
| `lib/sync-service/conflicts.ts` | Conflict detection |
| `lib/sync-service/diff-source.ts` | Source-level diffing |
| `lib/sync-ui/sync-state.ts` | UI state machine |
| `lib/sync-ui/use-sync-pr.ts` | React hook for sync flow |
| `lib/export/compile-pipeline.ts` | Compile orchestrator |
| `scripts/compile-from-source.ts` | CLI: source → compile |
| `scripts/compile-icons.ts` | CLI: project → compile |
| `scripts/validate-source-export.ts` | CLI: validate source |
| `.github/workflows/icons-pr-validate.yml` | PR validation CI |
| `.github/workflows/icons-post-merge-build.yml` | Post-merge build CI |
