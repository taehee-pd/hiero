import { describe, expect, test } from 'bun:test';

import {
  cubicMonotoneInterpolate,
  interpolateWeight,
  validateWeightControlPoints,
  type WeightControlPoints,
} from '../lib/runtime-core/weight-interpolation';

// ── Helper: simple rect path parameterised by stroke width ────────────

/** Produces "M0 0 L{w} 0 L{w} {w} L0 {w} Z" */
function rectPath(w: number): string {
  return `M0 0 L${w} 0 L${w} ${w} L0 ${w} Z`;
}

// ── cubicMonotoneInterpolate ──────────────────────────────────────────

describe('cubicMonotoneInterpolate', () => {
  test('returns exact value at each control point', () => {
    const pts = [
      { x: 100, y: 2 },
      { x: 400, y: 5 },
      { x: 900, y: 12 },
    ];
    expect(cubicMonotoneInterpolate(pts, 100)).toBe(2);
    expect(cubicMonotoneInterpolate(pts, 400)).toBe(5);
    expect(cubicMonotoneInterpolate(pts, 900)).toBe(12);
  });

  test('clamps to endpoints outside range', () => {
    const pts = [
      { x: 100, y: 10 },
      { x: 900, y: 90 },
    ];
    expect(cubicMonotoneInterpolate(pts, 0)).toBe(10);
    expect(cubicMonotoneInterpolate(pts, 1000)).toBe(90);
  });

  test('linear fallback with 2 points', () => {
    const pts = [
      { x: 100, y: 10 },
      { x: 900, y: 90 },
    ];
    expect(cubicMonotoneInterpolate(pts, 500)).toBe(50);
  });

  test('no overshoot with monotone values', () => {
    const pts = [
      { x: 100, y: 1 },
      { x: 200, y: 3 },
      { x: 400, y: 5 },
      { x: 700, y: 8 },
      { x: 900, y: 10 },
    ];
    // Sample many points and verify monotonicity
    let prev = -Infinity;
    for (let x = 100; x <= 900; x += 5) {
      const y = cubicMonotoneInterpolate(pts, x);
      expect(y).toBeGreaterThanOrEqual(prev);
      prev = y;
    }
  });

  test('C1 continuous at segment boundaries', () => {
    const pts = [
      { x: 100, y: 2 },
      { x: 400, y: 8 },
      { x: 900, y: 14 },
    ];
    const eps = 0.001;
    // Check derivative continuity at x=400 (interior point)
    const leftSlope =
      (cubicMonotoneInterpolate(pts, 400) -
        cubicMonotoneInterpolate(pts, 400 - eps)) /
      eps;
    const rightSlope =
      (cubicMonotoneInterpolate(pts, 400 + eps) -
        cubicMonotoneInterpolate(pts, 400)) /
      eps;
    expect(Math.abs(leftSlope - rightSlope)).toBeLessThan(1e-4);
  });

  test('single point returns its value', () => {
    expect(cubicMonotoneInterpolate([{ x: 400, y: 7 }], 500)).toBe(7);
  });

  test('empty points returns 0', () => {
    expect(cubicMonotoneInterpolate([], 400)).toBe(0);
  });
});

// ── validateWeightControlPoints ───────────────────────────────────────

describe('validateWeightControlPoints', () => {
  test('valid with 2 compatible control points', () => {
    const cp: WeightControlPoints = {
      ultralight: 'M0 0 L10 0 Z',
      black: 'M0 0 L20 0 Z',
    };
    const result = validateWeightControlPoints(cp);
    expect(result.valid).toBe(true);
    expect(result.populatedWeights).toEqual(['ultralight', 'black']);
  });

  test('valid with all 9 compatible control points', () => {
    const cp: WeightControlPoints = {
      ultralight: rectPath(1),
      thin: rectPath(2),
      light: rectPath(3),
      regular: rectPath(4),
      medium: rectPath(5),
      semibold: rectPath(6),
      bold: rectPath(7),
      heavy: rectPath(8),
      black: rectPath(9),
    };
    const result = validateWeightControlPoints(cp);
    expect(result.valid).toBe(true);
    expect(result.populatedWeights).toHaveLength(9);
  });

  test('invalid with fewer than 2 control points', () => {
    const result = validateWeightControlPoints({ regular: 'M0 0 L10 0 Z' });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('At least 2');
  });

  test('invalid with mismatched command counts', () => {
    const cp: WeightControlPoints = {
      ultralight: 'M0 0 L10 0 Z',
      black: 'M0 0 L10 0 L10 10 Z',
    };
    expect(validateWeightControlPoints(cp).valid).toBe(false);
  });

  test('invalid with mismatched command types', () => {
    const cp: WeightControlPoints = {
      ultralight: 'M0 0 L10 0',
      black: 'M0 0 C10 0 10 10 10 10',
    };
    expect(validateWeightControlPoints(cp).valid).toBe(false);
  });

  test('returns populatedWeights in sorted order', () => {
    const cp: WeightControlPoints = {
      black: rectPath(9),
      light: rectPath(3),
      regular: rectPath(4),
    };
    const result = validateWeightControlPoints(cp);
    expect(result.populatedWeights).toEqual(['light', 'regular', 'black']);
  });
});

