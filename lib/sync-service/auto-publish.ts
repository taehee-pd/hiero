/**
 * Auto-publish manager — debounced automatic publish with cancel.
 *
 * When autoPublish.on === 'save', the manager schedules a publish
 * after a 5-minute cooldown. The designer sees a countdown badge
 * with a cancel button. Clicking cancel clears the timer.
 *
 * @module
 */

const DEBOUNCE_MS = 300_000; // 300 seconds = 5 minutes

export type AutoPublishState = {
  targetId: string;
  scheduledAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
  cancelled: boolean;
};

export type AutoPublishManager = {
  /** Schedule a publish for a sync target. Replaces any existing timer. */
  schedule(targetId: string, callback: () => Promise<void>): void;
  /** Cancel a pending publish for a sync target. */
  cancel(targetId: string): void;
  /** Cancel all pending publishes. */
  cancelAll(): void;
  /** Get all scheduled (non-cancelled) publishes with remaining time. */
  getScheduled(): Array<{ targetId: string; remainingMs: number }>;
  /** Check if a specific target has a pending publish. */
  isPending(targetId: string): boolean;
};

export function createAutoPublishManager(
  debounceMs: number = DEBOUNCE_MS,
): AutoPublishManager {
  const pending = new Map<string, AutoPublishState>();

  function schedule(
    targetId: string,
    callback: () => Promise<void>,
  ): void {
    // Clear any existing timer for this target
    cancel(targetId);

    const scheduledAt = Date.now();
    const timeoutId = setTimeout(async () => {
      const state = pending.get(targetId);
      if (state?.cancelled) {
        pending.delete(targetId);
        return;
      }
      pending.delete(targetId);
      try {
        await callback();
      } catch {
        // Publish errors are surfaced via the connector result,
        // not thrown from the auto-publish timer.
      }
    }, debounceMs);

    pending.set(targetId, {
      targetId,
      scheduledAt,
      timeoutId,
      cancelled: false,
    });
  }

  function cancel(targetId: string): void {
    const state = pending.get(targetId);
    if (state) {
      clearTimeout(state.timeoutId);
      state.cancelled = true;
      pending.delete(targetId);
    }
  }

  function cancelAll(): void {
    for (const [id] of pending) cancel(id);
  }

  function getScheduled(): Array<{ targetId: string; remainingMs: number }> {
    const now = Date.now();
    return [...pending.values()]
      .filter((s) => !s.cancelled)
      .map((s) => ({
        targetId: s.targetId,
        remainingMs: Math.max(0, debounceMs - (now - s.scheduledAt)),
      }));
  }

  function isPending(targetId: string): boolean {
    const state = pending.get(targetId);
    return !!state && !state.cancelled;
  }

  return { schedule, cancel, cancelAll, getScheduled, isPending };
}
