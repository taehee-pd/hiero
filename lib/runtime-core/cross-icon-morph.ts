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
 * Compute similarity between two sub-paths using centroid proximity
 * and bbox similarity.
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

  // Closed compatibility bonus
  const closedBonus = a.closed === b.closed ? 0.2 : 0;

  return centroidScore * 0.4 + bboxScore * 0.4 + closedBonus;
}

// ---------------------------------------------------------------------------
// 8.2b — Segment-level De Casteljau subdivision
// ---------------------------------------------------------------------------

/**
 * Subdivide cubic segments to equalize curve counts within sub-path pairs.
 *
 * Uses De Casteljau subdivision to split longer segments.
 * Distribution formula: stepsPerSegment = longer.length / shorter.length
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

  const result: CubicSegment[] = [];
  const subdivisionsPerSegment = targetCount / segments.length;

  let remaining = targetCount;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]!;
    const prevEnd = i === 0 ? startPoint : segments[i - 1]!.end;
    const splits = i === segments.length - 1
      ? remaining
      : Math.round(subdivisionsPerSegment);

    if (splits <= 1) {
      result.push(segment);
      remaining -= 1;
    } else {
      const subdivided = splitCubicSegment(prevEnd, segment, splits);
      result.push(...subdivided);
      remaining -= subdivided.length;
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

/**
 * Find optimal rotation offset for a sub-path pair that minimizes
 * total point displacement during morphing.
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
 * Produce a morph interpolator between two different icons (cross-icon morph).
 *
 * Pipeline:
 * 1. Match sub-paths by centroid/bbox similarity
 * 2. Equalize segment counts via De Casteljau subdivision
 * 3. Find optimal shape index per matched pair
 * 4. Handle unmatched sub-paths via centroid collapse
 * 5. Build interpolator
 */
export function crossIconMorph(from: CubicPath, to: CubicPath): MorphInterpolator | null {
  if (from.length === 0 && to.length === 0) return null;

  // Step 1: Match sub-paths
  const matches = matchSubPaths(from, to);
  const matchedFrom = new Set(matches.map((m) => m.fromIndex));
  const matchedTo = new Set(matches.map((m) => m.toIndex));

  // Build aligned path pairs
  const alignedFrom: CubicPath = [];
  const alignedTo: CubicPath = [];

  // Add matched pairs
  for (const match of matches) {
    let fromSub = cloneSubPath(from[match.fromIndex]!);
    let toSub = cloneSubPath(to[match.toIndex]!);

    // Step 2: Equalize segment counts
    const targetSegments = Math.max(fromSub.segments.length, toSub.segments.length);
    if (fromSub.segments.length < targetSegments) {
      fromSub = {
        ...fromSub,
        segments: subdivideCubicSegments(fromSub.segments, targetSegments, fromSub.start),
      };
    }
    if (toSub.segments.length < targetSegments) {
      toSub = {
        ...toSub,
        segments: subdivideCubicSegments(toSub.segments, targetSegments, toSub.start),
      };
    }

    // Step 3: Optimize shape index for closed paths
    if (fromSub.closed && toSub.closed) {
      const offset = findOptimalShapeIndex(fromSub, toSub);
      if (offset > 0) {
        toSub = rotateSubPathSegments(toSub, offset);
      }
    }

    alignedFrom.push(fromSub);
    alignedTo.push(toSub);
  }

  // Step 4: Handle unmatched sub-paths
  for (let i = 0; i < from.length; i++) {
    if (!matchedFrom.has(i)) {
      const fromSub = cloneSubPath(from[i]!);
      const collapsed = createCentroidCollapsedSubPath(fromSub);
      alignedFrom.push(fromSub);
      alignedTo.push(collapsed);
    }
  }
  for (let i = 0; i < to.length; i++) {
    if (!matchedTo.has(i)) {
      const toSub = cloneSubPath(to[i]!);
      const collapsed = createCentroidCollapsedSubPath(toSub);
      alignedFrom.push(collapsed);
      alignedTo.push(toSub);
    }
  }

  // Step 5: Build interpolator
  return (t: number): string => {
    if (t <= 0) return serializePath(from);
    if (t >= 1) return serializePath(to);

    const result: CubicSubPath[] = [];
    for (let i = 0; i < alignedFrom.length; i++) {
      const fromSub = alignedFrom[i]!;
      const toSub = alignedTo[i]!;
      result.push(interpolateSubPath(fromSub, toSub, t));
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
// Interpolation helpers
// ---------------------------------------------------------------------------

function interpolateSubPath(from: CubicSubPath, to: CubicSubPath, t: number): CubicSubPath {
  const start = lerpPoint(from.start, to.start, t);
  const segCount = Math.min(from.segments.length, to.segments.length);
  const segments: CubicSegment[] = [];

  let prevFromEnd = from.start;
  let prevToEnd = to.start;

  for (let i = 0; i < segCount; i++) {
    const fromSeg = from.segments[i]!;
    const toSeg = to.segments[i]!;

    // Use rotational interpolation for control points
    const interpolatedEnd = lerpPoint(fromSeg.end, toSeg.end, t);
    const c1 = interpolateHandleRotational(
      lerpPoint(prevFromEnd, prevToEnd, t),
      fromSeg.c1,
      toSeg.c1,
      t,
    );
    const c2 = interpolateHandleRotational(
      interpolatedEnd,
      fromSeg.c2,
      toSeg.c2,
      t,
    );

    segments.push({ c1, c2, end: interpolatedEnd });
    prevFromEnd = fromSeg.end;
    prevToEnd = toSeg.end;
  }

  return { start, segments, closed: from.closed || to.closed };
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
