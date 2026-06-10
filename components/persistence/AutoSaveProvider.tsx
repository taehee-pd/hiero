'use client';

import { useAutoSave } from '@/lib/persistence/use-persistence';
import { useAutoPublish } from '@/lib/persistence/use-auto-publish';
import { StorageStatusBanner } from './StorageStatusBanner';

/**
 * Mounts auto-save wiring (IndexedDB) and auto-publish
 * wiring for npm countdown. Mount once at the app root.
 * Also hosts the degraded-storage warning banner so it is
 * present on every route without touching the layout.
 */
export function AutoSaveProvider() {
  useAutoSave();
  useAutoPublish();
  return <StorageStatusBanner />;
}
