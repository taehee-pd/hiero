'use client';

import { useCallback, useRef, useSyncExternalStore } from 'react';

// ---------------------------------------------------------------------------
// D4 — Animation progress visibility
// ---------------------------------------------------------------------------

/**
 * Snapshot of animation progress for an icon.
 */
export type AnimationProgressSnapshot = {
  /** Normalised progress (0-1). 0 when idle. */
  progress: number;
  /** Whether a transition or effect is currently running. */
  isAnimating: boolean;
  /** The current state ID of the icon. */
  currentState: string;
};

/**
 * `useAnimationProgress` — subscribes to animation frame progress
 * from an `IconDriver` (or any compatible store) via
 * `useSyncExternalStore`.
 *
 * Usage:
 * ```tsx
 * const { progress, isAnimating, currentState } = useAnimationProgress(driverRef);
 * ```
 *
 * The hook re-renders on every external state change. For per-frame
 * rendering (60fps), prefer the `onFrame` prop on `CuneiformIcon` instead.
 */
export function useAnimationProgress(
  driverRef: React.RefObject<{
    getCurrentState: () => string;
    subscribe: (listener: () => void) => () => void;
  } | null>,
): AnimationProgressSnapshot {
  // Internal mutable snapshot — written by the store, read by getSnapshot
  const snapshotRef = useRef<AnimationProgressSnapshot>({
    progress: 0,
    isAnimating: false,
    currentState: '',
  });

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const driver = driverRef.current;
      if (!driver) return () => {};
      return driver.subscribe(() => {
        // Driver state changed — update snapshot
        snapshotRef.current = {
          ...snapshotRef.current,
          currentState: driver.getCurrentState(),
        };
        onStoreChange();
      });
    },
    [driverRef],
  );

  const getSnapshot = useCallback((): AnimationProgressSnapshot => {
    const driver = driverRef.current;
    if (!driver) {
      return { progress: 0, isAnimating: false, currentState: '' };
    }
    return {
      ...snapshotRef.current,
      currentState: driver.getCurrentState(),
    };
  }, [driverRef]);

  const getServerSnapshot = useCallback(
    (): AnimationProgressSnapshot => ({
      progress: 0,
      isAnimating: false,
      currentState: '',
    }),
    [],
  );

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
