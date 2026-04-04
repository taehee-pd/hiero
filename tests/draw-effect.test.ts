import { describe, test, expect } from 'bun:test';
import {
  isPathFullyOpen,
  hasOpenSubpath,
  isStrokedLayer,
  isDrawEligible,
  filterDrawEligibleLayers,
} from '@/lib/runtime-core/open-path-guard';
import { computeTrimValues } from '@/lib/runtime-core/draw-executor';
import type { Layer } from '@/lib/schema/types';

// ---------------------------------------------------------------------------
// Open-Path Guard Tests
// ---------------------------------------------------------------------------

describe('isPathFullyOpen', () => {
  test('returns true for open path without Z', () => {
    expect(isPathFullyOpen('M 0 0 L 10 10 L 20 0')).toBe(true);
  });

  test('returns false for closed path with Z', () => {
    expect(isPathFullyOpen('M 0 0 L 10 10 L 20 0 Z')).toBe(false);
  });

  test('returns false for closed path with lowercase z', () => {
    expect(isPathFullyOpen('M 0 0 L 10 10 L 20 0 z')).toBe(false);
  });

  test('returns false for empty string', () => {
    expect(isPathFullyOpen('')).toBe(false);
  });

  test('returns false for whitespace-only string', () => {
    expect(isPathFullyOpen('   ')).toBe(false);
  });

  test('returns true for multi-subpath open path', () => {
    expect(isPathFullyOpen('M 0 0 L 10 10 M 20 20 L 30 30')).toBe(true);
  });

  test('returns false for mixed open/closed subpaths', () => {
    expect(isPathFullyOpen('M 0 0 L 10 10 Z M 20 20 L 30 30')).toBe(false);
  });

  test('returns true for visually-closed path without Z command', () => {
    // Path goes back to origin but has no Z — treated as open (syntactic check)
    expect(isPathFullyOpen('M 0 0 L 10 0 L 10 10 L 0 10 L 0 0')).toBe(true);
  });
});

describe('hasOpenSubpath', () => {
  test('returns true when at least one subpath is open', () => {
    expect(hasOpenSubpath('M 0 0 L 10 10 Z M 20 20 L 30 30')).toBe(true);
  });

  test('returns false when all subpaths are closed', () => {
    expect(hasOpenSubpath('M 0 0 L 10 10 Z M 20 20 L 30 30 Z')).toBe(false);
  });

  test('returns true for single open path', () => {
    expect(hasOpenSubpath('M 0 0 L 10 10')).toBe(true);
  });

  test('returns false for empty string', () => {
    expect(hasOpenSubpath('')).toBe(false);
  });
});

describe('isStrokedLayer', () => {
  test('returns true for layer with stroke and positive width', () => {
    const layer: Layer = {
      id: 'test',
      style: {
        stroke: { mode: 'fixed', value: '#000' },
        strokeWidth: 2,
      },
    };
    expect(isStrokedLayer(layer)).toBe(true);
  });

  test('returns false for layer without stroke', () => {
    const layer: Layer = {
      id: 'test',
      style: { fill: { mode: 'fixed', value: '#000' } },
    };
    expect(isStrokedLayer(layer)).toBe(false);
  });

  test('returns false for layer with stroke but zero width', () => {
    const layer: Layer = {
      id: 'test',
      style: {
        stroke: { mode: 'fixed', value: '#000' },
        strokeWidth: 0,
      },
    };
    expect(isStrokedLayer(layer)).toBe(false);
  });

  test('returns false for stroke value "none"', () => {
    const layer: Layer = {
      id: 'test',
      style: {
        stroke: { mode: 'fixed', value: 'none' },
        strokeWidth: 2,
      },
    };
    expect(isStrokedLayer(layer)).toBe(false);
  });

  test('returns true for layer with stroke but undefined width (SVG default is 1)', () => {
    const layer: Layer = {
      id: 'test',
      style: {
        stroke: { mode: 'fixed', value: '#000' },
      },
    };
    // SVG spec: strokeWidth defaults to 1 when unset
    expect(isStrokedLayer(layer)).toBe(true);
  });
});

