export type MotionPreference = 'full' | 'reduce';

/**
 * Detect the user's motion preference from the system setting.
 * Returns 'full' in non-browser environments (SSR safe).
 */
export function getMotionPreference(): MotionPreference {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'full';
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'reduce' : 'full';
}

/**
 * Subscribe to changes in the user's motion preference.
 * Returns an unsubscribe function. No-op in non-browser environments.
 */
export function subscribeMotionPreference(
  callback: (preference: MotionPreference) => void,
): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return () => {};
  }

  const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
  const handler = (event: MediaQueryListEvent) => {
    callback(event.matches ? 'reduce' : 'full');
  };
  mql.addEventListener('change', handler);
  return () => mql.removeEventListener('change', handler);
}

/**
 * Resolve whether animations should be skipped.
 */
export function shouldReduceMotion(setting: boolean | 'system'): boolean {
  if (setting === true) return true;
  if (setting === false) return false;
  return getMotionPreference() === 'reduce';
}
