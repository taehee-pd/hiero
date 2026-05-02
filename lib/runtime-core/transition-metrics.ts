/**
 * Transition validation metrics — five quantitative measures the
 * Wave-1 corpus harness applies to a resolved morph trajectory.
 *
 * A *trajectory* is a sequence of frames; each frame is a `(t, d)`
 * pair where `t ∈ [0, 1]` is normalized progress and `d` is the
 * rendered SVG path string. Metrics consume trajectories produced by
 * any resolver (legacy `auto-morph`, the W3+ cascade, baseline
 * comparators like Flubber / d3-interpolate-path).
 *
 * Plan: docs_canonical/ICON_TRANSITION_INTEGRATED_PLAN.md §9.2,
 * docs_canonical/ICON_TRANSITION_ALGORITHMS_PLAN.md §9.2.
 *
 * @module
 */
import { buildContourTree, type ContourRing, type Point } from './contour-tree';
import { canonicalizePath } from './path-normalization';

export type TrajectoryFrame = {
  /** Normalized progress in [0, 1]. */
  t: number;
  /** Rendered SVG path string at this `t`. */
  d: string;
};

export type Trajectory = {
  frames: TrajectoryFrame[];
};

/**
 * Sample a morph interpolator at `n` evenly-spaced t values to
 * produce a trajectory the metric harness can score.
 */
export function sampleTrajectory(
  interpolator: (t: number) => string,
  n: number,
): Trajectory {
  if (n < 2) {
    throw new Error(`sampleTrajectory requires n >= 2 (got ${n})`);
  }
  const frames: TrajectoryFrame[] = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    frames.push({ t, d: interpolator(t) });
  }
  return { frames };
}

// ---------------------------------------------------------------------------
// Metric 1 — boundary distortion
// ---------------------------------------------------------------------------

/**
 * Mean turning-function distance between consecutive frames, summed
 * across all rings. Captures boundary instability — a smoothly
 * evolving contour has small frame-to-frame turning-function
 * distance; a "snapping" morph has large jumps. The integral over
 * time is approximated by averaging across consecutive frame pairs.
 *
 * Higher = worse. Bounded below by 0.
 */
export function boundaryDistortion(trajectory: Trajectory): number {
  const ringSeqs = perRingPolylines(trajectory);
  if (ringSeqs.length === 0) return 0;
  let total = 0;
  let pairCount = 0;
  for (const seq of ringSeqs) {
    for (let i = 1; i < seq.length; i++) {
      const a = turningFunction(seq[i - 1]!);
      const b = turningFunction(seq[i]!);
      total += turningFunctionDistance(a, b);
      pairCount += 1;
    }
  }
  return pairCount === 0 ? 0 : total / pairCount;
}

// ---------------------------------------------------------------------------
// Metric 2 — area monotonicity error
// ---------------------------------------------------------------------------

/**
 * Sum of "wrong-direction" absolute area changes across the
 * trajectory's filled rings. The expected behaviour is monotonic —
 * source area to target area in one direction. A morph that
 * oscillates (area shrinks then grows) accumulates positive error.
 *
 * Returns 0 for a perfectly monotonic trajectory; otherwise the
 * total area "wasted" on direction reversals, normalized by the
 * sum of |area(target) - area(source)|.
 */
export function areaMonotonicityError(trajectory: Trajectory): number {
  const ringSeqs = perRingPolylines(trajectory);
  if (ringSeqs.length === 0) return 0;
  let totalError = 0;
  let totalChange = 0;
  for (const seq of ringSeqs) {
    if (seq.length < 2) continue;
    const areas = seq.map((points) => Math.abs(signedArea(points)));
    const direction = Math.sign(areas[areas.length - 1]! - areas[0]!);
    const change = Math.abs(areas[areas.length - 1]! - areas[0]!);
    totalChange += change;
    if (direction === 0) continue;
    for (let i = 1; i < areas.length; i++) {
      const delta = areas[i]! - areas[i - 1]!;
      // Wrong-direction step: opposite sign to overall direction.
      if (Math.sign(delta) !== 0 && Math.sign(delta) !== direction) {
        totalError += Math.abs(delta);
      }
    }
  }
  return totalChange === 0 ? 0 : totalError / totalChange;
}

