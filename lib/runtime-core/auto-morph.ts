/**
 * Auto Morph — Unified Automatic Morph Algorithm
 *
 * Replaces manual strategy selection with automatic detection of the
 * best morph approach for any pair of SVG paths.
 *
 * Strategy cascade (no user choice):
 * 1. Transform-only — identical paths after normalization
 * 2. Intrinsic Strict — identical command signatures (Sederberg 1993)
 * 3. Best Guess — same topology, different segments (aligned + padded)
 * 4. Point-Sampled — different topologies (arc-length sampling)
 * 5. Fallback — incompatible topology (fade-through)
 */

import { canonicalizePath, type GeometryStats } from './path-normalization';
import {
  intrinsicStrictMorph,
  bestGuessMorph,
  attemptCrossIconMorph,
  type MorphInterpolator,
} from './morph';

export type AutoMorphResult = {
  interpolator: MorphInterpolator;
  /** Which internal strategy was selected. */
  selectedStrategy:
    | 'identity'
    | 'intrinsicStrict'
    | 'bestGuess'
    | 'pointSampled'
    | 'fallback';
};

/**
 * Automatically select and apply the best morph strategy for two SVG paths.
 *
 * @param fromD  Source SVG path `d` string
 * @param toD    Target SVG path `d` string
 * @returns      AutoMorphResult with interpolator and strategy metadata,
 *               or null if no morph is possible (fallback to crossfade)
 */
export function autoMorph(fromD: string, toD: string): AutoMorphResult | null {
  // Normalize whitespace for identity check
  const normalizedFrom = fromD.trim();
  const normalizedTo = toD.trim();

  // Strategy 1: Identity — identical paths, no morph needed
  if (normalizedFrom === normalizedTo) {
    return {
      interpolator: () => normalizedFrom,
      selectedStrategy: 'identity',
    };
  }

  // Compute geometry stats for both paths
  const fromStats = safeGeometryStats(normalizedFrom);
  const toStats = safeGeometryStats(normalizedTo);

  if (!fromStats || !toStats) {
    return null; // Unparseable path — cannot morph
  }

  // Check compatibility metrics
  const sameSubpathCount = fromStats.subpathCount === toStats.subpathCount;
  const sameClosed = arraysEqual(fromStats.closed, toStats.closed);
  const commandMatch = computeCommandCompatibility(
    fromStats.commandSignature,
    toStats.commandSignature,
  );

  // Check for fill/stroke semantic mismatch (Codex Finding 3)
  // This would be checked at the layer level by the transition resolver,
  // but autoMorph operates on raw paths. The resolver guards this.

  // Strategy 2: Intrinsic Strict — identical command signatures
  if (commandMatch === 1 && sameSubpathCount && sameClosed) {
    try {
      const interpolator = intrinsicStrictMorph(normalizedFrom, normalizedTo);
      return { interpolator, selectedStrategy: 'intrinsicStrict' };
    } catch {
      // Fall through to best guess
    }
  }

  // Strategy 3: Best Guess — same topology, different segment counts
  if (sameSubpathCount && sameClosed && commandMatch >= 0.5) {
    const interpolator = bestGuessMorph(normalizedFrom, normalizedTo);
    if (interpolator) {
      return { interpolator, selectedStrategy: 'bestGuess' };
    }
  }

  // Strategy 4: Point-Sampled (Cross-Icon) — different topologies
  const centroidSim = computeCentroidSimilarity(fromStats, toStats);
  if (centroidSim >= 0.2) {
    const interpolator = attemptCrossIconMorph(normalizedFrom, normalizedTo);
    if (interpolator) {
      return { interpolator, selectedStrategy: 'pointSampled' };
    }
  }

  // No viable morph strategy — caller should use crossfade/fade-through
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeGeometryStats(d: string): GeometryStats | null {
  try {
    return canonicalizePath(d).stats;
  } catch {
    return null;
  }
}

function computeCommandCompatibility(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;

  let matches = 0;
  const minLen = Math.min(a.length, b.length);
  for (let i = 0; i < minLen; i++) {
    if (a[i] === b[i]) matches++;
  }
  return matches / maxLen;
}

function computeCentroidSimilarity(
  a: { centroid: { x: number; y: number }; bbox: { minX: number; minY: number; maxX: number; maxY: number } },
  b: { centroid: { x: number; y: number }; bbox: { minX: number; minY: number; maxX: number; maxY: number } },
): number {
  const dx = a.centroid.x - b.centroid.x;
  const dy = a.centroid.y - b.centroid.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Max span from both bounding boxes
  const aSpan = Math.max(
    a.bbox.maxX - a.bbox.minX,
    a.bbox.maxY - a.bbox.minY,
    1,
  );
  const bSpan = Math.max(
    b.bbox.maxX - b.bbox.minX,
    b.bbox.maxY - b.bbox.minY,
    1,
  );
  const maxSpan = Math.max(aSpan, bSpan);

  return Math.max(0, 1 - dist / maxSpan);
}

function arraysEqual<T>(a: T[], b: T[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i]);
}
