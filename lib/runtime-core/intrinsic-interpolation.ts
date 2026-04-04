/**
 * Intrinsic Interpolation Module
 *
 * Implements Sederberg et al. 1993 intrinsic interpolation for SVG path morphing.
 * Instead of linearly interpolating control point coordinates (which causes
 * "shrinkage" during rotational morphs), this decomposes each segment pair
 * into rotation angle + edge length, interpolates those separately, then
 * reconstructs coordinates.
 *
 * A square rotating 45° to become a diamond shrinks to ~70% at t=0.5 with
 * linear lerp. Intrinsic interpolation preserves edge lengths and angles,
 * producing a smooth rotation at full size.
 *
 * References:
 * - Sederberg, T.W., Gao, P., Wang, G., Mu, H. (1993). "2-D Shape Blending:
 *   An Intrinsic Solution to the Vertex Path Problem." SIGGRAPH '93.
 * - Alexa, M., Cohen-Or, D., Levin, D. (2000). "As-Rigid-As-Possible Shape
 *   Interpolation." SIGGRAPH 2000.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A 2D point. */
export type Point = { x: number; y: number };

/** Polar representation of an edge vector. */
export type PolarEdge = {
  length: number;
  angle: number; // radians, in [-π, π]
};

/**
 * Intrinsic representation of a cubic bezier control point relative to its
 * segment chord (the line from segment start to segment end).
 *
 * Instead of storing absolute (x, y), we store:
 * - tangentRatio: projection onto the chord direction (0 = at start, 1 = at end)
 * - normalRatio:  signed perpendicular offset, normalised by chord length
 * - magnitude:    distance from the nearest chord endpoint
 *
 * This representation is rotation-invariant: rotating the chord rotates the
 * control point with it, preserving the curve's shape.
 */
export type IntrinsicHandle = {
  tangentRatio: number;
  normalRatio: number;
  magnitude: number;
};

/**
 * Intrinsic representation of a single path segment (line or cubic bezier).
 * The segment is defined by its edge (start → end) in polar coordinates,
 * plus intrinsic representations of c1 and c2 control handles.
 */
export type IntrinsicSegment = {
  edge: PolarEdge;
  c1: IntrinsicHandle | null; // null for line segments
  c2: IntrinsicHandle | null; // null for line segments
};

// ---------------------------------------------------------------------------
// Epsilon for degenerate-edge fallback
// ---------------------------------------------------------------------------

const EPSILON = 1e-6;

// ---------------------------------------------------------------------------
// Core decomposition
// ---------------------------------------------------------------------------

/**
 * Decompose an absolute point into intrinsic representation relative to a
 * chord defined by `chordStart` and `chordEnd`.
 */
export function decomposeHandle(
  point: Point,
  chordStart: Point,
  chordEnd: Point,
): IntrinsicHandle {
  const dx = chordEnd.x - chordStart.x;
  const dy = chordEnd.y - chordStart.y;
  const chordLen = Math.sqrt(dx * dx + dy * dy);

  if (chordLen < EPSILON) {
    // Degenerate chord (zero-length edge). Store the raw offset vector
    // as tangent/normal ratios so reconstruction can recover direction
    // when blending with a non-degenerate segment.
    const px = point.x - chordStart.x;
    const py = point.y - chordStart.y;
    const mag = Math.sqrt(px * px + py * py);
    return {
      tangentRatio: mag > EPSILON ? px / mag : 0,
      normalRatio: mag > EPSILON ? py / mag : 0,
      magnitude: mag,
    };
  }

  // Unit tangent and normal vectors along the chord
  const tx = dx / chordLen;
  const ty = dy / chordLen;
  // Normal is perpendicular: (-ty, tx)
  const nx = -ty;
  const ny = tx;

  // Vector from chordStart to point
  const px = point.x - chordStart.x;
  const py = point.y - chordStart.y;

  // Project onto tangent and normal
  const tangentProj = px * tx + py * ty;
  const normalProj = px * nx + py * ny;

  return {
    tangentRatio: tangentProj / chordLen,
    normalRatio: normalProj / chordLen,
    magnitude: Math.sqrt(px * px + py * py),
  };
}

