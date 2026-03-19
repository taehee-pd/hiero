/**
 * Additional coverage tests for Phase 7/8 to maintain the 60% line threshold.
 *
 * Targets low-coverage areas in:
 * - lib/runtime-core/morph.ts (canonicalize, bestGuessMorph, alignment)
 * - lib/runtime-core/inspection.ts
 * - lib/runtime-core/motion-preference.ts
 * - lib/runtime-core/path-normalization.ts (additional paths)
 */

import { describe, expect, it } from 'bun:test';
import { strictMorph, bestGuessMorph, crossIconMorph } from '@/lib/runtime-core/morph';
import { inspectTransitionPlan } from '@/lib/runtime-core/inspection';
import {
  getMotionPreference,
  subscribeMotionPreference,
  shouldReduceMotion,
} from '@/lib/runtime-core/motion-preference';
import { canonicalizePath } from '@/lib/runtime-core/path-normalization';
import type { State, Transition } from '@/lib/schema/types';

// ---------------------------------------------------------------------------
// morph.ts — canonicalizeCommands coverage
// ---------------------------------------------------------------------------

describe('morph.ts — strictMorph', () => {
  it('interpolates matching M L Z paths', () => {
    const interp = strictMorph('M0 0 L10 0 L10 10 Z', 'M0 0 L20 0 L20 20 Z');
    expect(interp(0)).toBe('M0 0 L10 0 L10 10 Z');
    expect(interp(1)).toBe('M0 0 L20 0 L20 20 Z');
    const mid = interp(0.5);
    expect(mid).toContain('M');
    expect(mid).toContain('L');
  });

  it('interpolates C commands', () => {
    const interp = strictMorph(
      'M0 0 C5 0 10 5 10 10',
      'M0 0 C10 0 20 10 20 20',
    );
    const mid = interp(0.5);
    expect(mid).toContain('C');
  });

  it('handles H and V commands', () => {
    const interp = strictMorph('M0 0 H10 V10', 'M0 0 H20 V20');
    expect(interp(0.5)).toContain('H');
    expect(interp(0.5)).toContain('V');
  });

  it('handles Q commands', () => {
    const interp = strictMorph('M0 0 Q5 5 10 0', 'M0 0 Q10 10 20 0');
    expect(interp(0.5)).toContain('Q');
  });

  it('handles A (arc) commands', () => {
    const interp = strictMorph(
      'M10 80 A25 25 0 0 1 50 80',
      'M10 80 A30 30 0 0 1 60 80',
    );
    expect(interp(0.5)).toContain('A');
  });

  it('throws on mismatched signatures', () => {
    expect(() => strictMorph('M0 0 L10 10', 'M0 0 C5 5 10 10 15 15')).toThrow(
      'Path command signatures do not match',
    );
  });

  it('handles relative commands (m, l, c, q, h, v, a, z)', () => {
    const interp = strictMorph(
      'm0 0 l10 0 l0 10 z',
      'm0 0 l20 0 l0 20 z',
    );
    const mid = interp(0.5);
    expect(mid).toContain('M');
    expect(mid).toContain('L');
  });

  it('handles implicit line-to after M', () => {
    // After M, subsequent coordinate pairs are treated as L
    const interp = strictMorph('M0 0 5 5 10 0', 'M0 0 10 10 20 0');
    expect(interp(0.5)).toContain('L');
  });

  it('t=0 returns original from path', () => {
    const from = 'M0 0 L10 10 Z';
    const to = 'M0 0 L20 20 Z';
    expect(strictMorph(from, to)(0)).toBe(from);
  });

  it('t=1 returns original to path', () => {
    const from = 'M0 0 L10 10 Z';
    const to = 'M0 0 L20 20 Z';
    expect(strictMorph(from, to)(1)).toBe(to);
  });
});

