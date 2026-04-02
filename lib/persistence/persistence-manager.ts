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
import type { PersistenceAdapter, ProjectMeta, SavedProject } from './adapter';

const AUTO_SAVE_DEBOUNCE_MS = 500;

export class PersistenceManager {
  private adapter: PersistenceAdapter;
  private currentProjectId: string | null = null;
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private onSaved: (() => void) | null = null;
  private onError: ((error: unknown) => void) | null = null;

  constructor(
    adapter: PersistenceAdapter,
    callbacks?: {
      onSaved?: () => void;
      onError?: (error: unknown) => void;
    },
  ) {
    this.adapter = adapter;
    this.onSaved = callbacks?.onSaved ?? null;
    this.onError = callbacks?.onError ?? null;
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
    this.saveTimer = setTimeout(() => {
      void this.executeSave(workspace);
    }, AUTO_SAVE_DEBOUNCE_MS);
  }

  /** Cancel any pending debounced save. */
  cancelPendingSave(): void {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
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

  dispose(): void {
    this.cancelPendingSave();
  }
}
