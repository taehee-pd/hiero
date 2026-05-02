/**
 * Hierarchical-match tier (W3-4 T3 / T4 / T5 + non-strict T1/T2).
 *
 * Routes per-layer-pair morphs through the existing
 * `attemptCrossIconMorph` / `bestGuessMorph` engines. These already
 * implement subpath winding normalisation, greedy ring matching by
 * centroid + bbox + area + signature, and De Casteljau resampling
 * — i.e. the W2 baseline cross-icon morph behaviour. The W3 wrap
 * adds:
 *   - distortion measurement via the metric harness so the cascade
 *     can reject badly-distorted matches
 *   - tier-aware signal emission when the cascade lands here from
 *     a strict-signature attempt that failed
 *
 * The roadmap calls out `hungarian-on3` for *optimal* rectangular
 * assignment. That dependency lands when npm install is wired in
 * the deployment env (W3.5). The greedy matcher in
 * `cross-icon-morph.ts:100-126` is the W3 starting point — it is
 * known-acceptable on the seed corpus and the W5 calibration pass
 * will replace it once Hungarian is in tree.
 *
 * Plan: docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §5.3,
 * §5.4, §5.5.
 */
import { attemptCrossIconMorph, bestGuessMorph } from '../morph';
import { sampleTrajectory, boundaryDistortion } from '../transition-metrics';
import type { CascadeInput, TierResult } from '../cascade';

const SAMPLE_FRAMES = 5;

export function resolveHierarchicalMatch(input: CascadeInput): TierResult | null {
  // T6/T7/T8 route elsewhere.
  if (
    input.taxonomy === 'T6' ||
    input.taxonomy === 'T7' ||
    input.taxonomy === 'T8'
  ) {
    return null;
  }

  const fromCanonical = input.fromTopology.canonical;
  const toCanonical = input.toTopology.canonical;
  if (!fromCanonical || !toCanonical) return null;

  // Try best-guess first (handles same-topology, padded-segments
  // pairs); fall through to the cross-icon engine for differing
  // subpath counts.
  let interpolator = bestGuessMorph(fromCanonical.d, toCanonical.d);
  if (!interpolator) {
    interpolator = attemptCrossIconMorph(fromCanonical.d, toCanonical.d);
  }
  if (!interpolator) return null;

  const distortion = estimateDistortion(interpolator);
  return {
    interpolator,
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
