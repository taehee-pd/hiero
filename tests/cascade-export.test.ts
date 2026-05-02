/**
 * W4-1 + W4-2 acceptance: the export sampler emits keyframes the
 * Lottie / compiled-icon pipelines can consume; preview ≡ export
 * by construction (the same sampleMorph runs both).
 */
import { describe, expect, test } from 'bun:test';

import { resolveMorph } from '../lib/runtime-core/cascade';
import {
  sampleForCompiledIcon,
  sampleForExport,
  sampleForLottie,
} from '../lib/runtime-core/cascade-export';
import { sampleMorphTrajectory } from '../lib/runtime-core/cascade-scheduler';
import type { Layer, PaintRef } from '../lib/schema/types';

const FILL: PaintRef = { mode: 'fixed', value: '#000' };
const STROKE: PaintRef = { mode: 'fixed', value: '#000' };

function fillLayer(d: string, id = 'l'): Layer {
  return { id, style: { fill: FILL }, path: { d } } as Layer;
}

function strokeLayer(d: string, id = 'l'): Layer {
  return { id, style: { stroke: STROKE, strokeWidth: 1 }, path: { d } } as Layer;
}

describe('sampleForExport', () => {
  test('emits at least 2 keyframes for sensible fps + duration', () => {
    const r = resolveMorph(
      fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a'),
      fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b'),
    );
    const frames = sampleForExport(r, { fps: 30, durationMs: 300 });
    expect(frames.length).toBeGreaterThanOrEqual(2);
    expect(frames[0]!.t).toBe(0);
    expect(frames[frames.length - 1]!.t).toBe(1);
  });

  test('frameCount override wins over fps', () => {
    const r = resolveMorph(
      fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a'),
      fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b'),
    );
    const frames = sampleForExport(r, { frameCount: 16, durationMs: 1000 });
    expect(frames.length).toBe(16);
  });

  test('frameCount=1 floors at the 2-frame minimum', () => {
    const r = resolveMorph(
      fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a'),
      fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b'),
    );
    // computeFrameCount clamps to >= 2 — the cap matches the
    // sampleMorphTrajectory contract.
    const frames = sampleForExport(r, { frameCount: 1, durationMs: 100 });
    expect(frames.length).toBe(2);
  });

  test('preview ≡ export at matching frame counts (the parity invariant)', () => {
    const r = resolveMorph(
      fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a'),
      fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b'),
    );
    const previewFrames = sampleMorphTrajectory(r, 10);
    const exportFrames = sampleForExport(r, { frameCount: 10, durationMs: 1000 });
    for (let i = 0; i < 10; i++) {
      expect(exportFrames[i]!.d).toBe(previewFrames[i]!.d);
      expect(exportFrames[i]!.alpha).toBe(previewFrames[i]!.alpha);
    }
  });
});

describe('sampleForLottie / sampleForCompiledIcon', () => {
  test('Lottie default is 30 fps', () => {
    const r = resolveMorph(
      fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a'),
      fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b'),
    );
    const frames = sampleForLottie(r, 1000);
    // 30 fps × 1000ms = 30 frames + 1 endpoint = 31.
    expect(frames.length).toBe(31);
  });

  test('compiled-icon caps at 16 keyframes for compactness', () => {
    const r = resolveMorph(
      fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a'),
      fillLayer('M5 5 L15 5 L15 15 L5 15 Z', 'b'),
    );
    const frames = sampleForCompiledIcon(r, 1000);
    expect(frames.length).toBe(16);
  });

  test('designed-fallback exports the V-shaped alpha envelope', () => {
    const r = resolveMorph(
      fillLayer('M0 0 L10 0 L10 10 L0 10 Z', 'a'),
      strokeLayer('M0 0 L10 10', 'b'),
    );
    expect(r.tier).toBe('designed-fallback');
    const frames = sampleForCompiledIcon(r, 600);
    // Endpoints fully opaque.
    expect(frames[0]!.alpha).toBeGreaterThan(0.99);
    expect(frames[frames.length - 1]!.alpha).toBeGreaterThan(0.99);
    // Some frame near the midpoint of the sampled trajectory has a
    // very low alpha — the geometry-swap mask. We don't assert on
    // a specific frame index because sample spacing depends on
    // frameCount; instead find the minimum and check it's ≪ 0.5.
    const minAlpha = frames.reduce(
      (min, f) => Math.min(min, f.alpha),
      1,
    );
    expect(minAlpha).toBeLessThan(0.05);
  });
});
