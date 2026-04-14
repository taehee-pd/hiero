/**
 * Cross-icon morphing algorithms (Phase 8.2).
 *
 * Handles morphing between different icons that share similar topology
 * but different geometry. Common cases: hamburger→X, play→pause,
 * plus→close, arrow direction changes, lock→unlock.
 *
 * @module
 */

import type { MorphInterpolator } from './morph';

type Point = { x: number; y: number };

type CubicSegment = {
  c1: Point;
  c2: Point;
  end: Point;
};

type CubicSubPath = {
  start: Point;
  segments: CubicSegment[];
  closed: boolean;
};

type CubicPath = CubicSubPath[];

// ---------------------------------------------------------------------------
// 8.2 pre — Winding order normalization (GSAP/Flubber pattern)
// ---------------------------------------------------------------------------

/**
 * Compute the signed area of the polygon formed by sub-path segment endpoints.
 * Positive = clockwise (in screen coordinates where Y points down),
 * negative = counter-clockwise.
 */
function computeSignedArea(sub: CubicSubPath): number {
  const points: Point[] = [sub.start];
  for (const seg of sub.segments) {
    points.push(seg.end);
  }
  let area = 0;
  for (let i = 0; i < points.length; i++) {
    const curr = points[i]!;
    const next = points[(i + 1) % points.length]!;
    area += (curr.x * next.y - next.x * curr.y);
  }
  return area / 2;
}

/**
 * Ensure a sub-path has clockwise winding order (positive signed area
 * in screen coordinates). If the sub-path is counter-clockwise, reverse
 * segment order and swap control points so the morph interpolates
 * consistently between source and target.
 */
function ensureClockwise(sub: CubicSubPath): CubicSubPath {
  const area = computeSignedArea(sub);
  // Area >= 0 means already clockwise (or degenerate); leave as-is
  if (area >= 0) return sub;

  // Reverse: walk segments backwards, swapping c1/c2 to maintain
  // cubic bezier direction after reversal.
  const n = sub.segments.length;
  if (n === 0) return sub;

  const reversedSegments: CubicSegment[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const seg = sub.segments[i]!;
    const prevEnd = i === 0 ? sub.start : sub.segments[i - 1]!.end;
    reversedSegments.push({
      c1: { ...seg.c2 },
      c2: { ...seg.c1 },
      end: { ...prevEnd },
    });
  }

  return {
    start: { ...sub.segments[n - 1]!.end },
    segments: reversedSegments,
    closed: sub.closed,
  };
}

// ---------------------------------------------------------------------------
// 8.2a — Sub-path matching
// ---------------------------------------------------------------------------

type SubPathMatch = {
  fromIndex: number;
  toIndex: number;
  score: number;
};

/**
 * Match sub-paths between source and target icons by centroid proximity
 * and bounding box similarity.
 */
export function matchSubPaths(from: CubicPath, to: CubicPath): SubPathMatch[] {
  const matches: SubPathMatch[] = [];
  const usedFrom = new Set<number>();
  const usedTo = new Set<number>();

  // Score all possible pairs
  const candidates: SubPathMatch[] = [];
  for (let fi = 0; fi < from.length; fi++) {
    for (let ti = 0; ti < to.length; ti++) {
      const score = computeSubPathSimilarity(from[fi]!, to[ti]!);
      candidates.push({ fromIndex: fi, toIndex: ti, score });
    }
  }

  // Greedy matching by best score first
  candidates.sort((a, b) => b.score - a.score);
  for (const candidate of candidates) {
    if (usedFrom.has(candidate.fromIndex) || usedTo.has(candidate.toIndex)) {
      continue;
    }
    matches.push(candidate);
    usedFrom.add(candidate.fromIndex);
    usedTo.add(candidate.toIndex);
  }

  return matches;
}

/**
 * Compute similarity between two sub-paths using centroid proximity,
 * bbox similarity, area similarity, and segment count similarity.
 *
 * Weight distribution:
 * - Centroid proximity: 35%
 * - BBox similarity:    30%
 * - Area similarity:    10%
 * - Segment count:       5%
 * - Closed bonus:       20%
 */
