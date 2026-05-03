import { describe, expect, test } from 'bun:test';

import {
  shouldWrapWithArap,
  triangulateContourTree,
  wrapWithArap,
} from '../lib/runtime-core/cascade-tiers/arap-wrap';
import { buildContourTree } from '../lib/runtime-core/contour-tree';
import { canonicalizePath } from '../lib/runtime-core/path-normalization';

const SQUARE = 'M0 0 L10 0 L10 10 L0 10 Z';
const STAR = 'M5 0 L6 4 L10 5 L6 6 L5 10 L4 6 L0 5 L4 4 Z';
const COMB = 'M0 10 L0 0 L2 0 L2 6 L4 6 L4 0 L6 0 L6 6 L8 6 L8 0 L10 0 L10 10 Z';

function tree(d: string) {
  return buildContourTree(canonicalizePath(d));
}

describe('shouldWrapWithArap', () => {
  test('returns false on a simple convex polygon', () => {
    expect(shouldWrapWithArap(tree(SQUARE))).toBe(false);
  });

  test('returns true on a non-convex contour with sharp turns', () => {
    // Star has 8 sharp boundary turns — well above the ≥5 threshold.
    expect(shouldWrapWithArap(tree(STAR))).toBe(true);
  });

  test('returns true on a comb-shaped contour', () => {
    expect(shouldWrapWithArap(tree(COMB))).toBe(true);
  });

  test('returns false for null tree', () => {
    expect(shouldWrapWithArap(null)).toBe(false);
  });
});

describe('triangulateContourTree', () => {
  test('triangulates a simple square into 2 triangles', () => {
    const triangles = triangulateContourTree(tree(SQUARE));
    expect(triangles.length).toBe(2);
  });

  test('triangulates a star into multiple triangles', () => {
    const triangles = triangulateContourTree(tree(STAR));
    // 8-pointed star → fan triangulation produces ≥ 6 triangles.
    expect(triangles.length).toBeGreaterThanOrEqual(6);
  });

  test('returns [] for an empty tree', () => {
    expect(triangulateContourTree(tree(''))).toEqual([]);
  });
});

describe('wrapWithArap', () => {
  // A baseline that linearly interpolates between two same-anchor-
  // count polylines. Our ARAP wrap should override this for
  // intermediate `t` and emit rotation-aware positions.
  function linearBaseline(fromD: string, toD: string) {
    const fromPts = parsePoints(fromD);
    const toPts = parsePoints(toD);
    return (t: number): string => {
      if (t <= 0) return fromD;
      if (t >= 1) return toD;
      const blended: string[] = ['M'];
      for (let i = 0; i < fromPts.length; i++) {
        const f = fromPts[i]!;
        const tp = toPts[i]!;
        const x = (1 - t) * f.x + t * tp.x;
        const y = (1 - t) * f.y + t * tp.y;
        if (i === 0) blended.push(`${x} ${y}`);
        else blended.push(`L${x} ${y}`);
      }
      blended.push('Z');
      return blended.join(' ');
    };
  }

  test('passes through baseline at t=0 and t=1', () => {
    const fromD = STAR;
    // Rotate the star 30° about its centroid (5, 5).
    const toD = rotateAroundCentroid(STAR, 5, 5, Math.PI / 6);
    const baseline = linearBaseline(fromD, toD);
    const wrapped = wrapWithArap(baseline, tree(fromD), tree(toD));
    expect(wrapped(0)).toBe(fromD);
    expect(wrapped(1)).toBe(toD);
  });

  test('mid-frame output diverges from pure-linear baseline on a rotation', () => {
    // Rotation of a non-convex shape is the canonical case: linear
    // per-vertex blending shrinks the shape mid-rotation; ARAP
    // preserves the rigid scale.
    const fromD = STAR;
    const toD = rotateAroundCentroid(STAR, 5, 5, Math.PI / 4); // 45°
    const baseline = linearBaseline(fromD, toD);
    const wrapped = wrapWithArap(baseline, tree(fromD), tree(toD));
    const linearMid = baseline(0.5);
    const arapMid = wrapped(0.5);
    // Different output strings — ARAP doesn't emit the linear blend.
    expect(arapMid).not.toBe(linearMid);

    // ARAP-mid should preserve the bounding box more faithfully
    // than the linear blend does. For a pure rotation the source
    // bbox area is conserved; linear blending shrinks it.
    const sourceArea = bboxArea(parsePoints(fromD));
    const linearArea = bboxArea(parsePoints(linearMid));
    const arapArea = bboxArea(parsePoints(arapMid));
    // Linear blending shrinks the shape mid-rotation; ARAP should
    // be closer to the source area than linear is.
    expect(Math.abs(arapArea - sourceArea)).toBeLessThan(
      Math.abs(linearArea - sourceArea),
    );
  });

  test('falls through to baseline when triangulation fails', () => {
    // Open subpath has no closed ring → triangulation returns [].
    const fromD = 'M0 0 L10 10';
    const toD = 'M0 0 L20 20';
    const baseline = linearBaseline(fromD, toD);
    const wrapped = wrapWithArap(baseline, tree(fromD), tree(toD));
    expect(wrapped(0.5)).toBe(baseline(0.5));
  });
});

function parsePoints(d: string): Array<{ x: number; y: number }> {
  const tokens = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:[eE][+-]?\d+)?/g) ?? [];
  const points: Array<{ x: number; y: number }> = [];
  let cursor = 0;
  while (cursor < tokens.length) {
    const cmd = tokens[cursor++]!;
    if (!/^[a-zA-Z]$/.test(cmd)) continue;
    if (cmd.toUpperCase() === 'M' || cmd.toUpperCase() === 'L') {
      while (
        cursor + 1 < tokens.length &&
        /^-?\d/.test(tokens[cursor]!) &&
        /^-?\d/.test(tokens[cursor + 1]!)
      ) {
        points.push({ x: +tokens[cursor]!, y: +tokens[cursor + 1]! });
        cursor += 2;
      }
    }
  }
  return points;
}

function rotateAroundCentroid(d: string, cx: number, cy: number, angle: number): string {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const points = parsePoints(d);
  const parts: string[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const dx = p.x - cx;
    const dy = p.y - cy;
    const x = cx + cos * dx - sin * dy;
    const y = cy + sin * dx + cos * dy;
    parts.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

function bboxArea(points: Array<{ x: number; y: number }>): number {
  if (points.length === 0) return 0;
  let minX = points[0]!.x;
  let minY = points[0]!.y;
  let maxX = minX;
  let maxY = minY;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return (maxX - minX) * (maxY - minY);
}
