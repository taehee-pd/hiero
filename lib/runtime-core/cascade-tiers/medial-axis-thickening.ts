/**
 * Medial-axis thickening (Tiller-Hanson via `clipper2-ts`),
 * algorithms-plan §5.6.
 *
 * Replaces the W3 misaligned-skeleton baseline in the
 * `draw-coordinated` tier with a **continuous-grow** morph for
 * stroke ↔ fill transitions whose skeletons align: the source path
 * is offset outward (positive `delta`) and the target path is
 * offset inward (negative `delta`), producing a smooth geometric
 * thickening where the W3 baseline produced an instantaneous swap
 * at `t = 0.5`.
 *
 * **Skeleton-alignment test.** A full Voronoi medial-axis test
 * (Aichholzer 1995) needs a Voronoi-diagram library that doesn't
 * ship in tree. The W4 substitute is an **inflated-skeleton
 * Jaccard** test: inflate both source and target by the same delta
 * (computed from the joint bounding-box diagonal) and measure the
 * intersection-over-union of the resulting polygons. ≥ 0.50 IoU
 * means the skeletons "align well enough" — the Tiller-Hanson grow
 * morph is invoked. Below the threshold, the baseline misaligned-
 * skeleton path stays.
 *
 * The IoU threshold is calibrated against the W5 corpus; today's
 * 0.50 is the point that distinguishes the corpus's stroke ↔ fill
 * pairs that visually share a centerline from those that don't.
 *
 * Plan: docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §5.6,
 *       docs_canonical/ICON_TRANSITION_ROADMAP.md W3-6 + W4.
 *
 * @module
 */
import {
  EndType,
  FillRule,
  JoinType,
  areaPathsD,
  getBoundsPathsD,
  inflatePathsD,
  intersectD,
  unionD,
  type PathD,
  type PathsD,
} from 'clipper2-ts';

import type { CanonicalPath } from '../path-normalization';

const SKELETON_ALIGN_IOU_THRESHOLD = 0.5;
const PRECISION = 4; // clipper2 double precision (decimal places)

// ---------------------------------------------------------------------------
// SVG <-> clipper2 conversion
// ---------------------------------------------------------------------------

/**
 * Parse a canonical `d` string into clipper2's `PathsD` (one path
 * per subpath). Curves are sampled at endpoints — clipper2 operates
 * on polygons, not curves; the lossy reduction is acceptable for
 * Tiller-Hanson offsetting because the inflated polygon's curvature
 * comes from the offset, not from the original control points.
 */
export function pathToPathsD(d: string): PathsD {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g) ?? [];
  const paths: PathsD = [];
  let current: PathD = [];
  let cursor = 0;
  while (cursor < tokens.length) {
    const cmd = tokens[cursor++]!;
    if (!/^[a-zA-Z]$/.test(cmd)) continue;
    const upper = cmd.toUpperCase();
    if (upper === 'M') {
      if (current.length > 0) paths.push(current);
      current = [];
      while (cursor + 1 < tokens.length && isNum(tokens[cursor]) && isNum(tokens[cursor + 1])) {
        current.push({ x: +tokens[cursor]!, y: +tokens[cursor + 1]! });
        cursor += 2;
      }
    } else if (upper === 'L') {
      while (cursor + 1 < tokens.length && isNum(tokens[cursor]) && isNum(tokens[cursor + 1])) {
        current.push({ x: +tokens[cursor]!, y: +tokens[cursor + 1]! });
        cursor += 2;
      }
    } else if (upper === 'C') {
      while (
        cursor + 5 < tokens.length &&
        [0, 1, 2, 3, 4, 5].every((k) => isNum(tokens[cursor + k]))
      ) {
        current.push({ x: +tokens[cursor + 4]!, y: +tokens[cursor + 5]! });
        cursor += 6;
      }
    } else if (upper === 'Q') {
      while (
        cursor + 3 < tokens.length &&
        [0, 1, 2, 3].every((k) => isNum(tokens[cursor + k]))
      ) {
        current.push({ x: +tokens[cursor + 2]!, y: +tokens[cursor + 3]! });
        cursor += 4;
      }
    } else if (upper === 'A') {
      while (
        cursor + 6 < tokens.length &&
        [0, 1, 2, 3, 4, 5, 6].every((k) => isNum(tokens[cursor + k]))
      ) {
        current.push({ x: +tokens[cursor + 5]!, y: +tokens[cursor + 6]! });
        cursor += 7;
      }
    }
  }
  if (current.length > 0) paths.push(current);
  return paths;
}