function computeSubPathSimilarity(a: CubicSubPath, b: CubicSubPath): number {
  const centroidA = computeSubPathCentroid(a);
  const centroidB = computeSubPathCentroid(b);
  const bboxA = computeSubPathBBox(a);
  const bboxB = computeSubPathBBox(b);

  // Centroid distance (normalized by max span)
  const maxSpan = Math.max(
    bboxA.maxX - bboxA.minX, bboxA.maxY - bboxA.minY,
    bboxB.maxX - bboxB.minX, bboxB.maxY - bboxB.minY,
    1,
  );
  const centroidDist = Math.hypot(centroidA.x - centroidB.x, centroidA.y - centroidB.y);
  const centroidScore = Math.max(0, 1 - centroidDist / maxSpan);

  // BBox similarity
  const aw = Math.max(bboxA.maxX - bboxA.minX, 0.001);
  const ah = Math.max(bboxA.maxY - bboxA.minY, 0.001);
  const bw = Math.max(bboxB.maxX - bboxB.minX, 0.001);
  const bh = Math.max(bboxB.maxY - bboxB.minY, 0.001);
  const bboxScore = Math.max(0,
    1 - (Math.abs(aw - bw) / Math.max(aw, bw) + Math.abs(ah - bh) / Math.max(ah, bh)) / 2,
  );

  // Area similarity (shoelace formula on endpoints)
  const areaA = Math.abs(computeSignedArea(a));
  const areaB = Math.abs(computeSignedArea(b));
  const maxArea = Math.max(areaA, areaB, 0.001);
  const areaScore = 1 - Math.abs(areaA - areaB) / maxArea;

  // Segment count similarity
  const segA = a.segments.length;
  const segB = b.segments.length;
  const maxSeg = Math.max(segA, segB, 1);
  const segCountScore = 1 - Math.abs(segA - segB) / maxSeg;

  // Closed compatibility bonus
  const closedBonus = a.closed === b.closed ? 0.2 : 0;

  return (
    centroidScore * 0.35 +
    bboxScore * 0.30 +
    areaScore * 0.10 +
    segCountScore * 0.05 +
    closedBonus
  );
}

// ---------------------------------------------------------------------------
// 8.2b — Segment-level De Casteljau subdivision
// ---------------------------------------------------------------------------

/**
 * Estimate the arc length of a cubic bezier segment using the
 * chord-length + control-polygon-length heuristic:
 *   arcLength ~= (chordLength + controlPolygonLength) / 2
 */
export function estimateCubicArcLength(start: Point, segment: CubicSegment): number {
  const chordLength = Math.hypot(
    segment.end.x - start.x,
    segment.end.y - start.y,
  );
  const controlPolygonLength =
    Math.hypot(segment.c1.x - start.x, segment.c1.y - start.y) +
    Math.hypot(segment.c2.x - segment.c1.x, segment.c2.y - segment.c1.y) +
    Math.hypot(segment.end.x - segment.c2.x, segment.end.y - segment.c2.y);

  return (chordLength + controlPolygonLength) / 2;
}

/**
 * Subdivide cubic segments to equalize curve counts within sub-path pairs.
 *
 * Uses De Casteljau subdivision to split longer segments.
 * Distributes extra subdivisions proportionally by arc length so that
 * longer segments receive more splits (arc-length aware distribution).
 */
export function subdivideCubicSegments(
  segments: CubicSegment[],
  targetCount: number,
  startPoint: Point,
): CubicSegment[] {
  if (segments.length === 0) {
    // Create degenerate segments at start point
    return Array.from({ length: targetCount }, () => ({
      c1: { ...startPoint },
      c2: { ...startPoint },
      end: { ...startPoint },
    }));
  }

  if (segments.length >= targetCount) {
    return segments.slice(0, targetCount);
  }

  // Compute arc lengths for proportional distribution
  const arcLengths: number[] = [];
  for (let i = 0; i < segments.length; i++) {
    const prevEnd = i === 0 ? startPoint : segments[i - 1]!.end;
    arcLengths.push(estimateCubicArcLength(prevEnd, segments[i]!));
  }
  const totalArcLength = arcLengths.reduce((s, l) => s + l, 0);

  // Distribute subdivisions proportionally by arc length
  const extraSplits = targetCount - segments.length;
  const splitsPerSegment = new Array<number>(segments.length).fill(1);

  if (totalArcLength > 0) {
    // Assign extra splits proportionally, then use largest-remainder method
    // to ensure exact total
    const rawExtra = arcLengths.map((l) => (l / totalArcLength) * extraSplits);
    const flooredExtra = rawExtra.map((r) => Math.floor(r));
    let assignedExtra = flooredExtra.reduce((s, v) => s + v, 0);
    const remainders = rawExtra.map((r, i) => ({ idx: i, rem: r - flooredExtra[i]! }));
    remainders.sort((a, b) => b.rem - a.rem);

    for (let i = 0; assignedExtra < extraSplits; i++, assignedExtra++) {
      flooredExtra[remainders[i]!.idx]! += 1;
    }

    for (let i = 0; i < segments.length; i++) {
      splitsPerSegment[i] = 1 + flooredExtra[i]!;
    }
  } else {
    // Degenerate: uniform fallback
    const uniform = targetCount / segments.length;
    let remaining = targetCount;
    for (let i = 0; i < segments.length; i++) {
      const splits = i === segments.length - 1
        ? remaining
        : Math.round(uniform);
      splitsPerSegment[i] = splits;
      remaining -= splits;
    }
  }

  const result: CubicSegment[] = [];
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    const prevEnd = i === 0 ? startPoint : segments[i - 1]!.end;
    const splits = splitsPerSegment[i]!;

    if (splits <= 1) {
      result.push(segment);
    } else {
      const subdivided = splitCubicSegment(prevEnd, segment, splits);
      result.push(...subdivided);
    }
  }

  return result;
}

