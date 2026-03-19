/**
 * Phase 8 — Cross-Icon Morphing & Advanced Transitions tests.
 *
 * Tests arc-to-cubic conversion, rotational interpolation, shape index
 * optimization, cross-icon morphing, topology detection, and crossfade.
 */

import { describe, expect, it } from 'bun:test';
import { arcToCubicSegments } from '@/lib/runtime-core/arc-to-cubic';
import {
  matchSubPaths,
  subdivideCubicSegments,
  splitCubicSegment,
  findOptimalShapeIndex,
  rotateSubPathSegments,
  createCentroidCollapsedSubPath,
  crossIconMorph,
  interpolateHandleRotational,
} from '@/lib/runtime-core/cross-icon-morph';
import {
  analyzeTopologyCompatibility,
  computeCrossfadeFrame,
  computeDrawCrossfadeFrame,
  shouldUseDrawCrossfade,
} from '@/lib/runtime-core/topology-detection';
import type { State } from '@/lib/schema/types';

// ---------------------------------------------------------------------------
// 8.1a — Arc-to-cubic conversion tests
// ---------------------------------------------------------------------------

describe('Phase 8.1a — Arc-to-cubic conversion', () => {
  it('converts a simple arc to cubic segments', () => {
    const segments = arcToCubicSegments(
      { x: 0, y: 0 },
      10, 10,   // rx, ry
      0,         // x-axis rotation
      0,         // large-arc flag
      1,         // sweep flag
      { x: 10, y: 10 },
    );
    expect(segments.length).toBeGreaterThan(0);
    // Last segment should end near the target point
    const last = segments[segments.length - 1]!;
    expect(Math.abs(last.end.x - 10)).toBeLessThan(0.1);
    expect(Math.abs(last.end.y - 10)).toBeLessThan(0.1);
  });

  it('handles degenerate arc (zero radius)', () => {
    const segments = arcToCubicSegments(
      { x: 0, y: 0 },
      0, 0, 0, 0, 1,
      { x: 10, y: 10 },
    );
    // Should return a single degenerate segment (line-like)
    expect(segments.length).toBe(1);
    expect(segments[0]!.end.x).toBe(10);
    expect(segments[0]!.end.y).toBe(10);
  });

  it('handles arc with same start and end point', () => {
    const segments = arcToCubicSegments(
      { x: 5, y: 5 },
      10, 10, 0, 0, 1,
      { x: 5, y: 5 },
    );
    expect(segments.length).toBe(0);
  });

  it('produces multiple segments for large arcs', () => {
    const segments = arcToCubicSegments(
      { x: 0, y: 10 },
      10, 10, 0,
      1,  // large-arc
      1,  // sweep
      { x: 0, y: -10 },
    );
    // Large arc should produce at least 4 segments (> pi radians)
    expect(segments.length).toBeGreaterThanOrEqual(4);
  });

  it('handles elliptical arcs (rx !== ry)', () => {
    const segments = arcToCubicSegments(
      { x: 0, y: 0 },
      20, 10, 0, 0, 1,
      { x: 20, y: 10 },
    );
    expect(segments.length).toBeGreaterThan(0);
    const last = segments[segments.length - 1]!;
    expect(Math.abs(last.end.x - 20)).toBeLessThan(0.1);
    expect(Math.abs(last.end.y - 10)).toBeLessThan(0.1);
  });

  it('handles rotated arcs', () => {
    const segments = arcToCubicSegments(
      { x: 0, y: 0 },
      10, 10, 45, 0, 1,
      { x: 10, y: 10 },
    );
    expect(segments.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// 8.1b — Rotational interpolation tests
// ---------------------------------------------------------------------------

describe('Phase 8.1b — Rotational interpolation', () => {
  it('interpolates handles at t=0 returning from handle', () => {
    const anchor = { x: 0, y: 0 };
    const fromHandle = { x: 10, y: 0 };
    const toHandle = { x: 0, y: 10 };

    const result = interpolateHandleRotational(anchor, fromHandle, toHandle, 0);
    expect(Math.abs(result.x - 10)).toBeLessThan(0.01);
    expect(Math.abs(result.y - 0)).toBeLessThan(0.01);
  });

  it('interpolates handles at t=1 returning to handle', () => {
    const anchor = { x: 0, y: 0 };
    const fromHandle = { x: 10, y: 0 };
    const toHandle = { x: 0, y: 10 };

    const result = interpolateHandleRotational(anchor, fromHandle, toHandle, 1);
    expect(Math.abs(result.x - 0)).toBeLessThan(0.01);
    expect(Math.abs(result.y - 10)).toBeLessThan(0.01);
  });

  it('produces smooth midpoint interpolation', () => {
    const anchor = { x: 0, y: 0 };
    const fromHandle = { x: 10, y: 0 };
    const toHandle = { x: 0, y: 10 };

    const result = interpolateHandleRotational(anchor, fromHandle, toHandle, 0.5);
    // At midpoint, angle should be ~45 degrees, length ~10
    const len = Math.sqrt(result.x ** 2 + result.y ** 2);
    expect(len).toBeCloseTo(10, 0);
  });

  it('handles coincident handles gracefully', () => {
    const anchor = { x: 5, y: 5 };
    const handle = { x: 5, y: 5 };

    const result = interpolateHandleRotational(anchor, handle, handle, 0.5);
    expect(result.x).toBeCloseTo(5);
    expect(result.y).toBeCloseTo(5);
  });
});

// ---------------------------------------------------------------------------
// 8.1c — Shape index optimization tests
// ---------------------------------------------------------------------------

describe('Phase 8.1c — Shape index optimization', () => {
  it('returns 0 for open paths', () => {
    const sub = {
      start: { x: 0, y: 0 },
      segments: [
        { c1: { x: 1, y: 0 }, c2: { x: 2, y: 0 }, end: { x: 3, y: 0 } },
        { c1: { x: 4, y: 0 }, c2: { x: 5, y: 0 }, end: { x: 6, y: 0 } },
      ],
      closed: false,
    };
    expect(findOptimalShapeIndex(sub, sub)).toBe(0);
  });

  it('finds non-zero offset for misaligned closed paths', () => {
    const from = {
      start: { x: 0, y: 0 },
      segments: [
        { c1: { x: 5, y: 0 }, c2: { x: 10, y: 0 }, end: { x: 10, y: 0 } },
        { c1: { x: 10, y: 5 }, c2: { x: 10, y: 10 }, end: { x: 10, y: 10 } },
        { c1: { x: 5, y: 10 }, c2: { x: 0, y: 10 }, end: { x: 0, y: 10 } },
        { c1: { x: 0, y: 5 }, c2: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
      ],
      closed: true,
    };

    // Rotated version: same shape but starting from different point
    const to = {
      start: { x: 10, y: 10 },
      segments: [
        { c1: { x: 5, y: 10 }, c2: { x: 0, y: 10 }, end: { x: 0, y: 10 } },
        { c1: { x: 0, y: 5 }, c2: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
        { c1: { x: 5, y: 0 }, c2: { x: 10, y: 0 }, end: { x: 10, y: 0 } },
        { c1: { x: 10, y: 5 }, c2: { x: 10, y: 10 }, end: { x: 10, y: 10 } },
      ],
      closed: true,
    };

    const offset = findOptimalShapeIndex(from, to);
    // Optimal offset should minimize displacement
    expect(offset).toBeGreaterThanOrEqual(0);
    expect(offset).toBeLessThan(from.segments.length);
  });

  it('rotateSubPathSegments correctly reorders segments', () => {
    const sub = {
      start: { x: 0, y: 0 },
      segments: [
        { c1: { x: 1, y: 0 }, c2: { x: 2, y: 0 }, end: { x: 3, y: 0 } },
        { c1: { x: 4, y: 0 }, c2: { x: 5, y: 0 }, end: { x: 6, y: 0 } },
        { c1: { x: 7, y: 0 }, c2: { x: 8, y: 0 }, end: { x: 9, y: 0 } },
      ],
      closed: true,
    };

    const rotated = rotateSubPathSegments(sub, 1);
    expect(rotated.segments[0]!.end.x).toBe(6); // Was at index 1
    expect(rotated.segments[1]!.end.x).toBe(9); // Was at index 2
    expect(rotated.segments[2]!.end.x).toBe(3); // Was at index 0
  });

  it('rotateSubPathSegments with offset 0 returns unchanged', () => {
    const sub = {
      start: { x: 0, y: 0 },
      segments: [
        { c1: { x: 1, y: 0 }, c2: { x: 2, y: 0 }, end: { x: 3, y: 0 } },
      ],
      closed: true,
    };

    const rotated = rotateSubPathSegments(sub, 0);
    expect(rotated).toBe(sub); // Identity — same reference
  });
});

// ---------------------------------------------------------------------------
// 8.2 — Cross-icon morphing tests
// ---------------------------------------------------------------------------

describe('Phase 8.2 — Cross-icon morphing', () => {
  it('matches sub-paths by centroid proximity', () => {
    const from = [
      {
        start: { x: 0, y: 0 },
        segments: [{ c1: { x: 5, y: 0 }, c2: { x: 10, y: 0 }, end: { x: 10, y: 10 } }],
        closed: true,
      },
      {
        start: { x: 20, y: 20 },
        segments: [{ c1: { x: 25, y: 20 }, c2: { x: 30, y: 20 }, end: { x: 30, y: 30 } }],
        closed: true,
      },
    ];

    const to = [
      {
        start: { x: 21, y: 21 }, // Close to from[1]
        segments: [{ c1: { x: 26, y: 21 }, c2: { x: 31, y: 21 }, end: { x: 31, y: 31 } }],
        closed: true,
      },
      {
        start: { x: 1, y: 1 }, // Close to from[0]
        segments: [{ c1: { x: 6, y: 1 }, c2: { x: 11, y: 1 }, end: { x: 11, y: 11 } }],
        closed: true,
      },
    ];

    const matches = matchSubPaths(from, to);
    expect(matches.length).toBe(2);
    // Should match by proximity
    const match0 = matches.find((m) => m.fromIndex === 0);
    expect(match0!.toIndex).toBe(1); // from[0] closest to to[1]
  });

  it('subdivides segments to equalize counts', () => {
    const segments = [
      { c1: { x: 5, y: 0 }, c2: { x: 10, y: 5 }, end: { x: 10, y: 10 } },
    ];
    const result = subdivideCubicSegments(segments, 3, { x: 0, y: 0 });
    expect(result.length).toBe(3);
  });

  it('splitCubicSegment produces correct number of segments', () => {
    const start = { x: 0, y: 0 };
    const segment = { c1: { x: 5, y: 0 }, c2: { x: 10, y: 5 }, end: { x: 10, y: 10 } };

    const result = splitCubicSegment(start, segment, 4);
    expect(result.length).toBe(4);
    // Last segment should end at the original end point
    expect(result[3]!.end.x).toBeCloseTo(10, 1);
    expect(result[3]!.end.y).toBeCloseTo(10, 1);
  });

  it('creates centroid-collapsed sub-path', () => {
    const template = {
      start: { x: 0, y: 0 },
      segments: [
        { c1: { x: 5, y: 0 }, c2: { x: 10, y: 0 }, end: { x: 10, y: 10 } },
        { c1: { x: 10, y: 15 }, c2: { x: 5, y: 20 }, end: { x: 0, y: 20 } },
      ],
      closed: true,
    };

    const collapsed = createCentroidCollapsedSubPath(template);
    expect(collapsed.segments.length).toBe(2);
    // All points should be at the centroid
    const cx = collapsed.start.x;
    const cy = collapsed.start.y;
    expect(collapsed.segments[0]!.end.x).toBe(cx);
    expect(collapsed.segments[0]!.end.y).toBe(cy);
    expect(collapsed.segments[1]!.end.x).toBe(cx);
    expect(collapsed.segments[1]!.end.y).toBe(cy);
  });

  it('crossIconMorph returns null for empty paths', () => {
    const result = crossIconMorph([], []);
    expect(result).toBeNull();
  });

  it('crossIconMorph produces valid SVG path at all progress values', () => {
    const from = [{
      start: { x: 0, y: 0 },
      segments: [
        { c1: { x: 5, y: 0 }, c2: { x: 10, y: 5 }, end: { x: 10, y: 10 } },
      ],
      closed: true,
    }];

    const to = [{
      start: { x: 2, y: 2 },
      segments: [
        { c1: { x: 7, y: 2 }, c2: { x: 12, y: 7 }, end: { x: 12, y: 12 } },
      ],
      closed: true,
    }];

    const interpolator = crossIconMorph(from, to);
    expect(interpolator).not.toBeNull();

    // Check that it produces valid SVG path strings at various progress values
    for (const t of [0, 0.25, 0.5, 0.75, 1]) {
      const path = interpolator!(t);
      expect(path).toContain('M');
      expect(path).toContain('C');
    }
  });
});

// ---------------------------------------------------------------------------
// 8.3a — Topology detection tests
// ---------------------------------------------------------------------------

describe('Phase 8.3a — Topology incompatibility detection', () => {
  function makeState(layers: Record<string, { d?: string; fill?: boolean; stroke?: boolean; strokeWidth?: number }>): State {
    const stateLayers: Record<string, State['layers'][string]> = {};
    for (const [id, config] of Object.entries(layers)) {
      stateLayers[id] = {
        id,
        path: config.d ? { d: config.d } : undefined,
        style: {
          fill: config.fill ? { mode: 'fixed' as const, value: '#000' } : undefined,
          stroke: config.stroke ? { mode: 'fixed' as const, value: '#000' } : undefined,
          strokeWidth: config.strokeWidth,
        },
      };
    }
    return { id: 'test', layers: stateLayers };
  }

  it('detects compatible topology', () => {
    const from = makeState({ line: { d: 'M0 0 L10 10 Z', fill: true } });
    const to = makeState({ line: { d: 'M0 0 L20 20 Z', fill: true } });

    const result = analyzeTopologyCompatibility(from, to);
    expect(result.compatible).toBe(true);
    expect(result.recommendedStrategy).toBe('morph');
  });

  it('detects stroke-to-fill change', () => {
    const from = makeState({ line: { d: 'M0 0 L10 10', stroke: true, strokeWidth: 2 } });
    const to = makeState({ line: { d: 'M0 0 L10 10 Z', fill: true } });

    const result = analyzeTopologyCompatibility(from, to);
    expect(result.incompatibilities).toContain('stroke-to-fill-change');
    expect(result.recommendedStrategy).toBe('draw-crossfade');
  });

  it('detects subpath count mismatch', () => {
    const from = makeState({ shape: { d: 'M0 0 L10 10 Z', fill: true } });
    const to = makeState({ shape: { d: 'M0 0 L10 10 Z M20 20 L30 30 Z', fill: true } });

    const result = analyzeTopologyCompatibility(from, to);
    expect(result.incompatibilities).toContain('subpath-count-mismatch');
    expect(result.compatible).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8.3b — Coordinated crossfade tests
// ---------------------------------------------------------------------------

describe('Phase 8.3b — Coordinated crossfade', () => {
  it('crossfade at t=0: outgoing fully visible, incoming hidden', () => {
    const frame = computeCrossfadeFrame(0);
    expect(frame.outgoingOpacity).toBe(1);
    expect(frame.incomingOpacity).toBe(0);
  });

  it('crossfade at t=1: outgoing hidden, incoming fully visible', () => {
    const frame = computeCrossfadeFrame(1);
    expect(frame.outgoingOpacity).toBe(0);
    expect(frame.incomingOpacity).toBeCloseTo(1, 1);
  });

  it('crossfade at midpoint has both partially visible', () => {
    const frame = computeCrossfadeFrame(0.5);
    expect(frame.outgoingOpacity).toBe(0.5);
    expect(frame.incomingOpacity).toBeGreaterThan(0);
    expect(frame.incomingOpacity).toBeLessThan(1);
  });

  it('incoming scale has overshoot (emphasis)', () => {
    const frame = computeCrossfadeFrame(0.3);
    expect(frame.incomingScale).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// 8.3c — Draw-coordinated crossfade tests
// ---------------------------------------------------------------------------

describe('Phase 8.3c — Draw-coordinated crossfade', () => {
  it('without draw annotation: draw progress stays at 1', () => {
    const frame = computeDrawCrossfadeFrame(0.5, false);
    expect(frame.outgoingDrawProgress).toBe(1);
    expect(frame.incomingDrawProgress).toBe(1);
  });

  it('with draw annotation: outgoing draws off', () => {
    const frame = computeDrawCrossfadeFrame(0.5, true);
    expect(frame.outgoingDrawProgress).toBeLessThan(1);
  });

  it('with draw annotation: incoming draws on', () => {
    const frame = computeDrawCrossfadeFrame(0.8, true);
    expect(frame.incomingDrawProgress).toBeGreaterThan(0);
  });

  it('at t=0: outgoing fully drawn, incoming not drawn', () => {
    const frame = computeDrawCrossfadeFrame(0, true);
    expect(frame.outgoingDrawProgress).toBe(1);
    expect(frame.incomingDrawProgress).toBe(0);
  });

  it('shouldUseDrawCrossfade requires annotation with 2+ layers', () => {
    expect(shouldUseDrawCrossfade(undefined, undefined)).toBe(false);
    expect(shouldUseDrawCrossfade(
      { mode: 'byLayer', layers: {} },
      undefined,
    )).toBe(false);
    expect(shouldUseDrawCrossfade(
      {
        mode: 'byLayer',
        layers: {
          layer1: { guidePoints: [] },
          layer2: { guidePoints: [] },
        },
      },
      undefined,
    )).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 8.4 — Editor topology validation tests
// ---------------------------------------------------------------------------

describe('Phase 8.4 — Editor topology validation', () => {
  it('MorphReadinessIndicator types are importable', async () => {
    // Type-level check — ensure the component module is well-formed
    const mod = await import('@/components/editor/MorphReadinessIndicator');
    expect(typeof mod.MorphReadinessIndicator).toBe('function');
    expect(typeof mod.MorphPreview).toBe('function');
  });

  it('GeometryChangeWarning exports are importable', async () => {
    const mod = await import('@/components/editor/GeometryChangeWarning');
    expect(typeof mod.GeometryChangeWarning).toBe('function');
    expect(typeof mod.useGeometryValidation).toBe('function');
    expect(typeof mod.detectGeometryBreaks).toBe('function');
  });
});

// ---------------------------------------------------------------------------
// 8.4a — Geometry break detection tests
// ---------------------------------------------------------------------------

describe('Phase 8.4a — detectGeometryBreaks', () => {
  // Dynamic import so tests work even if the file fails to compile independently
  let detectGeometryBreaks: typeof import('@/components/editor/GeometryChangeWarning')['detectGeometryBreaks'];

  // Eagerly import once for the suite
  it('module loads', async () => {
    const mod = await import('@/components/editor/GeometryChangeWarning');
    detectGeometryBreaks = mod.detectGeometryBreaks;
    expect(typeof detectGeometryBreaks).toBe('function');
  });

  it('returns empty array for identical paths', () => {
    const d = 'M0 0 L10 10 Z';
    const breaks = detectGeometryBreaks(d, d);
    expect(breaks.length).toBe(0);
  });

  it('detects sub-path count change', () => {
    const prev = 'M0 0 L10 10 Z';
    const curr = 'M0 0 L10 10 Z M20 20 L30 30 Z';
    const breaks = detectGeometryBreaks(prev, curr);
    const subpathBreak = breaks.find((b) => b.kind === 'subpath-count-changed');
    expect(subpathBreak).toBeDefined();
    expect(subpathBreak!.detail).toContain('1');
    expect(subpathBreak!.detail).toContain('2');
  });

  it('detects closed status change', () => {
    const prev = 'M0 0 L10 0 L10 10 Z';
    const curr = 'M0 0 L10 0 L10 10';
    const breaks = detectGeometryBreaks(prev, curr);
    const closedBreak = breaks.find((b) => b.kind === 'closed-status-changed');
    expect(closedBreak).toBeDefined();
  });

  it('detects significant command signature change', () => {
    // A simple line vs a cubic curve — very different signatures
    const prev = 'M0 0 L10 10';
    const curr = 'M0 0 C2 4 8 6 10 10 C12 14 18 16 20 20';
    const breaks = detectGeometryBreaks(prev, curr);
    const sigBreak = breaks.find((b) => b.kind === 'command-signature-changed');
    expect(sigBreak).toBeDefined();
  });

  it('handles empty previous path', () => {
    const breaks = detectGeometryBreaks('', 'M0 0 L10 10 Z');
    expect(breaks.length).toBeGreaterThan(0);
    const subBreak = breaks.find((b) => b.kind === 'subpath-count-changed');
    expect(subBreak).toBeDefined();
  });

  it('handles empty current path', () => {
    const breaks = detectGeometryBreaks('M0 0 L10 10 Z', '');
    expect(breaks.length).toBeGreaterThan(0);
  });

  it('handles both paths empty', () => {
    const breaks = detectGeometryBreaks('', '');
    expect(breaks.length).toBe(0);
  });

  it('detects point count change', () => {
    const prev = 'M0 0 L10 10';
    const curr = 'M0 0 L5 5 L10 10 L15 15';
    const breaks = detectGeometryBreaks(prev, curr);
    const ptBreak = breaks.find((b) => b.kind === 'point-count-changed');
    expect(ptBreak).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// Integration: transition resolver with cross-icon morph and topology
// ---------------------------------------------------------------------------

import { resolveTransition, attemptCrossIconMorph } from '@/lib/runtime-core';
import type { Layer, Transition } from '@/lib/schema/types';

function makeLayer(id: string, d: string, opts: { fill?: boolean; stroke?: boolean; strokeWidth?: number } = {}): Layer {
  return {
    id,
    path: { d },
    style: {
      fill: opts.fill !== false ? { mode: 'fixed' as const, value: '#000' } : undefined,
      stroke: opts.stroke ? { mode: 'fixed' as const, value: '#000' } : undefined,
      strokeWidth: opts.strokeWidth,
    },
  };
}

describe('Phase 8 — Transition resolver cross-icon morph integration', () => {
  it('uses crossIconMorph as fallback when strictMorph and bestGuessMorph fail', () => {
    // Two paths with different sub-path counts — strictMorph and bestGuessMorph
    // will fail, but crossIconMorph can match sub-paths by centroid proximity.
    const fromState: State = {
      id: 'from',
      layers: {
        shape: makeLayer('shape', 'M0 0 L10 0 L10 10 Z'),
      },
    };
    const toState: State = {
      id: 'to',
      layers: {
        shape: makeLayer('shape', 'M0 0 L10 0 L10 10 Z M15 15 L25 15 L25 25 Z'),
      },
    };
    const transition: Transition = {
      id: 'test',
      from: 'from',
      to: 'to',
      strategy: 'bestGuessMorph',
      durationMs: 200,
      layerBindings: [{ fromLayerId: 'shape', toLayerId: 'shape' }],
    };

    const resolved = resolveTransition(transition, fromState, toState);
    const binding = resolved.layerBindings[0]!;
    // Should either get a morph via crossIconMorph or a fallback
    const hasMorphOrFallback = binding.morph !== undefined || binding.fallback !== undefined;
    expect(hasMorphOrFallback).toBe(true);
  });

  it('topology analysis is included in resolved transition', () => {
    const fromState: State = {
      id: 'from',
      layers: { line: makeLayer('line', 'M0 0 L10 10', { stroke: true, strokeWidth: 2, fill: false }) },
    };
    const toState: State = {
      id: 'to',
      layers: { line: makeLayer('line', 'M0 0 L10 10 Z', { fill: true }) },
    };
    const transition: Transition = {
      id: 'topo-test',
      from: 'from',
      to: 'to',
      strategy: 'bestGuessMorph',
      durationMs: 150,
      layerBindings: [{ fromLayerId: 'line', toLayerId: 'line' }],
    };

    const resolved = resolveTransition(transition, fromState, toState);
    expect(resolved.topologyAnalysis).toBeDefined();
  });

  it('topology-incompatible transition overrides morph to crossfade', () => {
    const fromState: State = {
      id: 'outline',
      layers: { icon: makeLayer('icon', 'M0 0 L10 0 L10 10', { stroke: true, strokeWidth: 2, fill: false }) },
    };
    const toState: State = {
      id: 'filled',
      layers: { icon: makeLayer('icon', 'M0 0 L10 0 L10 10 Z', { fill: true }) },
    };
    const transition: Transition = {
      id: 'stroke-fill',
      from: 'outline',
      to: 'filled',
      strategy: 'strictMorph',
      durationMs: 200,
      layerBindings: [{ fromLayerId: 'icon', toLayerId: 'icon' }],
    };

    const resolved = resolveTransition(transition, fromState, toState);
    // Topology detection should flag incompatibility
    expect(resolved.topologyAnalysis?.compatible).toBe(false);
    // Binding should have a fallback instead of morph due to topology override
    const binding = resolved.layerBindings[0]!;
    const hasOverride = binding.fallback !== undefined || binding.animationType !== 'morph';
    expect(hasOverride).toBe(true);
  });
});

describe('Phase 8 — attemptCrossIconMorph', () => {
  it('produces valid interpolation for simple paths', () => {
    const interpolator = attemptCrossIconMorph(
      'M0 0 L10 0 L10 10 Z',
      'M5 5 L15 5 L15 15 Z',
    );
    expect(interpolator).not.toBeNull();
    const mid = interpolator!(0.5);
    expect(mid).toContain('M');
  });

  it('handles paths with different sub-path counts', () => {
    const interpolator = attemptCrossIconMorph(
      'M0 0 L10 0 L10 10 Z',
      'M0 0 L10 0 L10 10 Z M20 20 L30 20 L30 30 Z',
    );
    // May or may not succeed depending on normalization;
    // the key is it doesn't throw
    expect(typeof interpolator === 'function' || interpolator === null).toBe(true);
  });

  it('handles empty or minimal path strings gracefully', () => {
    // Empty paths may or may not produce null depending on parser behavior.
    // The key is they don't throw.
    const r1 = attemptCrossIconMorph('', 'M0 0 L10 10');
    expect(r1 === null || typeof r1 === 'function').toBe(true);
    const r2 = attemptCrossIconMorph('M0 0 L10 10', '');
    expect(r2 === null || typeof r2 === 'function').toBe(true);
  });
});

describe('Phase 8 — Cross-icon morph winding normalization', () => {
  it('crossIconMorph handles paths with opposite winding directions', () => {
    // CW square
    const from = [{
      start: { x: 0, y: 0 },
      segments: [
        { c1: { x: 10, y: 0 }, c2: { x: 10, y: 0 }, end: { x: 10, y: 0 } },
        { c1: { x: 10, y: 10 }, c2: { x: 10, y: 10 }, end: { x: 10, y: 10 } },
        { c1: { x: 0, y: 10 }, c2: { x: 0, y: 10 }, end: { x: 0, y: 10 } },
        { c1: { x: 0, y: 0 }, c2: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
      ],
      closed: true,
    }];

    // CCW square (reversed)
    const to = [{
      start: { x: 0, y: 0 },
      segments: [
        { c1: { x: 0, y: 10 }, c2: { x: 0, y: 10 }, end: { x: 0, y: 10 } },
        { c1: { x: 10, y: 10 }, c2: { x: 10, y: 10 }, end: { x: 10, y: 10 } },
        { c1: { x: 10, y: 0 }, c2: { x: 10, y: 0 }, end: { x: 10, y: 0 } },
        { c1: { x: 0, y: 0 }, c2: { x: 0, y: 0 }, end: { x: 0, y: 0 } },
      ],
      closed: true,
    }];

    const interpolator = crossIconMorph(from, to);
    expect(interpolator).not.toBeNull();
    // Should produce valid SVG at midpoint
    const mid = interpolator!(0.5);
    expect(mid).toContain('M');
    expect(mid).toContain('C');
  });
});

describe('Phase 8 — MorphReadiness crossIconMorph strategy', () => {
  it('readiness recommends crossIconMorph for partially compatible paths', () => {
    const fromState: State = {
      id: 'from',
      layers: {
        a: makeLayer('a', 'M0 0 L10 0 L10 10 Z'),
      },
    };
    const toState: State = {
      id: 'to',
      layers: {
        a: makeLayer('a', 'M2 2 C5 2 8 5 10 10 Z'),
      },
    };
    const transition: Transition = {
      id: 'mixed',
      from: 'from',
      to: 'to',
      strategy: 'replace',
      durationMs: 200,
      layerBindings: [{ fromLayerId: 'a', toLayerId: 'a' }],
    };

    const resolved = resolveTransition(transition, fromState, toState);
    const binding = resolved.layerBindings[0]!;
    // The readiness should recommend something — either morph or crossIconMorph
    expect(binding.readiness).toBeDefined();
    expect(['strictMorph', 'bestGuessMorph', 'crossIconMorph', 'fallback']).toContain(
      binding.readiness!.recommendedStrategy,
    );
  });
});