describe('isDrawEligible', () => {
  test('returns true for open stroked path', () => {
    const layer: Layer = {
      id: 'test',
      path: { d: 'M 0 0 L 10 10 L 20 0' },
      style: {
        stroke: { mode: 'fixed', value: '#000' },
        strokeWidth: 2,
      },
    };
    expect(isDrawEligible(layer)).toBe(true);
  });

  test('returns false for closed path', () => {
    const layer: Layer = {
      id: 'test',
      path: { d: 'M 0 0 L 10 10 L 20 0 Z' },
      style: {
        stroke: { mode: 'fixed', value: '#000' },
        strokeWidth: 2,
      },
    };
    expect(isDrawEligible(layer)).toBe(false);
  });

  test('returns false for fill-only open path', () => {
    const layer: Layer = {
      id: 'test',
      path: { d: 'M 0 0 L 10 10 L 20 0' },
      style: {
        fill: { mode: 'fixed', value: '#000' },
      },
    };
    expect(isDrawEligible(layer)).toBe(false);
  });

  test('returns false for layer without path', () => {
    const layer: Layer = {
      id: 'test',
      style: {
        stroke: { mode: 'fixed', value: '#000' },
        strokeWidth: 2,
      },
    };
    expect(isDrawEligible(layer)).toBe(false);
  });
});

