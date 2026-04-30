/**
 * React hook that loads `hiero.config.ts` via the dev-server route.
 *
 * Browser-safe: this hook never imports the filesystem or env-var
 * checks — it just calls `/api/install-config` which is the trust
 * boundary. Per the eng-review credential-handling rule, tokens never
 * reach the client; this hook only sees config shape.
 *
 *   ┌────────────┐    fetch /api/install-config    ┌──────────────────┐
 *   │  React UI  │─────────────────────────────────▶│ server-side load │
 *   └────────────┘                                  │ + validate       │
 *                                                   └──────────────────┘
 *
 * Phase 2.5 wiring fix (issue P1 + P4): consumed by PublishDialog
 * (release-target options) and SetupHealthPanel (config-shape checks).
 */

'use client';

import { useEffect, useState } from 'react';
import type { HieroConfig } from './types';

export type HieroConfigState =
  | { kind: 'loading' }
  | { kind: 'loaded'; config: HieroConfig; sourcePath: string }
  | { kind: 'missing'; message: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'fetch-error'; message: string };

type ApiResponse =
  | { ok: true; config: HieroConfig; sourcePath: string }
  | { ok: false; reason: 'missing' | 'invalid'; message: string };

let cached: HieroConfigState | null = null;

/**
 * Load + cache the host repo's hiero.config.ts. The cache is a single
 * in-memory snapshot per browser session — no auto-refetch. Callers
 * that need to invalidate after a `hiero init` can call
 * `clearHieroConfigCache()` and remount the consumer.
 */
export function useHieroConfig(): HieroConfigState {
  const [state, setState] = useState<HieroConfigState>(
    () => cached ?? { kind: 'loading' },
  );

  useEffect(() => {
    if (cached && cached.kind !== 'loading') {
      setState(cached);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch('/api/install-config', {
          headers: { accept: 'application/json' },
        });
        if (!response.ok) {
          const next: HieroConfigState = {
            kind: 'fetch-error',
            message: `Failed to load config: HTTP ${response.status}.`,
          };
          cached = next;
          if (!cancelled) setState(next);
          return;
        }
        const body = (await response.json()) as ApiResponse;
        const next: HieroConfigState = body.ok
          ? { kind: 'loaded', config: body.config, sourcePath: body.sourcePath }
          : body.reason === 'missing'
            ? { kind: 'missing', message: body.message }
            : { kind: 'invalid', message: body.message };
        cached = next;
        if (!cancelled) setState(next);
      } catch (err) {
        const next: HieroConfigState = {
          kind: 'fetch-error',
          message:
            err instanceof Error ? err.message : 'Unknown error loading config.',
        };
        cached = next;
        if (!cancelled) setState(next);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

export function clearHieroConfigCache(): void {
  cached = null;
}
