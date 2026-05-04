/**
 * W4-8 acceptance: serialised timing override resolves to runtime
 * MotionCurves; malformed payloads are rejected at the schema lint.
 */
import { describe, expect, test } from 'bun:test';

import {
  isValidTimingOverride,
  resolveTimingOverride,
} from '../lib/runtime-core/timing-override';

describe('resolveTimingOverride', () => {
  test('resolves named easings into runtime curves', () => {
    const m = resolveTimingOverride({
      g: 'ease-in-out',
      alpha: 'ease-out-cubic',
      alphaOffsetRatio: 0.05,
    });
    expect(typeof m.g).toBe('function');
    expect(typeof m.alpha).toBe('function');
    expect(m.alphaOffsetRatio).toBe(0.05);
  });

  test('falls back to 0.08 alpha offset when missing', () => {
    const m = resolveTimingOverride({ g: 'linear', alpha: 'linear' });
    expect(m.alphaOffsetRatio).toBe(0.08);
  });

  test('clamps absurd alpha offsets back to the 0.08 default', () => {
    const m = resolveTimingOverride({
      g: 'linear',
      alpha: 'linear',
      alphaOffsetRatio: 0.95,
    });
    expect(m.alphaOffsetRatio).toBe(0.08);
  });
});

describe('isValidTimingOverride', () => {
  test('accepts well-formed named overrides', () => {
    expect(
      isValidTimingOverride({ g: 'ease-in-out', alpha: 'ease-out-cubic' }),
    ).toBe(true);
  });

  test('accepts parametric cubic-bezier easings', () => {
    expect(
      isValidTimingOverride({
        g: 'cubic-bezier(0.4, 0, 0.2, 1)',
        alpha: 'cubic-bezier(0.0, 0, 0.2, 1)',
      }),
    ).toBe(true);
  });

  test('accepts parametric steps easings', () => {
    expect(isValidTimingOverride({ g: 'steps(5, start)', alpha: 'steps(3)' })).toBe(true);
  });

  test('rejects empty easing strings', () => {
    expect(isValidTimingOverride({ g: '', alpha: 'ease-out' })).toBe(false);
  });

  test('rejects unknown named easings (W4 audit §8: no silent linear fallback)', () => {
    expect(
      isValidTimingOverride({ g: 'ease-in-cubicc', alpha: 'ease-out' }),
    ).toBe(false);
    expect(
      isValidTimingOverride({ g: 'ease-out', alpha: 'mystery-curve' }),
    ).toBe(false);
  });

  test('rejects malformed parametric easings', () => {
    expect(
      isValidTimingOverride({ g: 'cubic-bezier(0.4)', alpha: 'ease-out' }),
    ).toBe(false);
    expect(
      isValidTimingOverride({ g: 'steps()', alpha: 'ease-out' }),
    ).toBe(false);
  });

  test('rejects out-of-range alpha offsets', () => {
    expect(
      isValidTimingOverride({
        g: 'ease-in-out',
        alpha: 'ease-out-cubic',
        alphaOffsetRatio: -0.1,
      }),
    ).toBe(false);
    expect(
      isValidTimingOverride({
        g: 'ease-in-out',
        alpha: 'ease-out-cubic',
        alphaOffsetRatio: 0.6,
      }),
    ).toBe(false);
  });

  test('rejects non-object inputs', () => {
    expect(isValidTimingOverride(null)).toBe(false);
    expect(isValidTimingOverride(42)).toBe(false);
    expect(isValidTimingOverride('ease-in-out')).toBe(false);
  });
});
