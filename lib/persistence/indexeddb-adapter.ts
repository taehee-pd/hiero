/**
 * IndexedDB persistence adapter for web.
 *
 * Two stores live in the same database:
 *
 *   hiero_projects (v1)              — autosaved current workspace per project
 *     keyPath: 'id'
 *
 *   hiero_draft_checkpoints (v2)     — durable user-intent draft snapshots
 *     keyPath: 'id'
 *     index 'projectId_createdAt' on ['projectId', 'createdAt'] (history listing)
 *
 * Schema upgrades use a switch-fallthrough handler keyed off
 * `event.oldVersion` so a fresh install at v4 and a user upgrading from
 * v1 both end up with the same final shape. Add new stores by appending a
 * case; do NOT renumber existing cases.
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

const DB_NAME = 'hiero_projects';
export const DB_VERSION = 4;
export const PROJECTS_STORE = 'projects';
export const CHECKPOINTS_STORE = 'hiero_draft_checkpoints';
export const CHECKPOINTS_INDEX_PROJECT_CREATED = 'projectId_createdAt';
export const VERSION_SNAPSHOTS_STORE = 'hiero_version_snapshots';
export const VERSION_SNAPSHOTS_INDEX_PUBLISHED_AT = 'publishedAt';
export const RESTORE_EVENTS_STORE = 'hiero_restore_events';
export const RESTORE_EVENTS_INDEX_SNAPSHOT_RESTORED = 'snapshotId_restoredAt';

type StoredProjectRecord = {
  id: string;
  name: string;
  data: Workspace;
  updatedAt: number;
  iconCount: number;
  /**
   * D5 — last-known-good payload. Every autosave keeps the previous
   * (structurally valid) workspace alongside the new one, so a write
   * that lands corrupted never strands the project: `load()` falls
   * back to the backup instead of returning garbage.
   */
  backupData?: Workspace;
};

/** Cheap structural sanity check — catches truncated/corrupted payloads. */
export function isWorkspaceShaped(data: unknown): data is Workspace {
  if (!data || typeof data !== 'object') return false;
  const candidate = data as { iconSets?: unknown; meta?: unknown };
  return (
    typeof candidate.iconSets === 'object' &&
    candidate.iconSets !== null &&
    typeof candidate.meta === 'object' &&
    candidate.meta !== null
  );
}

/**
 * Pick the workspace to surface from a stored record: the primary
 * payload when it is well-formed, otherwise the last-known-good
 * backup. Returns null when neither survives.
 * Exported for unit testing.
 */
export function resolveStoredWorkspace(record: {
  data: unknown;
  backupData?: unknown;
}): { data: Workspace; recovered: boolean } | null {
  if (isWorkspaceShaped(record.data)) {
    return { data: record.data, recovered: false };
  }
  if (isWorkspaceShaped(record.backupData)) {
    return { data: record.backupData, recovered: true };
  }
  return null;
}

type StoredCheckpointRecord = {
  id: string;
  projectId: string;
  createdAt: number;
  memo: string | null;
  iconCount: number;
  data: Workspace;
};

function countIcons(workspace: Workspace): number {
  let count = 0;
  for (const setId of Object.keys(workspace.iconSets)) {
    count += Object.keys(workspace.iconSets[setId].icons).length;
  }
  return count;
}

/**
 * Apply schema upgrades cumulatively. Each `case` is the upgrade FROM that
 * version; cases fall through, so a fresh database (oldVersion === 0) runs
 * every step and a user on v1 runs only the v1→v2 step.
 *
 * Exported for unit testing — most call sites should not import this.
 */
