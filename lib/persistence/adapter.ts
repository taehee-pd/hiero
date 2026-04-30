/**
 * Persistence adapter — unified interface for project storage.
 *
 * Two durability tiers live behind this interface:
 *
 *   ┌────────────────────┐
 *   │    EditorStore     │
 *   │                    │
 *   │  autosave ────────►│  PersistenceAdapter.save()       (debounced, IDB)
 *   │  Cmd+S    ────────►│  PersistenceAdapter.createCheckpoint() (durable)
 *   │  load()   ◄────────│  PersistenceAdapter.load() / loadCheckpoint()
 *   └────────────────────┘
 *
 * Autosave is background safety. Draft checkpoints are intentful
 * snapshots: timestamped, optionally memoed, restorable later. They live in
 * a sibling IDB store and never overwrite each other.
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

/**
 * Metadata-only view of a draft checkpoint, used by list UIs that don't
 * need the full workspace payload.
 */
export type DraftCheckpointMeta = {
  id: string;
  projectId: string;
  createdAt: number;
  memo: string | null;
  iconCount: number;
};

/**
 * Full draft checkpoint record. Includes the snapshot of the workspace
 * at checkpoint time so it can be restored verbatim.
 */
export type DraftCheckpoint = DraftCheckpointMeta & {
  data: Workspace;
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

  /**
   * Create a durable draft checkpoint. Distinct from autosave: never
   * overwrites prior checkpoints, always allocates a new id.
   */
  createCheckpoint(
    projectId: string,
    data: Workspace,
    memo: string | null,
  ): Promise<DraftCheckpointMeta>;

  /**
   * List checkpoints for a project, newest first.
   */
  listCheckpoints(projectId: string): Promise<DraftCheckpointMeta[]>;

  /** Load a full checkpoint by id. Returns null if not found. */
  loadCheckpoint(id: string): Promise<DraftCheckpoint | null>;

  /** Delete a checkpoint by id. No-op if not found. */
  deleteCheckpoint(id: string): Promise<void>;
}
