/**
 * ARAP-quality-wrap tier (W4 / algorithms-plan §5.1).
 *
 * Sits between `hierarchical-match` and `draw-coordinated` in the
 * cascade. Fires only when:
 *   1. The taxonomy is morphable (T1-T5; T6-T8 route elsewhere).
 *   2. The {@link shouldWrapWithArap} trigger says the source
 *      contour has enough turning-function variation that pure
 *      intrinsic interpolation would visibly "swim" on the
 *      interior.
 *
 * When invoked, runs the hierarchical-match tier internally to
 * obtain a baseline interpolator, then wraps it with
 * {@link wrapWithArap} so intermediate-`t` boundary positions come
 * from per-triangle polar-decomposition blending rather than
 * straight per-vertex linear interpolation.
 *
 * Plan: docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §5.1,
 *       docs_canonical/ICON_TRANSITION_ROADMAP.md W3-2 (ARAP
 *       deferral) + W5-3 (threshold calibration).
 *
 * @module
 */
import type { CascadeInput, TierResult } from '../cascade';
import { sampleTrajectory, boundaryDistortion } from '../transition-metrics';
import { resolveHierarchicalMatch } from './hierarchical-match';
import { shouldWrapWithArap, wrapWithArap } from './arap-wrap';

const SAMPLE_FRAMES = 5;

export function resolveArapQualityWrap(
  input: CascadeInput,
): TierResult | null {
  // ARAP wraps morphable taxonomies only.
  if (
    input.taxonomy === 'T6' ||
    input.taxonomy === 'T7' ||
    input.taxonomy === 'T8'
  ) {
    return null;
  }

  // The trigger is computed against the source contour tree — high
  // turning-function variation indicates a non-convex boundary
  // where rotation-aware interpolation pays off. Convex / low-
  // variation shapes don't benefit and bypass the wrap (saves
  // triangulation + per-frame solver cost).
  if (!shouldWrapWithArap(input.fromTopology.tree)) return null;

  // Re-use the hierarchical-match tier as the baseline. The
  // matcher's Hungarian assignment has already aligned subpath
  // ordering on both sides; ARAP improves the per-frame *path*
  // sampled out of that alignment, not the alignment itself.
  const baseline = resolveHierarchicalMatch(input);
  if (!baseline) return null;

  const wrapped = wrapWithArap(
    baseline.interpolator,
    input.fromTopology.tree,
    input.toTopology.tree,
  );

  // Re-measure distortion on the wrapped interpolator. The cascade
  // then compares against the tier ceiling and decides whether the
  // wrap improved on the baseline or should fall through.
  const distortion = estimateDistortion(wrapped);
  return {
    interpolator: wrapped,
    motion: input.motion,
    distortion,
    signal: null,
  };
}

function estimateDistortion(interpolator: (t: number) => string): number {
  try {
    const trajectory = sampleTrajectory(interpolator, SAMPLE_FRAMES);
    return boundaryDistortion(trajectory);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
