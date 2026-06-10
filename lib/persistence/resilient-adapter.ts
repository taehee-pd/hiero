/**
 * Resilient persistence adapter — IndexedDB with an in-memory fallback.
 *
 * Wraps the primary (IndexedDB) adapter. When an operation fails in a
 * way that means storage is *unavailable* (missing API in private
 * browsing, security policy, corrupted/version-locked database), the
 * adapter permanently switches this session to `MemoryAdapter` and
 * flips the shared storage status so the UI can warn the user.
 *
 * Quota errors deliberately do NOT degrade: the database is healthy and
 * holds the user's existing projects — falling back to memory would
 * hide them. Those keep surfacing through the manager's onError toast.
 *
 * `probe()` runs at construction so a blocked IndexedDB is detected at
 * startup — before the user's first edit — not on the first failed save.
 */

'use client';

import type { Workspace } from '@/lib/schema/types';
import type {
  RestoreEvent,
  VersionSnapshot,
  VersionSnapshotMeta,
} from '@/lib/sync-service/version-snapshot';
import type {
  DraftCheckpoint,
  DraftCheckpointMeta,
  PersistenceAdapter,
  ProjectMeta,
  SavedProject,
} from './adapter';
import { MemoryAdapter } from './memory-adapter';
import { markStorageDegraded } from './storage-status';

/** DOMException names that mean "storage cannot be used", not "this write failed". */
const UNAVAILABLE_ERROR_NAMES = new Set([
  'SecurityError',
  'InvalidStateError',
  'UnknownError',
  'VersionError',
  'NotFoundError',
]);

export function isStorageUnavailableError(error: unknown): boolean {
  if (error instanceof TypeError || error instanceof ReferenceError) {
    // `indexedDB` missing entirely (some private modes, sandboxed iframes).
    return true;
  }
  if (error && typeof error === 'object' && 'name' in error) {
    const name = (error as { name: unknown }).name;
    return typeof name === 'string' && UNAVAILABLE_ERROR_NAMES.has(name);
  }
  return false;
}

export class ResilientAdapter implements PersistenceAdapter {
  private primary: PersistenceAdapter;
  private fallback = new MemoryAdapter();
  private degraded = false;

  constructor(primary: PersistenceAdapter, options?: { probe?: boolean }) {
    this.primary = primary;
    if (options?.probe !== false) {
      void this.probe();
    }
  }

  /** Detect blocked storage at startup so the banner shows before the first edit. */
  private async probe(): Promise<void> {
    try {
      await this.primary.list();
    } catch (error) {
      if (isStorageUnavailableError(error)) this.degrade(error);
    }
  }

  private degrade(error: unknown): void {
    if (!this.degraded) {
      this.degraded = true;
      markStorageDegraded();
      console.error(
        '[persistence] IndexedDB unavailable — falling back to in-memory storage for this session:',
        error,
      );
    }
  }

  private async run<T>(op: (adapter: PersistenceAdapter) => Promise<T>): Promise<T> {
    if (this.degraded) return op(this.fallback);
    try {
      return await op(this.primary);
    } catch (error) {
      if (!isStorageUnavailableError(error)) throw error;
      this.degrade(error);
      return op(this.fallback);
    }
  }

  list(): Promise<ProjectMeta[]> {
    return this.run((a) => a.list());
  }

  load(id: string): Promise<SavedProject | null> {
    return this.run((a) => a.load(id));
  }

  save(id: string, data: Workspace): Promise<void> {
    return this.run((a) => a.save(id, data));
  }

  delete(id: string): Promise<void> {
    return this.run((a) => a.delete(id));
  }

  rename(id: string, newName: string): Promise<void> {
    return this.run((a) => a.rename(id, newName));
  }

  createCheckpoint(
    projectId: string,
    data: Workspace,
    memo: string | null,
  ): Promise<DraftCheckpointMeta> {
    return this.run((a) => a.createCheckpoint(projectId, data, memo));
  }

  listCheckpoints(projectId: string): Promise<DraftCheckpointMeta[]> {
    return this.run((a) => a.listCheckpoints(projectId));
  }

  loadCheckpoint(id: string): Promise<DraftCheckpoint | null> {
    return this.run((a) => a.loadCheckpoint(id));
  }

  deleteCheckpoint(id: string): Promise<void> {
    return this.run((a) => a.deleteCheckpoint(id));
  }

  saveVersionSnapshot(snapshot: VersionSnapshot): Promise<void> {
    return this.run((a) => a.saveVersionSnapshot(snapshot));
  }

  listVersionSnapshots(): Promise<VersionSnapshotMeta[]> {
    return this.run((a) => a.listVersionSnapshots());
  }

  loadVersionSnapshot(id: string): Promise<VersionSnapshot | null> {
    return this.run((a) => a.loadVersionSnapshot(id));
  }

  appendRestoreEvent(event: RestoreEvent): Promise<void> {
    return this.run((a) => a.appendRestoreEvent(event));
  }

  listRestoreEvents(snapshotId: string): Promise<RestoreEvent[]> {
    return this.run((a) => a.listRestoreEvents(snapshotId));
  }
}