/**
 * Split a cubic bezier segment into `n` equal-parameter segments
 * using De Casteljau's algorithm.
 */
export function splitCubicSegment(
  start: Point,
  segment: CubicSegment,
  n: number,
): CubicSegment[] {
  if (n <= 1) return [segment];

  const result: CubicSegment[] = [];
  let currentStart = start;
  let currentSegment = segment;

  for (let i = 0; i < n - 1; i++) {
    const remainingSegments = n - i;
    const t = 1 / remainingSegments;
    const [left, right] = deCasteljauSplit(currentStart, currentSegment, t);
    result.push(left);
    currentStart = left.end;
    currentSegment = right;
  }
  result.push(currentSegment);

  return result;
}

/**
 * Split a cubic bezier at parameter t using De Casteljau's algorithm.
 */
function deCasteljauSplit(
  start: Point,
  segment: CubicSegment,
  t: number,
): [CubicSegment, CubicSegment] {
  const p0 = start;
  const p1 = segment.c1;
  const p2 = segment.c2;
  const p3 = segment.end;

  // Level 1
  const p01 = lerpPoint(p0, p1, t);
  const p12 = lerpPoint(p1, p2, t);
  const p23 = lerpPoint(p2, p3, t);

  // Level 2
  const p012 = lerpPoint(p01, p12, t);
  const p123 = lerpPoint(p12, p23, t);

  // Level 3 (split point)
  const p0123 = lerpPoint(p012, p123, t);

  const left: CubicSegment = {
    c1: p01,
    c2: p012,
    end: p0123,
  };

  const right: CubicSegment = {
    c1: p123,
    c2: p23,
    end: p3,
  };

  return [left, right];
}

// ---------------------------------------------------------------------------
// 8.2c — Shape index optimization per sub-path pair
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Arc-length infrastructure (Gauss-Legendre quadrature, n=12)
// Weights and abscissae from https://pomax.github.io/bezierinfo/legendre-gauss.html
// ---------------------------------------------------------------------------

const GL12_W = [
  0.2491470458134028, 0.2491470458134028,
  0.2334925365383548, 0.2334925365383548,
  0.2031674267230659, 0.2031674267230659,
  0.1600783285433462, 0.1600783285433462,
  0.1069393259953184, 0.1069393259953184,
  0.0471753363865118, 0.0471753363865118,
] as const;

const GL12_X = [
  -0.1252334085114689, 0.1252334085114689,
  -0.3678314989981802, 0.3678314989981802,
  -0.5873179542866175, 0.5873179542866175,
  -0.7699026741943047, 0.7699026741943047,
  -0.9041172563704749, 0.9041172563704749,
  -0.9815606342467192, 0.9815606342467192,
] as const;

/**
 * Evaluate the speed |B'(t)| of a cubic Bezier at parameter t.
 * B'(t) = 3[(P1-P0)(1-t)² + 2(P2-P1)(1-t)t + (P3-P2)t²]
 */
function cubicSpeed(p0: Point, p1: Point, p2: Point, p3: Point, t: number): number {
  const mt = 1 - t;
  const ax = 3 * ((p1.x - p0.x) * mt * mt + 2 * (p2.x - p1.x) * mt * t + (p3.x - p2.x) * t * t);
  const ay = 3 * ((p1.y - p0.y) * mt * mt + 2 * (p2.y - p1.y) * mt * t + (p3.y - p2.y) * t * t);
  return Math.sqrt(ax * ax + ay * ay);
}

/**
 * Compute the arc length of a cubic bezier segment using Gauss-Legendre
 * quadrature (n=12). Significantly more accurate than the chord-length
 * heuristic — error < 0.1% for typical icon-scale curves.
 */
