/**
 * Tests for executePublishTransaction — the unified publish orchestrator.
 *
 * Outcomes covered:
 *   - all-success → snapshot persisted, kind='success'
 *   - partial-failure → snapshot persisted (any-success rule), kind='partial-failure'
 *   - all-failed → no snapshot, kind='all-failed'
 *   - empty target list → all-failed (no successes possible)
 *   - target order preserved
 *
 * Eng-review must-fix #1: persist on any-success so partial failure is
 * still visible in history. This file pins that contract.
 */

import { describe, it, expect, mock } from 'bun:test';
import {
  executePublishTransaction,
  hashWorkspace,
  type PublishTransactionInput,
  type TargetExecutor,
} from '@/lib/sync-service/publish-transaction';
import type { PersistenceAdapter } from '@/lib/persistence/adapter';
import type {
  ChangesSummary,
  VersionSnapshot,
  VersionSnapshotMeta,
} from '@/lib/sync-service/version-snapshot';
import type { Workspace } from '@/lib/schema/types';

function makeWorkspace(name = 'Test'): Workspace {
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

function makeChanges(): ChangesSummary {
  return { added: ['icon-a'], modified: [], removed: [] };
}

function makeStubPersistence(): PersistenceAdapter & {
  _snapshots: Map<string, VersionSnapshot>;
} {
  const snapshots = new Map<string, VersionSnapshot>();
  return {
    _snapshots: snapshots,
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
    async saveVersionSnapshot(snapshot) {
      snapshots.set(snapshot.id, snapshot);
    },
    async listVersionSnapshots(): Promise<VersionSnapshotMeta[]> {
      return Array.from(snapshots.values()).map(({ workspaceSnapshot: _ws, ...meta }) => meta);
    },
    async loadVersionSnapshot(id: string) {
      return snapshots.get(id) ?? null;
    },
    async appendRestoreEvent() {},
    async listRestoreEvents() {
      return [];
    },
  };
}

function makeInput(overrides: Partial<PublishTransactionInput> = {}): PublishTransactionInput {
  return {
    version: '1.0.0',
    releaseNotes: 'Initial release',
    publishedBy: 'taehee',
    workspace: makeWorkspace(),
    changesSummary: makeChanges(),
    targets: [{ kind: 'git-pr', payload: { owner: 'o', repo: 'r' } }],
    ...overrides,
  };
}

const fixedClock = () => new Date('2026-04-30T12:00:00.000Z');
const fixedId = () => 'vsnap_test_001';

describe('executePublishTransaction', () => {
  it('persists a snapshot when every target succeeds', async () => {
    const persistence = makeStubPersistence();
    const execute: TargetExecutor = mock(async () => ({
      status: 'success',
      url: 'https://example.com/pr/1',
    })) as unknown as TargetExecutor;

    const outcome = await executePublishTransaction(
      makeInput({
        targets: [
          { kind: 'git-pr', payload: {} },
          { kind: 'npm-registry', payload: {} },
        ],
      }),
      { execute, persistence, now: fixedClock, generateId: fixedId },
    );

    expect(outcome.kind).toBe('success');
    if (outcome.kind !== 'success') throw new Error('unreachable');

    expect(outcome.snapshot.id).toBe('vsnap_test_001');
    expect(outcome.snapshot.version).toBe('1.0.0');
    expect(outcome.snapshot.targetResults).toHaveLength(2);
    expect(outcome.snapshot.targetResults.every((r) => r.status === 'success')).toBe(true);
    expect(persistence._snapshots.has('vsnap_test_001')).toBe(true);
  });

  it('partial-failure still persists snapshot, lists failed targets', async () => {
    const persistence = makeStubPersistence();
    const execute: TargetExecutor = async (spec) => {
      if (spec.kind === 'git-pr') return { status: 'success', url: 'https://pr/1' };
      return { status: 'failed', error: 'npm 401: unauthorized' };
    };

    const outcome = await executePublishTransaction(
      makeInput({
        targets: [
          { kind: 'git-pr', payload: {} },
          { kind: 'npm-registry', payload: {} },
        ],
      }),
      { execute, persistence, now: fixedClock, generateId: fixedId },
    );

    expect(outcome.kind).toBe('partial-failure');
    if (outcome.kind !== 'partial-failure') throw new Error('unreachable');
    expect(persistence._snapshots.has('vsnap_test_001')).toBe(true);
    expect(outcome.failedTargets).toHaveLength(1);
    expect(outcome.failedTargets[0].kind).toBe('npm-registry');
    expect(outcome.failedTargets[0].error).toBe('npm 401: unauthorized');
    expect(outcome.snapshot.targetResults).toHaveLength(2);
  });

  it('all-failed → no snapshot persisted, returns the per-target results', async () => {
    const persistence = makeStubPersistence();
    const execute: TargetExecutor = async () => ({
      status: 'failed',
      error: 'network down',
    });

    const outcome = await executePublishTransaction(
      makeInput({
        targets: [
          { kind: 'git-pr', payload: {} },
          { kind: 'npm-registry', payload: {} },
        ],
      }),
      { execute, persistence, now: fixedClock, generateId: fixedId },
    );

    expect(outcome.kind).toBe('all-failed');
    if (outcome.kind !== 'all-failed') throw new Error('unreachable');
    expect(persistence._snapshots.size).toBe(0);
    expect(outcome.targetResults).toHaveLength(2);
    expect(outcome.targetResults.every((r) => r.status === 'failed')).toBe(true);
    expect(outcome.targetResults[0].error).toBe('network down');
  });

  it('empty target list → all-failed (no successes possible)', async () => {
    const persistence = makeStubPersistence();
    const execute: TargetExecutor = mock(async () => ({
      status: 'success' as const,
    })) as unknown as TargetExecutor;

    const outcome = await executePublishTransaction(
      makeInput({ targets: [] }),
      { execute, persistence, now: fixedClock, generateId: fixedId },
    );

    expect(outcome.kind).toBe('all-failed');
    expect(persistence._snapshots.size).toBe(0);
    expect((execute as unknown as ReturnType<typeof mock>).mock.calls).toHaveLength(0);
  });

  it('preserves target execution order in the snapshot', async () => {
    const persistence = makeStubPersistence();
    const calls: string[] = [];
    const execute: TargetExecutor = async (spec) => {
      calls.push(spec.kind);
      return { status: 'success', url: `https://${spec.kind}` };
    };

    const outcome = await executePublishTransaction(
      makeInput({
        targets: [
          { kind: 'local-directory' },
          { kind: 'git-pr' },
          { kind: 'npm-registry' },
        ],
      }),
      { execute, persistence, now: fixedClock, generateId: fixedId },
    );

    expect(calls).toEqual(['local-directory', 'git-pr', 'npm-registry']);
    if (outcome.kind !== 'success') throw new Error('unreachable');
    expect(outcome.snapshot.targetResults.map((r) => r.kind)).toEqual([
      'local-directory',
      'git-pr',
      'npm-registry',
    ]);
  });

  it('snapshot includes deterministic sourceHash', async () => {
    const persistence = makeStubPersistence();
    const execute: TargetExecutor = async () => ({ status: 'success' });
    const ws = makeWorkspace('Snap');

    const outcome = await executePublishTransaction(
      makeInput({ workspace: ws }),
      { execute, persistence, now: fixedClock, generateId: fixedId },
    );

    if (outcome.kind !== 'success') throw new Error('unreachable');
    expect(outcome.snapshot.sourceHash).toBe(hashWorkspace(ws));
    // Same workspace → same hash, deterministically.
    expect(hashWorkspace(ws)).toBe(hashWorkspace(makeWorkspace('Snap')));
    // Different workspace → different hash.
    expect(hashWorkspace(makeWorkspace('Different'))).not.toBe(hashWorkspace(ws));
  });

  it('records failure error on per-target result', async () => {
    const persistence = makeStubPersistence();
    const execute: TargetExecutor = async (spec) =>
      spec.kind === 'git-pr'
        ? { status: 'success', url: 'https://pr' }
        : { status: 'failed', error: 'boom', url: 'https://attempted' };

    const outcome = await executePublishTransaction(
      makeInput({
        targets: [
          { kind: 'git-pr' },
          { kind: 'npm-registry' },
        ],
      }),
      { execute, persistence, now: fixedClock, generateId: fixedId },
    );

    if (outcome.kind !== 'partial-failure') throw new Error('unreachable');
    const npm = outcome.snapshot.targetResults.find((r) => r.kind === 'npm-registry')!;
    expect(npm.status).toBe('failed');
    expect(npm.error).toBe('boom');
    expect(npm.url).toBe('https://attempted');
    const pr = outcome.snapshot.targetResults.find((r) => r.kind === 'git-pr')!;
    expect(pr.error).toBeUndefined();
  });
});

describe('hashWorkspace', () => {
  it('returns an 8-char hex string', () => {
    const h = hashWorkspace(makeWorkspace());
    expect(h).toMatch(/^[0-9a-f]{8}$/);
  });

  it('is stable across calls for the same workspace', () => {
    const ws = makeWorkspace('Stable');
    expect(hashWorkspace(ws)).toBe(hashWorkspace(ws));
  });

  it('changes when the workspace changes', () => {
    expect(hashWorkspace(makeWorkspace('A'))).not.toBe(hashWorkspace(makeWorkspace('B')));
  });
});
