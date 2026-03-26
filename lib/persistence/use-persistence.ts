/**
 * React hook that wires PersistenceManager to the editor store.
 *
 * - Auto-saves to IndexedDB when workspace changes (debounced 500ms)
 * - Provides load/list/delete/rename operations for the Explorer
 * - Desktop skips IndexedDB auto-save (handled by DesktopCommandBridge)
 */

'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { editorStore } from '@/lib/editor-store/store';
import { isDesktop } from '@/lib/platform/bridge';
import { IndexedDBAdapter } from './indexeddb-adapter';
import { PersistenceManager } from './persistence-manager';
import type { ProjectMeta, SavedProject } from './adapter';
import { toast } from '@/components/ui/use-toast';

let sharedManager: PersistenceManager | null = null;

function getManager(): PersistenceManager {
  if (!sharedManager) {
    sharedManager = new PersistenceManager(new IndexedDBAdapter(), {
      onSaved: () => {
        editorStore.getState().markSaved();
      },
      onError: (error: unknown) => {
        const isQuota =
          error instanceof DOMException && error.name === 'QuotaExceededError';
        toast({
          title: isQuota ? 'Storage full' : 'Save failed',
          description: isQuota
            ? 'Browser storage is full. Delete some projects to free space.'
            : 'Could not save your project. Your work may be lost if you close this tab.',
          variant: 'destructive',
        });
        console.error('[persistence] save failed:', error);
      },
    });
  }
  return sharedManager;
}

/**
 * Hook for auto-save wiring. Call once at the app root.
 * On desktop, this is a no-op (desktop has its own save path).
 */
export function useAutoSave(): void {
  const managerRef = useRef<PersistenceManager | null>(null);

  useEffect(() => {
    // Desktop has its own auto-save via DesktopCommandBridge
    if (isDesktop()) return;

    const manager = getManager();
    managerRef.current = manager;

    // Subscribe to store changes — schedule save when workspace changes
    let prevWorkspace = editorStore.getState().workspace;

    const unsubscribe = editorStore.subscribe(() => {
      const state = editorStore.getState();
      if (state.workspace && state.workspace !== prevWorkspace) {
        prevWorkspace = state.workspace;
        manager.scheduleSave(state.workspace);
      }
    });

    return () => {
      unsubscribe();
      manager.cancelPendingSave();
    };
  }, []);
}

/**
 * Hook for project list operations (Explorer).
 * Works on both web (IndexedDB) and desktop (filesystem via bridge).
 */
export function useProjectList() {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const manager = getManager();
      const list = await manager.listProjects();
      setProjects(list);
    } catch (error) {
      console.error('[persistence] list failed:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const loadProject = useCallback(async (id: string): Promise<SavedProject | null> => {
    const manager = getManager();
    const project = await manager.loadProject(id);
    return project;
  }, []);

  const deleteProject = useCallback(
    async (id: string) => {
      const manager = getManager();
      await manager.deleteProject(id);
      await refresh();
    },
    [refresh],
  );

  const renameProject = useCallback(
    async (id: string, newName: string) => {
      const manager = getManager();
      await manager.renameProject(id, newName);
      await refresh();
    },
    [refresh],
  );

  const setCurrentProjectId = useCallback((id: string | null) => {
    const manager = getManager();
    manager.setProjectId(id);
  }, []);

  const createNewProject = useCallback(() => {
    const manager = getManager();
    const id = manager.generateId();
    manager.setProjectId(id);
    return id;
  }, []);

  return {
    projects,
    isLoading,
    refresh,
    loadProject,
    deleteProject,
    renameProject,
    setCurrentProjectId,
    createNewProject,
  };
}

/**
 * Reset the persistence manager's project ID for a fresh workspace.
 * Call this when creating a new project (e.g. Toolbar "New Project")
 * to prevent overwriting the previously saved project.
 */
export function resetPersistenceForNewProject(): void {
  const manager = getManager();
  const id = manager.generateId();
  manager.setProjectId(id);
}
