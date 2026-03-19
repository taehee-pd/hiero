/**
 * Sync analytics event emitter — UI layer bridge.
 *
 * This module provides the UI-facing analytics API that components and
 * hooks use. It delegates to the service-level SyncAnalytics module
 * for the full event taxonomy, and also dispatches DOM CustomEvents
 * for external listeners (PostHog, Mixpanel, etc.).
 *
 * For service-level instrumentation (inside syncPr), see:
 *   lib/sync-service/analytics.ts
 */

// Re-export service-level types for convenience
export type {
  SyncEventName,
  SyncEvent,
  SyncEventListener,
  SyncAnalytics,
  SyncAnalyticsOptions,
  SyncRunSummary,
} from '@/lib/sync-service/analytics';

export {
  createSyncAnalytics,
  createNoOpAnalytics,
  formatSyncTimeline,
} from '@/lib/sync-service/analytics';

// ---------------------------------------------------------------------------
// Legacy UI event emitter (kept for backward compatibility)
// ---------------------------------------------------------------------------

export type LegacySyncEventName =
  | 'sync_started'
  | 'sync_validation_failed'
  | 'sync_pr_created'
  | 'sync_conflict_detected'
  | 'sync_completed';

export type SyncEventPayload = Record<string, string | number | boolean>;

const listeners = new Set<(name: LegacySyncEventName, payload?: SyncEventPayload) => void>();

/**
 * Emit a sync analytics event (legacy UI API).
 *
 * For new code, prefer `createSyncAnalytics()` and pass it to `syncPr`.
 */
export function emitSyncEvent(
  name: LegacySyncEventName,
  payload?: SyncEventPayload,
): void {
  for (const fn of listeners) {
    try {
      fn(name, payload);
    } catch {
      // Don't let analytics errors break the sync flow.
    }
  }

  // Also dispatch a DOM CustomEvent for external listeners
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('coniva:sync', {
        detail: { name, ...payload },
      }),
    );
  }
}

/**
 * Subscribe to legacy sync events. Returns an unsubscribe function.
 */
export function onSyncEvent(
  fn: (name: LegacySyncEventName, payload?: SyncEventPayload) => void,
): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
