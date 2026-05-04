'use client';

/**
 * Engineer-facing debug surface for the resolved transition (W4-9).
 *
 * Renders ONLY when `process.env.NEXT_PUBLIC_HIERO_DEBUG === '1'`.
 * In production builds the gate compiles down to dead code (Webpack
 * folds the env-var literal — the constant-folding pattern is the
 * same one `next.config.mjs` uses for `NEXT_PUBLIC_BUILD_CHANNEL`).
 *
 * The pill carries algorithm vocabulary verbatim: tier name,
 * raw signal kind + structured fields, distortion estimate. This
 * is the ONE authorized place where `Hungarian` / `intrinsic` /
 * `ARAP` etc. surface in user-visible markup. The
 * `scripts/check-non-debug-copy.ts` lint excludes this file by
 * the `*Debug*.tsx` filename rule.
 *
 * Plan: docs_canonical/ICON_TRANSITION_UX_PLAN.md §3 Layer 3.
 */
import { useMemo } from 'react';

import type { MorphResolution } from '@/lib/runtime-core/morph-resolution';
import { signalToDebugString } from '@/lib/runtime-core/transition-signal-messages';
import { tierCeiling } from '@/lib/runtime-core/cascade';

type Props = {
  resolution: MorphResolution | null | undefined;
};

export function TransitionDebugPill({ resolution }: Props) {
  // Gate at module level: when the flag is unset, the early-return
  // below is the entire component body. Production tree-shaking
  // removes the rest.
  if (process.env.NEXT_PUBLIC_HIERO_DEBUG !== '1') return null;
  if (!resolution) return null;
  return <DebugPillBody resolution={resolution} />;
}

function DebugPillBody({ resolution }: { resolution: MorphResolution }) {
  const ceiling = useMemo(() => tierCeiling(resolution.tier), [resolution.tier]);
  const debugString = useMemo(
    () => signalToDebugString(resolution.signal),
    [resolution.signal],
  );
  return (
    <div
      role="status"
      aria-label="Transition resolver debug info"
      className="inline-flex flex-col gap-0.5 rounded-md border border-border/60 bg-background/80 px-2 py-1 font-mono text-[10px] leading-tight text-muted-foreground shadow-sm"
      data-testid="transition-debug-pill"
    >
      <div>
        Engine chose:{' '}
        <span className="font-semibold text-foreground">
          {resolution.tier}
        </span>{' '}
        <span aria-hidden>·</span> taxonomy:{' '}
        <span className="text-foreground">{resolution.taxonomy}</span>
      </div>
      <div>
        distortion:{' '}
        <span className="text-foreground">
          {resolution.distortion.toFixed(3)}
        </span>{' '}
        <span aria-hidden>/</span> ceiling:{' '}
        <span className="text-foreground">
          {Number.isFinite(ceiling) ? ceiling.toFixed(2) : '∞'}
        </span>
      </div>
      {debugString ? (
        <div className="break-words text-foreground">{debugString}</div>
      ) : null}
    </div>
  );
}