export function applyUpgrade(db: IDBDatabase, oldVersion: number): void {
  switch (oldVersion) {
    /* eslint-disable no-fallthrough */
    case 0: {
      if (!db.objectStoreNames.contains(PROJECTS_STORE)) {
        db.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
      }
    }
    case 1: {
      if (!db.objectStoreNames.contains(CHECKPOINTS_STORE)) {
        const store = db.createObjectStore(CHECKPOINTS_STORE, {
          keyPath: 'id',
        });
        store.createIndex(CHECKPOINTS_INDEX_PROJECT_CREATED, [
          'projectId',
          'createdAt',
        ]);
      }
    }
    case 2: {
      if (!db.objectStoreNames.contains(VERSION_SNAPSHOTS_STORE)) {
        const store = db.createObjectStore(VERSION_SNAPSHOTS_STORE, {
          keyPath: 'id',
        });
        store.createIndex(VERSION_SNAPSHOTS_INDEX_PUBLISHED_AT, 'publishedAt');
      }
    }
    case 3: {
      if (!db.objectStoreNames.contains(RESTORE_EVENTS_STORE)) {
        const store = db.createObjectStore(RESTORE_EVENTS_STORE, {
          keyPath: 'id',
        });
        store.createIndex(RESTORE_EVENTS_INDEX_SNAPSHOT_RESTORED, [
          'snapshotId',
          'restoredAt',
        ]);
      }
    }
    /* eslint-enable no-fallthrough */
  }
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      applyUpgrade(request.result, event.oldVersion);
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(
  db: IDBDatabase,
  storeName: string,
  mode: IDBTransactionMode,
): IDBObjectStore {
  const tx = db.transaction(storeName, mode);
  return tx.objectStore(storeName);
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function generateCheckpointId(): string {
  return `ckpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function toCheckpointMeta(record: StoredCheckpointRecord): DraftCheckpointMeta {
  return {
    id: record.id,
    projectId: record.projectId,
    createdAt: record.createdAt,
    memo: record.memo,
    iconCount: record.iconCount,
  };
}

export class IndexedDBAdapter implements PersistenceAdapter {
  async list(): Promise<ProjectMeta[]> {
    const db = await openDB();
    try {
      const store = txStore(db, PROJECTS_STORE, 'readonly');
      const records = await requestToPromise<StoredProjectRecord[]>(
        store.getAll(),
      );
      return records
        .map((r) => ({
          id: r.id,
          name: r.name,
          updatedAt: r.updatedAt,
          iconCount: r.iconCount,
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } finally {
      db.close();
    }
  }

  async load(id: string): Promise<SavedProject | null> {
    const db = await openDB();
    try {
      const store = txStore(db, PROJECTS_STORE, 'readonly');
      const record = await requestToPromise<StoredProjectRecord | undefined>(
        store.get(id),
      );
      if (!record) return null;
      const resolved = resolveStoredWorkspace(record);
      if (!resolved) return null;
      if (resolved.recovered) {
        console.warn(
          `[persistence] project ${id}: primary payload was corrupted; recovered the previous snapshot.`,
        );
      }
      return {
        id: record.id,
        name: record.name,
        data: resolved.data,
        updatedAt: record.updatedAt,
      };
    } finally {
      db.close();
    }
  }

  async save(id: string, data: Workspace): Promise<void> {
    const db = await openDB();
    try {
      const store = txStore(db, PROJECTS_STORE, 'readwrite');
      // Keep the previous well-formed payload as the last-known-good
      // backup (D5). Same transaction, so the read can't race the put.
      const existing = await requestToPromise<StoredProjectRecord | undefined>(
        store.get(id),
      );
      const record: StoredProjectRecord = {
        id,
        name: data.meta.name,
        data,
        updatedAt: Date.now(),
        iconCount: countIcons(data),
        ...(existing && isWorkspaceShaped(existing.data)
          ? { backupData: existing.data }
          : existing?.backupData
            ? { backupData: existing.backupData }
            : {}),
      };
      await requestToPromise(store.put(record));
    } finally {
      db.close();
    }
  }

  async delete(id: string): Promise<void> {
    const db = await openDB();
    try {
      const store = txStore(db, PROJECTS_STORE, 'readwrite');
      await requestToPromise(store.delete(id));
    } finally {
      db.close();
    }
  }

  async rename(id: string, newName: string): Promise<void> {
    const db = await openDB();
    try {
      const store = txStore(db, PROJECTS_STORE, 'readwrite');
      const record = await requestToPromise<StoredProjectRecord | undefined>(
        store.get(id),
      );
      if (!record) return;
      record.name = newName;
      record.data = {
        ...record.data,
        meta: { ...record.data.meta, name: newName },
      };
      record.updatedAt = Date.now();
      await requestToPromise(store.put(record));
    } finally {
      db.close();
    }
  }

  async createCheckpoint(
    projectId: string,
    data: Workspace,
    memo: string | null,
  ): Promise<DraftCheckpointMeta> {
    const db = await openDB();
    try {
      const store = txStore(db, CHECKPOINTS_STORE, 'readwrite');
      const record: StoredCheckpointRecord = {
        id: generateCheckpointId(),
        projectId,
        createdAt: Date.now(),
        memo,
        iconCount: countIcons(data),
        data,
      };
      await requestToPromise(store.put(record));
      return toCheckpointMeta(record);
    } finally {
      db.close();
    }
  }

  async listCheckpoints(projectId: string): Promise<DraftCheckpointMeta[]> {
    const db = await openDB();
    try {
      const store = txStore(db, CHECKPOINTS_STORE, 'readonly');
      const index = store.index(CHECKPOINTS_INDEX_PROJECT_CREATED);
      const range = IDBKeyRange.bound(
        [projectId, -Infinity],
        [projectId, Infinity],
      );
      const records = await requestToPromise<StoredCheckpointRecord[]>(
        index.getAll(range),
      );
      return records
        .map(toCheckpointMeta)
        .sort((a, b) => b.createdAt - a.createdAt);
    } finally {
      db.close();
    }
  }

  async loadCheckpoint(id: string): Promise<DraftCheckpoint | null> {
    const db = await openDB();
    try {
      const store = txStore(db, CHECKPOINTS_STORE, 'readonly');
      const record = await requestToPromise<StoredCheckpointRecord | undefined>(
        store.get(id),
      );
      if (!record) return null;
      return {
        ...toCheckpointMeta(record),
        data: record.data,
      };
    } finally {
      db.close();
    }
  }

  async deleteCheckpoint(id: string): Promise<void> {
    const db = await openDB();
    try {
      const store = txStore(db, CHECKPOINTS_STORE, 'readwrite');
      await requestToPromise(store.delete(id));
    } finally {
      db.close();
    }
  }

  async saveVersionSnapshot(snapshot: VersionSnapshot): Promise<void> {
    const db = await openDB();
    try {
      const store = txStore(db, VERSION_SNAPSHOTS_STORE, 'readwrite');
      await requestToPromise(store.put(snapshot));
    } finally {
      db.close();
    }
  }

  async listVersionSnapshots(): Promise<VersionSnapshotMeta[]> {
    const db = await openDB();
    try {
      const store = txStore(db, VERSION_SNAPSHOTS_STORE, 'readonly');
      const records = await requestToPromise<VersionSnapshot[]>(
        store.getAll(),
      );
      return records
        .map(({ workspaceSnapshot: _ws, ...meta }) => meta)
        .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
    } finally {
      db.close();
    }
  }

  async loadVersionSnapshot(id: string): Promise<VersionSnapshot | null> {
    const db = await openDB();
    try {
      const store = txStore(db, VERSION_SNAPSHOTS_STORE, 'readonly');
      const record = await requestToPromise<VersionSnapshot | undefined>(
        store.get(id),
      );
      return record ?? null;
    } finally {
      db.close();
    }
  }

  async appendRestoreEvent(event: RestoreEvent): Promise<void> {
    const db = await openDB();
    try {
      const store = txStore(db, RESTORE_EVENTS_STORE, 'readwrite');
      // `add` (not `put`) so duplicate ids throw — append-only contract.
      await requestToPromise(store.add(event));
    } finally {
      db.close();
    }
  }

  async listRestoreEvents(snapshotId: string): Promise<RestoreEvent[]> {
    const db = await openDB();
    try {
      const store = txStore(db, RESTORE_EVENTS_STORE, 'readonly');
      const index = store.index(RESTORE_EVENTS_INDEX_SNAPSHOT_RESTORED);
      const range = IDBKeyRange.bound(
        [snapshotId, ''],
        [snapshotId, '￿'],
      );
      const records = await requestToPromise<RestoreEvent[]>(
        index.getAll(range),
      );
      return records.sort((a, b) => (a.restoredAt < b.restoredAt ? 1 : -1));
    } finally {
      db.close();
    }
  }
}