export function segmentArcLengthGL(start: Point, seg: CubicSegment): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    // Map abscissa from [-1, 1] to [0, 1]
    const t = 0.5 * (GL12_X[i]! + 1);
    sum += GL12_W[i]! * cubicSpeed(start, seg.c1, seg.c2, seg.end, t);
  }
  return 0.5 * sum;
}

/**
 * Build a cumulative arc-length LUT for a closed sub-path.
 * lut[i] = total arc length from the sub-path start to the END of segment i.
 * lut[-1] (i.e. index before 0) = 0 (start).
 */
function buildArcLengthLut(subPath: CubicSubPath): { lut: number[]; total: number } {
  const lut: number[] = [];
  let accumulated = 0;
  let prevEnd = subPath.start;
  for (const seg of subPath.segments) {
    accumulated += segmentArcLengthGL(prevEnd, seg);
    lut.push(accumulated);
    prevEnd = seg.end;
  }
  return { lut, total: accumulated };
}

/**
 * Sample a point on a sub-path at arc-length fraction `frac` ∈ [0, 1).
 * Uses the LUT for O(log n) segment lookup + linear interpolation within
 * the segment's parameter range.
 */
function sampleSubPathAtFraction(
  subPath: CubicSubPath,
  lut: number[],
  total: number,
  frac: number,
): Point {
  if (subPath.segments.length === 0) return { ...subPath.start };

  const target = frac * total;

  // Binary search for the segment whose end arc-length >= target
  let lo = 0;
  let hi = lut.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (lut[mid]! < target) lo = mid + 1;
    else hi = mid;
  }

  const segIdx = lo;
  const seg = subPath.segments[segIdx]!;
  const segStart = segIdx === 0 ? subPath.start : subPath.segments[segIdx - 1]!.end;
  const arcAtStart = segIdx === 0 ? 0 : lut[segIdx - 1]!;
  const arcAtEnd = lut[segIdx]!;
  const segLen = arcAtEnd - arcAtStart;

  // Linear interpolation of t within this segment
  const tLocal = segLen < 1e-10 ? 0 : (target - arcAtStart) / segLen;
  const t = Math.max(0, Math.min(1, tLocal));

  // Evaluate cubic Bezier at t
  const mt = 1 - t;
  return {
    x:
      mt * mt * mt * segStart.x +
      3 * mt * mt * t * seg.c1.x +
      3 * mt * t * t * seg.c2.x +
      t * t * t * seg.end.x,
    y:
      mt * mt * mt * segStart.y +
      3 * mt * mt * t * seg.c1.y +
      3 * mt * t * t * seg.c2.y +
      t * t * t * seg.end.y,
  };
}

/**
 * Find the optimal rotation offset for a closed sub-path pair using
 * arc-length-uniform sampling.
 *
 * Unlike `findOptimalShapeIndex` (which searches over segment endpoints),
 * this function samples N points at equal arc-length fractions around each
 * path's perimeter, then performs the O(N²) cyclic rotation search over
 * those uniform samples. This correctly handles shape pairs with very
 * different curvature distributions — e.g. heart → star — where segment
 * endpoints are clustered near high-curvature regions.
 *
 * Algorithm credit:
 *   - Sederberg, Gao, Wang & Mu (SIGGRAPH '93): intrinsic arc-fraction mapping
 *   - Veltman/Flubber (2017): O(N²) cyclic search over uniformly-sampled ring
 *
 * @param N  Number of uniform samples (default 64 — 4096 distance evals ≈ 20 µs)
 * @returns  Segment index in `to` that should become the new start (for rotateSubPathSegments)
 */
export function findOptimalShapeIndexArcLength(
  from: CubicSubPath,
  to: CubicSubPath,
  N = 64,
): number {
  if (from.segments.length === 0 || to.segments.length === 0) return 0;
  if (!from.closed || !to.closed) return 0;

  // Build arc-length LUTs
  const fromLut = buildArcLengthLut(from);
  const toLut = buildArcLengthLut(to);

  if (fromLut.total < 1e-10 || toLut.total < 1e-10) return 0;

  // Sample N arc-length-uniform points from each path
  const fromPts: Point[] = [];
  const toPts: Point[] = [];
  for (let i = 0; i < N; i++) {
    const frac = i / N;
    fromPts.push(sampleSubPathAtFraction(from, fromLut.lut, fromLut.total, frac));
    toPts.push(sampleSubPathAtFraction(to, toLut.lut, toLut.total, frac));
  }

  // O(N²) cyclic rotation search — minimise sum of squared distances
  let bestOffset = 0;
  let bestCost = Infinity;
  for (let offset = 0; offset < N; offset++) {
    let cost = 0;
    for (let i = 0; i < N; i++) {
      cost += pointDistSq(fromPts[i]!, toPts[(i + offset) % N]!);
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestOffset = offset;
    }
  }

  // Convert arc-length sample offset → segment index in `to`.
  // Find the segment whose end arc-length is closest to
  // (bestOffset / N) * total.
  const arcTarget = (bestOffset / N) * toLut.total;
  let bestSeg = 0;
  let minDist = Infinity;
  for (let i = 0; i < toLut.lut.length; i++) {
    const d = Math.abs(toLut.lut[i]! - arcTarget);
    if (d < minDist) {
      minDist = d;
      bestSeg = i + 1; // segment after this boundary → new start index
    }
  }
  return bestSeg % to.segments.length;
}

