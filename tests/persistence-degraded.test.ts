/**
 * A2 — degraded persistence contract (docs_canonical/IMPROVEMENT_BACKLOG.md).
 *
 *   - ResilientAdapter falls back to in-memory storage when IndexedDB is
 *     unavailable (SecurityError, missing API) and flips the shared
 *     storage status so the banner can warn the user.
 *   - Quota errors do NOT degrade: the database is healthy and holds the
 *     user's projects; the save failure keeps surfacing to the caller.
 *   - The startup probe detects blocked storage before the first edit.
 */
import { beforeEach, describe, expect, test } from 'bun:test';

import type { PersistenceAdapter } from '../lib/persistence/adapter';
import { MemoryAdapter } from '../lib/persistence/memory-adapter';
import {
  ResilientAdapter,
  isStorageUnavailableError,
} from '../lib/persistence/resilient-adapter';
import {
  getStorageStatus,
  resetStorageStatusForTests,
  subscribeStorageStatus,
} from '../lib/persistence/storage-status';
import { SAMPLE_WORKSPACE } from '../lib/schema/sample-project';
import type { Workspace } from '../lib/schema/types';

function namedError(name: string, message = name): Error {
  const error = new Error(message);
  error.name = name;
  return error;
}

/** Adapter whose every method rejects with the given error. */
function failingAdapter(error: Error): PersistenceAdapter {
  const fail = () => Promise.reject(error);
  return {
    list: fail,
    load: fail,
    save: fail,
    delete: fail,
    rename: fail,
    createCheckpoint: fail,
    listCheckpoints: fail,
    loadCheckpoint: fail,
    deleteCheckpoint: fail,
    saveVersionSnapshot: fail,
    listVersionSnapshots: fail,
    loadVersionSnapshot: fail,
    appendRestoreEvent: fail,
    listRestoreEvents: fail,
  };
}

function workspace(): Workspace {
  return structuredClone(SAMPLE_WORKSPACE);
}

beforeEach(() => {
  resetStorageStatusForTests();
});

describe('isStorageUnavailableError', () => {
  test('classifies blocked-storage errors as unavailable', () => {
    expect(isStorageUnavailableError(namedError('SecurityError'))).toBe(true);
    expect(isStorageUnavailableError(namedError('InvalidStateError'))).toBe(true);
    expect(isStorageUnavailableError(namedError('VersionError'))).toBe(true);
    expect(isStorageUnavailableError(new TypeError('indexedDB is not defined'))).toBe(true);
  });

  test('quota and generic errors are NOT unavailable', () => {
    expect(isStorageUnavailableError(namedError('QuotaExceededError'))).toBe(false);
    expect(isStorageUnavailableError(new Error('something else'))).toBe(false);
    expect(isStorageUnavailableError(null)).toBe(false);
  });
});

describe('ResilientAdapter degraded mode', () => {
  test('falls back to memory on SecurityError and keeps the session working', async () => {
    const adapter = new ResilientAdapter(failingAdapter(namedError('SecurityError')), {
      probe: false,
    });

    expect(getStorageStatus().degraded).toBe(false);
    await adapter.save('p1', workspace());
    expect(getStorageStatus().degraded).toBe(true);
    expect(getStorageStatus().reason).toBe('unavailable');

    // Subsequent operations run against the in-memory store.
    const loaded = await adapter.load('p1');
    expect(loaded).not.toBeNull();
    expect(loaded!.id).toBe('p1');
    const list = await adapter.list();
    expect(list.length).toBe(1);
  });

  test('checkpoints round-trip through the fallback', async () => {
    const adapter = new ResilientAdapter(failingAdapter(namedError('SecurityError')), {
      probe: false,
    });
    const meta = await adapter.createCheckpoint('p1', workspace(), 'memo');
    const checkpoint = await adapter.loadCheckpoint(meta.id);
    expect(checkpoint).not.toBeNull();
    expect(checkpoint!.memo).toBe('memo');
    const all = await adapter.listCheckpoints('p1');
    expect(all.length).toBe(1);
  });

  test('QuotaExceededError surfaces to the caller and does NOT degrade', async () => {
    const adapter = new ResilientAdapter(failingAdapter(namedError('QuotaExceededError')), {
      probe: false,
    });
    await expect(adapter.save('p1', workspace())).rejects.toThrow('QuotaExceededError');
    expect(getStorageStatus().degraded).toBe(false);
  });

  test('startup probe detects blocked storage before any operation', async () => {
    let notified = false;
    const unsubscribe = subscribeStorageStatus(() => {
      notified = true;
    });
    new ResilientAdapter(failingAdapter(namedError('SecurityError')));
    // The probe is fire-and-forget; let its microtasks settle.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(getStorageStatus().degraded).toBe(true);
    expect(notified).toBe(true);
    unsubscribe();
  });

  test('healthy primary stays primary', async () => {
    const primary = new MemoryAdapter();
    const adapter = new ResilientAdapter(primary, { probe: false });
    await adapter.save('p1', workspace());
    expect(getStorageStatus().degraded).toBe(false);
    // Written through to the primary, not a hidden fallback.
    expect((await primary.list()).length).toBe(1);
  });
});
