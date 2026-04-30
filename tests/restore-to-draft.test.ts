/**
 * Tests for restoreSnapshotIntoDraft.
 *
 * Eng-review pinned contracts:
 *   - never silently publishes (no saveVersionSnapshot call from restore)
 *   - records an audit row via appendRestoreEvent
 *   - audit row carries the dirty-work resolution choice
 *   - throws if the snapshot id doesn't exist
 *   - applies the snapshot's workspace through the caller-provided sink
 */

import { describe, it, expect, mock } from 'bun:test';
import { restoreSnapshotIntoDraft } from '@/lib/sync-ui/restore-to-draft';
import type { PersistenceAdapter } from '@/lib/persistence/adapter';
import type {
  RestoreEvent,
  VersionSnapshot,
} from '@/lib/sync-service/version-snapshot';
import type { Workspace } from '@/lib/schema/types';

function makeWorkspace(name = 'restored'): Workspace {
  return {
    version: '2.0',
    meta: {
      name,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z',
    },
    iconSets: {},
  };
}

function makeSnapshot(id = 'vsnap_1'): VersionSnapshot {
  return {
    id,
    version: '1.0.0',
    releaseNotes: '',
    publishedAt: '2026-04-30T12:00:00.000Z',
    publishedBy: 'taehee',
    changesSummary: { added: [], modified: [], removed: [] },
    sourceHash: 'deadbeef',
    targetResults: [],
    workspaceSnapshot: makeWorkspace('snap-workspace'),
  };
}

function makeAdapter(seed?: VersionSnapshot): PersistenceAdapter & {
  _events: RestoreEvent[];
  _snapshotCallCount: number;
} {
  const snapshots = new Map<string, VersionSnapshot>();
  if (seed) snapshots.set(seed.id, seed);
  const events: RestoreEvent[] = [];
  let snapshotCallCount = 0;

  return {
    _events: events,
    get _snapshotCallCount() {
      return snapshotCallCount;
    },
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
      return { id: 'x', projectId: 'x', createdAt: 0, memo: null, iconCount: 0 };
    },
    async listCheckpoints() {
      return [];
    },
    async loadCheckpoint() {
      return null;
    },
    async deleteCheckpoint() {},
    async saveVersionSnapshot() {
      // Pinned: restore must NEVER call saveVersionSnapshot.
      snapshotCallCount += 1;
    },
    async listVersionSnapshots() {
      return Array.from(snapshots.values()).map(({ workspaceSnapshot: _ws, ...meta }) => meta);
    },
    async loadVersionSnapshot(id) {
      return snapshots.get(id) ?? null;
    },
    async appendRestoreEvent(event) {
      if (events.some((e) => e.id === event.id)) {
        throw new Error(`duplicate id: ${event.id}`);
      }
      events.push(event);
    },
    async listRestoreEvents(snapshotId) {
      return events.filter((e) => e.snapshotId === snapshotId);
    },
  } as PersistenceAdapter & { _events: RestoreEvent[]; _snapshotCallCount: number };
}

describe('restoreSnapshotIntoDraft', () => {
  it('applies the snapshot workspace via the caller sink and writes an audit row', async () => {
    const snapshot = makeSnapshot();
    const adapter = makeAdapter(snapshot);
    const apply = mock(async () => {});

    const result = await restoreSnapshotIntoDraft('vsnap_1', {
      persistence: adapter,
      restoredBy: 'taehee',
      dirtyWorkResolution: 'no-dirty-work',
      projectId: 'proj-1',
      now: () => new Date('2026-05-01T00:00:00.000Z'),
      generateId: () => 'restore_test_1',
      applyToEditor: apply as unknown as (
        ws: Workspace,
        s: VersionSnapshot,
      ) => Promise<void>,
    });

    expect(apply).toHaveBeenCalledTimes(1);
    const callArg = (apply as unknown as ReturnType<typeof mock>).mock.calls[0];
    expect((callArg[0] as Workspace).meta.name).toBe('snap-workspace');

    expect(adapter._events).toHaveLength(1);
    expect(adapter._events[0].snapshotId).toBe('vsnap_1');
    expect(adapter._events[0].snapshotVersion).toBe('1.0.0');
    expect(adapter._events[0].preservedDirtyWorkAs).toBe('no-dirty-work');
    expect(adapter._events[0].restoredAt).toBe('2026-05-01T00:00:00.000Z');
    expect(adapter._events[0].id).toBe('restore_test_1');

    expect(result.snapshot.id).toBe('vsnap_1');
    expect(result.event.id).toBe('restore_test_1');
  });

  it('records the dirty-work resolution on the audit row', async () => {
    const snapshot = makeSnapshot();
    const adapter = makeAdapter(snapshot);
    const apply = async () => {};

    await restoreSnapshotIntoDraft('vsnap_1', {
      persistence: adapter,
      restoredBy: 'taehee',
      dirtyWorkResolution: 'checkpoint',
      projectId: null,
      generateId: () => 'r1',
      applyToEditor: apply,
    });
    expect(adapter._events[0].preservedDirtyWorkAs).toBe('checkpoint');

    await restoreSnapshotIntoDraft('vsnap_1', {
      persistence: adapter,
      restoredBy: 'taehee',
      dirtyWorkResolution: 'discarded',
      projectId: null,
      generateId: () => 'r2',
      applyToEditor: apply,
    });
    expect(adapter._events[1].preservedDirtyWorkAs).toBe('discarded');
  });

  it('never calls saveVersionSnapshot — restore is not a publish', async () => {
    const snapshot = makeSnapshot();
    const adapter = makeAdapter(snapshot);

    await restoreSnapshotIntoDraft('vsnap_1', {
      persistence: adapter,
      restoredBy: 'taehee',
      dirtyWorkResolution: 'no-dirty-work',
      projectId: null,
      applyToEditor: async () => {},
    });

    expect(adapter._snapshotCallCount).toBe(0);
  });

  it('throws when the snapshot id is unknown', async () => {
    const adapter = makeAdapter();
    await expect(
      restoreSnapshotIntoDraft('missing-id', {
        persistence: adapter,
        restoredBy: 'taehee',
        dirtyWorkResolution: 'no-dirty-work',
        projectId: null,
        applyToEditor: async () => {},
      }),
    ).rejects.toThrow(/Version snapshot not found/);
    expect(adapter._events).toHaveLength(0);
  });

  it('audit log accumulates across multiple restores of the same snapshot', async () => {
    const snapshot = makeSnapshot();
    const adapter = makeAdapter(snapshot);
    const apply = async () => {};

    await restoreSnapshotIntoDraft('vsnap_1', {
      persistence: adapter,
      restoredBy: 'taehee',
      dirtyWorkResolution: 'no-dirty-work',
      projectId: null,
      generateId: () => 'r1',
      applyToEditor: apply,
    });
    await restoreSnapshotIntoDraft('vsnap_1', {
      persistence: adapter,
      restoredBy: 'taehee',
      dirtyWorkResolution: 'discarded',
      projectId: null,
      generateId: () => 'r2',
      applyToEditor: apply,
    });

    const events = await adapter.listRestoreEvents('vsnap_1');
    expect(events).toHaveLength(2);
  });
});
