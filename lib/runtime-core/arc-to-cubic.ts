/**
 * Arc-to-cubic-bezier conversion (Phase 8.1a).
 *
 * Converts SVG arc commands (A) to sequences of cubic bezier commands (C)
 * using the standard pi/4 arc segment approximation algorithm.
 *
 * The approach:
 * 1. Convert SVG endpoint parameterization to center parameterization
 * 2. Split the arc into segments of at most pi/4 (45 degrees)
 * 3. Approximate each segment with a cubic bezier curve
 *
 * @module
 */

type Point = { x: number; y: number };

type CubicSegment = {
  c1: Point;
  c2: Point;
  end: Point;
};

/**
 * Convert an SVG arc segment to one or more cubic bezier segments.
 *
 * @param start - Starting point of the arc
 * @param rx - X radius
 * @param ry - Y radius
 * @param xAxisRotation - Rotation in degrees
 * @param largeArcFlag - Large arc flag (0 or 1)
 * @param sweepFlag - Sweep flag (0 or 1)
 * @param end - End point of the arc
 * @returns Array of cubic bezier segments approximating the arc
 */
export function arcToCubicSegments(
  start: Point,
  rx: number,
  ry: number,
  xAxisRotation: number,
  largeArcFlag: number,
  sweepFlag: number,
  end: Point,
): CubicSegment[] {
  // Handle degenerate cases
  if (rx === 0 || ry === 0) {
    return [{ c1: { ...start }, c2: { ...end }, end: { ...end } }];
  }
  if (start.x === end.x && start.y === end.y) {
    return [];
  }

  // Ensure radii are positive
  rx = Math.abs(rx);
  ry = Math.abs(ry);

  const phi = (xAxisRotation * Math.PI) / 180;
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);

  // Step 1: Compute (x1', y1') — endpoint on unit circle
  const dx = (start.x - end.x) / 2;
  const dy = (start.y - end.y) / 2;
  const x1p = cosPhi * dx + sinPhi * dy;
  const y1p = -sinPhi * dx + cosPhi * dy;

  // Ensure radii are large enough
  const x1pSq = x1p * x1p;
  const y1pSq = y1p * y1p;
  let rxSq = rx * rx;
  let rySq = ry * ry;

  const radiiCheck = x1pSq / rxSq + y1pSq / rySq;
  if (radiiCheck > 1) {
    const scale = Math.sqrt(radiiCheck);
    rx *= scale;
    ry *= scale;
    rxSq = rx * rx;
    rySq = ry * ry;
  }

  // Step 2: Compute (cx', cy') — center on unit circle
  const numerator = Math.max(0, rxSq * rySq - rxSq * y1pSq - rySq * x1pSq);
  const denominator = rxSq * y1pSq + rySq * x1pSq;
  const sq = denominator === 0 ? 0 : Math.sqrt(numerator / denominator);
  const sign = largeArcFlag === sweepFlag ? -1 : 1;

  const cxp = sign * sq * ((rx * y1p) / ry);
  const cyp = sign * sq * ((-ry * x1p) / rx);

  // Step 3: Compute center point (cx, cy)
  const mx = (start.x + end.x) / 2;
  const my = (start.y + end.y) / 2;
  const cx = cosPhi * cxp - sinPhi * cyp + mx;
  const cy = sinPhi * cxp + cosPhi * cyp + my;

  // Step 4: Compute theta1 and dtheta
  const theta1 = angleBetween(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dtheta = angleBetween(
    (x1p - cxp) / rx,
    (y1p - cyp) / ry,
    (-x1p - cxp) / rx,
    (-y1p - cyp) / ry,
  );

  if (sweepFlag === 0 && dtheta > 0) {
    dtheta -= 2 * Math.PI;
  } else if (sweepFlag === 1 && dtheta < 0) {
    dtheta += 2 * Math.PI;
  }

  // Step 5: Split into segments of at most pi/4 and approximate each
  const segmentCount = Math.max(1, Math.ceil(Math.abs(dtheta) / (Math.PI / 4)));
  const segmentAngle = dtheta / segmentCount;
  const segments: CubicSegment[] = [];

  let currentAngle = theta1;
  let currentPoint = { ...start };

  for (let i = 0; i < segmentCount; i++) {
    const nextAngle = currentAngle + segmentAngle;
    const cubic = arcSegmentToCubic(
      cx,
      cy,
      rx,
      ry,
      phi,
      currentAngle,
      segmentAngle,
      currentPoint,
    );
    segments.push(cubic);
    currentAngle = nextAngle;
    currentPoint = cubic.end;
  }

  // Ensure the last point matches exactly
  if (segments.length > 0) {
    segments[segments.length - 1]!.end = { ...end };
  }

  return segments;
}

/**
 * Approximate a single arc segment (≤ pi/4) with a cubic bezier.
 */
function arcSegmentToCubic(
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  phi: number,
  theta: number,
  dtheta: number,
  startPoint: Point,
): CubicSegment {
  const alpha = (4 / 3) * Math.tan(dtheta / 4);
  const cosPhi_ = Math.cos(phi);
  const sinPhi_ = Math.sin(phi);

  const cosTheta1 = Math.cos(theta);
  const sinTheta1 = Math.sin(theta);
  const cosTheta2 = Math.cos(theta + dtheta);
  const sinTheta2 = Math.sin(theta + dtheta);

  // Control point 1
  const dx1 = -rx * sinTheta1;
  const dy1 = ry * cosTheta1;
  const c1x = startPoint.x + alpha * (cosPhi_ * dx1 - sinPhi_ * dy1);
  const c1y = startPoint.y + alpha * (sinPhi_ * dx1 + cosPhi_ * dy1);

  // End point
  const ex = cx + rx * cosTheta2 * cosPhi_ - ry * sinTheta2 * sinPhi_;
  const ey = cy + rx * cosTheta2 * sinPhi_ + ry * sinTheta2 * cosPhi_;

  // Control point 2
  const dx2 = -rx * sinTheta2;
  const dy2 = ry * cosTheta2;
  const c2x = ex - alpha * (cosPhi_ * dx2 - sinPhi_ * dy2);
  const c2y = ey - alpha * (sinPhi_ * dx2 + cosPhi_ * dy2);

  return {
    c1: { x: c1x, y: c1y },
    c2: { x: c2x, y: c2y },
    end: { x: ex, y: ey },
  };
}

/**
 * Compute the angle (in radians) between two vectors.
 */
function angleBetween(ux: number, uy: number, vx: number, vy: number): number {
  const dot = ux * vx + uy * vy;
  const cross = ux * vy - uy * vx;
  const lenU = Math.sqrt(ux * ux + uy * uy);
  const lenV = Math.sqrt(vx * vx + vy * vy);
  const denom = lenU * lenV;
  if (denom === 0) return 0;
  const cosAngle = Math.max(-1, Math.min(1, dot / denom));
  const angle = Math.acos(cosAngle);
  return cross < 0 ? -angle : angle;
}
