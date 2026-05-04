/**
 * Draw-coordinated tier (W3-6 T7) with W4 Tiller-Hanson upgrade.
 *
 * Stroke ↔ fill transitions. Two paths:
 *
 *  - **Aligned-skeleton path** (W4): when {@link skeletonsAlign}
 *    reports source and target inflated forms with ≥ 0.50 IoU,
 *    the morph is a continuous `clipper2-ts` polygon-offset grow:
 *    source expands outward through `t ∈ [0, 0.5]`, target shrinks
 *    inward through `t ∈ [0.5, 1]`. Visual continuity at the
 *    midpoint is guaranteed by the Jaccard threshold.
 *  - **Misaligned-skeleton path** (W3 baseline): when the
 *    skeletons don't align, the interpolator returns source
 *    geometry for `t < 0.5` and target for `t ≥ 0.5`, with the
 *    0.08·duration geometry/opacity offset the runtime scheduler
 *    reads from `motion.alphaOffsetRatio`.
 *
 * "No raw crossfade" is the §1 motion-contract invariant — even
 * the misaligned path produces a *designed* motion (draw-out plus
 * draw-in with offset), not a synchronous opacity blend. This tier
 * is structurally distinct from T8's `draw-replace`: T7 fires on
 * recognised stroke ↔ fill *symmetric* topology; T8 fires when
 * topology is genuinely incompatible.
 *
 * Plan: docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §5.6.
 */
import type { CascadeInput, TierResult } from '../cascade';
import {
  skeletonsAlign,
  thickenedInterpolator,
} from './medial-axis-thickening';

export function resolveDrawCoordinated(input: CascadeInput): TierResult | null {
  if (input.taxonomy !== 'T7') return null;

  const fromCanonical = input.fromTopology.canonical;
  const toCanonical = input.toTopology.canonical;
  const fromD = fromCanonical?.d ?? '';
  const toD = toCanonical?.d ?? '';
  if (!fromD || !toD) return null;

  // Try the aligned-skeleton path first. When the skeletons align
  // (inflated-form Jaccard ≥ 0.50) and Tiller-Hanson offsetting
  // succeeds, emit the continuous-grow morph.
  if (skeletonsAlign(fromCanonical, toCanonical)) {
    const grow = thickenedInterpolator(fromCanonical, toCanonical);
    if (grow) {
      return {
        interpolator: grow,
        motion: input.motion,
        // Aligned-skeleton path produces continuous geometry; the
        // distortion estimate sits below the misaligned baseline
        // so the cascade prefers it. The 0.30 figure is the W5
        // calibration anchor — re-tune once the corpus runs.
        distortion: 0.30,
        signal: null,
      };
    }
  }

  // Misaligned-skeleton baseline: source for the first half,
  // target for the second. The runtime scheduler interleaves
  // opacity via `motion.alpha` and the cadence-derived
  // `alphaOffsetRatio` (0.08 on `'soft'`, 0.04 on `'snappy'`).
  return {
    interpolator: (t: number) => (t < 0.5 ? fromD : toD),
    motion: input.motion,
    distortion: 0.5,
    signal: null,
  };
}
