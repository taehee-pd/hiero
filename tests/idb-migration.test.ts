/**
 * IDB schema migration tests.
 *
 * The adapter's `applyUpgrade` function uses a switch-fallthrough so a
 * fresh install (oldVersion=0) and a user upgrading from v1 both end up
 * with the same final schema. This test exercises that path without
 * needing real IndexedDB by feeding `applyUpgrade` a minimal mock
 * IDBDatabase that records create-store / create-index calls.
 *
 * Why this matters: per the eng plan review, every existing user has a
 * v1 database. If the upgrade path silently skips creating the new
 * stores, every checkpoint write throws.
 */

import { describe, it, expect } from 'bun:test';
import {
  applyUpgrade,
  CHECKPOINTS_INDEX_PROJECT_CREATED,
  CHECKPOINTS_STORE,
  DB_VERSION,
  PROJECTS_STORE,
  VERSION_SNAPSHOTS_INDEX_PUBLISHED_AT,
  VERSION_SNAPSHOTS_STORE,
} from '@/lib/persistence/indexeddb-adapter';

type MockStore = {
  keyPath: string | string[];
  indices: Array<{ name: string; keyPath: string | string[] }>;
};

function createMockDB(initial: Record<string, MockStore> = {}) {
  const stores = new Map<string, MockStore>();
  for (const [name, store] of Object.entries(initial)) {
    stores.set(name, store);
  }

  const objectStoreNames = {
    contains(name: string): boolean {
      return stores.has(name);
    },
  };

  const db = {
    objectStoreNames,
    createObjectStore(
      name: string,
      options: { keyPath: string | string[] },
    ): { createIndex: (idxName: string, keyPath: string | string[]) => void } {
      if (stores.has(name)) {
        throw new Error(`store ${name} already exists`);
      }
      const store: MockStore = {
        keyPath: options.keyPath,
        indices: [],
      };
      stores.set(name, store);
      return {
        createIndex(idxName: string, keyPath: string | string[]) {
          store.indices.push({ name: idxName, keyPath });
        },
      };
    },
  } as unknown as IDBDatabase & { _stores: typeof stores };
  (db as { _stores: typeof stores })._stores = stores;

  return { db, stores };
}

describe('applyUpgrade', () => {
  it('fresh install (oldVersion=0) creates every store at the latest schema', () => {
    const { db, stores } = createMockDB();

    applyUpgrade(db, 0);

    expect(stores.has(PROJECTS_STORE)).toBe(true);
    expect(stores.has(CHECKPOINTS_STORE)).toBe(true);
    expect(stores.has(VERSION_SNAPSHOTS_STORE)).toBe(true);

    const checkpoints = stores.get(CHECKPOINTS_STORE)!;
    expect(checkpoints.keyPath).toBe('id');
    expect(checkpoints.indices).toHaveLength(1);
    expect(checkpoints.indices[0]).toEqual({
      name: CHECKPOINTS_INDEX_PROJECT_CREATED,
      keyPath: ['projectId', 'createdAt'],
    });

    const snapshots = stores.get(VERSION_SNAPSHOTS_STORE)!;
    expect(snapshots.keyPath).toBe('id');
    expect(snapshots.indices).toHaveLength(1);
    expect(snapshots.indices[0]).toEqual({
      name: VERSION_SNAPSHOTS_INDEX_PUBLISHED_AT,
      keyPath: 'publishedAt',
    });
  });

  it('upgrade from v1 (existing projects store) adds checkpoints + snapshots', () => {
    // Simulate a user on v1: the projects store already exists.
    const { db, stores } = createMockDB({
      [PROJECTS_STORE]: { keyPath: 'id', indices: [] },
    });

    applyUpgrade(db, 1);

    // Projects store untouched.
    expect(stores.get(PROJECTS_STORE)!.keyPath).toBe('id');
    // Both new stores created via the fallthrough chain.
    expect(stores.has(CHECKPOINTS_STORE)).toBe(true);
    expect(stores.get(CHECKPOINTS_STORE)!.indices[0].name).toBe(
      CHECKPOINTS_INDEX_PROJECT_CREATED,
    );
    expect(stores.has(VERSION_SNAPSHOTS_STORE)).toBe(true);
    expect(stores.get(VERSION_SNAPSHOTS_STORE)!.indices[0].name).toBe(
      VERSION_SNAPSHOTS_INDEX_PUBLISHED_AT,
    );
  });

  it('upgrade from v2 (Phase 1 user) only adds the snapshots store', () => {
    // Simulate a user on v2: projects + checkpoints stores both exist.
    const { db, stores } = createMockDB({
      [PROJECTS_STORE]: { keyPath: 'id', indices: [] },
      [CHECKPOINTS_STORE]: {
        keyPath: 'id',
        indices: [
          {
            name: CHECKPOINTS_INDEX_PROJECT_CREATED,
            keyPath: ['projectId', 'createdAt'],
          },
        ],
      },
    });

    applyUpgrade(db, 2);

    expect(stores.size).toBe(3);
    expect(stores.has(VERSION_SNAPSHOTS_STORE)).toBe(true);
  });

  it('does not double-create stores that already exist (re-entrancy safety)', () => {
    const { db, stores } = createMockDB({
      [PROJECTS_STORE]: { keyPath: 'id', indices: [] },
      [CHECKPOINTS_STORE]: {
        keyPath: 'id',
        indices: [
          {
            name: CHECKPOINTS_INDEX_PROJECT_CREATED,
            keyPath: ['projectId', 'createdAt'],
          },
        ],
      },
      [VERSION_SNAPSHOTS_STORE]: {
        keyPath: 'id',
        indices: [
          { name: VERSION_SNAPSHOTS_INDEX_PUBLISHED_AT, keyPath: 'publishedAt' },
        ],
      },
    });

    expect(() => applyUpgrade(db, 0)).not.toThrow();
    expect(stores.size).toBe(3);
  });

  it('DB_VERSION matches the highest case in the upgrade ladder', () => {
    // If a future phase adds a new case (e.g. case 3) without bumping
    // DB_VERSION, fresh installs would never run that case. Phase 3
    // will bump this to 4 with the restore_events store.
    expect(DB_VERSION).toBe(3);
  });
});