// ---------------------------------------------------------------------------
// Metric 3 — self-intersection count
// ---------------------------------------------------------------------------

/**
 * Total count of self-intersecting edges across all closed rings,
 * summed over all frames. O(n²) per ring per frame; adequate for
 * icon-scale (≤ 200 vertices per ring).
 *
 * Higher = worse; 0 = clean across the whole trajectory.
 */
export function selfIntersectionCount(trajectory: Trajectory): number {
  const ringSeqs = perRingPolylines(trajectory);
  let count = 0;
  for (const seq of ringSeqs) {
    for (const points of seq) {
      count += countSelfIntersections(points);
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Metric 4 — temporal jerk proxy
// ---------------------------------------------------------------------------

/**
 * Finite-difference third-derivative magnitude of the per-frame
 * centroid, summed across rings. Captures "snap then ooze" failures
 * where the morph has discontinuous acceleration.
 *
 * Requires ≥ 4 frames per ring; otherwise contributes 0.
 */
export function temporalJerkProxy(trajectory: Trajectory): number {
  const ringSeqs = perRingPolylines(trajectory);
  let totalJerk = 0;
  for (const seq of ringSeqs) {
    if (seq.length < 4) continue;
    const centroids = seq.map((points) => centroidOf(points));
    for (let i = 3; i < centroids.length; i++) {
      // Discrete third derivative: c[i] - 3*c[i-1] + 3*c[i-2] - c[i-3]
      const cx =
        centroids[i]!.x -
        3 * centroids[i - 1]!.x +
        3 * centroids[i - 2]!.x -
        centroids[i - 3]!.x;
      const cy =
        centroids[i]!.y -
        3 * centroids[i - 1]!.y +
        3 * centroids[i - 2]!.y -
        centroids[i - 3]!.y;
      totalJerk += Math.hypot(cx, cy);
    }
  }
  return totalJerk;
}

// ---------------------------------------------------------------------------
// Metric 5 — preview/export parity error
// ---------------------------------------------------------------------------

/**
 * Maximum Hausdorff distance between two trajectories' frames at
 * matching `t` values. Used to verify the export pipeline reproduces
 * the runtime's morph (W4 commitment). Returns 0 when the two
 * trajectories are identical at every sample point.
 *
 * Trajectories must have the same number of frames; mismatched
 * frame counts indicate a sampling-rate disagreement and throw.
 */
export function previewExportParityError(
  preview: Trajectory,
  exported: Trajectory,
): number {
  if (preview.frames.length !== exported.frames.length) {
    throw new Error(
      `previewExportParityError: frame-count mismatch ` +
        `(preview=${preview.frames.length}, exported=${exported.frames.length})`,
    );
  }
  let maxError = 0;
  for (let i = 0; i < preview.frames.length; i++) {
    const a = preview.frames[i]!;
    const b = exported.frames[i]!;
    const aRings = ringsOf(a.d);
    const bRings = ringsOf(b.d);
    const ringCount = Math.min(aRings.length, bRings.length);
    for (let r = 0; r < ringCount; r++) {
      const h = hausdorff(aRings[r]!, bRings[r]!);
      if (h > maxError) maxError = h;
    }
  }
  return maxError;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ringsOf(d: string): Point[][] {
  const tree = buildContourTree(canonicalizePath(d));
  return tree.rings.map((r) => r.points);
}

function perRingPolylines(trajectory: Trajectory): Point[][][] {
  // `perRingPolylines[ringIndex][frameIndex]` = polygon points.
  // Frames may have varying ring counts mid-morph (birth/death); we
  // only score rings present in *all* frames so per-ring sequences
  // are well-defined.
  const perFrame = trajectory.frames.map((f) => ringsOf(f.d));
  if (perFrame.length === 0) return [];
  const minRings = perFrame.reduce(
    (min, rings) => Math.min(min, rings.length),
    perFrame[0]!.length,
  );
  if (minRings === 0) return [];
  const ringSeqs: Point[][][] = [];
  for (let r = 0; r < minRings; r++) {
    ringSeqs.push(perFrame.map((rings) => rings[r]!));
  }
  return ringSeqs;
}

function signedArea(points: Point[]): number {
  if (points.length < 3) return 0;
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  return area / 2;
}

function centroidOf(points: Point[]): Point {
  if (points.length === 0) return { x: 0, y: 0 };
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}

/**
 * Turning function: cumulative angle change as a function of
 * normalized arc length. Returns an array of `[s, theta]` pairs
 * starting at `[0, 0]`.
 */
function turningFunction(points: Point[]): Array<[s: number, theta: number]> {
  if (points.length < 2) return [[0, 0]];
  const segLengths: number[] = [];
  let total = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segLengths.push(len);
    total += len;
  }
  if (total === 0) return [[0, 0]];
  const result: Array<[number, number]> = [[0, 0]];
  let cumulativeS = 0;
  let cumulativeTheta = 0;
  for (let i = 0; i < points.length; i++) {
    const prev = points[(i - 1 + points.length) % points.length]!;
    const curr = points[i]!;
    const next = points[(i + 1) % points.length]!;
    const a1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const a2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    let delta = a2 - a1;
    while (delta > Math.PI) delta -= 2 * Math.PI;
    while (delta < -Math.PI) delta += 2 * Math.PI;
    cumulativeTheta += delta;
    cumulativeS += segLengths[i]! / total;
    result.push([cumulativeS, cumulativeTheta]);
  }
  return result;
}

function turningFunctionDistance(
  a: Array<[number, number]>,
  b: Array<[number, number]>,
): number {
  // L1 norm of the difference, evaluated at the union of both
  // functions' breakpoints. Both functions are step-wise;
  // integrating between consecutive break-s values uses the
  // left-endpoint value.
  const breakpoints = Array.from(
    new Set([...a.map(([s]) => s), ...b.map(([s]) => s)]),
  ).sort((x, y) => x - y);
  let total = 0;
  for (let i = 1; i < breakpoints.length; i++) {
    const s0 = breakpoints[i - 1]!;
    const s1 = breakpoints[i]!;
    const va = sampleTurning(a, s0);
    const vb = sampleTurning(b, s0);
    total += Math.abs(va - vb) * (s1 - s0);
  }
  return total;
}

function sampleTurning(
  fn: Array<[number, number]>,
  s: number,
): number {
  // Step function: value at s = value at the largest breakpoint ≤ s.
  let value = fn[0]?.[1] ?? 0;
  for (const [bs, bv] of fn) {
    if (bs <= s) value = bv;
    else break;
  }
  return value;
}

function countSelfIntersections(points: Point[]): number {
  // O(n²) edge-pair test on the closed polyline. Skip neighbouring
  // edges (they share an endpoint by construction).
  if (points.length < 4) return 0;
  let count = 0;
  for (let i = 0; i < points.length; i++) {
    const a1 = points[i]!;
    const a2 = points[(i + 1) % points.length]!;
    for (let j = i + 2; j < points.length; j++) {
      // Skip the wrap-around edge that shares a vertex with edge i.
      if (i === 0 && j === points.length - 1) continue;
      const b1 = points[j]!;
      const b2 = points[(j + 1) % points.length]!;
      if (segmentsIntersect(a1, a2, b1, b2)) count += 1;
    }
  }
  return count;
}

function segmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const d1 = cross(p4.x - p3.x, p4.y - p3.y, p1.x - p3.x, p1.y - p3.y);
  const d2 = cross(p4.x - p3.x, p4.y - p3.y, p2.x - p3.x, p2.y - p3.y);
  const d3 = cross(p2.x - p1.x, p2.y - p1.y, p3.x - p1.x, p3.y - p1.y);
  const d4 = cross(p2.x - p1.x, p2.y - p1.y, p4.x - p1.x, p4.y - p1.y);
  return (
    ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) &&
    ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))
  );
}

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

function hausdorff(a: Point[], b: Point[]): number {
  return Math.max(directedHausdorff(a, b), directedHausdorff(b, a));
}

function directedHausdorff(a: Point[], b: Point[]): number {
  let max = 0;
  for (const p of a) {
    let min = Number.POSITIVE_INFINITY;
    for (const q of b) {
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < min) min = d;
    }
    if (min > max) max = min;
  }
  return max;
}

// Re-export ContourRing for harness scripts that need ring-level
// access (unused inside this module, but part of the public surface).
export type { ContourRing };
