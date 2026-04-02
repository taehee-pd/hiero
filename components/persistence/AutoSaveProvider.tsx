'use client';

import { useAutoSave } from '@/lib/persistence/use-persistence';
import { useAutoPublish } from '@/lib/persistence/use-auto-publish';

/**
 * Mounts auto-save wiring (IndexedDB) and auto-publish
 * wiring for npm countdown. Mount once at the app root.
 */
export function AutoSaveProvider() {
  useAutoSave();
  useAutoPublish();
  return null;
}
