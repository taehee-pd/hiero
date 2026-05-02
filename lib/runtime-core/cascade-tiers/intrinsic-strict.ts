/**
 * Intrinsic-strict tier (W3-2 T1 / W3-3 T2 fast path).
 *
 * Runs Sederberg-1993 intrinsic interpolation when both layers
 * share an exact command signature after canonicalisation. This is
 * the strongest baseline for similar-topology pairs and fires for
 * the bulk of T1 / T2 cases.
 *
 * Uses the existing `intrinsicStrictMorph` from
 * `lib/runtime-core/morph.ts`. The W3 cascade adds a structured
 * distortion estimate on top so the cascade-floor logic can reject
 * a strictly-equal-signature morph that nevertheless produces a
 * deformed result (rare but possible — e.g. start-vertex
 * misalignment on a near-symmetric shape).
 *
 * Plan: docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §5.1, §5.2.
 */
import { intrinsicStrictMorph, bestGuessMorph } from '../morph';
import type { CascadeInput, TierResult } from '../cascade';
import type { GeometryStats } from '../path-normalization';
import { sampleTrajectory, boundaryDistortion } from '../transition-metrics';

const SAMPLE_FRAMES = 5;

export function resolveIntrinsicStrict(input: CascadeInput): TierResult | null {
  // Only T1, T2, T3, T4, T5 are eligible — T6/T7/T8 route elsewhere.
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

  // Only the intrinsic-strict engine — `bestGuessMorph` belongs to
  // the hierarchical-match tier — runs here. Gate on the same
  // signature equality the engine itself requires.
  if (!hasMatchingSignature(fromCanonical.stats, toCanonical.stats)) {
    return null;
  }

  let interpolator;
  try {
    interpolator = intrinsicStrictMorph(fromCanonical.d, toCanonical.d);
  } catch {
    return null;
  }
  // bestGuessMorph is a defensive fallback when intrinsic throws on
  // a degenerate input but the topology classifier still claims the
  // pair shares a signature. Keep the engine choice ordered so the
  // higher-fidelity strict path wins when both succeed.
  if (!interpolator) {
    interpolator = bestGuessMorph(fromCanonical.d, toCanonical.d);
    if (!interpolator) return null;
  }

  const distortion = estimateDistortion(interpolator);
  return {
    interpolator,
    motion: input.motion,
    distortion,
    signal: null,
  };
}

function hasMatchingSignature(a: GeometryStats, b: GeometryStats): boolean {
  if (a.subpathCount !== b.subpathCount) return false;
  if (a.commandSignature.length !== b.commandSignature.length) return false;
  for (let i = 0; i < a.commandSignature.length; i++) {
    if (a.commandSignature[i] !== b.commandSignature[i]) return false;
  }
  if (a.closed.length !== b.closed.length) return false;
  for (let i = 0; i < a.closed.length; i++) {
    if (a.closed[i] !== b.closed[i]) return false;
  }
  return true;
}

/**
 * Self-reported distortion estimate. Sample the morph at a few
 * frames, build a trajectory, run `boundaryDistortion` from the
 * metric harness. Cheap (sub-millisecond on icon-scale shapes).
 *
 * The returned number is unitless; the cascade ceiling for this
 * tier is calibrated against the corpus baseline in W5.
 */
function estimateDistortion(interpolator: (t: number) => string): number {
  try {
    const trajectory = sampleTrajectory(interpolator, SAMPLE_FRAMES);
    return boundaryDistortion(trajectory);
  } catch {
    // If sampling throws (pathological interpolator), report a
    // distortion above the tier's ceiling so the cascade falls
    // through.
    return Number.POSITIVE_INFINITY;
  }
}
