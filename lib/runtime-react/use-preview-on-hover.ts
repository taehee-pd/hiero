'use client';

/**
 * Hover-preview hook (W4-6).
 *
 * Drives the icon-picker's preview-on-hover affordance. When the
 * user hovers a candidate target icon, the hook resolves a
 * morph against the active source, samples it through the
 * cascade-scheduler, and emits per-frame `(d, alpha)` updates the
 * picker can render. Hover-end stops playback; `prefers-reduced-
 * motion` short-circuits to a static preview.
 *
 * Performance budget: ≤100ms time-to-first-frame. The hook is
 * deliberately lightweight — it computes resolution lazily and
 * caches via the optional `ResolverCache` so repeated hovers over
 * the same candidate hit memo.
 *
 * UX ref: docs_canonical/ICON_TRANSITION_UX_PLAN.md §6.2.
 */
import { useEffect, useMemo, useRef, useState } from 'react';

import { resolveMorph } from '@/lib/runtime-core/cascade';
import { sampleMorph, type MorphFrame } from '@/lib/runtime-core/cascade-scheduler';
import type { Cadence } from '@/lib/runtime-core/motion-curves';
import type { MorphResolution } from '@/lib/runtime-core/morph-resolution';
import type { ResolverCache } from '@/lib/runtime-core/resolver-cache';
import type { Layer } from '@/lib/schema/types';

const RAMP_IN_MS = 120; // §7.2 — three motion moments earn animation
const DEFAULT_DURATION_MS = 600;

export type UsePreviewOnHoverOptions = {
  /**
   * Target layer being hovered. `null` = no hover; the preview
   * resets to the source's static state.
   */
  hoverTarget: Layer | null;
  /** Source layer (the currently-displayed icon). */
  source: Layer;
  /** Cadence override; defaults to `'soft'`. */
  cadence?: Cadence;
  /** Total duration the preview plays, in ms. Default 600. */
  durationMs?: number;
  /**
   * Shared resolver cache so repeated hovers over the same
   * candidate skip re-canonicalisation.
   */
  cache?: ResolverCache;
};

export type PreviewState = {
  /** Currently-rendered path string. */
  d: string;
  /** Currently-rendered opacity. */
  alpha: number;
  /** The morph resolution driving the preview, or null when idle. */
  resolution: MorphResolution | null;
};

/**
 * `requestAnimationFrame` shim — a real RAF when the runtime
 * supports it, a setTimeout poll-fill otherwise (SSR / test).
 */
const raf =
  typeof requestAnimationFrame !== 'undefined'
    ? requestAnimationFrame
    : (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number;

const cancelRaf =
  typeof cancelAnimationFrame !== 'undefined'
    ? cancelAnimationFrame
    : (handle: number) => clearTimeout(handle);

/**
 * Honour `prefers-reduced-motion`. SSR-safe (returns false).
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function usePreviewOnHover({
  hoverTarget,
  source,
  cadence = 'soft',
  durationMs = DEFAULT_DURATION_MS,
  cache,
}: UsePreviewOnHoverOptions): PreviewState {
  const [state, setState] = useState<PreviewState>(() => ({
    d: source.path?.d ?? '',
    alpha: 1,
    resolution: null,
  }));
  const rafHandle = useRef<number | null>(null);
  const startTime = useRef<number | null>(null);

  // Resolve the morph once per (source, target, cadence) — memoized
  // through the cache when provided. The cascade is pure so this
  // is safe inside useMemo.
  const resolution = useMemo<MorphResolution | null>(() => {
    if (!hoverTarget) return null;
    return resolveMorph(source, hoverTarget, { cadence, cache });
  }, [hoverTarget, source, cadence, cache]);

  useEffect(() => {
    // No hover target — reset to source's static path.
    if (!resolution || !hoverTarget) {
      if (rafHandle.current !== null) {
        cancelRaf(rafHandle.current);
        rafHandle.current = null;
      }
      startTime.current = null;
      setState({
        d: source.path?.d ?? '',
        alpha: 1,
        resolution: null,
      });
      return;
    }

    // Reduced-motion preference: jump to t=1 (the target's static
    // shape at full opacity) without playing the trajectory.
    if (prefersReducedMotion()) {
      const frame: MorphFrame = sampleMorph(resolution, 1);
      setState({ d: frame.d, alpha: frame.alpha, resolution });
      return;
    }

    startTime.current = null;
    // W4 audit §6: seed the visible state with the t=0 frame of
    // the new resolution before the first RAF tick fires. Without
    // this seed the next render shows the previous transition's
    // last frame for one paint while RAF is being scheduled,
    // visible as a flicker on rapid hover-target switches.
    {
      const seed = sampleMorph(resolution, 0);
      setState({ d: seed.d, alpha: seed.alpha, resolution });
    }

    const tick = (now: number) => {
      if (startTime.current === null) startTime.current = now;
      const elapsed = now - startTime.current;
      const total = RAMP_IN_MS + durationMs;
      let frame: MorphFrame;
      if (elapsed < RAMP_IN_MS) {
        // Ramp-in phase: hold at t=0, fade alpha from prior to 1.
        // The 120 ms ramp gives the user a perceptible "this is a
        // new preview" handoff (§7.2 motion moment).
        const ramp = elapsed / RAMP_IN_MS;
        frame = sampleMorph(resolution, 0);
        frame = { d: frame.d, alpha: ramp * frame.alpha };
      } else if (elapsed < total) {
        const t = (elapsed - RAMP_IN_MS) / durationMs;
        frame = sampleMorph(resolution, t);
      } else {
        // Hover persists past playback end — freeze on `t=1`.
        frame = sampleMorph(resolution, 1);
      }
      setState({ d: frame.d, alpha: frame.alpha, resolution });
      rafHandle.current = raf(tick);
    };
    rafHandle.current = raf(tick);

    return () => {
      if (rafHandle.current !== null) cancelRaf(rafHandle.current);
      rafHandle.current = null;
      startTime.current = null;
    };
  }, [resolution, hoverTarget, source, durationMs]);

  return state;
}