/**
 * Find optimal rotation offset for a sub-path pair that minimizes
 * total point displacement during morphing.
 *
 * Used by `bestGuessMorph` (topology already matched after alignCubicPaths —
 * segment endpoints are meaningful). For the topology-agnostic `crossIconMorph`
 * pipeline use `findOptimalShapeIndexArcLength` instead.
 */
export function findOptimalShapeIndex(
  from: CubicSubPath,
  to: CubicSubPath,
): number {
  if (from.segments.length === 0 || to.segments.length === 0) return 0;
  if (!from.closed || !to.closed) return 0; // Only optimize closed paths

  const n = Math.min(from.segments.length, to.segments.length);
  let bestOffset = 0;
  let bestCost = Infinity;

  for (let offset = 0; offset < n; offset++) {
    let cost = 0;
    for (let i = 0; i < n; i++) {
      const fromSeg = from.segments[i]!;
      const toSeg = to.segments[(i + offset) % n]!;
      cost += pointDistSq(fromSeg.end, toSeg.end);
      cost += pointDistSq(fromSeg.c1, toSeg.c1) * 0.5;
      cost += pointDistSq(fromSeg.c2, toSeg.c2) * 0.5;
    }
    // Also check start point alignment
    const fromStart = from.start;
    const toStart = offset === 0
      ? to.start
      : to.segments[(offset - 1) % n]!.end;
    cost += pointDistSq(fromStart, toStart);

    if (cost < bestCost) {
      bestCost = cost;
      bestOffset = offset;
    }
  }

  return bestOffset;
}

/**
 * Apply a rotation offset to a closed sub-path's segments.
 */
export function rotateSubPathSegments(
  subPath: CubicSubPath,
  offset: number,
): CubicSubPath {
  if (offset === 0 || subPath.segments.length === 0) return subPath;
  const n = subPath.segments.length;
  const normalizedOffset = ((offset % n) + n) % n;
  if (normalizedOffset === 0) return subPath;

  const rotated = [
    ...subPath.segments.slice(normalizedOffset),
    ...subPath.segments.slice(0, normalizedOffset),
  ];

  const newStart = normalizedOffset > 0
    ? subPath.segments[normalizedOffset - 1]!.end
    : subPath.start;

  return {
    start: { ...newStart },
    segments: rotated,
    closed: subPath.closed,
  };
}

/**
 * Reverse the traversal direction of a cubic sub-path.
 *
 * Given a path that walks S → s0.end → s1.end → … → s(n-1).end, returns
 * a path that walks s(n-1).end → … → s1.end → s0.end → S. Each cubic
 * segment gets its control points swapped (c1 ↔ c2) because they were
 * named relative to the original direction.
 *
 * Used by `alignCubicPaths` / `bestGuessMorph` to avoid visual
 * horizontal-flip artifacts when two paths encode the same geometry in
 * opposite orientations.
 */
export function reverseSubPathSegments(subPath: CubicSubPath): CubicSubPath {
  const n = subPath.segments.length;
  if (n === 0) {
    return {
      start: { ...subPath.start },
      segments: [],
      closed: subPath.closed,
    };
  }

  // Previous-end lookup: prev(0) = start; prev(i>0) = segs[i-1].end
  const prevEnd = (i: number) =>
    i === 0 ? subPath.start : subPath.segments[i - 1]!.end;

  const reversed: CubicSubPath['segments'] = new Array(n);
  for (let r = 0; r < n; r += 1) {
    const origIdx = n - 1 - r;
    const origSeg = subPath.segments[origIdx]!;
    reversed[r] = {
      c1: { ...origSeg.c2 },
      c2: { ...origSeg.c1 },
      end: { ...prevEnd(origIdx) },
    };
  }

  return {
    start: { ...subPath.segments[n - 1]!.end },
    segments: reversed,
    closed: subPath.closed,
  };
}

