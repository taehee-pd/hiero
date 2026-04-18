# Repo-Native Distribution

**Status:** Proposed
**Primary future files:** `lib/live-sync/*`, `packages/cuneiform-cli`, `lib/sync-service/*`

## Overview

This spec defines how Cuneiform distributes icon changes in an installable, repo-native model.

The key change from the existing product model is:

- live integration is the default development loop
- sync and publish become release concerns

Cuneiform should no longer treat `Local / GitHub / npm` as the primary way users experience edits. Those remain valid outputs, but they should happen after Cuneiform has already updated the host repo or host app locally.

## Core Model

Cuneiform distribution has two lanes.

### Lane 1: Live Integration

Used during day-to-day authoring.

```text
Figma plugin export
  -> Cuneiform canonical source
  -> local watcher
  -> incremental rebuild
  -> host module invalidation
  -> host app or optional reference environment reflects the change
```

### Lane 2: Release Distribution

Used for deterministic outputs and transport.

```text
Cuneiform canonical source
  -> snapshot codegen
  -> local-directory OR git-pr OR npm-registry target
  -> CI / release workflow
```

## Inputs

### Ingress

Primary ingress for the first wedge:

- Figma plugin payload exported by the designer

After ingress, Cuneiform becomes the system of record.

### Source of Truth

Canonical source export files remain authoritative:

- `manifest.json`
- `icons/<name>/icon.json`
- `icons/<name>/preview.svg`

## Outputs

### Live Cache Outputs

Disposable local outputs for dev-time speed:

- `.cuneiform/cache/runtime/*`
- `.cuneiform/cache/generated/*`

Properties:

- not team-shared
- safe to delete
- used for incremental rebuild and HMR

### Snapshot Outputs

Deterministic release-oriented outputs, for example:

- `src/icons/generated/data/*`
- `src/icons/generated/components/*`
- `src/icons/generated/index.ts`
- `src/icons/generated/stories/*.stories.tsx`

Properties:

- reproducible from canonical source
- suitable for CI and review
- may be committed or ignored by team policy

## Connectors

### Live Connector

Responsibilities:

- watch canonical source
- rebuild only changed icons
- update live registry or cache outputs
- notify host adapters when invalidation is needed

Non-responsibilities:

- package publish
- remote PR creation
- long-term artifact ownership

### Release Connector

Responsibilities:

- create deterministic snapshot outputs
- write to local output directories
- open PRs when configured
- publish packages when configured

Non-responsibilities:

- HMR
- editor session state
- draft recovery

## Host Adapters

Host adapters sit on top of the live connector.

Examples:

- React app integration
- optional reference app wiring explored later

Responsibilities:

- expose live runtime modules or generated registry files
- trigger host refresh or HMR invalidation
- provide predictable import surfaces for host code

## Product Rules

- Figma is ingress, not SSOT
- Cuneiform is SSOT after import
- the host codebase consumes outputs directly
- live feedback and release sync must remain separate in code and UX

## Failure Scenarios

### Watcher crash

Effect:

- local app stops reflecting edits

Expected behavior:

- canonical source remains intact
- user can restart the watcher without data loss

### Invalid generated cache

Effect:

- host app may fail to reload

Expected behavior:

- cache can be cleared and rebuilt from canonical source
- release outputs are unaffected

### Release sync failure

Effect:

- PR or publish does not complete

Expected behavior:

- live editing loop remains available
- release failure does not corrupt canonical source

## Testing Requirements

- incremental rebuild only touches changed icons
- clearing cache and rebuilding yields equivalent live outputs
- snapshot generation remains deterministic
- release connectors do not depend on live cache presence
- host invalidation events are debounced correctly
