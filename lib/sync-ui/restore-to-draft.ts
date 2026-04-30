/**
 * Restore-to-draft action.
 *
 * Loads a published VersionSnapshot back into the editor as a *draft*,
 * never as a publish (spec rule #7: "rollback should not silently
 * publish"). The user re-publishes explicitly if they want.
 *
 *   ┌──────────┐
 *   │ snapshot │ ── loadVersionSnapshot ──► workspace
 *   └──────────┘                                  │
 *                                                 ▼
 *                                          editorStore.loadWorkspace
 *                                          (markDirty: true)
 *                                                 │
 *                                                 ▼
 *                                          createCheckpoint
 *                                          ("Restored from vX.Y.Z")
 *                                                 │
 *                                                 ▼
 *                                          appendRestoreEvent (audit)
 *
 * Dirty-work handling: callers should pre-check `editorStore.isDirty`
 * and surface the three-button confirm UI (Save & Restore / Discard &
 * Restore / Cancel). This module accepts a `dirtyWorkResolution` arg so
 * the caller's choice is recorded on the audit row.
 */

'use client';

import type { Workspace } from '@/lib/schema/types';
import type { PersistenceAdapter } from '@/lib/persistence/adapter';
import type {
  RestoreEvent,
  VersionSnapshot,
} from '@/lib/sync-service/version-snapshot';

export type DirtyWorkResolution =
  | 'checkpoint' // user picked Save & Restore — pre-restore work saved
  | 'discarded' // user picked Discard & Restore
  | 'no-dirty-work'; // restore happened on a clean workspace

export type RestoreOptions = {
  persistence: PersistenceAdapter;
  /** Display name for the audit trail. */
  restoredBy: string;
  /** What happened to the user's pre-restore work. */
  dirtyWorkResolution: DirtyWorkResolution;
  /** Project id the restore writes into; null if no project context. */
  projectId: string | null;
  /** Override clock for deterministic tests. */
  now?: () => Date;
  /** Override id generation for deterministic tests. */
  generateId?: () => string;
  /**
   * Sink for the restored workspace. Production wires this to
   * `editorStore.getState().loadWorkspace(ws, { markDirty: true })` and
   * `persistenceManager.createCheckpoint`. Tests provide a stub.
   */
  applyToEditor: (
    workspace: Workspace,
    snapshot: VersionSnapshot,
  ) => Promise<void>;
};

export type RestoreResult = {
  snapshot: VersionSnapshot;
  event: RestoreEvent;
};

function defaultRestoreId(): string {
  return `restore_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Restore a published version's workspace into the editor as a draft
 * and append an audit row. Throws if the snapshot can't be loaded.
 */
export async function restoreSnapshotIntoDraft(
  snapshotId: string,
  options: RestoreOptions,
): Promise<RestoreResult> {
  const snapshot = await options.persistence.loadVersionSnapshot(snapshotId);
  if (!snapshot) {
    throw new Error(`Version snapshot not found: ${snapshotId}`);
  }

  const now = options.now ?? (() => new Date());
  const generateId = options.generateId ?? defaultRestoreId;

  // 1. Apply the workspace to the editor as a dirty draft. The caller
  //    is responsible for any preserveDirtyWorkAs side-effect (e.g.
  //    creating a "Auto-saved before restore" checkpoint) BEFORE this
  //    runs — by the time we get here, the choice has been made.
  await options.applyToEditor(snapshot.workspaceSnapshot, snapshot);

  // 2. Append the audit row. Append-only — there is no delete API.
  const event: RestoreEvent = {
    id: generateId(),
    snapshotId: snapshot.id,
    snapshotVersion: snapshot.version,
    restoredAt: now().toISOString(),
    restoredBy: options.restoredBy,
    projectId: options.projectId,
    preservedDirtyWorkAs: options.dirtyWorkResolution,
  };
  await options.persistence.appendRestoreEvent(event);

  return { snapshot, event };
}
