'use client';

import { useCallback, useState } from 'react';
import { Icon as UiIcon } from '@hiero/ui-icons';
import { Button } from '@/components/ui/button';
import { BUILD_VERSION } from '@/lib/build-version';

type Props = {
  error: Error & { digest?: string };
  /** Next.js error-boundary reset — re-renders the failed segment. */
  reset: () => void;
};

function buildErrorReport(error: Props['error']): string {
  return [
    `Hiero error report`,
    `time: ${new Date().toISOString()}`,
    `channel: ${BUILD_VERSION.channel} · version: ${BUILD_VERSION.app} · commit: ${BUILD_VERSION.commit}`,
    error.digest ? `digest: ${error.digest}` : null,
    `message: ${error.message}`,
    error.stack ? `stack:\n${error.stack}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Crash recovery screen rendered by `app/error.tsx` and
 * `app/global-error.tsx`. The core promise: a render crash never costs
 * saved work — auto-save runs against IndexedDB on every change, so
 * reloading restores the last saved state.
 */
export function ErrorRecoveryScreen({ error, reset }: Props) {
  const [copied, setCopied] = useState(false);

  const copyReport = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildErrorReport(error));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the details stay visible below for manual copy.
    }
  }, [error]);

  return (
    <main
      role="alert"
      className="flex h-screen w-screen items-center justify-center bg-background p-6 text-foreground"
    >
      <div className="w-full max-w-md space-y-4">
        <div className="flex items-center gap-2">
          <UiIcon name="alert-triangle" size={20} className="size-5 text-destructive" />
          <h1 className="text-lg font-medium">Hiero hit an unexpected error</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          Your work is auto-saved to this browser as you edit. Reloading brings back
          your last saved state — at most the past few seconds of changes are affected.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button onClick={reset}>Try again</Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Reload Hiero
          </Button>
          <Button variant="ghost" onClick={() => void copyReport()}>
            {copied ? 'Copied' : 'Copy error details'}
          </Button>
        </div>
        <details className="rounded border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none">Error details</summary>
          <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all">
            {error.message}
            {error.digest ? `\ndigest: ${error.digest}` : ''}
          </pre>
        </details>
      </div>
    </main>
  );
}
