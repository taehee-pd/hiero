/**
 * IndexedDB persistence adapter for web.
 *
 * Uses raw IndexedDB API (no external deps) to store Workspace documents.
 * Auto-save is debounced to avoid excessive writes during rapid editing.
 */

'use client';

import type { Workspace } from '@/lib/schema/types';
import type { PersistenceAdapter, ProjectMeta, SavedProject } from './adapter';

const DB_NAME = 'coniva_projects';
const DB_VERSION = 1;
const STORE_NAME = 'projects';

type StoredRecord = {
  id: string;
  name: string;
  data: Workspace;
  updatedAt: number;
  iconCount: number;
};

function countIcons(workspace: Workspace): number {
  let count = 0;
  for (const setId of Object.keys(workspace.iconSets)) {
    count += Object.keys(workspace.iconSets[setId].icons).length;
  }
  return count;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function txStore(
  db: IDBDatabase,
  mode: IDBTransactionMode,
): IDBObjectStore {
  const tx = db.transaction(STORE_NAME, mode);
  return tx.objectStore(STORE_NAME);
}

function requestToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export class IndexedDBAdapter implements PersistenceAdapter {
  async list(): Promise<ProjectMeta[]> {
    const db = await openDB();
    try {
      const store = txStore(db, 'readonly');
      const records = await requestToPromise<StoredRecord[]>(store.getAll());
      return records
        .map((r) => ({
          id: r.id,
          name: r.name,
          updatedAt: r.updatedAt,
          iconCount: r.iconCount,
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt);
    } finally {
      db.close();
    }
  }

  async load(id: string): Promise<SavedProject | null> {
    const db = await openDB();
    try {
      const store = txStore(db, 'readonly');
      const record = await requestToPromise<StoredRecord | undefined>(store.get(id));
      if (!record) return null;
      return {
        id: record.id,
        name: record.name,
        data: record.data,
        updatedAt: record.updatedAt,
      };
    } finally {
      db.close();
    }
  }

  async save(id: string, data: Workspace): Promise<void> {
    const db = await openDB();
    try {
      const store = txStore(db, 'readwrite');
      const record: StoredRecord = {
        id,
        name: data.meta.name,
        data,
        updatedAt: Date.now(),
        iconCount: countIcons(data),
      };
      await requestToPromise(store.put(record));
    } finally {
      db.close();
    }
  }

  async delete(id: string): Promise<void> {
    const db = await openDB();
    try {
      const store = txStore(db, 'readwrite');
      await requestToPromise(store.delete(id));
    } finally {
      db.close();
    }
  }

  async rename(id: string, newName: string): Promise<void> {
    const db = await openDB();
    try {
      const store = txStore(db, 'readwrite');
      const record = await requestToPromise<StoredRecord | undefined>(store.get(id));
      if (!record) return;
      record.name = newName;
      record.data = {
        ...record.data,
        meta: { ...record.data.meta, name: newName },
      };
      record.updatedAt = Date.now();
      await requestToPromise(store.put(record));
    } finally {
      db.close();
    }
  }
}
