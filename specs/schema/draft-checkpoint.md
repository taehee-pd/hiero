# Draft Checkpoint Schema

**Status:** Reviewed
**Primary files:** `lib/persistence/adapter.ts`, `lib/persistence/indexeddb-adapter.ts`, `lib/persistence/persistence-manager.ts`, `lib/persistence/save-state.ts`

## Overview

This spec defines the **DraftCheckpoint** model — a durable, user-intentful snapshot of a workspace that sits **between** background autosave and a published release. It exists to give designers an explicit "Save" action that is distinct from autosave and from publish.

The Hiero Self-Hosted Studio Spec Sheet calls this out as the most-frequently-confused concept in the prior product: autosave was the only practical save layer, and "Save" had no first-class meaning. This spec pins three durability tiers with clearly different guarantees.

## Goals

- Designers can create timestamped, optionally memoed snapshots of their work
- Snapshots are **append-only** — creating one never overwrites a prior one
- The list of recent checkpoints is browseable and each one is restorable
- Autosave's existing 500ms debounce semantics are preserved unchanged

## Non-Goals

- This is **not** a publish — checkpoints are local only
- This is **not** undo/redo — the editor's transient history stays separate
- Per-icon or per-layer checkpointing — one checkpoint snapshots the whole workspace

## Durability tiers

```text
   transient ── isDirty true ────────────────► 'unsaved'
                       │
                       ▼
   background ── PersistenceManager.scheduleSave (500ms debounce)
                       │
                       ▼
                hiero_projects (IDB store, single row per project)
                       │
                       ▼
                 'autosaved'
                       │
                       ▼
   user-intentful ── PersistenceManager.createCheckpoint(memo?)
                       │
                       ▼
            hiero_draft_checkpoints (IDB store, append-only)
                       │
                       ▼
                'draft-saved'
                       │
                       ▼
   release ── publish-transaction.executePublishTransaction
                       │
                       ▼
            hiero_version_snapshots (IDB store, append-only)
                       │
                       ▼
                 'published'
```

## Types

```typescript
/** Metadata-only view used by checkpoint list UIs. */
export type DraftCheckpointMeta = {
  id: string;
  projectId: string;
  createdAt: number;       // ms epoch
  memo: string | null;     // user-supplied label, normalized: empty/whitespace → null
  iconCount: number;
};

/** Full record with embedded workspace snapshot. */
export type DraftCheckpoint = DraftCheckpointMeta & {
  data: Workspace;
};
```

## Adapter contract

```typescript
interface PersistenceAdapter {
  // ... existing project methods

  createCheckpoint(
    projectId: string,
    data: Workspace,
    memo: string | null,
  ): Promise<DraftCheckpointMeta>;

  listCheckpoints(projectId: string): Promise<DraftCheckpointMeta[]>; // newest first
  loadCheckpoint(id: string): Promise<DraftCheckpoint | null>;
  deleteCheckpoint(id: string): Promise<void>;
}
```

## IndexedDB layout

- Database: `hiero_projects` (existing)
- Schema version: 2 (introduced in Phase 1)
- New store: `hiero_draft_checkpoints`
  - `keyPath: 'id'`
  - Index `projectId_createdAt` on `['projectId', 'createdAt']` — supports range scans for list-by-project
- Schema upgrades use a **switch-fallthrough** handler keyed on `event.oldVersion` so a fresh install at the latest version and a user upgrading from v1 both end up with the same final shape. See `lib/persistence/indexeddb-adapter.ts:applyUpgrade`.

## Manager API rules

```typescript
class PersistenceManager {
  async createCheckpoint(workspace: Workspace, memo?: string | null): Promise<DraftCheckpointMeta>;
  async listCheckpoints(): Promise<DraftCheckpointMeta[]>;
  async loadCheckpoint(id: string): Promise<DraftCheckpoint | null>;
  async deleteCheckpoint(id: string): Promise<void>;
}
```

- **Race-prevention.** `createCheckpoint` flushes any pending autosave first using the queued workspace (not the new checkpoint payload), so the autosave row reflects the latest typed state and the checkpoint row reflects the explicit-Save state. Both writes happen in deterministic order.
- **Memo normalization.** Empty strings and whitespace-only memos are stored as `null` so the UI can render "untitled checkpoint" without ambiguous empty labels.
- **Project ID.** If no `projectId` is set when `createCheckpoint` is called, the manager auto-generates one (matching the existing `executeSave` behavior).
- **Errors.** Adapter errors are surfaced via the `onError` callback **and** rethrown so the caller can distinguish failures from successes (autosave swallows by design; checkpoints don't).

## Save-state taxonomy hook

`lib/persistence/save-state.ts` exposes `deriveSaveState({ isDirty, lastAutosaveAt, lastCheckpointAt, lastPublishedAt })` returning one of:

- `'unsaved'` — `isDirty` is true (always wins)
- `'published'` — most recent of {publish, checkpoint}, ties favor publish
- `'draft-saved'` — most recent is checkpoint
- `'autosaved'` — only autosave timestamp present (or nothing yet on a clean workspace)

See `specs/ui/save-state-taxonomy.md` for the full state machine and copy.

## Test contract

- `tests/persistence-adapter.test.ts` — append-only behavior, `listCheckpoints` newest-first, projectId scoping, full payload roundtrip
- `tests/persistence-manager.test.ts` — autosave/checkpoint race ordering, memo normalization, project-ID auto-generation, error surfacing
- `tests/save-state.test.ts` — 16-combination matrix covering every input × dirty crossproduct
- `tests/idb-migration.test.ts` — fresh install + v1→v2 upgrade lands at the same final schema

## Open future work

- Retention policy (eng-review §Performance #3): cap list query at 100 with pagination, OR auto-prune checkpoints older than 30 days. Decide before checkpoint count grows past the UI's comfortable scroll depth.
- Memo edit / rename after creation — currently checkpoints are immutable.
- Cross-project import/export of checkpoints (out of scope for the first wedge).
