/**
 * Tests for PersistenceManager — debounced save, project lifecycle.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { PersistenceManager } from '@/lib/persistence/persistence-manager';
import type { PersistenceAdapter, ProjectMeta, SavedProject } from '@/lib/persistence/adapter';
import type { Workspace } from '@/lib/schema/types';

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------

function createMockAdapter() {
  const store = new Map<string, { data: Workspace; updatedAt: number }>();

  const adapter: PersistenceAdapter & { _store: typeof store } = {
    _store: store,
    async list(): Promise<ProjectMeta[]> {
      return Array.from(store.entries()).map(([id, r]) => ({
        id,
        name: r.data.meta.name,
        updatedAt: r.updatedAt,
        iconCount: 0,
      }));
    },
    async load(id: string): Promise<SavedProject | null> {
      const r = store.get(id);
      if (!r) return null;
      return { id, name: r.data.meta.name, data: r.data, updatedAt: r.updatedAt };
    },
    async save(id: string, data: Workspace): Promise<void> {
      store.set(id, { data, updatedAt: Date.now() });
    },
    async delete(id: string): Promise<void> {
      store.delete(id);
    },
    async rename(id: string, newName: string): Promise<void> {
      const r = store.get(id);
      if (!r) return;
      r.data = { ...r.data, meta: { ...r.data.meta, name: newName } };
      r.updatedAt = Date.now();
    },
  };

  return adapter;
}

function makeWorkspace(name = 'Test'): Workspace {
  return {
    version: '2.0',
    meta: {
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    iconSets: {},
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PersistenceManager', () => {
  let adapter: ReturnType<typeof createMockAdapter>;
  let onSaved: ReturnType<typeof mock>;
  let onError: ReturnType<typeof mock>;
  let manager: PersistenceManager;

  beforeEach(() => {
    adapter = createMockAdapter();
    onSaved = mock(() => {});
    onError = mock(() => {});
    manager = new PersistenceManager(adapter, {
      onSaved: onSaved as () => void,
      onError: onError as (e: unknown) => void,
    });
  });

  it('generates unique project IDs', () => {
    const id1 = manager.generateId();
    const id2 = manager.generateId();
    expect(id1).toMatch(/^project_\d+_/);
    expect(id1).not.toBe(id2);
  });

  it('saveNow saves immediately and calls onSaved', async () => {
    manager.setProjectId('test-id');
    const ws = makeWorkspace('Immediate Save');

    await manager.saveNow(ws);

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(adapter._store.has('test-id')).toBe(true);
    expect(adapter._store.get('test-id')!.data.meta.name).toBe('Immediate Save');
  });

  it('saveNow auto-generates project ID if not set', async () => {
    const ws = makeWorkspace('Auto ID');

    await manager.saveNow(ws);

    expect(manager.projectId).toMatch(/^project_/);
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('scheduleSave debounces writes', async () => {
    manager.setProjectId('debounce-test');

    // Schedule 3 rapid saves
    manager.scheduleSave(makeWorkspace('V1'));
    manager.scheduleSave(makeWorkspace('V2'));
    manager.scheduleSave(makeWorkspace('V3'));

    // Wait for debounce (500ms + margin)
    await new Promise((r) => setTimeout(r, 700));

    // Only the last save should have gone through
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(adapter._store.get('debounce-test')!.data.meta.name).toBe('V3');
  });

  it('cancelPendingSave prevents scheduled save', async () => {
    manager.setProjectId('cancel-test');

    manager.scheduleSave(makeWorkspace('Should not save'));
    manager.cancelPendingSave();

    await new Promise((r) => setTimeout(r, 700));

    expect(onSaved).toHaveBeenCalledTimes(0);
    expect(adapter._store.has('cancel-test')).toBe(false);
  });

  it('loadProject sets current project ID', async () => {
    await adapter.save('existing', makeWorkspace('Existing'));

    const loaded = await manager.loadProject('existing');

    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('Existing');
    expect(manager.projectId).toBe('existing');
  });

  it('loadProject returns null for missing project', async () => {
    const loaded = await manager.loadProject('missing');
    expect(loaded).toBeNull();
    expect(manager.projectId).toBeNull();
  });

  it('deleteProject removes project and clears ID if current', async () => {
    manager.setProjectId('to-delete');
    await adapter.save('to-delete', makeWorkspace('Delete Me'));

    await manager.deleteProject('to-delete');

    expect(adapter._store.has('to-delete')).toBe(false);
    expect(manager.projectId).toBeNull();
  });

  it('deleteProject does not clear ID for different project', async () => {
    manager.setProjectId('current');
    await adapter.save('other', makeWorkspace('Other'));

    await manager.deleteProject('other');

    expect(manager.projectId).toBe('current');
  });

  it('renameProject updates project name via adapter', async () => {
    await adapter.save('rename-me', makeWorkspace('Old Name'));

    await manager.renameProject('rename-me', 'New Name');

    const loaded = await adapter.load('rename-me');
    expect(loaded!.data.meta.name).toBe('New Name');
  });

  it('renameProject is a no-op for missing project', async () => {
    await manager.renameProject('missing', 'New Name');
    // Should not throw
  });

  it('listProjects delegates to adapter', async () => {
    await adapter.save('p1', makeWorkspace('A'));
    await adapter.save('p2', makeWorkspace('B'));

    const list = await manager.listProjects();
    expect(list).toHaveLength(2);
  });

  it('onError is called when save fails', async () => {
    const failingAdapter: PersistenceAdapter = {
      async list() {
        return [];
      },
      async load() {
        return null;
      },
      async save() {
        throw new Error('Disk full');
      },
      async delete() {},
      async rename() {},
    };

    const errorManager = new PersistenceManager(failingAdapter, {
      onError: onError as (e: unknown) => void,
    });
    errorManager.setProjectId('fail-test');

    await errorManager.saveNow(makeWorkspace('Fail'));

    expect(onError).toHaveBeenCalledTimes(1);
    const errorArg = (onError as ReturnType<typeof mock>).mock.calls[0][0];
    expect(errorArg).toBeInstanceOf(Error);
    expect((errorArg as Error).message).toBe('Disk full');
  });

  it('dispose cancels pending saves', async () => {
    manager.setProjectId('dispose-test');
    manager.scheduleSave(makeWorkspace('Disposed'));
    manager.dispose();

    await new Promise((r) => setTimeout(r, 700));

    expect(onSaved).toHaveBeenCalledTimes(0);
  });
});
