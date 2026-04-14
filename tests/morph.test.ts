import { describe, expect, test } from 'bun:test';

import type { Layer, LayerSnapshot } from '../lib/schema';
import { bestGuessMorph, resolveTransition, strictMorph, type TransitionConfig } from '../lib/runtime-core';

function makeLayer(id: string, d: string): Layer {
  return {
    id,
    path: { d },
    style: {},
  };
}

describe('morph helpers', () => {
  test('strictMorph interpolates compatible paths and preserves endpoints', () => {
    const from = 'M0 0 L10 0 L10 10 L0 10 Z';
    const to = 'M5 0 L10 5 L5 10 L0 5 Z';
    const morph = strictMorph(from, to);

    expect(morph(0)).toBe(from);
    expect(morph(1)).toBe(to);
    expect(morph(0.5)).toBe('M2.5 0 L10 2.5 L7.5 10 L0 7.5 Z');
  });

  test('bestGuessMorph returns null when a path cannot be normalized', () => {
    const morph = bestGuessMorph(
      'M0 0 A10 10 0 0 1 10 10',
      'M0 0 L10 0 L10 10 Z',
    );

    expect(morph).toBeNull();
  });

  test('bestGuessMorph normalizes differing command types with the same point flow', () => {
    const morph = bestGuessMorph(
      'M0 0 L10 0 L10 10 Z',
      'M0 0 Q10 0 10 10 Z',
    );

    expect(morph).not.toBeNull();
    const halfway = morph!(0.5);
    expect(halfway).toContain('C');
    expect(halfway.startsWith('M')).toBeTrue();
  });
});

describe('transition resolver morph integration', () => {
  test('strictMorph bindings receive a morph interpolator', () => {
    const fromState: LayerSnapshot = {
      layers: {
        shape: makeLayer('shape', 'M0 0 L10 0 L10 10 L0 10 Z'),
      },
    };
    const toState: LayerSnapshot = {
      layers: {
        shape: makeLayer('shape', 'M5 0 L10 5 L5 10 L0 5 Z'),
      },
    };
    const transition: TransitionConfig = {
      id: 'idle-active',
      strategy: 'strictMorph',
      durationMs: 120,
      layerBindings: [{ fromLayerId: 'shape', toLayerId: 'shape' }],
    };

    const resolved = resolveTransition(transition, fromState, toState);
    expect(resolved.layerBindings[0]?.morph).toBeDefined();
    expect(resolved.layerBindings[0]?.fallback).toBeUndefined();
  });

  test('bestGuessMorph bindings cascade to cross-icon morph for arc → polygon', () => {
    // After the dogfooding loosen-up, an arc → polygon pair (which used
    // to short-circuit to fallback when bestGuessMorph couldn't normalize
    // it) cascades through the cross-icon morph engine, which DOES handle
    // differing topologies. The user-visible result is a real morph
    // animation instead of a crossfade.
    const fromState: LayerSnapshot = {
      layers: {
        shape: makeLayer('shape', 'M0 0 A10 10 0 0 1 10 10'),
      },
    };
    const toState: LayerSnapshot = {
      layers: {
        shape: makeLayer('shape', 'M0 0 L10 0 L10 10 Z'),
      },
    };
    const transition: TransitionConfig = {
      id: 'idle-active',
      strategy: 'bestGuessMorph',
      durationMs: 120,
      layerBindings: [{ fromLayerId: 'shape', toLayerId: 'shape' }],
    };

    const resolved = resolveTransition(transition, fromState, toState);
    expect(resolved.layerBindings[0]?.morph).toBeDefined();
    expect(resolved.layerBindings[0]?.fallback).toBeUndefined();
  });
});
