/**
 * Storage status — tiny external store that tracks whether persistence
 * is running against IndexedDB (durable) or the in-memory fallback
 * (degraded). `ResilientAdapter` writes to it; `StorageStatusBanner`
 * subscribes via `useSyncExternalStore`.
 */

'use client';

import { useSyncExternalStore } from 'react';

export type StorageStatus = {
  degraded: boolean;
  /** Why persistence fell back to memory. Null while durable. */
  reason: 'unavailable' | null;
};

const DURABLE: StorageStatus = { degraded: false, reason: null };

let status: StorageStatus = DURABLE;
const listeners = new Set<() => void>();

export function getStorageStatus(): StorageStatus {
  return status;
}

export function subscribeStorageStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function markStorageDegraded(): void {
  if (status.degraded) return;
  status = { degraded: true, reason: 'unavailable' };
  for (const listener of listeners) listener();
}

/** Test-only: restore the durable state between cases. */
export function resetStorageStatusForTests(): void {
  status = DURABLE;
  for (const listener of listeners) listener();
}

export function useStorageStatus(): StorageStatus {
  return useSyncExternalStore(
    subscribeStorageStatus,
    getStorageStatus,
    () => DURABLE,
  );
}
