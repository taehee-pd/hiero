/**
 * Filesystem persistence adapter for desktop (Electrobun).
 *
 * Wraps the existing platform bridge methods (saveProject, openProject,
 * getRecentProjects) behind the PersistenceAdapter interface.
 *
 * This adapter uses the OS filesystem via Electrobun RPC — it does NOT
 * manage its own storage. Project IDs are file paths.
 */

'use client';

import type { Workspace } from '@/lib/schema/types';
import { isWorkspace } from '@/lib/schema/guards';
import {
  getRecentProjects,
  saveProject,
  setCurrentProjectPath,
} from '@/lib/platform/bridge';
import type { PersistenceAdapter, ProjectMeta, SavedProject } from './adapter';

function countIcons(workspace: Workspace): number {
  let count = 0;
  for (const setId of Object.keys(workspace.iconSets)) {
    count += Object.keys(workspace.iconSets[setId].icons).length;
  }
  return count;
}

export class FileSystemAdapter implements PersistenceAdapter {
  async list(): Promise<ProjectMeta[]> {
    const recent = await getRecentProjects();
    return recent.map((r) => ({
      id: r.path,
      name: r.name,
      updatedAt: new Date(r.updatedAt).getTime(),
      iconCount: 0, // metadata-only — icon count not stored in recent list
    }));
  }

  async load(_id: string): Promise<SavedProject | null> {
    // Desktop load is handled by the bridge's openProject() + file
    // association flow, which already calls loadWorkspace/loadProject
    // in DesktopCommandBridge. This adapter's load() is not the
    // primary desktop load path — it exists for interface compliance.
    return null;
  }

  async save(id: string, data: Workspace): Promise<void> {
    const updatedAt = new Date().toISOString();
    const updated: Workspace = {
      ...data,
      meta: { ...data.meta, updatedAt },
    };
    const json = JSON.stringify(updated, null, 2);
    const result = await saveProject(json, id);
    if (result?.path) {
      setCurrentProjectPath(result.path);
    }
  }

  async delete(_id: string): Promise<void> {
    // Desktop does not support deleting projects from the filesystem
    // via the bridge. Users manage files through Finder/Explorer.
  }
}
