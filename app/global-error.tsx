'use client';

import { useEffect } from 'react';
import { ErrorRecoveryScreen } from '@/components/error-recovery';
import './globals.css';

/**
 * Last-resort boundary for crashes in the root layout itself. Must
 * render its own <html>/<body> because it replaces the root layout.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[hiero] global error boundary caught:', error);
  }, [error]);

  return (
    <html lang="en" className="dark bg-background">
      <body className="antialiased">
        <ErrorRecoveryScreen error={error} reset={reset} />
      </body>
    </html>
  );
}
