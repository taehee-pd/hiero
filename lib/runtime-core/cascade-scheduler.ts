/**
 * Two-curve scheduler for the V2 cascade (W3-8).
 *
 * Bridges {@link MorphResolution.motion} into per-frame playback.
 * Geometry progress and opacity progress are decoupled — the
 * scheduler reads `motion.g(t)` to pick the path-string at each
 * wall-clock progress, and `motion.alpha(t)` to drive opacity.
 *
 * Geometry leads opacity by `motion.alphaOffsetRatio` (default 0.08
 * on `'soft'` cadence, 0.04 on `'snappy'`). The offset is applied
 * inside {@link alphaProgress}; the geometry curve runs over the
 * full `[0, 1]`.
 *
 * The scheduler is platform-neutral — it returns `(d, alpha)` per
 * frame and lets the renderer (`runtime-dom`, `runtime-react`,
 * Lottie export) apply them. The legacy multi-layer scheduler in
 * `lib/runtime-core/scheduler.ts` is unchanged; the cascade
 * scheduler is an additive playback path used by Wave-4 surfaces
 * (preview-on-hover, Storybook fixtures) and the W5 corpus harness.
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §2.3 +
 * docs_canonical/ICON_TRANSITION_UX_PLAN.md §1 (progress
 * decoupling).
 *
 * @module
 */
import type { MorphResolution } from './morph-resolution';
import { geometryProgress } from './motion-curves';

/**
 * Per-frame output for a resolved morph at progress `t ∈ [0, 1]`.
 *
 * - `d`     — interpolated SVG path string
 * - `alpha` — opacity at the same wall-clock instant, honouring the
 *             motion's `alphaOffsetRatio`. `1` = fully visible.
 *
 * The renderer is responsible for crossfading source ↔ target
 * geometry via this `alpha` when the resolution is a designed
 * fallback (the interpolator there returns source for `t < 0.5`,
 * target for `t ≥ 0.5`); for continuous morphs (T1–T5) `alpha`
 * stays at 1 across the whole range and the geometry interpolation
 * carries the visual change.
 */
export type MorphFrame = {
  d: string;
  alpha: number;
};

/**
 * Sample a {@link MorphResolution} at a single normalised time.
 * Pure; safe to call inside a render loop.
 */
export function sampleMorph(resolution: MorphResolution, t: number): MorphFrame {
  const tt = clamp01(t);
  const geometryT = geometryProgress(resolution.motion, tt);
  const d = resolution.interpolator(geometryT);
  const alpha = computeAlpha(resolution, tt);
  return { d, alpha };
}

/**
 * Sample a resolution at evenly-spaced frames. Mirrors
 * `transition-metrics.sampleTrajectory` but produces (d, alpha)
 * pairs; useful for the W4 hover-preview pipeline and the W5
 * corpus harness when measuring opacity-driven motion.
 */
export function sampleMorphTrajectory(
  resolution: MorphResolution,
  frameCount: number,
): MorphFrame[] {
  if (frameCount < 2) {
    throw new Error(`sampleMorphTrajectory requires frameCount >= 2 (got ${frameCount})`);
  }
  const out: MorphFrame[] = [];
  for (let i = 0; i < frameCount; i++) {
    out.push(sampleMorph(resolution, i / (frameCount - 1)));
  }
  return out;
}

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

function computeAlpha(resolution: MorphResolution, t: number): number {
  // Designed fallbacks render source for `t < 0.5` and target for
  // `t >= 0.5`; the alpha curve therefore needs to cross zero at
  // the midpoint to mask the geometry swap. Continuous morphs
  // (intrinsic-strict, hierarchical-match, compound-isomorphic)
  // ride at full opacity end-to-end.
  if (resolution.tier === 'designed-fallback') {
    return computeFallbackAlpha(resolution, t);
  }
  if (resolution.tier === 'draw-coordinated') {
    // Same source/target swap at t=0.5 as designed-fallback; alpha
    // dips at the midpoint then recovers, with the per-fallback
    // offset applied on the recovery side.
    return computeFallbackAlpha(resolution, t);
  }
  // Continuous morphs (identity, intrinsic-strict, hierarchical-
  // match, compound-isomorphic) ride at full opacity end-to-end.
  // The geometric interpolation carries the visual change; opacity
  // is a no-op for these tiers per the §1 motion contract.
  void t;
  return 1;
}

function computeFallbackAlpha(resolution: MorphResolution, t: number): number {
  // Symmetric V around the swap point. The runtime alpha curve
  // shapes both halves; the offset stretches the recovery half.
  const offset = resolution.motion.alphaOffsetRatio;
  if (t < 0.5) {
    // Outgoing half: alpha falls from 1 → 0.
    const local = t * 2; // remap [0, 0.5] → [0, 1]
    return 1 - resolution.motion.alpha(clamp01(local));
  }
  // Incoming half: alpha rises from 0 → 1, optionally delayed by
  // `offset` to give the geometry swap a moment to land.
  const local = (t - 0.5) * 2; // remap [0.5, 1] → [0, 1]
  if (local < offset) return 0;
  const denom = 1 - offset;
  if (denom <= 0) return resolution.motion.alpha(clamp01(local));
  return resolution.motion.alpha(clamp01((local - offset) / denom));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}
