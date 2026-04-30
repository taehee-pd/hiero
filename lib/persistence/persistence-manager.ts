/**
 * Persistence manager — coordinates auto-save and project lifecycle.
 *
 * ```
 * EditorStore ──isDirty──► PersistenceManager.scheduleSave()
 *                               │
 *                               ▼ (debounce 500ms)
 *                         PersistenceAdapter.save()
 *                               │
 *                               ▼
 *                         markSaved() on store
 * ```
 */

'use client';

import type { Workspace } from '@/lib/schema/types';
import type {
  DraftCheckpoint,
  DraftCheckpointMeta,
  PersistenceAdapter,
  ProjectMeta,
  SavedProject,
} from './adapter';

const AUTO_SAVE_DEBOUNCE_MS = 500;

export class PersistenceManager {
  private adapter: PersistenceAdapter;
  private currentProjectId: string | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  /** Workspace currently queued for the next debounced autosave. */
  private pendingWorkspace: Workspace | null = null;
  private onSaved: (() => void) | null = null;
  private onError: ((error: unknown) => void) | null = null;
  private onCheckpointSaved: ((meta: DraftCheckpointMeta) => void) | null = null;

  constructor(
    adapter: PersistenceAdapter,
    callbacks?: {
      onSaved?: () => void;
      onError?: (error: unknown) => void;
      onCheckpointSaved?: (meta: DraftCheckpointMeta) => void;
    },
  ) {
    this.adapter = adapter;
    this.onSaved = callbacks?.onSaved ?? null;
    this.onError = callbacks?.onError ?? null;
    this.onCheckpointSaved = callbacks?.onCheckpointSaved ?? null;
  }

  get projectId(): string | null {
    return this.currentProjectId;
  }

  setProjectId(id: string | null): void {
    this.currentProjectId = id;
  }

  /** Generate a new unique project ID. */
  generateId(): string {
    return `project_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  /** Schedule a debounced save. Cancels any pending save. */
  scheduleSave(workspace: Workspace): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.pendingWorkspace = workspace;
    this.saveTimer = setTimeout(() => {
      const queued = this.pendingWorkspace;
      this.saveTimer = null;
      this.pendingWorkspace = null;
      if (queued) void this.executeSave(queued);
    }, AUTO_SAVE_DEBOUNCE_MS);
  }

  /** Cancel any pending debounced save. */
  cancelPendingSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    this.pendingWorkspace = null;
  }

  /** Save immediately (no debounce). */
  async saveNow(workspace: Workspace): Promise<void> {
    this.cancelPendingSave();
    await this.executeSave(workspace);
  }

  private async executeSave(workspace: Workspace): Promise<void> {
    if (!this.currentProjectId) {
      this.currentProjectId = this.generateId();
    }
    try {
      await this.adapter.save(this.currentProjectId, workspace);
      this.onSaved?.();
    } catch (error: unknown) {
      this.onError?.(error);
    }
  }

  /** List all stored projects. */
  async listProjects(): Promise<ProjectMeta[]> {
    return this.adapter.list();
  }

  /** Load a project by ID. */
  async loadProject(id: string): Promise<SavedProject | null> {
    const project = await this.adapter.load(id);
    if (project) {
      this.currentProjectId = id;
    }
    return project;
  }

  /** Delete a project by ID. */
  async deleteProject(id: string): Promise<void> {
    await this.adapter.delete(id);
    if (this.currentProjectId === id) {
      this.currentProjectId = null;
    }
  }

  /** Rename a project. */
  async renameProject(id: string, newName: string): Promise<void> {
    await this.adapter.rename(id, newName);
  }

  /**
   * Create a durable draft checkpoint of the current workspace. Distinct
   * from autosave: never overwrites prior checkpoints.
   *
   * Cancels any pending autosave first and flushes it synchronously so
   * the autosave and checkpoint don't race the workspace write order.
   */
  async createCheckpoint(
    workspace: Workspace,
    memo: string | null = null,
  ): Promise<DraftCheckpointMeta> {
    // Flush any pending autosave first so the autosave row reflects the
    // queued workspace, not whatever was current at checkpoint time.
    // After the flush we still write the checkpoint with the explicit
    // `workspace` arg the caller passed in.
    if (this.saveTimer) {
      const queued = this.pendingWorkspace;
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
      this.pendingWorkspace = null;
      if (queued) await this.executeSave(queued);
    }
    if (!this.currentProjectId) {
      this.currentProjectId = this.generateId();
    }
    try {
      const meta = await this.adapter.createCheckpoint(
        this.currentProjectId,
        workspace,
        memo && memo.trim().length > 0 ? memo.trim() : null,
      );
      this.onCheckpointSaved?.(meta);
      return meta;
    } catch (error: unknown) {
      this.onError?.(error);
      throw error;
    }
  }

  /** List checkpoints for the current project, newest first. */
  async listCheckpoints(): Promise<DraftCheckpointMeta[]> {
    if (!this.currentProjectId) return [];
    return this.adapter.listCheckpoints(this.currentProjectId);
  }

  /** Load a checkpoint by id. */
  async loadCheckpoint(id: string): Promise<DraftCheckpoint | null> {
    return this.adapter.loadCheckpoint(id);
  }

  /** Delete a checkpoint by id. */
  async deleteCheckpoint(id: string): Promise<void> {
    await this.adapter.deleteCheckpoint(id);
  }

  dispose(): void {
    this.cancelPendingSave();
  }
}
