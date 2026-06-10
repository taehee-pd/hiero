'use client';

import { useEffect } from 'react';
import { ErrorRecoveryScreen } from '@/components/error-recovery';

/**
 * Route-segment error boundary. Catches render/lifecycle crashes in any
 * page so a component failure shows a recovery screen instead of a
 * blank document. Auto-saved IndexedDB state survives; "Try again"
 * re-renders the segment, reload restores the last saved workspace.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[hiero] route error boundary caught:', error);
  }, [error]);

  return <ErrorRecoveryScreen error={error} reset={reset} />;
}
