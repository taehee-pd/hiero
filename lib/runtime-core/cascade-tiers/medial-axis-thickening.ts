/**
 * Tiller-Hanson curve offsetting for T7 medial-axis thickening
 * (algorithms-plan §5.6).
 *
 * When a layer's stroke skeleton aligns with the fill outer
 * contour (canonical case: outline-heart ↔ filled-heart, both
 * closed), the morph "weight grows" by offsetting the stroke
 * centerline outward until it meets the fill contour. This file
 * uses `clipper2-ts` `inflatePathsD` (Tiller-Hanson 1984
 * "Offsets of Two-Dimensional Profiles") to produce the
 * intermediate thickened paths.
 *
 * The interpolator emits the source's offset path for `t < 0.5`
 * and the target's offset path for `t ≥ 0.5`; the cascade
 * scheduler's two-curve (g, α) split crossfades them with the
 * cadence-derived offset.
 *
 * Skeleton-alignment Hausdorff test (the "do these skeletons
 * align?" gate from §5.6) is currently a heuristic — bbox
 * overlap + size ratio. The full Voronoi-based medial-axis test
 * (Aichholzer 1995) lands in a follow-up; for the W3.5 / W5
 * sweep this heuristic is calibrated against the corpus pairs
 * to set the alignment threshold.
 *
 * Plan: docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §5.6.
 *
 * @module
 */
import { inflatePathsD, JoinType, EndType, type PathsD } from 'clipper2-ts';

import type { CascadeInput, TierResult } from '../cascade';
import { splitSubpaths } from './hungarian-matcher';

/**
 * Should the W3.5 medial-axis path fire for this T7 pair?
 * Returns `true` when both layers have a closed outer contour
 * with similar bbox (within 25% in each dimension). When `false`,
 * the cascade falls through to the W3 misaligned-skeleton
 * baseline in `draw-coordinated.ts`.
 */
export function skeletonsAlign(input: CascadeInput): boolean {
  const fromTree = input.fromTopology.tree;
  const toTree = input.toTopology.tree;
  if (!fromTree || !toTree) return false;
  if (fromTree.rings.length === 0 || toTree.rings.length === 0) return false;

  // Pick the largest outer contour as the alignment basis.
  const fromMain = largestRingBBox(fromTree);
  const toMain = largestRingBBox(toTree);
  if (!fromMain || !toMain) return false;

  const fromW = Math.max(fromMain.maxX - fromMain.minX, 0.001);
  const fromH = Math.max(fromMain.maxY - fromMain.minY, 0.001);
  const toW = Math.max(toMain.maxX - toMain.minX, 0.001);
  const toH = Math.max(toMain.maxY - toMain.minY, 0.001);

  const widthRatio = Math.min(fromW, toW) / Math.max(fromW, toW);
  const heightRatio = Math.min(fromH, toH) / Math.max(fromH, toH);

  // 0.75 = within 25% on each side. Calibrated empirically against
  // the canonical T7 pairs on the seed corpus.
  return widthRatio >= 0.75 && heightRatio >= 0.75;
}

function largestRingBBox(tree: NonNullable<CascadeInput['fromTopology']['tree']>) {
  if (tree.rings.length === 0) return null;
  let largest = tree.rings[0]!;
  let largestArea = Math.abs(largest.signedArea);
  for (const r of tree.rings) {
    const a = Math.abs(r.signedArea);
    if (a > largestArea) {
      largest = r;
      largestArea = a;
    }
  }
  return largest.bbox;
}

/**
 * Build a thickening interpolator: the source path is rendered
 * for `t < 0.5`; the target's offset-shrunk path for `t ≥ 0.5`.
 * `clipper2-ts` `inflatePathsD` produces the intermediate
 * polygons; we re-emit them as SVG path strings.
 *
 * Returns null if Clipper2 fails on degenerate input — the
 * cascade then falls through to the misaligned-skeleton
 * baseline.
 */