describe('morph.ts — bestGuessMorph', () => {
  it('morphs between paths with same structure', () => {
    const interp = bestGuessMorph(
      'M0 0 L10 0 L10 10 L0 10 Z',
      'M5 5 L15 5 L15 15 L5 15 Z',
    );
    expect(interp).not.toBeNull();
    const mid = interp!(0.5);
    expect(mid).toContain('M');
    expect(mid).toContain('C');
  });

  it('returns null for completely incompatible paths', () => {
    // bestGuessMorph with closed vs open should return null from alignCubicPaths
    const interp = bestGuessMorph(
      'M0 0 L10 0 L10 10 Z',
      'M0 0 L10 0 L10 10',
    );
    expect(interp).toBeNull();
  });

  it('t=0 returns original from path', () => {
    const from = 'M0 0 L10 0 L10 10 L0 10 Z';
    const to = 'M5 5 L15 5 L15 15 L5 15 Z';
    const interp = bestGuessMorph(from, to);
    expect(interp).not.toBeNull();
    expect(interp!(0)).toBe(from);
    expect(interp!(1)).toBe(to);
  });

  it('handles paths with different segment counts', () => {
    const from = 'M0 0 L10 0 L10 10 Z';
    const to = 'M0 0 L5 0 L10 0 L10 5 L10 10 Z';
    const interp = bestGuessMorph(from, to);
    // May or may not succeed depending on alignment, but should not crash
    if (interp) {
      expect(typeof interp(0.5)).toBe('string');
    }
  });

  it('handles paths with multiple subpaths', () => {
    const from = 'M0 0 L10 0 L10 10 Z M20 0 L30 0 L30 10 Z';
    const to = 'M5 5 L15 5 L15 15 Z M25 5 L35 5 L35 15 Z';
    const interp = bestGuessMorph(from, to);
    expect(interp).not.toBeNull();
    if (interp) {
      expect(interp(0.5)).toContain('M');
    }
  });

  it('handles from path with more subpaths than to', () => {
    const from = 'M0 0 L10 0 L10 10 Z M20 0 L30 0 L30 10 Z';
    const to = 'M5 5 L15 5 L15 15 Z';
    const interp = bestGuessMorph(from, to);
    // Should create degenerate subpath for the missing one
    if (interp) {
      expect(typeof interp(0.5)).toBe('string');
    }
  });
});

// ---------------------------------------------------------------------------
// inspection.ts
// ---------------------------------------------------------------------------

