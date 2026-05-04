import { describe, expect, test } from 'bun:test';

import {
  alphaProgress,
  defaultMotionCurves,
  geometryProgress,
  withCustomCurves,
} from '../lib/runtime-core/motion-curves';

describe('motion-curves', () => {
  test('soft is the default cadence', () => {
    const soft = defaultMotionCurves();
    const explicit = defaultMotionCurves('soft');
    expect(soft.alphaOffsetRatio).toBe(0.08);
    expect(explicit.alphaOffsetRatio).toBe(0.08);
    expect(soft.g(0.5)).toBeCloseTo(explicit.g(0.5), 12);
  });

  test('snappy has a tighter alpha offset than soft', () => {
    const soft = defaultMotionCurves('soft');
    const snappy = defaultMotionCurves('snappy');
    expect(snappy.alphaOffsetRatio).toBeLessThan(soft.alphaOffsetRatio);
    expect(snappy.alphaOffsetRatio).toBe(0.04);
  });

  test('geometryProgress clamps t into [0, 1]', () => {
    const curves = defaultMotionCurves();
    expect(geometryProgress(curves, -1)).toBe(0);
    expect(geometryProgress(curves, 0)).toBe(0);
    expect(geometryProgress(curves, 1)).toBe(1);
    expect(geometryProgress(curves, 2)).toBe(1);
  });

  test('alphaProgress is zero before the offset and reaches 1 at t=1', () => {
    const curves = defaultMotionCurves('soft');
    expect(alphaProgress(curves, 0)).toBe(0);
    expect(alphaProgress(curves, 0.05)).toBe(0); // before the 0.08 offset
    expect(alphaProgress(curves, 1)).toBeCloseTo(1, 6);
  });

  test('alphaProgress with zero offset matches alpha curve directly', () => {
    const curves = withCustomCurves(
      (t) => t,
      (t) => t,
      0,
    );
    expect(alphaProgress(curves, 0.3)).toBeCloseTo(0.3, 12);
    expect(alphaProgress(curves, 0.7)).toBeCloseTo(0.7, 12);
  });

  test('alphaProgress caps absurd offsets at 0.5', () => {
    const curves = withCustomCurves(
      (t) => t,
      (t) => t,
      0.95, // user-supplied nonsense
    );
    // capped to 0.5; alpha at t=0.6 → (0.6 - 0.5) / 0.5 = 0.2
    expect(alphaProgress(curves, 0.6)).toBeCloseTo(0.2, 12);
  });

  test('withCustomCurves passes through to the scheduler unchanged', () => {
    const curves = withCustomCurves(
      (t) => t * t,
      (t) => Math.sqrt(t),
      0.1,
    );
    expect(curves.g(0.5)).toBeCloseTo(0.25, 12);
    expect(curves.alpha(0.25)).toBeCloseTo(0.5, 12);
    expect(curves.alphaOffsetRatio).toBe(0.1);
  });

  test('non-finite inputs degrade to 0 / 0', () => {
    const curves = defaultMotionCurves();
    expect(geometryProgress(curves, Number.NaN)).toBe(0);
    expect(alphaProgress(curves, Number.NaN)).toBe(0);
  });
});