/**
 * Total sum-of-squares displacement between two equal-length sub-paths,
 * comparing each pair of endpoints and (with half weight) control
 * points. Used as the scoring function for direction / rotation
 * alignment in {@link alignCubicPaths}.
 */
export function computeSubPathAlignmentCost(
  from: CubicSubPath,
  to: CubicSubPath,
): number {
  const n = Math.min(from.segments.length, to.segments.length);
  let cost = pointDistSq(from.start, to.start);
  for (let i = 0; i < n; i += 1) {
    const f = from.segments[i]!;
    const t = to.segments[i]!;
    cost += pointDistSq(f.end, t.end);
    cost += pointDistSq(f.c1, t.c1) * 0.5;
    cost += pointDistSq(f.c2, t.c2) * 0.5;
  }
  return cost;
}

// ---------------------------------------------------------------------------
// 8.2d — Unmatched sub-path handling
// ---------------------------------------------------------------------------

/**
 * Create a degenerate sub-path collapsed to a centroid point with the
 * same number of segments as the template, for fade-in/fade-out
 * of unmatched sub-paths.
 */
export function createCentroidCollapsedSubPath(
  template: CubicSubPath,
  centroid?: Point,
): CubicSubPath {
  const center = centroid ?? computeSubPathCentroid(template);
  return {
    start: { ...center },
    segments: template.segments.map(() => ({
      c1: { ...center },
      c2: { ...center },
      end: { ...center },
    })),
    closed: template.closed,
  };
}

// ---------------------------------------------------------------------------
// 8.2 — Complete cross-icon morph pipeline
// ---------------------------------------------------------------------------

/**
 * Sample N arc-length-uniform points from a closed sub-path.
 * Uses the GL12-based LUT already built by buildArcLengthLut.
 */
function sampleSubPathNPoints(sub: CubicSubPath, N: number): Point[] {
  if (sub.segments.length === 0) {
    return Array.from({ length: N }, () => ({ ...sub.start }));
  }
  const { lut, total } = buildArcLengthLut(sub);
  if (total < 1e-10) {
    return Array.from({ length: N }, () => ({ ...sub.start }));
  }
  return Array.from({ length: N }, (_, i) =>
    sampleSubPathAtFraction(sub, lut, total, i / N),
  );
}

/**
 * Reconstruct a closed smooth cubic bezier path from N uniformly-distributed
 * points using Catmull-Rom → Bezier conversion (tension = 1/6).
 *
 * This avoids all control-handle interpolation artifacts: handles are derived
 * from neighboring point positions, so they are always proportional to local
 * segment length and never create mid-morph "blobs".
 */
function catmullRomToClosedBezier(pts: Point[]): CubicSubPath {
  const n = pts.length;
  if (n < 2) return { start: pts[0] ?? { x: 0, y: 0 }, segments: [], closed: true };

  // Standard Catmull-Rom → cubic Bezier conversion:
  //   c1 = p[i]   + (p[i+1] - p[i-1]) / 6
  //   c2 = p[i+1] - (p[i+2] - p[i])   / 6
  const TENSION = 1 / 6;
  const segments: CubicSegment[] = [];

  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]!;
    const curr = pts[i]!;
    const next = pts[(i + 1) % n]!;
    const nextNext = pts[(i + 2) % n]!;

    segments.push({
      c1: {
        x: curr.x + (next.x - prev.x) * TENSION,
        y: curr.y + (next.y - prev.y) * TENSION,
      },
      c2: {
        x: next.x - (nextNext.x - curr.x) * TENSION,
        y: next.y - (nextNext.y - curr.y) * TENSION,
      },
      end: next,
    });
  }

  return { start: pts[0]!, segments, closed: true };
}

/**
 * Reconstruct an open smooth cubic bezier path from N uniformly-distributed
 * points using Catmull-Rom → Bezier conversion (tension = 1/6).
 *
 * For open paths the first and last control handles use clamped (non-wrapping)
 * neighbours, which avoids wrap-around kinks at the endpoints.
 */
function catmullRomToOpenBezier(pts: Point[]): CubicSubPath {
  const n = pts.length;
  if (n < 2) return { start: pts[0] ?? { x: 0, y: 0 }, segments: [], closed: false };

  const TENSION = 1 / 6;
  const segments: CubicSegment[] = [];

  for (let i = 0; i < n - 1; i++) {
    // Clamp neighbours at the endpoints instead of wrapping
    const prev = pts[Math.max(0, i - 1)]!;
    const curr = pts[i]!;
    const next = pts[i + 1]!;
    const nextNext = pts[Math.min(n - 1, i + 2)]!;

    segments.push({
      c1: {
        x: curr.x + (next.x - prev.x) * TENSION,
        y: curr.y + (next.y - prev.y) * TENSION,
      },
      c2: {
        x: next.x - (nextNext.x - curr.x) * TENSION,
        y: next.y - (nextNext.y - curr.y) * TENSION,
      },
      end: next,
    });
  }

  return { start: pts[0]!, segments, closed: false };
}

