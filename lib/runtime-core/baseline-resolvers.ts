/**
 * Comparative-baseline resolvers (W5-2).
 *
 * The W5 calibration corpus runs the proposed cascade alongside
 * three baselines:
 *   1. The current Hiero `autoMorph` (the legacy resolver).
 *   2. Flubber-style greedy ring matching — winding normalisation +
 *      bbox/area scoring with no per-tier cascade.
 *   3. d3-interpolate-path-style cubic segment-count equalisation
 *      (only meaningful for same-signature pairs).
 *
 * The harness compares trajectory metrics tier-by-tier and
 * surfaces the proposed cascade's strict improvement over the
 * baseline failure modes (hard topology misreads, role-swaps,
 * severe distortions).
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §9.3,
 * docs_canonical/ICON_TRANSITION_ROADMAP.md W5-2.
 *
 * @module
 */
import {
  attemptCrossIconMorph,
  bestGuessMorph,
  intrinsicStrictMorph,
  type MorphInterpolator,
} from './morph';
import { autoMorph } from './auto-morph';

export type BaselineName =
  | 'hiero-legacy'
  | 'flubber-style-greedy'
  | 'd3-interpolate-path-style';

/**
 * Hiero's pre-cascade `autoMorph` — the in-tree baseline. Already
 * called out as the comparison floor in the corpus harness.
 */
export function hieroLegacyResolver(
  fromD: string,
  toD: string,
): MorphInterpolator | null {
  const result = autoMorph(fromD, toD);
  return result?.interpolator ?? null;
}

/**
 * Flubber-style greedy ring matcher. Hiero's existing
 * `attemptCrossIconMorph` IS this baseline operationally (the
 * cross-icon-morph file's docstring cites Flubber as inspiration).
 * Exposing it under the canonical baseline name lets the W5
 * harness contrast tier-by-tier.
 */
export function flubberStyleResolver(
  fromD: string,
  toD: string,
): MorphInterpolator | null {
  return attemptCrossIconMorph(fromD, toD);
}

/**
 * d3-interpolate-path-style same-signature equalisation. The
 * library equalises cubic segment counts then linearly
 * interpolates control points; meaningless on differing
 * topologies (returns null). Hiero's `intrinsicStrictMorph` is
 * the closest equivalent in tree.
 */
export function d3InterpolatePathStyleResolver(
  fromD: string,
  toD: string,
): MorphInterpolator | null {
  try {
    return intrinsicStrictMorph(fromD, toD);
  } catch {
    // Different signatures — fall through to bestGuess as the d3
    // library's "subdivide-and-pad" fallback approximates this.
    return bestGuessMorph(fromD, toD);
  }
}

export const BASELINE_RESOLVERS: Record<
  BaselineName,
  (fromD: string, toD: string) => MorphInterpolator | null
> = {
  'hiero-legacy': hieroLegacyResolver,
  'flubber-style-greedy': flubberStyleResolver,
  'd3-interpolate-path-style': d3InterpolatePathStyleResolver,
};