/**
 * Reconstruct an absolute point from its intrinsic representation relative
 * to a chord.
 */
export function reconstructHandle(
  handle: IntrinsicHandle,
  chordStart: Point,
  chordEnd: Point,
): Point {
  const dx = chordEnd.x - chordStart.x;
  const dy = chordEnd.y - chordStart.y;
  const chordLen = Math.sqrt(dx * dx + dy * dy);

  if (chordLen < EPSILON) {
    // Degenerate chord. Place at chordStart offset by magnitude in original direction.
    // Since we can't recover direction from a zero-length chord, use tangentRatio
    // as angle hint (this gracefully degrades).
    return {
      x: chordStart.x + handle.magnitude * handle.tangentRatio,
      y: chordStart.y + handle.magnitude * handle.normalRatio,
    };
  }

  // Unit tangent and normal
  const tx = dx / chordLen;
  const ty = dy / chordLen;
  const nx = -ty;
  const ny = tx;

  // Reconstruct from tangent/normal ratios
  const x = chordStart.x + (handle.tangentRatio * chordLen) * tx + (handle.normalRatio * chordLen) * nx;
  const y = chordStart.y + (handle.tangentRatio * chordLen) * ty + (handle.normalRatio * chordLen) * ny;

  return { x, y };
}

/**
 * Decompose an edge vector (from start to end) into polar representation.
 */
export function decomposePolar(start: Point, end: Point): PolarEdge {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return {
    length: Math.sqrt(dx * dx + dy * dy),
    angle: Math.atan2(dy, dx),
  };
}

/**
 * Reconstruct an endpoint from a starting point and polar edge.
 */
export function reconstructFromPolar(start: Point, edge: PolarEdge): Point {
  return {
    x: start.x + edge.length * Math.cos(edge.angle),
    y: start.y + edge.length * Math.sin(edge.angle),
  };
}

// ---------------------------------------------------------------------------
// Angle interpolation
// ---------------------------------------------------------------------------

/**
 * Interpolate two angles using shortest-arc rotation.
 * Both angles are in radians. Result is in (-π, π].
 */
export function angleLerp(a: number, b: number, t: number): number {
  // Compute the shortest angular difference
  let diff = b - a;

  // Normalise to [-π, π]
  while (diff > Math.PI) diff -= 2 * Math.PI;
  while (diff < -Math.PI) diff += 2 * Math.PI;

  let result = a + diff * t;

  // Normalise result
  while (result > Math.PI) result -= 2 * Math.PI;
  while (result < -Math.PI) result += 2 * Math.PI;

  return result;
}

// ---------------------------------------------------------------------------
// Intrinsic handle interpolation
// ---------------------------------------------------------------------------

/**
 * Interpolate two intrinsic handles.
 */
export function lerpIntrinsicHandle(
  a: IntrinsicHandle,
  b: IntrinsicHandle,
  t: number,
): IntrinsicHandle {
  return {
    tangentRatio: a.tangentRatio + (b.tangentRatio - a.tangentRatio) * t,
    normalRatio: a.normalRatio + (b.normalRatio - a.normalRatio) * t,
    magnitude: a.magnitude + (b.magnitude - a.magnitude) * t,
  };
}

// ---------------------------------------------------------------------------
// Full segment interpolation
// ---------------------------------------------------------------------------

/**
 * Decompose a cubic bezier segment into intrinsic representation.
 *
 * @param start  Segment start point (absolute)
 * @param c1     First control point (absolute), or null for line segments
 * @param c2     Second control point (absolute), or null for line segments
 * @param end    Segment end point (absolute)
 */
export function decomposeSegment(
  start: Point,
  c1: Point | null,
  c2: Point | null,
  end: Point,
): IntrinsicSegment {
  return {
    edge: decomposePolar(start, end),
    c1: c1 ? decomposeHandle(c1, start, end) : null,
    c2: c2 ? decomposeHandle(c2, start, end) : null,
  };
}