describe('filterDrawEligibleLayers', () => {
  const layers: Record<string, Layer> = {
    openStroked: {
      id: 'openStroked',
      path: { d: 'M 0 0 L 10 10' },
      style: { stroke: { mode: 'fixed', value: '#000' }, strokeWidth: 2 },
    },
    closedStroked: {
      id: 'closedStroked',
      path: { d: 'M 0 0 L 10 10 Z' },
      style: { stroke: { mode: 'fixed', value: '#000' }, strokeWidth: 2 },
    },
    openFilled: {
      id: 'openFilled',
      path: { d: 'M 0 0 L 10 10' },
      style: { fill: { mode: 'fixed', value: '#000' } },
    },
  };

  test('returns only eligible layers', () => {
    expect(filterDrawEligibleLayers(layers)).toEqual(['openStroked']);
  });

  test('respects layerIds filter', () => {
    expect(filterDrawEligibleLayers(layers, ['closedStroked', 'openStroked'])).toEqual(['openStroked']);
  });

  test('returns empty array when no layers are eligible', () => {
    expect(filterDrawEligibleLayers(layers, ['closedStroked', 'openFilled'])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Draw Effect Trim Value Tests
// ---------------------------------------------------------------------------

describe('draw effect trim values', () => {
  test('reveal mode: trimEnd progresses from 0 to 1', () => {
    // At t=0: nothing visible (trimEnd=0)
    const atZero = computeTrimValues(0, 0, 0, 100);
    expect(parseFloat(atZero.dashArray.split(' ')[0]!)).toBe(0);

    // At t=0.5: half visible (trimEnd=0.5)
    const atHalf = computeTrimValues(0, 0.5, 0, 100);
    expect(parseFloat(atHalf.dashArray.split(' ')[0]!)).toBe(50);

    // At t=1: fully visible (trimEnd=1)
    const atOne = computeTrimValues(0, 1, 0, 100);
    expect(parseFloat(atOne.dashArray.split(' ')[0]!)).toBe(100);
  });

  test('erase mode: trimStart progresses from 0 to 1', () => {
    // At t=0: fully visible (trimStart=0, trimEnd=1)
    const atZero = computeTrimValues(0, 1, 0, 100);
    expect(parseFloat(atZero.dashArray.split(' ')[0]!)).toBe(100);

    // At t=0.5: half visible (trimStart=0.5, trimEnd=1)
    const atHalf = computeTrimValues(0.5, 1, 0, 100);
    expect(parseFloat(atHalf.dashArray.split(' ')[0]!)).toBe(50);

    // At t=1: nothing visible (trimStart=1, trimEnd=1)
    const atOne = computeTrimValues(1, 1, 0, 100);
    expect(parseFloat(atOne.dashArray.split(' ')[0]!)).toBe(0);
  });

  test('slide mode: fixed window moves along path', () => {
    const windowSize = 0.2;
    const t = 0.5;
    const trimStart = t * (1 - windowSize); // 0.4
    const trimEnd = trimStart + windowSize;  // 0.6

    const result = computeTrimValues(trimStart, trimEnd, 0, 100);
    expect(parseFloat(result.dashArray.split(' ')[0]!)).toBeCloseTo(20, 4); // 20% of 100
  });

  test('trim offset rotates visible window', () => {
    const result = computeTrimValues(0, 0.5, 0.25, 100);
    // Visible length should be 50 (0.5 * 100)
    expect(parseFloat(result.dashArray.split(' ')[0]!)).toBe(50);
    // Offset should account for the 0.25 offset: -(0 + 0.25) * 100 = -25
    expect(parseFloat(result.dashOffset)).toBe(-25);
  });
});

// ---------------------------------------------------------------------------
// Intrinsic Interpolation Tests
// ---------------------------------------------------------------------------

describe('intrinsic interpolation', () => {
  const {
    decomposePolar,
    reconstructFromPolar,
    angleLerp,
    decomposeHandle,
    reconstructHandle,
  } = require('@/lib/runtime-core/intrinsic-interpolation');

  test('decomposePolar and reconstructFromPolar are inverses', () => {
    const start = { x: 10, y: 20 };
    const end = { x: 30, y: 40 };
    const polar = decomposePolar(start, end);
    const reconstructed = reconstructFromPolar(start, polar);
    expect(reconstructed.x).toBeCloseTo(end.x, 4);
    expect(reconstructed.y).toBeCloseTo(end.y, 4);
  });

  test('angleLerp uses shortest arc', () => {
    // From 170° to -170° should go through 180°, not through 0°
    const a = (170 * Math.PI) / 180;
    const b = (-170 * Math.PI) / 180;
    const mid = angleLerp(a, b, 0.5);
    // Midpoint should be near ±180°
    expect(Math.abs(Math.abs(mid) - Math.PI)).toBeLessThan(0.01);
  });

  test('angleLerp at t=0 returns start angle', () => {
    const result = angleLerp(0.5, 1.5, 0);
    expect(result).toBeCloseTo(0.5, 6);
  });

  test('angleLerp at t=1 returns end angle', () => {
    const result = angleLerp(0.5, 1.5, 1);
    expect(result).toBeCloseTo(1.5, 6);
  });

  test('decomposeHandle and reconstructHandle are inverses', () => {
    const point = { x: 5, y: 8 };
    const chordStart = { x: 0, y: 0 };
    const chordEnd = { x: 10, y: 0 };

    const intrinsic = decomposeHandle(point, chordStart, chordEnd);
    const reconstructed = reconstructHandle(intrinsic, chordStart, chordEnd);

    expect(reconstructed.x).toBeCloseTo(point.x, 4);
    expect(reconstructed.y).toBeCloseTo(point.y, 4);
  });

  test('decomposeHandle handles degenerate chord', () => {
    const point = { x: 5, y: 3 };
    const degenerate = { x: 0, y: 0 };
    const intrinsic = decomposeHandle(point, degenerate, degenerate);
    expect(intrinsic.magnitude).toBeCloseTo(Math.sqrt(25 + 9), 4);
  });
});

// ---------------------------------------------------------------------------
// Auto Morph Tests
// ---------------------------------------------------------------------------

describe('autoMorph', () => {
  const { autoMorph } = require('@/lib/runtime-core/auto-morph');

  test('identity: returns identity strategy for identical paths', () => {
    const result = autoMorph('M 0 0 L 10 10', 'M 0 0 L 10 10');
    expect(result).not.toBeNull();
    expect(result!.selectedStrategy).toBe('identity');
    expect(result!.interpolator(0.5)).toBe('M 0 0 L 10 10');
  });

  test('intrinsicStrict: selected for identical command signatures', () => {
    const result = autoMorph('M 0 0 L 10 0 L 10 10 Z', 'M 5 5 L 15 5 L 15 15 Z');
    expect(result).not.toBeNull();
    expect(result!.selectedStrategy).toBe('intrinsicStrict');
  });

  test('intrinsicStrict: interpolator returns source at t=0 and target at t=1', () => {
    const from = 'M 0 0 L 10 0 L 10 10 Z';
    const to = 'M 5 5 L 15 5 L 15 15 Z';
    const result = autoMorph(from, to);
    expect(result!.interpolator(0)).toBe(from);
    expect(result!.interpolator(1)).toBe(to);
  });

  test('bestGuess: selected for same topology with different segment counts', () => {
    const from = 'M 0 0 C 5 0 10 5 10 10 Z';
    const to = 'M 0 0 C 3 0 7 3 10 10 C 10 7 7 0 0 0 Z';
    const result = autoMorph(from, to);
    expect(result).not.toBeNull();
    // Should select either bestGuess or pointSampled depending on readiness
    expect(['bestGuess', 'pointSampled']).toContain(result!.selectedStrategy);
  });

  test('handles degenerate paths gracefully', () => {
    // Empty paths should return identity or null
    const result = autoMorph('', '');
    // Either null or identity is acceptable for empty paths
    if (result) {
      expect(result.selectedStrategy).toBe('identity');
    }
  });
});
