/**
 * Unit tests for lib/editor-core/pointer-pan.ts
 *
 * Tests the pure `createPanAccumulator` and `shouldEndPan` functions
 * extracted from Canvas.tsx pointer event handlers. No DOM / rAF / component required.
 */
import { describe, expect, test } from 'bun:test';
import { createPanAccumulator, shouldEndPan } from '../lib/editor-core/pointer-pan';

// --- createPanAccumulator ---

describe('createPanAccumulator', () => {
  test('starts at zero', () => {
    const acc = createPanAccumulator();
    expect(acc.drain()).toEqual({ x: 0, y: 0 });
  });

  test('add() accumulates a single delta', () => {
    const acc = createPanAccumulator();
    acc.add(10, -5);
    expect(acc.drain()).toEqual({ x: 10, y: -5 });
  });

  test('add() sums multiple deltas', () => {
    const acc = createPanAccumulator();
    acc.add(3, 4);
    acc.add(-1, 2);
    acc.add(10, -6);
    expect(acc.drain()).toEqual({ x: 12, y: 0 });
  });

  test('drain() resets accumulator to zero', () => {
    const acc = createPanAccumulator();
    acc.add(7, 8);
    acc.drain();
    expect(acc.drain()).toEqual({ x: 0, y: 0 });
  });

  test('drain() returns total before resetting, then zero on next drain', () => {
    const acc = createPanAccumulator();
    acc.add(5, -3);
    const first = acc.drain();
    const second = acc.drain();
    expect(first).toEqual({ x: 5, y: -3 });
    expect(second).toEqual({ x: 0, y: 0 });
  });

  test('add() after drain() accumulates fresh', () => {
    const acc = createPanAccumulator();
    acc.add(1, 2);
    acc.drain();
    acc.add(9, -4);
    expect(acc.drain()).toEqual({ x: 9, y: -4 });
  });

  test('handles negative deltas correctly', () => {
    const acc = createPanAccumulator();
    acc.add(-100, -200);
    acc.add(50, 75);
    expect(acc.drain()).toEqual({ x: -50, y: -125 });
  });

  test('handles fractional (sub-pixel) deltas', () => {
    const acc = createPanAccumulator();
    acc.add(0.3, 0.7);
    acc.add(0.3, 0.7);
    const { x, y } = acc.drain();
    expect(x).toBeCloseTo(0.6);
    expect(y).toBeCloseTo(1.4);
  });
});

// --- shouldEndPan ---

describe('shouldEndPan', () => {
  test('returns false when session is null', () => {
    expect(shouldEndPan(null, undefined)).toBe(false);
    expect(shouldEndPan(null, 1)).toBe(false);
  });

  test('returns true when pointerId is undefined and session exists (blur/mouseup path)', () => {
    expect(shouldEndPan({ pointerId: 5 }, undefined)).toBe(true);
  });

  test('returns true when pointerId matches session pointerId', () => {
    expect(shouldEndPan({ pointerId: 3 }, 3)).toBe(true);
  });

  test('returns false when pointerId does not match session pointerId', () => {
    expect(shouldEndPan({ pointerId: 3 }, 7)).toBe(false);
  });

  test('returns false when session is null even with a matching-looking pointerId', () => {
    expect(shouldEndPan(null, 0)).toBe(false);
  });

  test('pointerId 0 matches session pointerId 0', () => {
    expect(shouldEndPan({ pointerId: 0 }, 0)).toBe(true);
  });

  test('pointerId 0 does not match session pointerId 1', () => {
    expect(shouldEndPan({ pointerId: 1 }, 0)).toBe(false);
  });
});