/**
 * Interpolate two intrinsic segments and reconstruct absolute coordinates.
 *
 * @param from       Source intrinsic segment
 * @param to         Target intrinsic segment
 * @param t          Progress 0-1
 * @param startPoint The absolute start point for this segment
 * @returns          { c1, c2, end } in absolute coordinates
 */
export function interpolateSegment(
  from: IntrinsicSegment,
  to: IntrinsicSegment,
  t: number,
  startPoint: Point,
): { c1: Point | null; c2: Point | null; end: Point } {
  // Interpolate edge in polar space
  const interpEdge: PolarEdge = {
    length: from.edge.length + (to.edge.length - from.edge.length) * t,
    angle: angleLerp(from.edge.angle, to.edge.angle, t),
  };

  // Reconstruct end point
  const end = reconstructFromPolar(startPoint, interpEdge);

  // Interpolate control handles
  let c1: Point | null = null;
  let c2: Point | null = null;

  if (from.c1 && to.c1) {
    const interpC1 = lerpIntrinsicHandle(from.c1, to.c1, t);
    c1 = reconstructHandle(interpC1, startPoint, end);
  } else if (from.c1 || to.c1) {
    // One side is a line, other is a curve. Create identity handle for the line side.
    const lineHandle: IntrinsicHandle = { tangentRatio: 0, normalRatio: 0, magnitude: 0 };
    const curveHandle = from.c1 ?? to.c1!;
    const interpC1 = from.c1
      ? lerpIntrinsicHandle(curveHandle, lineHandle, t)
      : lerpIntrinsicHandle(lineHandle, curveHandle, t);
    c1 = reconstructHandle(interpC1, startPoint, end);
  }

  if (from.c2 && to.c2) {
    const interpC2 = lerpIntrinsicHandle(from.c2, to.c2, t);
    c2 = reconstructHandle(interpC2, startPoint, end);
  } else if (from.c2 || to.c2) {
    const lineHandle: IntrinsicHandle = { tangentRatio: 1, normalRatio: 0, magnitude: 0 };
    const curveHandle = from.c2 ?? to.c2!;
    const interpC2 = from.c2
      ? lerpIntrinsicHandle(curveHandle, lineHandle, t)
      : lerpIntrinsicHandle(lineHandle, curveHandle, t);
    c2 = reconstructHandle(interpC2, startPoint, end);
  }

  return { c1, c2, end };
}

// ---------------------------------------------------------------------------
// Path-level intrinsic interpolation
// ---------------------------------------------------------------------------

/** A parsed path segment for intrinsic processing. */
export type PathSegmentData = {
  command: string; // 'M', 'L', 'C', 'Q', 'H', 'V', 'Z', etc.
  start: Point;
  end: Point;
  c1: Point | null;
  c2: Point | null;
};

/**
 * Perform intrinsic interpolation on two arrays of matched path segments.
 *
 * Both arrays must have the same length and matching command types.
 * Returns an array of interpolated absolute coordinates that can be
 * serialized back to the original command format.
 *
 * Preserves the original command stream (M stays M, L stays L, C stays C, etc.)
 * — only the numeric values change.
 */
