/**
 * Tests for PersistenceManager — debounced save, project lifecycle.
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { PersistenceManager } from '@/lib/persistence/persistence-manager';
import type {
  DraftCheckpoint,
  DraftCheckpointMeta,
  PersistenceAdapter,
  ProjectMeta,
  SavedProject,
} from '@/lib/persistence/adapter';
import type { Workspace } from '@/lib/schema/types';

// ---------------------------------------------------------------------------
// Mock adapter
// ---------------------------------------------------------------------------

function createMockAdapter() {
  const store = new Map<string, { data: Workspace; updatedAt: number }>();
  const checkpoints = new Map<
    string,
    { projectId: string; data: Workspace; createdAt: number; memo: string | null }
  >();
  let checkpointSeq = 0;

  const adapter: PersistenceAdapter & {
    _store: typeof store;
    _checkpoints: typeof checkpoints;
  } = {
    _store: store,
    _checkpoints: checkpoints,
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
    async createCheckpoint(
      projectId: string,
      data: Workspace,
      memo: string | null,
    ): Promise<DraftCheckpointMeta> {
      // Synthetic monotonic id+timestamp so list ordering is deterministic
      // even when the test runs faster than 1ms per checkpoint.
      checkpointSeq += 1;
      const id = `ckpt_${checkpointSeq}`;
      const createdAt = Date.now() + checkpointSeq;
      checkpoints.set(id, { projectId, data, createdAt, memo });
      return { id, projectId, createdAt, memo, iconCount: 0 };
    },
    async listCheckpoints(projectId: string): Promise<DraftCheckpointMeta[]> {
      return Array.from(checkpoints.entries())
        .filter(([, r]) => r.projectId === projectId)
        .map(([id, r]) => ({
          id,
          projectId: r.projectId,
          createdAt: r.createdAt,
          memo: r.memo,
          iconCount: 0,
        }))
        .sort((a, b) => b.createdAt - a.createdAt);
    },
    async loadCheckpoint(id: string): Promise<DraftCheckpoint | null> {
      const r = checkpoints.get(id);
      if (!r) return null;
      return {
        id,
        projectId: r.projectId,
        createdAt: r.createdAt,
        memo: r.memo,
        iconCount: 0,
        data: r.data,
      };
    },
    async deleteCheckpoint(id: string): Promise<void> {
      checkpoints.delete(id);
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
      async createCheckpoint() {
        throw new Error('not used');
      },
      async listCheckpoints() {
        return [];
      },
      async loadCheckpoint() {
        return null;
      },
      async deleteCheckpoint() {},
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

  // ---------------------------------------------------------------------
  // Draft checkpoints (Phase 1: Save vs Autosave)
  // ---------------------------------------------------------------------

  describe('draft checkpoints', () => {
    let onCheckpointSaved: ReturnType<typeof mock>;
    let cpManager: PersistenceManager;

    beforeEach(() => {
      onCheckpointSaved = mock(() => {});
      cpManager = new PersistenceManager(adapter, {
        onSaved: onSaved as () => void,
        onError: onError as (e: unknown) => void,
        onCheckpointSaved: onCheckpointSaved as (meta: DraftCheckpointMeta) => void,
      });
    });

    it('createCheckpoint persists a snapshot and fires onCheckpointSaved', async () => {
      cpManager.setProjectId('cp-1');
      const meta = await cpManager.createCheckpoint(makeWorkspace('Snap'), 'memo-text');

      expect(meta.id).toMatch(/^ckpt_/);
      expect(meta.memo).toBe('memo-text');
      expect(onCheckpointSaved).toHaveBeenCalledTimes(1);
      expect(adapter._checkpoints.size).toBe(1);
    });

    it('createCheckpoint auto-generates project ID when unset', async () => {
      const meta = await cpManager.createCheckpoint(makeWorkspace('Snap'));
      expect(cpManager.projectId).toMatch(/^project_/);
      expect(meta.projectId).toBe(cpManager.projectId!);
    });

    it('createCheckpoint normalizes empty/whitespace memos to null', async () => {
      cpManager.setProjectId('cp-2');
      const a = await cpManager.createCheckpoint(makeWorkspace('A'), '');
      const b = await cpManager.createCheckpoint(makeWorkspace('B'), '   ');
      const c = await cpManager.createCheckpoint(makeWorkspace('C'), '  trimmed  ');

      expect(a.memo).toBeNull();
      expect(b.memo).toBeNull();
      expect(c.memo).toBe('trimmed');
    });

    it('createCheckpoint never overwrites prior checkpoints', async () => {
      cpManager.setProjectId('cp-3');
      await cpManager.createCheckpoint(makeWorkspace('First'));
      await cpManager.createCheckpoint(makeWorkspace('Second'));
      await cpManager.createCheckpoint(makeWorkspace('Third'));

      const list = await cpManager.listCheckpoints();
      expect(list).toHaveLength(3);
    });

    it('createCheckpoint flushes a pending autosave first to avoid races', async () => {
      cpManager.setProjectId('cp-race');
      cpManager.scheduleSave(makeWorkspace('Pending autosave'));
      // Don't wait for the debounce — checkpoint should flush it synchronously.
      await cpManager.createCheckpoint(makeWorkspace('Checkpoint snapshot'));

      // Autosave must have completed (V flushed before checkpoint write).
      expect(onSaved).toHaveBeenCalledTimes(1);
      expect(adapter._store.get('cp-race')!.data.meta.name).toBe('Pending autosave');
      // Checkpoint contains its own payload, distinct from the autosave row.
      const list = await cpManager.listCheckpoints();
      expect(list).toHaveLength(1);
      const loaded = await cpManager.loadCheckpoint(list[0].id);
      expect(loaded!.data.meta.name).toBe('Checkpoint snapshot');
    });

    it('listCheckpoints returns newest-first', async () => {
      cpManager.setProjectId('cp-4');
      const first = await cpManager.createCheckpoint(makeWorkspace('First'));
      const second = await cpManager.createCheckpoint(makeWorkspace('Second'));

      const list = await cpManager.listCheckpoints();
      expect(list[0].id).toBe(second.id);
      expect(list[1].id).toBe(first.id);
    });

    it('listCheckpoints returns empty array when no project is set', async () => {
      const list = await cpManager.listCheckpoints();
      expect(list).toEqual([]);
    });

    it('listCheckpoints does not leak checkpoints across projects', async () => {
      cpManager.setProjectId('proj-A');
      await cpManager.createCheckpoint(makeWorkspace('A1'));
      await cpManager.createCheckpoint(makeWorkspace('A2'));

      cpManager.setProjectId('proj-B');
      await cpManager.createCheckpoint(makeWorkspace('B1'));

      const aList = await (async () => {
        cpManager.setProjectId('proj-A');
        return cpManager.listCheckpoints();
      })();
      expect(aList).toHaveLength(2);

      cpManager.setProjectId('proj-B');
      const bList = await cpManager.listCheckpoints();
      expect(bList).toHaveLength(1);
    });

    it('loadCheckpoint returns null for missing id', async () => {
      const loaded = await cpManager.loadCheckpoint('nonexistent');
      expect(loaded).toBeNull();
    });

    it('deleteCheckpoint removes the record', async () => {
      cpManager.setProjectId('cp-5');
      const meta = await cpManager.createCheckpoint(makeWorkspace('Doomed'));
      await cpManager.deleteCheckpoint(meta.id);

      const list = await cpManager.listCheckpoints();
      expect(list).toHaveLength(0);
    });

    it('createCheckpoint surfaces adapter errors via onError and rethrows', async () => {
      const failingAdapter: PersistenceAdapter = {
        async list() {
          return [];
        },
        async load() {
          return null;
        },
        async save() {},
        async delete() {},
        async rename() {},
        async createCheckpoint() {
          throw new Error('quota');
        },
        async listCheckpoints() {
          return [];
        },
        async loadCheckpoint() {
          return null;
        },
        async deleteCheckpoint() {},
      };
      const errorMgr = new PersistenceManager(failingAdapter, {
        onError: onError as (e: unknown) => void,
        onCheckpointSaved: onCheckpointSaved as (meta: DraftCheckpointMeta) => void,
      });
      errorMgr.setProjectId('err');

      await expect(errorMgr.createCheckpoint(makeWorkspace('X'))).rejects.toThrow('quota');
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onCheckpointSaved).toHaveBeenCalledTimes(0);
    });
  });
});
