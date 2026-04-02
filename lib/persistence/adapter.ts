/**
 * Persistence adapter — unified interface for project storage.
 *
 * ```
 * ┌────────────────────┐
 * │    EditorStore      │
 * │    (Zustand)        │
 * │                     │
 * │  save() ────────────┼──► PersistenceAdapter.save()
 * │  load() ◄───────────┼──── PersistenceAdapter.load()
 * └────────────────────┘
 *          │
 *          └── IndexedDBAdapter (web)
 *                └── idb: coniva_projects table
 * ```
 */

import type { Workspace } from '@/lib/schema/types';

export type ProjectMeta = {
  id: string;
  name: string;
  updatedAt: number;
  iconCount: number;
};

export type SavedProject = {
  id: string;
  name: string;
  data: Workspace;
  updatedAt: number;
};

export interface PersistenceAdapter {
  /** List all stored projects (metadata only). */
  list(): Promise<ProjectMeta[]>;

  /** Load a full project by ID. Returns null if not found. */
  load(id: string): Promise<SavedProject | null>;

  /** Save or update a project. Creates if ID doesn't exist. */
  save(id: string, data: Workspace): Promise<void>;

  /** Delete a project by ID. No-op if not found. */
  delete(id: string): Promise<void>;

  /** Rename a project. No-op if not found. */
  rename(id: string, newName: string): Promise<void>;
}
