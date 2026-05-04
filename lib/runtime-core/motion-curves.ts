/**
 * Motion curves — geometry / opacity progress decoupling.
 *
 * Two timing curves per resolved transition: `g(t)` for geometry
 * progress (path interpolation), `α(t)` for opacity progress (fade /
 * draw). Geometry leads opacity by `alphaOffsetRatio` (default 8% of
 * duration), which the runtime scheduler honours.
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §2.3,
 * docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §1.
 *
 * @module
 */
import type { EasingFunction } from './easing';
import { getEasingFunction } from './easing';

/**
 * A pair of timing curves plus an opacity-vs-geometry offset.
 *
 * - `g`  — geometry progress curve, applied to path interpolation.
 * - `alpha` — opacity progress curve, applied to fade / draw.
 * - `alphaOffsetRatio` — fraction of total duration by which opacity
 *   trails geometry. `0` = synchronous; positive = geometry leads.
 */
export type MotionCurves = {
  g: EasingFunction;
  alpha: EasingFunction;
  alphaOffsetRatio: number;
};

/**
 * Authored cadence as exposed in the editor's Layer-1 toggle.
 *
 * `'soft'` (default) and `'snappy'` are the only authored values
 * today. The Layer-2 timing-curve override surfaces in W4-8; when
 * it lands the union widens to include `'custom'` plus a separate
 * `Transition.timing` block. Until then there is no third value —
 * a silently-soft fallback for an unknown cadence breaks the
 * §1 motion contract (two distinct cadences, predictable).
 *
 * UX ref: docs_canonical/ICON_TRANSITION_UX_PLAN.md §3 Layer 1.
 */
export type Cadence = 'soft' | 'snappy';

const SOFT: MotionCurves = {
  g: getEasingFunction('ease-in-out'),
  alpha: getEasingFunction('ease-out-cubic'),
  alphaOffsetRatio: 0.08,
};

const SNAPPY: MotionCurves = {
  // 'ease-out' is faster-leading-edge than ease-in-out, matching the
  // perceptual contract of "snappy".
  g: getEasingFunction('ease-out'),
  alpha: getEasingFunction('ease-out-cubic'),
  alphaOffsetRatio: 0.04,
};

/**
 * Default motion curves per cadence.
 *
 * `'custom'` returns the soft defaults; the resolver overlays the
 * authored override on top via {@link withCustomCurves}.
 */
export function defaultMotionCurves(cadence: Cadence = 'soft'): MotionCurves {
  if (cadence === 'snappy') return SNAPPY;
  return SOFT;
}

/**
 * Build a {@link MotionCurves} from explicit easing-function
 * references (used by the Layer-2 override path).
 */
export function withCustomCurves(
  g: EasingFunction,
  alpha: EasingFunction,
  alphaOffsetRatio = SOFT.alphaOffsetRatio,
): MotionCurves {
  return { g, alpha, alphaOffsetRatio };
}

/**
 * Compute the opacity progress at a given geometry progress, honouring
 * the `alphaOffsetRatio`. Used by the runtime scheduler.
 *
 * `t` is the geometry progress in `[0, 1]`. Opacity progress at the
 * same wall-clock instant is `alpha(t')` where
 * `t' = clamp01((t - alphaOffsetRatio) / (1 - alphaOffsetRatio))`.
 */
export function alphaProgress(curves: MotionCurves, t: number): number {
  const offset = clampOffset(curves.alphaOffsetRatio);
  if (offset === 0) return curves.alpha(clamp01(t));
  if (t <= offset) return 0;
  const denom = 1 - offset;
  if (denom <= 0) return curves.alpha(clamp01(t));
  return curves.alpha(clamp01((t - offset) / denom));
}

/**
 * Compute the geometry progress at a given wall-clock progress.
 * For symmetry with {@link alphaProgress}; today this is the
 * identity wrap around `g`, but isolating the call site lets the
 * scheduler insert pre-roll / post-roll in a future phase without
 * touching call sites.
 */
export function geometryProgress(curves: MotionCurves, t: number): number {
  return curves.g(clamp01(t));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  if (value >= 1) return 1;
  return value;
}

function clampOffset(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= 0) return 0;
  // Cap at 0.5 so opacity always has at least half the duration to
  // resolve. The Layer-2 override UI enforces this on the schema side.
  if (value >= 0.5) return 0.5;
  return value;
}
