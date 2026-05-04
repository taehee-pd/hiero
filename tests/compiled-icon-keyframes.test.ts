/**
 * #1 — compiled-icon keyframe path tests.
 *
 * Covers the three new surfaces:
 *   1. CompiledLayerBinding.morph.keyframes schema + validator
 *   2. exportCompiledIcon populates keyframes when V2 is on
 *   3. sampleKeyframes nearest-prior + linear-alpha lookup
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';

import { isCompiledLayerBinding } from '../lib/compiler-contracts';
import { exportCompiledIcon } from '../lib/export/export-compiled-icon';
import { sampleKeyframes } from '../lib/runtime-sdk/renderer';
import type { Project } from '../lib/schema/types';

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

describe('isCompiledLayerBinding (keyframes)', () => {
  test('accepts a binding with valid keyframes', () => {
    expect(
      isCompiledLayerBinding({
        morph: {
          topology: 'bestGuess',
          keyframes: [
            { t: 0, d: 'M0 0 L10 0', alpha: 1 },
            { t: 1, d: 'M0 0 L20 0', alpha: 1 },
          ],
        },
      }),
    ).toBe(true);
  });

  test('rejects keyframes whose t is out of [0,1]', () => {
    expect(
      isCompiledLayerBinding({
        morph: {
          topology: 'bestGuess',
          keyframes: [{ t: 1.5, d: '', alpha: 1 }],
        },
      }),
    ).toBe(false);
  });

  test('rejects keyframes with non-string d', () => {
    expect(
      isCompiledLayerBinding({
        morph: {
          topology: 'bestGuess',
          keyframes: [{ t: 0, d: 42, alpha: 1 }],
        },
      }),
    ).toBe(false);
  });

  test('accepts a binding without keyframes (legacy compile path)', () => {
    expect(
      isCompiledLayerBinding({ morph: { topology: 'strict' } }),
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Populator (V2-flag-gated)
// ---------------------------------------------------------------------------

function makeProjectWithMorph(): Project {
  return {
    version: '1.0',
    meta: {
      name: 'kf-fix',
      createdAt: '2026-04-01T00:00:00Z',
      updatedAt: '2026-04-01T00:00:00Z',
    },
    icons: {
      ic: {
        id: 'ic',
        name: 'Icon',
        variants: {
          va: {
            id: 'va',
            size: 24,
            viewBox: [0, 0, 24, 24],
            layers: {
              shape: {
                id: 'shape',
                path: { d: 'M0 0 L10 0 L10 10 L0 10 Z' },
                style: { fill: { mode: 'fixed', value: '#000' } },
                transform: { x: 0, y: 0 },
              },
            },
          },
          vb: {
            id: 'vb',
            size: 24,
            viewBox: [0, 0, 24, 24],
            layers: {
              shape: {
                id: 'shape',
                path: { d: 'M0 0 L20 0 L20 20 L0 20 Z' },
                style: { fill: { mode: 'fixed', value: '#000' } },
                transform: { x: 0, y: 0 },
              },
            },
          },
        },
        transitions: {
          activate: {
            id: 'activate',
            fromIconId: 'ic',
            toIconId: 'ic',
            fromVariantId: 'va',
            toVariantId: 'vb',
            from: 'default',
            to: 'active',
            strategy: 'auto',
            durationMs: 240,
            easing: 'ease-in-out',
            layerBindings: [
              {
                fromLayerId: 'shape',
                toLayerId: 'shape',
                morph: { topology: 'bestGuess' },
              },
            ],
          },
        },
      },
    },
  } as unknown as Project;
}

describe('buildCompiledTransitions (via exportCompiledIcon)', () => {
  const PRIOR = process.env.NEXT_PUBLIC_HIERO_RESOLVER_V2;
  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_HIERO_RESOLVER_V2;
  });
  afterEach(() => {
    if (PRIOR === undefined) {
      delete process.env.NEXT_PUBLIC_HIERO_RESOLVER_V2;
    } else {
      process.env.NEXT_PUBLIC_HIERO_RESOLVER_V2 = PRIOR;
    }
  });

  test('flag off: emits empty transitions array (legacy parity)', () => {
    const compiled = exportCompiledIcon(makeProjectWithMorph(), 'ic');
    expect(compiled.transitions).toEqual([]);
  });

  test('flag on: emits a transition with keyframes per binding', () => {
    process.env.NEXT_PUBLIC_HIERO_RESOLVER_V2 = '1';
    const compiled = exportCompiledIcon(makeProjectWithMorph(), 'ic');
    expect(compiled.transitions.length).toBe(1);
    const t = compiled.transitions[0]!;
    expect(t.from).toBe('va');
    expect(t.to).toBe('vb');
    expect(t.bindings.length).toBe(1);
    const binding = t.bindings[0]!;
    expect(binding.morph?.keyframes).toBeDefined();
    expect(binding.morph!.keyframes!.length).toBeGreaterThan(1);
    // Endpoints at t=0 and t=1.
    expect(binding.morph!.keyframes![0]!.t).toBe(0);
    expect(
      binding.morph!.keyframes![binding.morph!.keyframes!.length - 1]!.t,
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// SDK sampler
// ---------------------------------------------------------------------------

describe('sampleKeyframes', () => {
  const KFS = [
    { t: 0, d: 'M0 0', alpha: 1 },
    { t: 0.5, d: 'M5 5', alpha: 0 },
    { t: 1, d: 'M10 10', alpha: 1 },
  ];

  test('clamps to first keyframe at t <= 0', () => {
    expect(sampleKeyframes(KFS, -0.1)).toEqual({ d: 'M0 0', alpha: 1 });
    expect(sampleKeyframes(KFS, 0)).toEqual({ d: 'M0 0', alpha: 1 });
  });

  test('clamps to last keyframe at t >= 1', () => {
    expect(sampleKeyframes(KFS, 1)).toEqual({ d: 'M10 10', alpha: 1 });
    expect(sampleKeyframes(KFS, 1.5)).toEqual({ d: 'M10 10', alpha: 1 });
  });

  test('uses nearest-prior d at intermediate t', () => {
    // t=0.25 falls between (0, M0 0) and (0.5, M5 5) → uses M0 0
    expect(sampleKeyframes(KFS, 0.25).d).toBe('M0 0');
    // t=0.75 falls between (0.5, M5 5) and (1, M10 10) → uses M5 5
    expect(sampleKeyframes(KFS, 0.75).d).toBe('M5 5');
  });

  test('linearly interpolates alpha between adjacent keyframes', () => {
    // t=0.25: midway between alpha=1 and alpha=0 → 0.5
    expect(sampleKeyframes(KFS, 0.25).alpha).toBeCloseTo(0.5, 5);
    // t=0.75: midway between alpha=0 and alpha=1 → 0.5
    expect(sampleKeyframes(KFS, 0.75).alpha).toBeCloseTo(0.5, 5);
  });

  test('returns empty d on empty input', () => {
    expect(sampleKeyframes([], 0.5)).toEqual({ d: '', alpha: 1 });
  });
});
