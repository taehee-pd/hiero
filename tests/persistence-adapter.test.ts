/**
 * Contract tests for PersistenceAdapter interface.
 * Uses an in-memory adapter to verify the behavioral contract
 * that any implementation (IndexedDB, filesystem) must satisfy.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import type {
  DraftCheckpoint,
  DraftCheckpointMeta,
  PersistenceAdapter,
  ProjectMeta,
  SavedProject,
} from '@/lib/persistence/adapter';
import type { Workspace } from '@/lib/schema/types';

// ---------------------------------------------------------------------------
// In-memory adapter (test double)
// ---------------------------------------------------------------------------

class InMemoryAdapter implements PersistenceAdapter {
  private store = new Map<
    string,
    { id: string; name: string; data: Workspace; updatedAt: number; iconCount: number }
  >();
  private checkpoints = new Map<
    string,
    {
      id: string;
      projectId: string;
      data: Workspace;
      createdAt: number;
      memo: string | null;
      iconCount: number;
    }
  >();
  private checkpointSeq = 0;

  async list(): Promise<ProjectMeta[]> {
    return Array.from(this.store.values())
      .map((r) => ({
        id: r.id,
        name: r.name,
        updatedAt: r.updatedAt,
        iconCount: r.iconCount,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async load(id: string): Promise<SavedProject | null> {
    const record = this.store.get(id);
    if (!record) return null;
    return { id: record.id, name: record.name, data: record.data, updatedAt: record.updatedAt };
  }

  async save(id: string, data: Workspace): Promise<void> {
    let iconCount = 0;
    for (const setId of Object.keys(data.iconSets)) {
      iconCount += Object.keys(data.iconSets[setId].icons).length;
    }
    this.store.set(id, {
      id,
      name: data.meta.name,
      data,
      updatedAt: Date.now(),
      iconCount,
    });
  }

  async delete(id: string): Promise<void> {
    this.store.delete(id);
  }

  async rename(id: string, newName: string): Promise<void> {
    const record = this.store.get(id);
    if (!record) return;
    record.name = newName;
    record.data = {
      ...record.data,
      meta: { ...record.data.meta, name: newName },
    };
    record.updatedAt = Date.now();
  }

  async createCheckpoint(
    projectId: string,
    data: Workspace,
    memo: string | null,
  ): Promise<DraftCheckpointMeta> {
    this.checkpointSeq += 1;
    const id = `ckpt_${this.checkpointSeq}`;
    const createdAt = Date.now() + this.checkpointSeq;
    let iconCount = 0;
    for (const setId of Object.keys(data.iconSets)) {
      iconCount += Object.keys(data.iconSets[setId].icons).length;
    }
    this.checkpoints.set(id, { id, projectId, data, createdAt, memo, iconCount });
    return { id, projectId, createdAt, memo, iconCount };
  }

  async listCheckpoints(projectId: string): Promise<DraftCheckpointMeta[]> {
    return Array.from(this.checkpoints.values())
      .filter((r) => r.projectId === projectId)
      .map(({ data: _data, ...meta }) => meta)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async loadCheckpoint(id: string): Promise<DraftCheckpoint | null> {
    const record = this.checkpoints.get(id);
    if (!record) return null;
    return { ...record };
  }

  async deleteCheckpoint(id: string): Promise<void> {
    this.checkpoints.delete(id);
  }
}

// ---------------------------------------------------------------------------
// Test fixture
// ---------------------------------------------------------------------------

function makeWorkspace(name: string, iconCount = 0): Workspace {
  const icons: Record<string, unknown> = {};
  for (let i = 0; i < iconCount; i++) {
    const id = `icon_${i}`;
    icons[id] = {
      id,
      name: `Icon ${i}`,
      category: 'test',
      tags: [],
      variants: {},
      components: [],
    };
  }
  return {
    version: '2.0',
    meta: {
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    iconSets: {
      default: {
        version: '1.0',
        meta: {
          name,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        icons,
      } as Workspace['iconSets'][string],
    },
  };
}

// ---------------------------------------------------------------------------
// Contract tests
// ---------------------------------------------------------------------------

describe('PersistenceAdapter contract', () => {
  let adapter: PersistenceAdapter;

  beforeEach(() => {
    adapter = new InMemoryAdapter();
  });

  it('list returns empty array when no projects saved', async () => {
    const list = await adapter.list();
    expect(list).toEqual([]);
  });

  it('save + load round-trips a workspace', async () => {
    const ws = makeWorkspace('Test Project', 3);
    await adapter.save('p1', ws);

    const loaded = await adapter.load('p1');
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('p1');
    expect(loaded!.name).toBe('Test Project');
    expect(loaded!.data.version).toBe('2.0');
    expect(loaded!.data.meta.name).toBe('Test Project');
  });

  it('save + list returns metadata with icon count', async () => {
    const ws = makeWorkspace('My Icons', 5);
    await adapter.save('p1', ws);

    const list = await adapter.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe('p1');
    expect(list[0].name).toBe('My Icons');
    expect(list[0].iconCount).toBe(5);
    expect(typeof list[0].updatedAt).toBe('number');
  });

  it('list returns projects sorted by most recently updated', async () => {
    const ws1 = makeWorkspace('First');
    await adapter.save('p1', ws1);

    // Small delay to ensure different timestamps
    await new Promise((r) => setTimeout(r, 5));

    const ws2 = makeWorkspace('Second');
    await adapter.save('p2', ws2);

    const list = await adapter.list();
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe('Second');
    expect(list[1].name).toBe('First');
  });

  it('save overwrites existing project with same ID', async () => {
    await adapter.save('p1', makeWorkspace('Version 1', 2));
    await adapter.save('p1', makeWorkspace('Version 2', 4));

    const list = await adapter.list();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Version 2');
    expect(list[0].iconCount).toBe(4);
  });

  it('load returns null for non-existent ID', async () => {
    const loaded = await adapter.load('nonexistent');
    expect(loaded).toBeNull();
  });

  it('delete removes a project', async () => {
    await adapter.save('p1', makeWorkspace('To Delete'));
    await adapter.delete('p1');

    const loaded = await adapter.load('p1');
    expect(loaded).toBeNull();
    const list = await adapter.list();
    expect(list).toHaveLength(0);
  });

  it('delete is a no-op for non-existent ID', async () => {
    await adapter.delete('nonexistent');
    const list = await adapter.list();
    expect(list).toEqual([]);
  });

  it('multiple projects coexist independently', async () => {
    await adapter.save('p1', makeWorkspace('Project A', 1));
    await adapter.save('p2', makeWorkspace('Project B', 2));
    await adapter.save('p3', makeWorkspace('Project C', 3));

    const list = await adapter.list();
    expect(list).toHaveLength(3);

    await adapter.delete('p2');
    const updated = await adapter.list();
    expect(updated).toHaveLength(2);
    expect(updated.map((p) => p.name).sort()).toEqual(['Project A', 'Project C']);
  });

  it('rename updates project name in both metadata and workspace data', async () => {
    await adapter.save('p1', makeWorkspace('Old Name', 3));

    await adapter.rename('p1', 'New Name');

    const loaded = await adapter.load('p1');
    expect(loaded).not.toBeNull();
    expect(loaded!.name).toBe('New Name');
    expect(loaded!.data.meta.name).toBe('New Name');

    const list = await adapter.list();
    expect(list[0].name).toBe('New Name');
    expect(list[0].iconCount).toBe(3);
  });

  it('rename is a no-op for non-existent ID', async () => {
    await adapter.rename('nonexistent', 'New Name');
    const list = await adapter.list();
    expect(list).toEqual([]);
  });

  it('rename preserves all workspace data (icons, icon sets)', async () => {
    const ws = makeWorkspace('Original', 5);
    await adapter.save('p1', ws);

    await adapter.rename('p1', 'Renamed');

    const loaded = await adapter.load('p1');
    expect(loaded!.data.version).toBe('2.0');
    expect(Object.keys(loaded!.data.iconSets.default.icons)).toHaveLength(5);
  });

  it('save preserves full workspace structure through roundtrip', async () => {
    const ws = makeWorkspace('Roundtrip Test', 3);
    await adapter.save('rt1', ws);

    const loaded = await adapter.load('rt1');
    expect(loaded).not.toBeNull();
    expect(loaded!.data.version).toBe(ws.version);
    expect(loaded!.data.meta.name).toBe(ws.meta.name);
    expect(loaded!.data.meta.createdAt).toBe(ws.meta.createdAt);

    const originalIcons = Object.keys(ws.iconSets.default.icons);
    const loadedIcons = Object.keys(loaded!.data.iconSets.default.icons);
    expect(loadedIcons).toEqual(originalIcons);
  });

  // ---------------------------------------------------------------------
  // Draft checkpoint contract
  // ---------------------------------------------------------------------

  it('createCheckpoint allocates a unique id and metadata', async () => {
    const meta = await adapter.createCheckpoint('proj-1', makeWorkspace('A'), 'first save');
    expect(meta.id).toMatch(/^ckpt_/);
    expect(meta.projectId).toBe('proj-1');
    expect(meta.memo).toBe('first save');
    expect(meta.createdAt).toBeGreaterThan(0);
  });

  it('createCheckpoint allows null memo and never overwrites prior records', async () => {
    const a = await adapter.createCheckpoint('proj-1', makeWorkspace('A'), null);
    const b = await adapter.createCheckpoint('proj-1', makeWorkspace('B'), null);
    expect(a.id).not.toBe(b.id);
    const list = await adapter.listCheckpoints('proj-1');
    expect(list).toHaveLength(2);
  });

  it('listCheckpoints returns newest-first', async () => {
    const first = await adapter.createCheckpoint('proj-1', makeWorkspace('First'), null);
    const second = await adapter.createCheckpoint('proj-1', makeWorkspace('Second'), null);
    const list = await adapter.listCheckpoints('proj-1');
    expect(list[0].id).toBe(second.id);
    expect(list[1].id).toBe(first.id);
  });

  it('listCheckpoints scopes by projectId', async () => {
    await adapter.createCheckpoint('proj-A', makeWorkspace('A1'), null);
    await adapter.createCheckpoint('proj-A', makeWorkspace('A2'), null);
    await adapter.createCheckpoint('proj-B', makeWorkspace('B1'), null);

    const aList = await adapter.listCheckpoints('proj-A');
    const bList = await adapter.listCheckpoints('proj-B');
    expect(aList).toHaveLength(2);
    expect(bList).toHaveLength(1);
  });

  it('loadCheckpoint returns the full workspace payload', async () => {
    const ws = makeWorkspace('Loaded', 3);
    const meta = await adapter.createCheckpoint('proj-1', ws, 'roundtrip');
    const loaded = await adapter.loadCheckpoint(meta.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.data.meta.name).toBe('Loaded');
    expect(Object.keys(loaded!.data.iconSets.default.icons)).toHaveLength(3);
    expect(loaded!.memo).toBe('roundtrip');
  });

  it('loadCheckpoint returns null for missing id', async () => {
    expect(await adapter.loadCheckpoint('nonexistent')).toBeNull();
  });

  it('deleteCheckpoint removes the record', async () => {
    const meta = await adapter.createCheckpoint('proj-1', makeWorkspace('D'), null);
    await adapter.deleteCheckpoint(meta.id);
    expect(await adapter.loadCheckpoint(meta.id)).toBeNull();
  });

  it('deleteCheckpoint is a no-op for missing id', async () => {
    await adapter.deleteCheckpoint('nonexistent');
    // No throw.
  });
});
