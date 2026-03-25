import { describe, expect, test } from 'bun:test';
import {
  cubicMonotoneInterpolate,
  WEIGHT_NUMERIC,
} from '@/lib/runtime-core/weight-interpolation';

/**
 * Tests for the data logic used by WeightCurveEditor (O5).
 * Verifies that the linear vs cubic comparison curves diverge
 * for 3+ control points, confirming the visual comparison is meaningful.
 */

function linearInterpolate(
  points: Array<{ x: number; y: number }>,
  x: number,
): number {
  if (points.length === 0) return 0;
  if (points.length === 1) return points[0]!.y;
  if (x <= points[0]!.x) return points[0]!.y;
  if (x >= points[points.length - 1]!.x) return points[points.length - 1]!.y;

  for (let i = 0; i < points.length - 1; i++) {
    if (x >= points[i]!.x && x <= points[i + 1]!.x) {
      const t = (x - points[i]!.x) / (points[i + 1]!.x - points[i]!.x);
      return points[i]!.y + t * (points[i + 1]!.y - points[i]!.y);
    }
  }
  return points[points.length - 1]!.y;
}

function extractFirstCoordinate(d: string): number | null {
  const re = /[a-zA-Z]\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/;
  const m = d.match(re);
  return m ? parseFloat(m[1]!) : null;
}

describe('WeightCurveEditor data logic', () => {
  test('extractFirstCoordinate extracts M command first value', () => {
    expect(extractFirstCoordinate('M10 20 L30 40')).toBe(10);
    expect(extractFirstCoordinate('M0 0')).toBe(0);
    expect(extractFirstCoordinate('m5.5 3.2')).toBe(5.5);
  });

  test('extractFirstCoordinate returns null for empty string', () => {
    expect(extractFirstCoordinate('')).toBe(null);
  });

  test('linear and cubic match at control points', () => {
    const points = [
      { x: WEIGHT_NUMERIC.light, y: 1 },
      { x: WEIGHT_NUMERIC.regular, y: 5 },
      { x: WEIGHT_NUMERIC.bold, y: 12 },
    ];

    for (const p of points) {
      expect(linearInterpolate(points, p.x)).toBe(p.y);
      expect(cubicMonotoneInterpolate(points, p.x)).toBe(p.y);
    }
  });

  test('cubic differs from linear at midpoints for 3+ points', () => {
    const points = [
      { x: WEIGHT_NUMERIC.ultralight, y: 1 },
      { x: WEIGHT_NUMERIC.regular, y: 8 },
      { x: WEIGHT_NUMERIC.black, y: 3 },
    ];

    const midX = (WEIGHT_NUMERIC.ultralight + WEIGHT_NUMERIC.regular) / 2;
    const linearY = linearInterpolate(points, midX);
    const cubicY = cubicMonotoneInterpolate(points, midX);

    // They should differ for non-linear data with 3+ points
    expect(Math.abs(cubicY - linearY)).toBeGreaterThan(0);
  });

  test('both methods clamp to endpoints outside range', () => {
    const points = [
      { x: WEIGHT_NUMERIC.light, y: 2 },
      { x: WEIGHT_NUMERIC.bold, y: 10 },
    ];

    expect(linearInterpolate(points, 50)).toBe(2);
    expect(linearInterpolate(points, 950)).toBe(10);
    expect(cubicMonotoneInterpolate(points, 50)).toBe(2);
    expect(cubicMonotoneInterpolate(points, 950)).toBe(10);
  });

  test('linear interpolation produces expected midpoint for 2 points', () => {
    const points = [
      { x: WEIGHT_NUMERIC.light, y: 0 },
      { x: WEIGHT_NUMERIC.bold, y: 8 },
    ];

    const mid = (WEIGHT_NUMERIC.light + WEIGHT_NUMERIC.bold) / 2;
    expect(linearInterpolate(points, mid)).toBe(4);
  });
});