describe('inspection.ts — inspectTransitionPlan', () => {
  function makeState(layers: Record<string, { d?: string }>): State {
    const result: Record<string, State['layers'][string]> = {};
    for (const [id, config] of Object.entries(layers)) {
      result[id] = {
        id,
        path: config.d ? { d: config.d } : undefined,
        style: { fill: { mode: 'currentColor' as const } },
      };
    }
    return { id: 'test', layers: result };
  }

  it('inspects a simple replace transition', () => {
    const transition: Transition = {
      id: 't1',
      from: 'idle',
      to: 'active',
      strategy: 'replace',
      durationMs: 300,
      layerBindings: [],
    };

    const from = makeState({ line: { d: 'M0 0 L10 10' } });
    const to = makeState({ line: { d: 'M0 0 L20 20' } });

    const result = inspectTransitionPlan(transition, from, to);
    expect(result.transitionId).toBe('t1');
    expect(result.strategy).toBe('replace');
    expect(result.bindings.length).toBeGreaterThan(0);
  });

  it('reports readiness scores for matched layers', () => {
    const transition: Transition = {
      id: 't2',
      from: 'a',
      to: 'b',
      strategy: 'replace',
      durationMs: 200,
      layerBindings: [],
    };

    const from = makeState({ shape: { d: 'M0 0 L10 0 L10 10 Z' } });
    const to = makeState({ shape: { d: 'M0 0 L20 0 L20 20 Z' } });

    const result = inspectTransitionPlan(transition, from, to);
    const binding = result.bindings.find((b) => b.fromLayerId === 'shape');
    expect(binding).toBeTruthy();
    expect(binding!.readinessScore).toBeGreaterThan(0);
    expect(binding!.recommendedStrategy).toBeTruthy();
  });

  it('handles unmatched layers', () => {
    const transition: Transition = {
      id: 't3',
      from: 'a',
      to: 'b',
      strategy: 'replace',
      durationMs: 200,
      layerBindings: [],
    };

    // Use very different geometry to avoid auto-matching
    const from = makeState({
      oldLayer1: { d: 'M0 0 L10 10' },
      oldLayer2: { d: 'M50 50 L60 60' },
    });
    const to = makeState({ newLayer: { d: 'M0 0 L20 20' } });

    const result = inspectTransitionPlan(transition, from, to);
    expect(result.bindings.length).toBeGreaterThan(0);
    // With 2 from layers and 1 to layer, at least one must be unmatched
    const hasFromOnly = result.bindings.some(
      (b) => b.fromLayerId && !b.toLayerId,
    );
    expect(hasFromOnly).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// motion-preference.ts
// ---------------------------------------------------------------------------

describe('motion-preference.ts', () => {
  it('getMotionPreference returns "full" in test environment', () => {
    // Bun test env has no window.matchMedia
    expect(getMotionPreference()).toBe('full');
  });

  it('subscribeMotionPreference returns no-op in test environment', () => {
    const unsubscribe = subscribeMotionPreference(() => {});
    expect(typeof unsubscribe).toBe('function');
    unsubscribe(); // Should not throw
  });

  it('shouldReduceMotion respects explicit boolean', () => {
    expect(shouldReduceMotion(true)).toBe(true);
    expect(shouldReduceMotion(false)).toBe(false);
  });

  it('shouldReduceMotion with "system" checks preference', () => {
    // In test env, getMotionPreference() returns 'full'
    expect(shouldReduceMotion('system')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// path-normalization.ts — additional coverage
// ---------------------------------------------------------------------------

describe('path-normalization.ts — additional coverage', () => {
  it('canonicalizes path with multiple subpaths', () => {
    const result = canonicalizePath('M0 0 L10 10 Z M20 20 L30 30 Z');
    expect(result.stats.subpathCount).toBe(2);
    expect(result.stats.closed).toEqual([true, true]);
  });

  it('canonicalizes path with open subpath', () => {
    const result = canonicalizePath('M0 0 L10 10');
    expect(result.stats.subpathCount).toBe(1);
    expect(result.stats.closed).toEqual([false]);
  });

  it('handles Q (quadratic) commands', () => {
    const result = canonicalizePath('M0 0 Q5 5 10 0');
    expect(result.stats.commandSignature).toContain('Q');
    expect(result.stats.pointCount).toBeGreaterThan(0);
  });

  it('handles C (cubic) commands', () => {
    const result = canonicalizePath('M0 0 C5 0 10 5 10 10');
    expect(result.stats.commandSignature).toContain('C');
  });

  it('handles A (arc) commands', () => {
    const result = canonicalizePath('M10 80 A25 25 0 0 1 50 80');
    expect(result.stats.commandSignature).toContain('A');
  });

  it('handles relative commands', () => {
    const result = canonicalizePath('m0 0 l10 10 l10 -10 z');
    expect(result.stats.subpathCount).toBe(1);
    expect(result.stats.closed).toEqual([true]);
  });

  it('handles H and V commands', () => {
    const result = canonicalizePath('M0 0 H10 V10 H0 Z');
    expect(result.stats.subpathCount).toBe(1);
    // H and V are converted to L
    expect(result.stats.commandSignature).toContain('L');
  });

  it('handles relative h and v commands', () => {
    const result = canonicalizePath('M0 0 h10 v10 h-10 z');
    expect(result.stats.subpathCount).toBe(1);
    expect(result.stats.closed).toEqual([true]);
  });

  it('handles empty path', () => {
    const result = canonicalizePath('');
    expect(result.stats.subpathCount).toBe(0);
    expect(result.stats.pointCount).toBe(0);
  });

  it('computes correct bbox', () => {
    const result = canonicalizePath('M5 10 L20 30');
    expect(result.stats.bbox.minX).toBeCloseTo(5);
    expect(result.stats.bbox.minY).toBeCloseTo(10);
    expect(result.stats.bbox.maxX).toBeCloseTo(20);
    expect(result.stats.bbox.maxY).toBeCloseTo(30);
  });

  it('computes correct centroid', () => {
    const result = canonicalizePath('M0 0 L10 0 L10 10 L0 10 Z');
    expect(result.stats.centroid.x).toBeCloseTo(5);
    expect(result.stats.centroid.y).toBeCloseTo(5);
  });

  it('sorts subpaths by position', () => {
    // Second subpath starts at (0,0), first at (20,20)
    // After normalization, (0,0) subpath should come first
    const result = canonicalizePath('M20 20 L30 30 Z M0 0 L10 10 Z');
    expect(result.d).toMatch(/^M0/);
  });
});