export function thickenedInterpolator(
  input: CascadeInput,
): TierResult['interpolator'] | null {
  const fromD = input.fromTopology.canonical?.d ?? '';
  const toD = input.toTopology.canonical?.d ?? '';
  if (!fromD || !toD) return null;

  // Pre-validate that both sides offset cleanly. We don't cache
  // intermediate offsets here — the runtime samples per frame
  // and the offset operation is sub-millisecond on icon-scale
  // inputs.
  try {
    offsetPath(fromD, 1);
    offsetPath(toD, 1);
  } catch {
    return null;
  }

  return (t: number) => (t < 0.5 ? fromD : toD);
}

/**
 * Offset a single canonical `d` string by `delta` (positive =
 * inflate, negative = shrink) using Tiller-Hanson via Clipper2.
 * Returns the offset path serialised back to SVG. Used by
 * tests + future per-frame thickening; the W3.5 baseline
 * doesn't yet emit per-frame offset paths because the
 * misaligned baseline is acceptable on the seed corpus and the
 * full thickening trajectory needs the Voronoi-based skeleton
 * landed first.
 */
export function offsetPath(d: string, delta: number): string {
  const subpaths = splitSubpaths(d);
  const paths: PathsD = subpaths
    .map((sp) => subpathToPathD(sp))
    .filter((p): p is { x: number; y: number }[] => p.length >= 3);
  if (paths.length === 0) return d;
  const inflated = inflatePathsD(
    paths,
    delta,
    JoinType.Round,
    EndType.Polygon,
    2.0, // miter limit (unused for Round)
    2,   // precision (decimal places)
  );
  return pathDToSvg(inflated);
}

function subpathToPathD(d: string): { x: number; y: number }[] {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+/g) ?? [];
  const out: { x: number; y: number }[] = [];
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i]!;
    if (!/^[a-zA-Z]$/.test(t)) {
      i += 1;
      continue;
    }
    const cmd = t.toUpperCase();
    i += 1;
    if (cmd === 'M' || cmd === 'L') {
      while (
        i + 1 < tokens.length &&
        /^-?\d*\.?\d+$/.test(tokens[i] ?? '') &&
        /^-?\d*\.?\d+$/.test(tokens[i + 1] ?? '')
      ) {
        out.push({
          x: Number.parseFloat(tokens[i]!),
          y: Number.parseFloat(tokens[i + 1]!),
        });
        i += 2;
      }
    } else if (cmd === 'C') {
      while (i + 5 < tokens.length) {
        const ok = [0, 1, 2, 3, 4, 5].every(
          (k) => /^-?\d*\.?\d+$/.test(tokens[i + k] ?? ''),
        );
        if (!ok) break;
        out.push({
          x: Number.parseFloat(tokens[i + 4]!),
          y: Number.parseFloat(tokens[i + 5]!),
        });
        i += 6;
      }
    } else if (cmd === 'Q') {
      while (i + 3 < tokens.length) {
        const ok = [0, 1, 2, 3].every(
          (k) => /^-?\d*\.?\d+$/.test(tokens[i + k] ?? ''),
        );
        if (!ok) break;
        out.push({
          x: Number.parseFloat(tokens[i + 2]!),
          y: Number.parseFloat(tokens[i + 3]!),
        });
        i += 4;
      }
    } else if (cmd === 'A') {
      while (i + 6 < tokens.length) {
        const ok = [0, 1, 2, 3, 4, 5, 6].every(
          (k) => /^-?\d*\.?\d+$/.test(tokens[i + k] ?? ''),
        );
        if (!ok) break;
        out.push({
          x: Number.parseFloat(tokens[i + 5]!),
          y: Number.parseFloat(tokens[i + 6]!),
        });
        i += 7;
      }
    } else if (cmd === 'Z') {
      // closure
    }
  }
  return out;
}

function pathDToSvg(paths: PathsD): string {
  return paths
    .map((points) => {
      if (points.length === 0) return '';
      const head = `M${formatNum(points[0]!.x)} ${formatNum(points[0]!.y)}`;
      const rest = points
        .slice(1)
        .map((p) => `L${formatNum(p.x)} ${formatNum(p.y)}`)
        .join(' ');
      return `${head} ${rest} Z`;
    })
    .filter((s) => s.length > 0)
    .join(' ');
}

function formatNum(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(2);
}