/**
 * Find the cyclic rotation offset (in sample space) that minimises total
 * point displacement between two sets of N arc-length-uniform samples.
 * Returns a rotated copy of `toPts`.
 */
function alignSampledPoints(fromPts: Point[], toPts: Point[]): Point[] {
  const N = fromPts.length;
  let bestOffset = 0;
  let bestCost = Infinity;
  for (let offset = 0; offset < N; offset++) {
    let cost = 0;
    for (let i = 0; i < N; i++) {
      cost += pointDistSq(fromPts[i]!, toPts[(i + offset) % N]!);
    }
    if (cost < bestCost) {
      bestCost = cost;
      bestOffset = offset;
    }
  }
  if (bestOffset === 0) return toPts;
  return [...toPts.slice(bestOffset), ...toPts.slice(0, bestOffset)];
}

/**
 * Produce a morph interpolator between two different icons (cross-icon morph).
 *
 * Algorithm (Flubber / Sederberg '93):
 * 1. Match sub-paths by centroid/bbox similarity
 * 2. Sample N arc-length-uniform points from each matched pair
 * 3. Find optimal cyclic rotation via O(N²) search on sample space
 * 4. Handle unmatched sub-paths via centroid collapse
 * 5. Lerp sampled points at each t, reconstruct smooth path with Catmull-Rom
 *
 * This approach avoids all control-handle interpolation artifacts (blobs,
 * kinks) that occur when bezier handles from very different shapes are
 * directly interpolated.
 */
export function crossIconMorph(from: CubicPath, to: CubicPath): MorphInterpolator | null {
  if (from.length === 0 && to.length === 0) return null;

  // Number of arc-length-uniform samples used for interpolation.
  // 64 gives smooth curves on any icon size with negligible reconstruction error.
  const N = 64;

  // Step 0: Normalize winding order to clockwise for consistent morphing
  const normalizedFrom = from.map(ensureClockwise);
  const normalizedTo = to.map(ensureClockwise);

  // Step 1: Match sub-paths
  const matches = matchSubPaths(normalizedFrom, normalizedTo);
  const matchedFrom = new Set(matches.map((m) => m.fromIndex));
  const matchedTo = new Set(matches.map((m) => m.toIndex));

  type Pair = {
    fromPts: Point[];
    toPts: Point[];
    disappearing: boolean;
    appearing: boolean;
    closed: boolean;
  };
  const pairs: Pair[] = [];

  // Step 2: Sample & align matched pairs
  for (const match of matches) {
    const fromSub = cloneSubPath(normalizedFrom[match.fromIndex]!);
    const toSub = cloneSubPath(normalizedTo[match.toIndex]!);

    const fromPts = sampleSubPathNPoints(fromSub, N);
    const rawToPts = sampleSubPathNPoints(toSub, N);

    // Find optimal cyclic rotation in sample space (closed paths only)
    const toPts = (fromSub.closed && toSub.closed)
      ? alignSampledPoints(fromPts, rawToPts)
      : rawToPts;

    pairs.push({ fromPts, toPts, disappearing: false, appearing: false, closed: fromSub.closed && toSub.closed });
  }

  // Step 3: Unmatched sub-paths — collapse to / expand from centroid
  for (let i = 0; i < normalizedFrom.length; i++) {
    if (!matchedFrom.has(i)) {
      const fromSub = cloneSubPath(normalizedFrom[i]!);
      const centroid = computeSubPathCentroid(fromSub);
      pairs.push({
        fromPts: sampleSubPathNPoints(fromSub, N),
        toPts: Array.from({ length: N }, () => ({ ...centroid })),
        disappearing: true,
        appearing: false,
        closed: fromSub.closed,
      });
    }
  }
  for (let i = 0; i < normalizedTo.length; i++) {
    if (!matchedTo.has(i)) {
      const toSub = cloneSubPath(normalizedTo[i]!);
      const centroid = computeSubPathCentroid(toSub);
      pairs.push({
        fromPts: Array.from({ length: N }, () => ({ ...centroid })),
        toPts: sampleSubPathNPoints(toSub, N),
        disappearing: false,
        appearing: true,
        closed: toSub.closed,
      });
    }
  }

  // Step 4: Build interpolator
  return (t: number): string => {
    if (t <= 0) return serializePath(normalizedFrom);
    if (t >= 1) return serializePath(normalizedTo);

    const result: CubicSubPath[] = [];
    for (const pair of pairs) {
      // Apply eased timing for unmatched (disappearing/appearing) sub-paths
      let effectiveT = t;
      if (pair.disappearing) {
        effectiveT = easeInCubic(t);   // from → centroid: accelerate collapse
      } else if (pair.appearing) {
        effectiveT = easeOutCubic(t);  // centroid → to: decelerate expansion
      }

      // Lerp each sample point, then reconstruct a smooth bezier.
      // Use closed vs open Catmull-Rom based on the pair's geometry.
      const pts: Point[] = pair.fromPts.map((fp, i) =>
        lerpPoint(fp, pair.toPts[i]!, effectiveT),
      );
      result.push(pair.closed ? catmullRomToClosedBezier(pts) : catmullRomToOpenBezier(pts));
    }
    return serializePath(result);
  };
}

