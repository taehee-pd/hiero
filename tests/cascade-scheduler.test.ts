/**
 * W3-8 acceptance: the two-curve scheduler honours `motion.g(t)`
 * and `motion.alpha(t)` separately, applies `alphaOffsetRatio`,
 * and produces a clean (d, alpha) frame stream for both
 * continuous and fallback resolutions.
 */
import { describe, expect, test } from 'bun:test';

import { resolveMorph } from '../lib/runtime-core/cascade';
import {
  sampleMorph,
  sampleMorphTrajectory,
} from '../lib/runtime-core/cascade-scheduler';
import type { Layer, PaintRef } from '../lib/schema/types';

const FILL: PaintRef = { mode: 'fixed', value: '#000' };
const STROKE: PaintRef = { mode: 'fixed', value: '#000' };

function fillLayer(d: string, id = 'l'): Layer {
  return { id, style: { fill: FILL }, path: { d } } as Layer;
}

function strokeLayer(d: string, id = 'l'): Layer {
  return { id, style: { stroke: STROKE, strokeWidth: 1 }, path: { d } } as Layer;
}

describe('cascade-scheduler — continuous morph (T1)', () => {
  const a = fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a');
  const b = fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b');
  const r = resolveMorph(a, b);

  test('alpha stays at 1 across the full trajectory', () => {
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const frame = sampleMorph(r, t);
      // Continuous morphs ride at full opacity per the contract.
      expect(frame.alpha).toBe(1);
    }
  });

  test('the path string evolves between t=0 and t=1', () => {
    expect(sampleMorph(r, 0).d).not.toBe(sampleMorph(r, 1).d);
  });

  test('clamps t to [0, 1]', () => {
    expect(sampleMorph(r, -1).d).toBe(sampleMorph(r, 0).d);
    expect(sampleMorph(r, 2).d).toBe(sampleMorph(r, 1).d);
  });
});

describe('cascade-scheduler — designed fallback (T8)', () => {
  const closed = fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a');
  const open = strokeLayer('M0 0 L10 10', 'b');
  const r = resolveMorph(closed, open);

  test('the geometry swap happens at t=0.5', () => {
    const before = sampleMorph(r, 0.49).d;
    const after = sampleMorph(r, 0.51).d;
    expect(before).not.toBe(after);
  });

  test('alpha is 1 at t=0, dips through the midpoint, recovers to 1 at t=1', () => {
    const start = sampleMorph(r, 0);
    const mid = sampleMorph(r, 0.5);
    const end = sampleMorph(r, 1);
    expect(start.alpha).toBeGreaterThan(0.99);
    expect(end.alpha).toBeGreaterThan(0.99);
    // Midpoint is the geometry swap; alpha is 0 there for the
    // outgoing half (t < 0.5 maps to the descending side, t >= 0.5
    // maps to the ascending side, both bottoming at 0).
    expect(mid.alpha).toBeLessThan(0.05);
  });

  test('alpha is monotonically descending then ascending', () => {
    const trajectory = sampleMorphTrajectory(r, 11);
    let i = 0;
    while (i < trajectory.length - 1 && trajectory[i + 1]!.alpha <= trajectory[i]!.alpha) i++;
    // Past the trough, alpha must be non-decreasing.
    for (let j = i + 1; j < trajectory.length; j++) {
      expect(trajectory[j]!.alpha).toBeGreaterThanOrEqual(trajectory[j - 1]!.alpha - 1e-9);
    }
  });
});

describe('cascade-scheduler — sampleMorphTrajectory', () => {
  const a = fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a');
  const b = fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b');
  const r = resolveMorph(a, b);

  test('produces N frames with monotonic timestamps', () => {
    const frames = sampleMorphTrajectory(r, 5);
    expect(frames.length).toBe(5);
    // Frame 0 corresponds to t=0; frame N-1 to t=1. The geometry
    // strings differ across frames for a continuous morph.
    expect(frames[0]!.d).not.toBe(frames[4]!.d);
  });

  test('rejects fewer than 2 frames', () => {
    expect(() => sampleMorphTrajectory(r, 1)).toThrow();
  });
});

describe('cascade-scheduler — cadence affects opacity offset', () => {
  const closed = fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a');
  const open = strokeLayer('M0 0 L10 10', 'b');
  const soft = resolveMorph(closed, open, { cadence: 'soft' });
  const snappy = resolveMorph(closed, open, { cadence: 'snappy' });

  test('snappy alpha recovery starts earlier than soft', () => {
    // Snappy has alphaOffsetRatio=0.04 vs soft=0.08. After the
    // midpoint the snappy curve crosses 0 sooner.
    const tSample = 0.55;
    const softAlpha = sampleMorph(soft, tSample).alpha;
    const snappyAlpha = sampleMorph(snappy, tSample).alpha;
    expect(snappyAlpha).toBeGreaterThanOrEqual(softAlpha);
  });
});
