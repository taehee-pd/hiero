# Version History

**Status:** Reviewed
**Primary files:** `app/history/page.tsx`, `components/studio/history/HistoryView.tsx`, `lib/sync-ui/version-compare.ts`, `lib/sync-ui/restore-to-draft.ts`

## Overview

Version History gives designers a browseable, comparable, restorable view of every successful publish. It lives at the dedicated route `/history` and reads `VersionSnapshot` and `RestoreEvent` records directly from the persistence adapter.

The Hiero Self-Hosted Studio Spec Sheet defines four user-visible deliverables here:

- C4: timeline / list of published versions
- C5: visual + structural compare between two versions
- C6: rollback that restores into draft and never silently publishes
- C9 (related): restore audit trail surfaced in the UI

## Goals

- One published version per row, reverse-chronological
- Two-version compare with added / modified / removed counts and an inline icon list
- Restore-to-draft loads the snapshot's workspace into the editor as a **dirty** draft and creates an audit row
- A user with unsaved changes gets a 3-button confirm before Restore overwrites the workspace

## Non-Goals

- This is **not** the publish surface — `PublishDialog` owns that. History only **reads** snapshots.
- This is **not** undo/redo — `RestoreEvent` audit log is publish-history-grade, not edit-history-grade.
- No multi-user collab — single-user IndexedDB only.

## Routing

```text
app/history/page.tsx ──► definePage({ route: '/history', children: <HistoryView /> })
                                                │
                                                ▼
                              page-registry: { kind: 'standalone' }
```

`/history` is registered as `standalone` (not a `shell`) so it doesn't fork the StudioLayout discriminator. The page-registry `RoutePath` union is updated; `pnpm test:registry` enforces enrollment.

> **Known design gap (P0 follow-up):** `/history` does not currently mount `<Navbar>`, so the page lacks the studio chrome (logo, project name, save badge, Cmd+S binding). Either lift Navbar into HistoryView or promote `/history` to a `shell` route. Tracked separately.

## Data flow

```text
HistoryView mounts
  │
  ├── adapter.listVersionSnapshots()       → setSnapshots(meta[])
  │
  ├── adapter.loadVersionSnapshot(selected) → setSelectedFull(snapshot)
  │     │
  │     └── adapter.listRestoreEvents(id)  → setRestoreEvents
  │
  └── on Compare-with change:
       adapter.loadVersionSnapshot(otherId)
         │
         ▼
       diffWorkspaces(older.workspaceSnapshot, newer.workspaceSnapshot) → setCompareDiff
```

The `older` / `newer` ordering is decided by `publishedAt` so added/removed semantics are natural ("v1.0 → v1.2 added 5 icons"), regardless of which slot the user picks.

## diffWorkspaces

```typescript
type WorkspaceDiff = {
  added: string[];
  removed: string[];
  modified: string[];
  totalAfter: number;
  isIdentical: boolean;
};

function diffWorkspaces(before: Workspace, after: Workspace): WorkspaceDiff;
```

- Operates on `Workspace` objects — not source-payload arrays (see `lib/sync-service/diff-source.ts` for that path)
- Set-namespaced keys (`${setId}/${iconId}`) so the same icon id across different sets is not collapsed
- `modified` uses content equality via `JSON.stringify` — shallow-deep, fast enough for Phase 3
- Sorted alphabetically for deterministic UI rendering

Future: deeper layer/transition diff. Phase 3 stays at icon level on purpose.

## Restore-to-draft

```typescript
async function restoreSnapshotIntoDraft(
  snapshotId: string,
  options: {
    persistence: PersistenceAdapter;
    restoredBy: string;
    dirtyWorkResolution: 'checkpoint' | 'discarded' | 'no-dirty-work';
    projectId: string | null;
    applyToEditor: (workspace: Workspace, snapshot: VersionSnapshot) => Promise<void>;
    now?: () => Date;
    generateId?: () => string;
  },
): Promise<{ snapshot: VersionSnapshot; event: RestoreEvent }>;
```

### Pinned contracts

- **Never silently publishes.** `restoreSnapshotIntoDraft` does not call `saveVersionSnapshot`. Test pinned in `tests/restore-to-draft.test.ts`.
- **Always writes an audit row.** Even if `applyToEditor` is a no-op (test stub), a `RestoreEvent` is appended.
- **`applyToEditor` is caller-injected.** Production wires this to `editorStore.loadWorkspace(ws, { markDirty: true })` so the restored workspace is dirty by definition; tests inject a stub.

### Dirty-work confirm UX

```text
                                     User clicks "Restore to draft"
                                                  │
                                                  ▼
                                       editorStore.isDirty?
                                                  │
                              ┌───────────────────┴──────────────┐
                              │                                  │
                              ▼ no                               ▼ yes
                      runRestore('no-dirty-work')        Show confirm dialog:
                                                        │
                                                        ├── Save & restore
                                                        │     ├── createCheckpoint(memo: "Auto-saved before restore from v...")
                                                        │     └── runRestore('checkpoint')
                                                        ├── Discard & restore
                                                        │     └── runRestore('discarded')
                                                        └── Cancel
                                                              └── close dialog, no restore
```

The dialog is **never silent** on dirty work. Per the spec rule "rollback should not silently publish" — extended in eng review to "rollback should not silently destroy in-progress work." The chosen resolution is recorded on the `RestoreEvent.preservedDirtyWorkAs` field so the audit log distinguishes the three branches.

### Banner

After restore, `HistoryView` renders a banner:

> Restored v{version} into draft. Publish to release.

This is the explicit handoff back to PublishDialog — the user must choose to re-publish. Restore alone produces no public artifact.

## Audit log surfacing

Each snapshot row in HistoryView shows a collapsible `<details>` "Restore audit (N)" section. Each entry renders:

```text
{restoredAt local time} · by {restoredBy} · pre-restore work: {preservedDirtyWorkAs}
```

The audit is queried lazily per selected snapshot; not loaded in bulk during the initial list fetch.

## UI patterns followed (and known divergences)

- Uses `<Select>` from `@/components/ui/select` for the compare-with picker (DESIGN.md §6: no native `<select>` in pane files)
- Uses `<Tag>` from DS for added/modified/removed counts
- Uses `<StatusBadge>` from DS for target results in the version detail
- **Divergence:** the snapshot list rows use raw Tailwind (`text-sm`, `bg-accent`) instead of the project's `wire-list-row` (11px, `var(--accent)` 55% mix). Flagged for a follow-up — when fixed, the history list will scale-match the icons list next to it.

## Test contract

- `tests/version-compare.test.ts` — identical workspaces, added/removed/modified, set-namespacing, alphabetical sort
- `tests/restore-to-draft.test.ts` — applies workspace through sink, records audit, never publishes, missing-id throws, audit accumulates across restores
- `tests/idb-migration.test.ts` — v3→v4 upgrade adds restore-events store

## Open future work

- Mount `<Navbar>` (P0 design-review finding) so `/history` carries studio chrome
- Surface a "History" link/IconButton in the Navbar so the route is reachable
- Pagination / virtualization for snapshot lists once they grow past ~100 entries
- Layer- and transition-level diff in compare view
- Per-icon restore (the spec's §Non-Goals explicitly punts this to future)

## Related specs

- `specs/schema/version-snapshot.md` — VersionSnapshot + RestoreEvent record shapes
- `specs/export/publish-transaction.md` — the publish flow that produces snapshots
- `specs/ui/save-state-taxonomy.md` — `'published'` state shown on the navbar badge after restore-then-publish
