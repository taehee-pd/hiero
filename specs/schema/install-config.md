# Install Config Schema

**Status:** Proposed
**Primary future files:** `lib/install-config/types.ts`, `lib/install-config/load-config.ts`, `lib/install-config/validate-config.ts`

## Overview

This spec defines the install-time configuration contract for Contour as a repo-native icon authoring platform.

The config file lives at the host repository root as `contour.config.ts`. Its job is to tell Contour:

- where canonical icon source lives
- which host surfaces should update live during development
- which release outputs should be produced for CI, review, or publishing

The key design rule is separation of concerns:

- `hostTargets` describe live development integrations
- `releaseTargets` describe snapshot or publish outputs

This replaces the older idea that one `SyncTarget` abstraction should own both development feedback and release transport.

## Goals

- Make Contour installable into an existing repo
- Keep the host repo as the durable source of truth for shared icon source
- Separate live feedback from release sync
- Keep the config explicit and boring

## Non-Goals

- This config does not store user drafts or recovery data
- This config does not store secrets or credentials
- This config does not replace canonical source files

## Canonical Example

```typescript
export default {
  sourceDir: 'contour',
  hostTargets: [
    {
      kind: 'react-app',
      mode: 'live',
      runtimeMode: 'cache-dir',
      cacheDir: '.contour/cache/app',
    },
  ],
  releaseTargets: [
    {
      kind: 'local-directory',
      outputMode: 'snapshot',
      outputDir: 'src/icons/generated',
    },
  ],
};
```

## Types

### ContourConfig

```typescript
type ContourConfig = {
  sourceDir: string;
  hostTargets: HostTarget[];
  releaseTargets?: ReleaseTarget[];
};
```

### HostTarget

```typescript
type HostTarget =
  | ReactAppHostTarget;
```

```typescript
type ReactAppHostTarget = {
  kind: 'react-app' | 'reference-app';
  mode: 'live';
  runtimeMode: 'in-memory' | 'cache-dir' | 'vendored';
  cacheDir?: string;
};
```

### ReleaseTarget

```typescript
type ReleaseTarget =
  | LocalDirectoryReleaseTarget
  | GitPrReleaseTarget
  | NpmRegistryReleaseTarget;
```

```typescript
type LocalDirectoryReleaseTarget = {
  kind: 'local-directory';
  outputMode: 'snapshot';
  outputDir: string;
};

type GitPrReleaseTarget = {
  kind: 'git-pr';
  outputMode: 'snapshot';
  owner: string;
  repo: string;
  baseBranch: string;
  packagePath?: string;
};

type NpmRegistryReleaseTarget = {
  kind: 'npm-registry';
  outputMode: 'snapshot';
  packageName: string;
  registry?: string;
  scope?: string;
};
```

## Behavior

### Source Directory

`sourceDir` points at the committed canonical icon source used by:

- validation
- compile-from-source flows
- live rebuilds
- snapshot generation

Expected structure:

```text
contour/
  manifest.json
  icons/
    alert/
      icon.json
      preview.svg
```

### Host Targets

Host targets are dev-time integrations only.

They answer:

- which host should react to icon changes
- how live runtime artifacts should be surfaced
- where local cache should be written, if needed

They do not define package publishing, PR creation, or snapshot ownership.

### Release Targets

Release targets are transport or snapshot outputs.

They answer:

- where deterministic generated files go
- whether a PR or package should be created
- how CI and release builds consume outputs

They do not define live HMR or editor interaction.

## Validation Rules

- `sourceDir` is required and must be relative to repo root
- `hostTargets` must have at least one entry for installable live mode
- `releaseTargets` may be empty in development-only repos
- `cacheDir` must never point outside the repo
- secrets must not appear in config values

## Migration from Legacy SyncTarget

Legacy `project.syncTargets` mixed live intent and release transport.

Migration direction:

- live local app usage becomes `hostTargets`
- local-directory, git-pr, and npm-registry delivery becomes `releaseTargets`

During migration, compatibility reads may map legacy sync targets into the new config model for one transition window.

## Edge Cases

- Repo has live host targets but no release targets, valid for teams that commit only canonical source
- Repo has release targets but no host targets, valid for CI or headless workflows, but not the primary installable experience
- Multiple host targets may coexist, but the product should default to the actual host codebase rather than a reference environment