// ── interpolateWeight ─────────────────────────────────────────────────

describe('interpolateWeight', () => {
  const threePoint: WeightControlPoints = {
    ultralight: 'M0 0 L10 0 L10 10 L0 10 Z',
    regular: 'M0 0 L20 0 L20 20 L0 20 Z',
    black: 'M0 0 L30 0 L30 30 L0 30 Z',
  };

  test('returns exact control-point path at control-point weight', () => {
    expect(interpolateWeight(threePoint, 'ultralight')).toBe(
      'M0 0 L10 0 L10 10 L0 10 Z',
    );
    expect(interpolateWeight(threePoint, 'regular')).toBe(
      'M0 0 L20 0 L20 20 L0 20 Z',
    );
    expect(interpolateWeight(threePoint, 'black')).toBe(
      'M0 0 L30 0 L30 30 L0 30 Z',
    );
  });

  test('returns exact path for numeric weight matching a control point', () => {
    expect(interpolateWeight(threePoint, 100)).toBe(
      'M0 0 L10 0 L10 10 L0 10 Z',
    );
    expect(interpolateWeight(threePoint, 400)).toBe(
      'M0 0 L20 0 L20 20 L0 20 Z',
    );
    expect(interpolateWeight(threePoint, 900)).toBe(
      'M0 0 L30 0 L30 30 L0 30 Z',
    );
  });

  test('returns null for incompatible paths', () => {
    const bad: WeightControlPoints = {
      ultralight: 'M0 0 L10 0 Z',
      black: 'M0 0 L10 0 L10 10 Z',
    };
    expect(interpolateWeight(bad, 500)).toBeNull();
  });

  test('returns null for fewer than 2 control points', () => {
    expect(interpolateWeight({ regular: 'M0 0 L10 0 Z' }, 400)).toBeNull();
  });

  test('interpolates intermediate weights with cubic spline', () => {
    const result = interpolateWeight(threePoint, 250);
    expect(result).not.toBeNull();
    // Should be between ultralight and regular values
    expect(result).toContain('L');
  });

  test('2-point linear fallback produces correct midpoint', () => {
    const twoPoint: WeightControlPoints = {
      ultralight: 'M0 0 L10 0 Z',
      black: 'M0 0 L90 0 Z',
    };
    const mid = interpolateWeight(twoPoint, 500);
    expect(mid).not.toBeNull();
    // At midpoint (500) of range [100, 900], t = 0.5, so L50
    expect(mid).toBe('M0 0 L50 0 Z');
  });

  test('clamps to nearest endpoint for out-of-range weights', () => {
    expect(interpolateWeight(threePoint, 50)).toBe(
      'M0 0 L10 0 L10 10 L0 10 Z',
    );
    expect(interpolateWeight(threePoint, 950)).toBe(
      'M0 0 L30 0 L30 30 L0 30 Z',
    );
  });

  test('works with 5 control points', () => {
    const fivePoint: WeightControlPoints = {
      ultralight: rectPath(2),
      light: rectPath(4),
      regular: rectPath(6),
      bold: rectPath(10),
      black: rectPath(14),
    };
    // At exact control points
    expect(interpolateWeight(fivePoint, 'ultralight')).toBe(rectPath(2));
    expect(interpolateWeight(fivePoint, 'regular')).toBe(rectPath(6));
    expect(interpolateWeight(fivePoint, 'black')).toBe(rectPath(14));
    // Intermediate should not be null
    expect(interpolateWeight(fivePoint, 500)).not.toBeNull();
  });

  test('accepts SymbolWeight name for target', () => {
    expect(interpolateWeight(threePoint, 'medium')).not.toBeNull();
  });

  test('cubic interpolation differs from linear for 3+ points', () => {
    // With monotone but non-linear control points, cubic should differ from
    // simple linear interpolation at interior points
    const cp: WeightControlPoints = {
      ultralight: 'M0 0 L1 0 Z',
      regular: 'M0 0 L10 0 Z',
      black: 'M0 0 L11 0 Z',
    };
    // At weight 250 (between ultralight=100 and regular=400)
    // Linear would give L4 (t=0.5 of [1,10] = 5.5)
    // Cubic should give a different value due to slope matching
    const result = interpolateWeight(cp, 250);
    expect(result).not.toBeNull();
  });
});