/**
 * Emit `PathsD` as an SVG `d` string. Each path becomes a subpath:
 * `M x y L x y L x y ... Z`.
 */
export function pathsDToD(paths: PathsD): string {
  if (paths.length === 0) return '';
  const parts: string[] = [];
  for (const path of paths) {
    if (path.length === 0) continue;
    for (let i = 0; i < path.length; i++) {
      const p = path[i]!;
      parts.push(`${i === 0 ? 'M' : 'L'}${fmt(p.x)} ${fmt(p.y)}`);
    }
    parts.push('Z');
  }
  return parts.join(' ');
}

function isNum(token: string | undefined): boolean {
  return token !== undefined && /^-?\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(token);
}

function fmt(n: number): string {
  if (Number.isInteger(n)) return String(n);
  const fixed = n.toFixed(3);
  return fixed.replace(/\.?0+$/, '') || '0';
}

// ---------------------------------------------------------------------------
// Tiller-Hanson offsetting
// ---------------------------------------------------------------------------

/**
 * Offset (Tiller-Hanson "polygon offsetting") a path by `delta` —
 * positive grows outward, negative shrinks inward. Round joins +
 * polygon end type are appropriate for filled regions; this is the
 * default for thickening morphs.
 *
 * Returns the offset `PathsD`; emit through {@link pathsDToD} to
 * get an SVG `d` string.
 */
export function offsetPath(d: string, delta: number): PathsD {
  const paths = pathToPathsD(d);
  if (paths.length === 0) return [];
  return inflatePathsD(
    paths,
    delta,
    JoinType.Round,
    EndType.Polygon,
    2.0, // miterLimit (unused for round joins)
    PRECISION,
  );
}

// ---------------------------------------------------------------------------
// Skeleton-alignment test
// ---------------------------------------------------------------------------

/**
 * Returns `true` when the source and target's inflated forms have
 * Jaccard index ≥ {@link SKELETON_ALIGN_IOU_THRESHOLD}. The
 * inflation amount is chosen as a small fraction of the joint
 * bounding-box diagonal so the test is scale-invariant.
 *
 * Returns `false` on degenerate inputs (zero-area paths, empty
 * canonical) — those route to the baseline, where the misaligned-
 * skeleton path's instantaneous swap is the safe behaviour.
 */
export function skeletonsAlign(
  fromCanonical: CanonicalPath | null,
  toCanonical: CanonicalPath | null,
): boolean {
  if (!fromCanonical || !toCanonical) return false;
  const srcPaths = pathToPathsD(fromCanonical.d);
  const tgtPaths = pathToPathsD(toCanonical.d);
  if (srcPaths.length === 0 || tgtPaths.length === 0) return false;

  // Joint bounding box → inflation delta. The factor (0.05) is
  // tuned so the inflated regions are large enough to overlap
  // when their centerlines coincide but small enough that
  // unrelated shapes don't accidentally pass the test.
  const srcBounds = getBoundsPathsD(srcPaths);
  const tgtBounds = getBoundsPathsD(tgtPaths);
  const minX = Math.min(srcBounds.left, tgtBounds.left);
  const minY = Math.min(srcBounds.top, tgtBounds.top);
  const maxX = Math.max(srcBounds.right, tgtBounds.right);
  const maxY = Math.max(srcBounds.bottom, tgtBounds.bottom);
  const diag = Math.hypot(maxX - minX, maxY - minY);
  if (!Number.isFinite(diag) || diag <= 0) return false;
  const delta = diag * 0.05;

  const srcInflated = inflatePathsD(
    srcPaths,
    delta,
    JoinType.Round,
    EndType.Polygon,
    2.0,
    PRECISION,
  );
  const tgtInflated = inflatePathsD(
    tgtPaths,
    delta,
    JoinType.Round,
    EndType.Polygon,
    2.0,
    PRECISION,
  );
  if (srcInflated.length === 0 || tgtInflated.length === 0) return false;

  const intersection = intersectD(
    srcInflated,
    tgtInflated,
    FillRule.NonZero,
    PRECISION,
  );
  const union = unionD(srcInflated, tgtInflated, FillRule.NonZero, PRECISION);
  const intersectionArea = Math.abs(areaPathsD(intersection));
  const unionArea = Math.abs(areaPathsD(union));
  if (unionArea <= 0) return false;
  return intersectionArea / unionArea >= SKELETON_ALIGN_IOU_THRESHOLD;
}

