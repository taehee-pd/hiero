import { useMemo } from 'react';

import type { MorphResolution } from '@/lib/runtime-core/morph-resolution';
import { signalToSentence } from '@/lib/runtime-core/transition-signal-messages';

/**
 * React hook returning the plain-language sentence the
 * AnimationStudioPanel renders for a resolved transition. Returns
 * `null` when the cascade landed where the topology classifier
 * suggested (i.e. no fallback explanation needed).
 *
 * Memoized over `resolution.signal` so consumers can pass a fresh
 * object reference without re-rendering the sentence every paint.
 *
 * Plan: docs_canonical/ICON_TRANSITION_UX_PLAN.md §6.3.
 */
export function useResolutionSentence(
  resolution: MorphResolution | null | undefined,
): string | null {
  const signal = resolution?.signal ?? null;
  return useMemo(() => signalToSentence(signal), [signal]);
}
