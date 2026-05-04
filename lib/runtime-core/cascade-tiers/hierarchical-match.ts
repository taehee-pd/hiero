/**
 * Hierarchical-match tier (W3-4 T3 / T4 / T5 + non-strict T1/T2).
 *
 * Pairs per-layer-pair subpaths via Hungarian rectangular assignment
 * over a centroid + bbox + area + signature cost matrix
 * ({@link hungarianMatch}), reorders both canonical `d` strings so
 * matched subpaths share index, then routes the aligned input
 * through the existing `bestGuessMorph` / `attemptCrossIconMorph`
 * engines (which pair by position after winding-normalisation +
 * De Casteljau resampling). Hints become hard constraints in the
 * cost matrix.
 *
 * Plan: docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §5.3,
 * §5.4, §5.5; ROADMAP W3-4 + W4-4.
 */
import { attemptCrossIconMorph, bestGuessMorph } from '../morph';
import { sampleTrajectory, boundaryDistortion } from '../transition-metrics';
import type { CascadeInput, TierResult } from '../cascade';
import {
  hungarianMatch,
  reorderCanonicalSubpaths,
} from './hungarian-matcher';

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

  // Hungarian rectangular assignment over centroid/bbox/area/
  // signature cost. Author hints are baked into the cost matrix as
  // hard constraints (forbidden cost on conflicting pairings, zero
  // cost on the pinned pairing). The matched indices then drive a
  // co-ordered re-emission of both sides' canonical `d` strings, so
  // the position-matching `bestGuessMorph` / `attemptCrossIconMorph`
  // engines see Hungarian-optimal pairs by index.
  const match = hungarianMatch(fromCanonical, toCanonical, input.hints);
  const fromD = match.matches.length > 0
    ? reorderCanonicalSubpaths(
        fromCanonical.d,
        match.matches.map((m) => m.fromIndex),
      )
    : fromCanonical.d;
  const toD = match.matches.length > 0
    ? reorderCanonicalSubpaths(
        toCanonical.d,
        match.matches.map((m) => m.toIndex),
      )
    : toCanonical.d;

  // Try best-guess first (handles same-topology, padded-segments
  // pairs); fall through to the cross-icon engine for differing
  // subpath counts.
  let interpolator = bestGuessMorph(fromD, toD);
  if (!interpolator) {
    interpolator = attemptCrossIconMorph(fromD, toD);
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
