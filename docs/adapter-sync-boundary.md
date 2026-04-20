# Adapter / Sync Boundary

This document defines the architectural boundary between **adapters** (pure transforms) and **sync connectors** (I/O orchestrators) in the Hiero export pipeline.

## Definitions

### Adapter

A pure, deterministic transform function that converts Hiero schema data into platform-specific output (React components, Swift structs, Flutter widgets, etc.).

**Properties:**

- No file system access, no network calls, no side effects.
- Receives structured input (Icon schema, RuntimeVariantPayload, RuntimeIconMeta).
- Returns structured output: `{ files: Array<{ path: string; contents: string }>; diagnostics: PlatformDiagnostic[] }`.
- Idempotent: same input always produces the same output.

### Sync Connector

An I/O orchestrator that writes adapter output to a target destination (local filesystem, Git repository, npm registry, cloud storage).

**Properties:**

- Performs file system writes, Git operations, API calls.
- Reads previous manifests to detect stale files.
- Handles conflict resolution, branching, and commit creation.
- Calls adapters internally but never contains codegen logic itself.

## Module Placement

```
lib/
  export/
    adapters/                  # Pure transforms (no I/O)
      react-adapter.ts         # Icon -> React component files
      storybook-generator.ts   # Icon -> Storybook stories
      manifest-cleanup.ts      # Stale file detection utilities
  sync-service/
    connectors/                # I/O orchestrators
      github-connector.ts      # Push to GitHub via PR
      filesystem-connector.ts  # Write to local directory
      registry-connector.ts    # Publish to npm/pub registry
```

## Data Flow

```
                                 Pure boundary
                                      |
  Icon Schema  ─────>  Adapter  ──────|──>  { files[], diagnostics[] }
                          |           |
                          v           |
                   RuntimeIconMeta    |
                   RuntimeVariantPayload
                                      |
                                      |
                        Sync Connector (I/O)
                              |
                    ┌─────────┼─────────┐
                    v         v         v
                 GitHub    Local FS   Registry
```

### Detailed steps

1. **Export pipeline** produces `RuntimeIconMeta` + `RuntimeVariantPayload[]` from the Icon schema.
2. **Adapter** receives these plus the original `Icon` schema object. It generates file contents and collects platform diagnostics.
3. **Manifest cleanup** compares the current file list against the previous manifest to identify stale files that should be removed.
4. **Sync connector** receives the adapter result and:
   - Reads the previous `.hiero-manifest.json` from the target.
   - Computes stale files via `computeStaleFiles()`.
   - Writes new files, removes stale files.
   - Writes the updated manifest via `buildManifest()` + `serializeManifest()`.
   - Commits / pushes / publishes as needed.

## Import Decision

Generated React components import the runtime from a configurable package path:

```typescript
import { HieroIcon } from '@hiero/runtime-react';
import type { Icon } from '@hiero/runtime-react';
```

The default package is `@hiero/runtime-react`. This can be overridden via adapter options for monorepo setups or custom distributions.

The adapter does **not** import from `@/lib/runtime-react` (the internal workspace path). Generated code is intended for external consumption and uses the published package name.

## Design Constraints

- Adapters must never import Node.js built-ins (`fs`, `path`, `child_process`).
- Adapters must be testable without mocking any I/O.
- Sync connectors must never contain codegen string templates.
- The manifest is the single source of truth for "what was generated last time".
