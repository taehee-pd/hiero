/**
 * Sync analytics event emitter.
 *
 * Fires structured events that any analytics provider can consume.
 * Currently dispatches custom DOM events; wire to PostHog, Mixpanel,
 * or console in dev by adding a listener.
 */

export type SyncEventName =
  | 'sync_started'
  | 'sync_validation_failed'
  | 'sync_pr_created'
  | 'sync_conflict_detected'
  | 'sync_completed';

export type SyncEventPayload = Record<string, string | number | boolean>;

const listeners = new Set<(name: SyncEventName, payload?: SyncEventPayload) => void>();

/**
 * Emit a sync analytics event.
 */
export function emitSyncEvent(
  name: SyncEventName,
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
      new CustomEvent('icophone:sync', {
        detail: { name, ...payload },
      }),
    );
  }
}

/**
 * Subscribe to sync events. Returns an unsubscribe function.
 */
export function onSyncEvent(
  fn: (name: SyncEventName, payload?: SyncEventPayload) => void,
): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
