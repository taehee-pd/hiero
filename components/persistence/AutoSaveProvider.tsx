'use client';

import { useAutoSave } from '@/lib/persistence/use-persistence';

/**
 * Mounts auto-save wiring for web (IndexedDB).
 * On desktop, this is a no-op — DesktopCommandBridge handles persistence.
 * Mount once at the app root alongside DesktopCommandBridge.
 */
export function AutoSaveProvider() {
  useAutoSave();
  return null;
}