// ---------------------------------------------------------------------------
// Continuous-grow interpolator
// ---------------------------------------------------------------------------

/**
 * Build a continuous-grow morph for an aligned stroke ↔ fill pair.
 *
 * Frame schedule (positive delta in both halves — magnitude grows
 * toward the midpoint and shrinks away from it):
 *  - `t ∈ [0, 0.5]`: source is offset outward by `2t·deltaMax` so
 *    the geometry grows from the source's exact shape (delta=0) at
 *    `t=0` to a "fattened" form at the midpoint.
 *  - `t ∈ (0.5, 1]`: target is offset outward by `2(1-t)·deltaMax`,
 *    deflating from a fattened form back to the target's exact
 *    shape at `t=1`.
 *
 * Both halves use positive delta so the midpoint forms coincide:
 * `src⊕deltaMax` (end of first half) and `tgt⊕deltaMax` (start of
 * second half) are exactly the polygons {@link skeletonsAlign}
 * tested for IoU ≥ 0.5, so the midpoint snap is bounded by that
 * threshold. A negative delta on the second half would deflate the
 * target *into* its actual shape, but the midpoint would jump from
 * `src⊕deltaMax` (fat) to `tgt⊖deltaMax` (thin) — the opposite of
 * what the IoU gate guarantees.
 *
 * Returns `null` when offsetting fails (degenerate input).
 */
export function thickenedInterpolator(
  fromCanonical: CanonicalPath | null,
  toCanonical: CanonicalPath | null,
): ((t: number) => string) | null {
  if (!fromCanonical || !toCanonical) return null;
  const fromD = fromCanonical.d;
  const toD = toCanonical.d;
  const srcPaths = pathToPathsD(fromD);
  const tgtPaths = pathToPathsD(toD);
  if (srcPaths.length === 0 || tgtPaths.length === 0) return null;

  const srcBounds = getBoundsPathsD(srcPaths);
  const tgtBounds = getBoundsPathsD(tgtPaths);
  const minX = Math.min(srcBounds.left, tgtBounds.left);
  const minY = Math.min(srcBounds.top, tgtBounds.top);
  const maxX = Math.max(srcBounds.right, tgtBounds.right);
  const maxY = Math.max(srcBounds.bottom, tgtBounds.bottom);
  const deltaMax = Math.hypot(maxX - minX, maxY - minY) * 0.05;
  if (!Number.isFinite(deltaMax) || deltaMax <= 0) return null;

  return (t: number) => {
    if (t <= 0) return fromD;
    if (t >= 1) return toD;
    if (t < 0.5) {
      const delta = 2 * t * deltaMax;
      const offset = inflatePathsD(
        srcPaths,
        delta,
        JoinType.Round,
        EndType.Polygon,
        2.0,
        PRECISION,
      );
      return offset.length > 0 ? pathsDToD(offset) : fromD;
    } else {
      const delta = 2 * (1 - t) * deltaMax;
      const offset = inflatePathsD(
        tgtPaths,
        delta,
        JoinType.Round,
        EndType.Polygon,
        2.0,
        PRECISION,
      );
      return offset.length > 0 ? pathsDToD(offset) : toD;
    }
  };
}