// ---------------------------------------------------------------------------
// 8.1b — Rotational interpolation helpers
// ---------------------------------------------------------------------------

/**
 * Interpolate control point handles using angle+length (polar) interpolation
 * relative to their anchor points. This prevents mid-morph kinks that occur
 * with raw x,y interpolation.
 */
export function interpolateHandleRotational(
  anchor: Point,
  fromHandle: Point,
  toHandle: Point,
  t: number,
): Point {
  const fromDx = fromHandle.x - anchor.x;
  const fromDy = fromHandle.y - anchor.y;
  const toDx = toHandle.x - anchor.x;
  const toDy = toHandle.y - anchor.y;

  const fromAngle = Math.atan2(fromDy, fromDx);
  const fromLen = Math.sqrt(fromDx * fromDx + fromDy * fromDy);
  const toAngle = Math.atan2(toDy, toDx);
  const toLen = Math.sqrt(toDx * toDx + toDy * toDy);

  // Use shortest angle path
  let angleDiff = toAngle - fromAngle;
  if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
  if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

  const angle = fromAngle + angleDiff * t;
  const len = fromLen + (toLen - fromLen) * t;

  return {
    x: anchor.x + len * Math.cos(angle),
    y: anchor.y + len * Math.sin(angle),
  };
}

// ---------------------------------------------------------------------------
// Serialization
// ---------------------------------------------------------------------------

function serializePath(path: CubicPath): string {
  const parts: string[] = [];
  for (const sub of path) {
    parts.push(`M${fmt(sub.start.x)} ${fmt(sub.start.y)}`);
    for (const seg of sub.segments) {
      parts.push(
        `C${fmt(seg.c1.x)} ${fmt(seg.c1.y)} ${fmt(seg.c2.x)} ${fmt(seg.c2.y)} ${fmt(seg.end.x)} ${fmt(seg.end.y)}`,
      );
    }
    if (sub.closed) {
      parts.push('Z');
    }
  }
  return parts.join(' ');
}

// ---------------------------------------------------------------------------
// Easing helpers for coordinated unmatched sub-path timing
// ---------------------------------------------------------------------------

/** Cubic ease-in: accelerating from zero velocity. */
function easeInCubic(t: number): number {
  return t * t * t;
}

/** Cubic ease-out: decelerating to zero velocity. */
function easeOutCubic(t: number): number {
  const t1 = t - 1;
  return t1 * t1 * t1 + 1;
}

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

function computeSubPathCentroid(sub: CubicSubPath): Point {
  const points: Point[] = [sub.start];
  for (const seg of sub.segments) {
    points.push(seg.end);
  }
  const cx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.y, 0) / points.length;
  return { x: cx, y: cy };
}

function computeSubPathBBox(sub: CubicSubPath) {
  const points: Point[] = [sub.start];
  for (const seg of sub.segments) {
    points.push(seg.c1, seg.c2, seg.end);
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of points) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  return { minX, minY, maxX, maxY };
}

function lerpPoint(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

function pointDistSq(a: Point, b: Point): number {
  return (a.x - b.x) ** 2 + (a.y - b.y) ** 2;
}

function cloneSubPath(sub: CubicSubPath): CubicSubPath {
  return {
    start: { ...sub.start },
    segments: sub.segments.map((s) => ({
      c1: { ...s.c1 },
      c2: { ...s.c2 },
      end: { ...s.end },
    })),
    closed: sub.closed,
  };
}

function fmt(n: number): string {
  const r = Number(n.toFixed(3));
  return Object.is(r, -0) ? '0' : String(r);
}