export function intrinsicInterpolatePath(
  fromSegments: PathSegmentData[],
  toSegments: PathSegmentData[],
  t: number,
): PathSegmentData[] {
  if (fromSegments.length !== toSegments.length) {
    throw new Error(
      `Segment count mismatch: ${fromSegments.length} vs ${toSegments.length}`,
    );
  }

  if (t <= 0) return fromSegments.map((s) => ({ ...s }));
  if (t >= 1) return toSegments.map((s) => ({ ...s }));

  const result: PathSegmentData[] = [];

  // Track the running start point for coordinate reconstruction.
  // The first M command establishes the initial position.
  let currentStart: Point = { x: 0, y: 0 };

  for (let i = 0; i < fromSegments.length; i++) {
    const fromSeg = fromSegments[i]!;
    const toSeg = toSegments[i]!;

    if (fromSeg.command === 'M') {
      // Move commands: linearly interpolate the position
      const x = fromSeg.end.x + (toSeg.end.x - fromSeg.end.x) * t;
      const y = fromSeg.end.y + (toSeg.end.y - fromSeg.end.y) * t;
      const end = { x, y };
      result.push({ command: 'M', start: end, end, c1: null, c2: null });
      currentStart = end;
      continue;
    }

    if (fromSeg.command === 'Z' || fromSeg.command === 'z') {
      result.push({ command: 'Z', start: currentStart, end: currentStart, c1: null, c2: null });
      continue;
    }

    // For drawing commands (L, C, Q, H, V, etc.): use intrinsic interpolation
    const fromEdgeLen = Math.sqrt(
      (fromSeg.end.x - fromSeg.start.x) ** 2 +
      (fromSeg.end.y - fromSeg.start.y) ** 2,
    );
    const toEdgeLen = Math.sqrt(
      (toSeg.end.x - toSeg.start.x) ** 2 +
      (toSeg.end.y - toSeg.start.y) ** 2,
    );

    // Use intrinsic interpolation for non-degenerate edges,
    // fall back to linear lerp for degenerate ones (Finding 11 mitigation)
    if (fromEdgeLen < EPSILON && toEdgeLen < EPSILON) {
      // Both degenerate: linear lerp
      const end = lerpPoint(fromSeg.end, toSeg.end, t);
      const c1 = fromSeg.c1 && toSeg.c1 ? lerpPoint(fromSeg.c1, toSeg.c1, t) : null;
      const c2 = fromSeg.c2 && toSeg.c2 ? lerpPoint(fromSeg.c2, toSeg.c2, t) : null;
      result.push({ command: fromSeg.command, start: currentStart, end, c1, c2 });
      currentStart = end;
      continue;
    }

    // Intrinsic decomposition
    const fromIntrinsic = decomposeSegment(fromSeg.start, fromSeg.c1, fromSeg.c2, fromSeg.end);
    const toIntrinsic = decomposeSegment(toSeg.start, toSeg.c1, toSeg.c2, toSeg.end);

    // Interpolate and reconstruct
    const { c1, c2, end } = interpolateSegment(fromIntrinsic, toIntrinsic, t, currentStart);

    result.push({ command: fromSeg.command, start: currentStart, end, c1, c2 });
    currentStart = end;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lerpPoint(a: Point, b: Point, t: number): Point {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
  };
}

/**
 * Serialize interpolated segments back to an SVG path `d` string.
 * Preserves the original command types.
 */
export function serializeSegments(segments: PathSegmentData[]): string {
  const parts: string[] = [];

  for (const seg of segments) {
    switch (seg.command) {
      case 'M':
        parts.push(`M${fmt(seg.end.x)} ${fmt(seg.end.y)}`);
        break;
      case 'L':
        parts.push(`L${fmt(seg.end.x)} ${fmt(seg.end.y)}`);
        break;
      case 'H':
        parts.push(`H${fmt(seg.end.x)}`);
        break;
      case 'V':
        parts.push(`V${fmt(seg.end.y)}`);
        break;
      case 'C':
        if (seg.c1 && seg.c2) {
          parts.push(
            `C${fmt(seg.c1.x)} ${fmt(seg.c1.y)} ${fmt(seg.c2.x)} ${fmt(seg.c2.y)} ${fmt(seg.end.x)} ${fmt(seg.end.y)}`,
          );
        } else {
          parts.push(`L${fmt(seg.end.x)} ${fmt(seg.end.y)}`);
        }
        break;
      case 'Q':
        if (seg.c1) {
          parts.push(
            `Q${fmt(seg.c1.x)} ${fmt(seg.c1.y)} ${fmt(seg.end.x)} ${fmt(seg.end.y)}`,
          );
        } else {
          parts.push(`L${fmt(seg.end.x)} ${fmt(seg.end.y)}`);
        }
        break;
      case 'Z':
      case 'z':
        parts.push('Z');
        break;
      default:
        // Fallback: line to endpoint
        parts.push(`L${fmt(seg.end.x)} ${fmt(seg.end.y)}`);
        break;
    }
  }

  return parts.join('');
}

/** Format a number with up to 4 decimal places, trimming trailing zeros. */
function fmt(n: number): string {
  return Number(n.toFixed(4)).toString();
}
