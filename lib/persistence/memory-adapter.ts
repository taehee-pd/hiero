/**
 * In-memory persistence adapter — the degraded-mode fallback.
 *
 * Used by `ResilientAdapter` when IndexedDB is unavailable (private
 * browsing, storage policy, corrupted database). Keeps the editor fully
 * functional for the lifetime of the tab; nothing survives a reload.
 * The `StorageStatusBanner` warns the user whenever this adapter is the
 * active write path.
 */

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

type ProjectRecord = SavedProject & { iconCount: number };

function countIcons(workspace: Workspace): number {
  let count = 0;
  for (const setId of Object.keys(workspace.iconSets)) {
    count += Object.keys(workspace.iconSets[setId].icons).length;
  }
  return count;
}

export class MemoryAdapter implements PersistenceAdapter {
  private projects = new Map<string, ProjectRecord>();
  private checkpoints = new Map<string, DraftCheckpoint>();
  private snapshots = new Map<string, VersionSnapshot>();
  private restoreEvents: RestoreEvent[] = [];

  async list(): Promise<ProjectMeta[]> {
    return [...this.projects.values()]
      .map(({ id, name, updatedAt, iconCount }) => ({ id, name, updatedAt, iconCount }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async load(id: string): Promise<SavedProject | null> {
    const record = this.projects.get(id);
    if (!record) return null;
    const { iconCount: _ic, ...project } = record;
    return project;
  }

  async save(id: string, data: Workspace): Promise<void> {
    this.projects.set(id, {
      id,
      name: data.meta.name,
      data,
      updatedAt: Date.now(),
      iconCount: countIcons(data),
    });
  }

  async delete(id: string): Promise<void> {
    this.projects.delete(id);
  }

  async rename(id: string, newName: string): Promise<void> {
    const record = this.projects.get(id);
    if (!record) return;
    this.projects.set(id, {
      ...record,
      name: newName,
      data: { ...record.data, meta: { ...record.data.meta, name: newName } },
      updatedAt: Date.now(),
    });
  }

  async createCheckpoint(
    projectId: string,
    data: Workspace,
    memo: string | null,
  ): Promise<DraftCheckpointMeta> {
    const checkpoint: DraftCheckpoint = {
      id: `ckpt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      projectId,
      createdAt: Date.now(),
      memo,
      iconCount: countIcons(data),
      data,
    };
    this.checkpoints.set(checkpoint.id, checkpoint);
    const { data: _data, ...meta } = checkpoint;
    return meta;
  }

  async listCheckpoints(projectId: string): Promise<DraftCheckpointMeta[]> {
    return [...this.checkpoints.values()]
      .filter((c) => c.projectId === projectId)
      .map(({ data: _data, ...meta }) => meta)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async loadCheckpoint(id: string): Promise<DraftCheckpoint | null> {
    return this.checkpoints.get(id) ?? null;
  }

  async deleteCheckpoint(id: string): Promise<void> {
    this.checkpoints.delete(id);
  }

  async saveVersionSnapshot(snapshot: VersionSnapshot): Promise<void> {
    this.snapshots.set(snapshot.id, snapshot);
  }

  async listVersionSnapshots(): Promise<VersionSnapshotMeta[]> {
    return [...this.snapshots.values()]
      .map(({ workspaceSnapshot: _ws, ...meta }) => meta)
      .sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1));
  }

  async loadVersionSnapshot(id: string): Promise<VersionSnapshot | null> {
    return this.snapshots.get(id) ?? null;
  }

  async appendRestoreEvent(event: RestoreEvent): Promise<void> {
    if (this.restoreEvents.some((e) => e.id === event.id)) {
      throw new Error(`Restore event ${event.id} already exists (append-only store)`);
    }
    this.restoreEvents.push(event);
  }

  async listRestoreEvents(snapshotId: string): Promise<RestoreEvent[]> {
    return this.restoreEvents
      .filter((e) => e.snapshotId === snapshotId)
      .sort((a, b) => (a.restoredAt < b.restoredAt ? 1 : -1));
  }
}
