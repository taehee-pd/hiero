'use client';

import { Icon as UiIcon } from '@hiero/ui-icons';
import { useStorageStatus } from '@/lib/persistence/storage-status';

/**
 * Persistent warning shown while persistence runs against the in-memory
 * fallback (IndexedDB unavailable). Intentionally not dismissable: as
 * long as it is visible, closing the tab loses all changes.
 */
export function StorageStatusBanner() {
  const { degraded } = useStorageStatus();
  if (!degraded) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      data-testid="storage-degraded-banner"
      className="status-warning-surface fixed inset-x-0 bottom-0 z-50 flex items-center justify-center gap-2 border-t px-4 py-2 text-sm"
    >
      <UiIcon name="alert-triangle" size={16} className="size-4 shrink-0" />
      <span>
        Browser storage is unavailable — changes won&apos;t survive closing this tab.
        Export your project file (⌘K → &ldquo;Export project file&rdquo;) to keep your work.
      </span>
    </div>
  );
}
