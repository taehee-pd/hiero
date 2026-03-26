'use client';

import { useAutoSave } from '@/lib/persistence/use-persistence';
import { useAutoPublish } from '@/lib/persistence/use-auto-publish';

/**
 * Mounts auto-save wiring for web (IndexedDB) and auto-publish
 * wiring for npm countdown. On desktop, auto-save is a no-op
 * (DesktopCommandBridge handles persistence).
 * Mount once at the app root alongside DesktopCommandBridge.
 */
export function AutoSaveProvider() {
  useAutoSave();
  useAutoPublish();
  return null;
}
