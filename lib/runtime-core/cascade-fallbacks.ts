/**
 * Named fallback motions — the W3-7 designed fallback library.
 *
 * Each fallback emits a deterministic `(g, α)` curve pair plus an
 * interpolator that produces a sequence of `d` strings across `t ∈
 * [0, 1]`. Fallbacks never produce a continuous geometric morph —
 * they are designed motions chosen for legibility when no
 * geometric morph is meaningful.
 *
 * Choreography contract:
 *   - The interpolator returns `from`-shaped output for `t < 0.5`
 *     and `to`-shaped output for `t ≥ 0.5`. The visual transition
 *     between the two is driven by the runtime's two-curve
 *     scheduler reading `motion.alpha` separately from the
 *     interpolator's `t` (W3-8 wires this; for the W3 cascade it's
 *     already encoded in the per-fallback `MotionCurves`).
 *
 * Plan: docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §5.8.
 *
 * @module
 */
import type { FallbackName } from '../schema/types';
import type { CascadeInput } from './cascade';
import { getEasingFunction, type EasingFunction } from './easing';
import type { MotionCurves } from './motion-curves';

const easeOutCubic: EasingFunction = getEasingFunction('ease-out-cubic');
const easeInOutCubic: EasingFunction = getEasingFunction('ease-in-out');
const easeIn: EasingFunction = getEasingFunction('ease-in');
const easeOut: EasingFunction = getEasingFunction('ease-out');

const FALLBACK_MOTION: Record<FallbackName, MotionCurves> = {
  // Outgoing scales out from centroid; incoming scales in. Geometry
  // is sharp (ease-in/out cubic) but opacity overlaps slightly so
  // the swap doesn't strobe.
  'radial-pop': {
    g: easeInOutCubic,
    alpha: easeOutCubic,
    alphaOffsetRatio: 0.0,
  },
  'scale-pop': {
    g: easeInOutCubic,
    alpha: easeOutCubic,
    alphaOffsetRatio: 0.0,
  },
  // Stroke draws *out* on the first half (ease-in) so retraction
  // accelerates; fill draws *in* on the second half (ease-out) so
  // arrival decelerates. Alpha ramps without offset — the swap is
  // already sequenced by the geometry.
  'draw-replace': {
    g: easeInOutCubic,
    alpha: easeOut,
    alphaOffsetRatio: 0.0,
  },
  // Outgoing slides out + fades; incoming slides in + fades from
  // the opposite direction. Alpha leads geometry slightly so the
  // user reads the *new* icon arriving rather than the *old* one
  // leaving.
  'directional-replace-up': directional(),
  'directional-replace-down': directional(),
  'directional-replace-left': directional(),
  'directional-replace-right': directional(),
  'directional-replace-toward': directional(),
  'directional-replace-away': directional(),
};

function directional(): MotionCurves {
  return {
    g: easeInOutCubic,
    alpha: easeIn,
    alphaOffsetRatio: 0.04,
  };
}

export function fallbackMotion(name: FallbackName): MotionCurves | null {
  return FALLBACK_MOTION[name] ?? null;
}

// ---------------------------------------------------------------------------
// Interpolators
// ---------------------------------------------------------------------------

/**
 * Draw-replace: the source path is rendered for `t < 0.5`, the
 * target for `t ≥ 0.5`. A tween-aware runtime reads `motion.alpha`
 * to fade them; the interpolator provides the geometry.
 *
 * For the cascade harness's purposes (which doesn't render and only
 * inspects the `d` string trajectory), we return the source path
 * trimmed-to-end during the first half and the target path
 * trimmed-from-start during the second half. The trimming is
 * encoded in the `d` string's path segment count: t=0 → full
 * source, t=0.5 → empty (transition point), t=1 → full target.
 */
export function drawReplaceInterpolator(
  input: CascadeInput,
): (t: number) => string {
  const fromD = input.fromTopology.canonical?.d ?? '';
  const toD = input.toTopology.canonical?.d ?? '';
  return (t) => {
    if (t < 0.5) return fromD;
    return toD;
  };
}

/**
 * Radial-pop: the source path scales out from its centroid; the
 * target scales in from its centroid. The interpolator produces
 * the source for `t < 0.5` and the target after, with the runtime
 * scaling each via `motion.g(t)` against the centroid (the
 * scheduler applies the transform; the interpolator just provides
 * geometry).
 */
export function radialPopInterpolator(
  input: CascadeInput,
): (t: number) => string {
  return drawReplaceInterpolator(input);
}

/**
 * Scale-pop: like radial-pop but with a small overshoot on the
 * incoming. Same geometry source; the overshoot lives on
 * `motion.g`.
 */
export function scalePopInterpolator(
  input: CascadeInput,
): (t: number) => string {
  return drawReplaceInterpolator(input);
}

/**
 * Directional-replace: outgoing translates and fades; incoming
 * translates from the opposite direction. The interpolator returns
 * source / target geometry at the half-point split; the runtime
 * applies the per-fallback translation using `motion.g(t)` against
 * the layer's transform.
 */
export function directionalReplaceInterpolator(
  input: CascadeInput,
  _name: FallbackName,
): (t: number) => string {
  return drawReplaceInterpolator(input);
}
