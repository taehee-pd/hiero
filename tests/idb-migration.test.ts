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

    const checkpoints = stores.get(CHECKPOINTS_STORE)!;
    expect(checkpoints.keyPath).toBe('id');
    expect(checkpoints.indices).toHaveLength(1);
    expect(checkpoints.indices[0]).toEqual({
      name: CHECKPOINTS_INDEX_PROJECT_CREATED,
      keyPath: ['projectId', 'createdAt'],
    });
  });

  it('upgrade from v1 (existing projects store) only adds the checkpoints store', () => {
    // Simulate a user on v1: the projects store already exists.
    const { db, stores } = createMockDB({
      [PROJECTS_STORE]: { keyPath: 'id', indices: [] },
    });

    applyUpgrade(db, 1);

    // Projects store untouched.
    expect(stores.get(PROJECTS_STORE)!.keyPath).toBe('id');
    // Checkpoints store created.
    expect(stores.has(CHECKPOINTS_STORE)).toBe(true);
    expect(stores.get(CHECKPOINTS_STORE)!.indices[0].name).toBe(
      CHECKPOINTS_INDEX_PROJECT_CREATED,
    );
  });

  it('does not double-create stores that already exist (re-entrancy safety)', () => {
    // Simulate a malformed prior install where both stores exist but
    // upgrade fires with oldVersion=0 for some reason.
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

    expect(() => applyUpgrade(db, 0)).not.toThrow();
    expect(stores.size).toBe(2);
  });

  it('DB_VERSION matches the highest case in the upgrade ladder', () => {
    // If a future phase adds a new case (e.g. case 2) without bumping
    // DB_VERSION, fresh installs would never run that case. Pin the
    // contract: DB_VERSION must equal (number of cases). Currently 2.
    expect(DB_VERSION).toBe(2);
  });
});
