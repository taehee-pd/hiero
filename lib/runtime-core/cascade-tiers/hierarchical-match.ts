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
import { resolveSubpathPins } from '../correspondence-hints';
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

  // W4-4 — apply author-supplied subpath pins by re-ordering both
  // sides' canonical paths so pinned pairs share index. The greedy
  // matcher in `attemptCrossIconMorph` / `bestGuessMorph` pairs by
  // *position* after normalisation, so a re-ordering propagates
  // pins through to the matched output without changing the
  // underlying engine. Hungarian-aware cost-matrix masking lands
  // alongside the `hungarian-on3` install (W3.5).
  const pins = resolveSubpathPins(
    input.hints,
    fromCanonical.stats.subpathCount,
    toCanonical.stats.subpathCount,
  );
  const fromD = pins.length > 0
    ? reorderSubpaths(fromCanonical.d, pins.map((p) => p.fromIndex))
    : fromCanonical.d;
  const toD = pins.length > 0
    ? reorderSubpaths(toCanonical.d, pins.map((p) => p.toIndex))
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

/**
 * Re-order the subpaths of a canonical `d` string so the
 * `priorityIndices` (in their listed order) come first, followed
 * by the remaining subpaths in their original order. Used by the
 * W4-4 hint plumbing to push pinned subpaths to the front so the
 * greedy matcher pairs them by index.
 */
function reorderSubpaths(d: string, priorityIndices: number[]): string {
  const subpaths = splitSubpaths(d);
  if (subpaths.length === 0) return d;
  const seen = new Set<number>();
  const reordered: string[] = [];
  for (const idx of priorityIndices) {
    if (idx < 0 || idx >= subpaths.length || seen.has(idx)) continue;
    reordered.push(subpaths[idx]!);
    seen.add(idx);
  }
  for (let i = 0; i < subpaths.length; i++) {
    if (!seen.has(i)) reordered.push(subpaths[i]!);
  }
  return reordered.join(' ').replace(/\s+/g, ' ').trim();
}

/**
 * Split a canonical `d` string into its constituent subpaths. The
 * canonical path emits absolute commands; subpaths are demarcated
 * by `M`. We split the command stream on each `M` and re-attach
 * the `M` to the chunk that follows.
 */
function splitSubpaths(d: string): string[] {
  const parts = d.split(/(?=\bM)/);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function estimateDistortion(interpolator: (t: number) => string): number {
  try {
    const trajectory = sampleTrajectory(interpolator, SAMPLE_FRAMES);
    return boundaryDistortion(trajectory);
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}
