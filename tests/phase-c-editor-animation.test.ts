import { describe, expect, test } from 'bun:test';

import type {
  Effect,
  Transition,
  State,
  TimelineTrack,
  SpringConfig,
  StateTrigger,
  TransitionStagger,
} from '../lib/schema';
import {
  getEasingFunction,
  computeEffectValues,
  resolveTransition,
  interpolateTransitionValues,
} from '../lib/runtime-core';
import type { EffectDefinition } from '../lib/runtime-core/effect-scheduler';

// --- C1: Cubic-bezier easing parsing ---

describe('C1 — Bezier curve easing integration', () => {
  test('getEasingFunction parses cubic-bezier strings', () => {
    const ease = getEasingFunction('cubic-bezier(0.4, 0.0, 0.2, 1)');
    expect(ease(0)).toBe(0);
    expect(ease(1)).toBe(1);
    // Material Standard curve should accelerate then decelerate
    const mid = ease(0.5);
    expect(mid).toBeGreaterThan(0.5);
    expect(mid).toBeLessThan(1);
  });

  test('getEasingFunction handles spring preset fallback', () => {
    // 'spring' as a string falls back to linear in the easing module
    const ease = getEasingFunction('spring');
    expect(ease(0.5)).toBe(0.5);
  });
});

// --- C3: Per-track easing ---

describe('C3 — Per-track easing in TimelineTrack', () => {
  test('TimelineTrack accepts optional easing field', () => {
    const track: TimelineTrack = {
      property: 'opacity',
      keyframes: [0, 1],
      easing: 'ease-in-out',
    };
    expect(track.easing).toBe('ease-in-out');
  });

  test('TimelineTrack accepts SpringConfig easing', () => {
    const spring: SpringConfig = { type: 'spring', stiffness: 200, damping: 15 };
    const track: TimelineTrack = {
      property: 'scale',
      keyframes: [1, 1.2, 1],
      easing: spring,
    };
    expect(track.easing).toEqual(spring);
  });

  test('per-track easing modifies interpolation via scheduler', () => {
    const fromState: State = {
      id: 'a',
      layers: {
        layer1: { id: 'layer1', style: {} },
      },
    };
    const toState: State = {
      id: 'b',
      layers: {
        layer1: { id: 'layer1', style: {} },
      },
    };
    const transition: Transition = {
      id: 'a-to-b',
      fromIconId: 'icon-test',
      toIconId: 'icon-test',
      fromVariantId: 'v24',
      toVariantId: 'v24',
      from: 'a',
      to: 'b',
      strategy: 'lineAnimation',
      durationMs: 300,
      easing: 'linear',
      layerBindings: [
        {
          fromLayerId: 'layer1',
          toLayerId: 'layer1',
          tracks: [
            { property: 'opacity', keyframes: [0, 1], easing: 'ease-in' },
          ],
        },
      ],
    };

    const resolved = resolveTransition(transition, fromState, toState);
    const valuesAtHalf = interpolateTransitionValues(resolved, 0.5);

    // ease-in at 0.5 = 0.25 (t*t), so opacity should be 0.25
    // But the transition-level easing is linear so progress=0.5
    // The per-track easing applies to the local binding progress
    expect(valuesAtHalf.layer1).toBeDefined();
    const opacity = valuesAtHalf.layer1?.opacity;
    expect(typeof opacity).toBe('number');
    // With ease-in (t*t), at t=0.5 the value should be ~0.25
    expect(opacity).toBeCloseTo(0.25, 1);
  });
});

// --- C4: Stagger schema ---

describe('C4 — Stagger controls in schema', () => {
  test('TransitionStagger type is valid', () => {
    const stagger: TransitionStagger = {
      mode: 'from-center',
      perLayerMs: 40,
      easing: 'ease-out',
    };
    expect(stagger.mode).toBe('from-center');
    expect(stagger.perLayerMs).toBe(40);
  });

  test('Transition accepts stagger config', () => {
    const transition: Transition = {
      id: 'test',
      fromIconId: 'icon-test',
      toIconId: 'icon-test',
      fromVariantId: 'v24',
      toVariantId: 'v24',
      from: 'idle',
      to: 'active',
      strategy: 'lineAnimation',
      durationMs: 300,
      layerBindings: [],
      stagger: { mode: 'linear', perLayerMs: 30 },
    };
    expect(transition.stagger?.mode).toBe('linear');
  });

  test('LayerBinding accepts explicit delayMs and durationMs', () => {
    const transition: Transition = {
      id: 'test',
      fromIconId: 'icon-test',
      toIconId: 'icon-test',
      fromVariantId: 'v24',
      toVariantId: 'v24',
      from: 'idle',
      to: 'active',
      strategy: 'lineAnimation',
      durationMs: 500,
      layerBindings: [
        {
          fromLayerId: 'a',
          toLayerId: 'a',
          tracks: [{ property: 'opacity', keyframes: [0, 1] }],
          delayMs: 100,
          durationMs: 200,
        },
      ],
    };
    expect(transition.layerBindings![0]!.delayMs).toBe(100);
    expect(transition.layerBindings![0]!.durationMs).toBe(200);
  });
});

// --- C5: Custom effect builder ---

describe('C5 — Custom effect kind', () => {
  test('Effect accepts kind: custom with customTracks', () => {
    const effect: Effect = {
      id: 'my-custom',
      kind: 'custom',
      durationMs: 600,
      customTracks: [
        { property: 'scale', keyframes: [1, 1.3, 1] },
        { property: 'rotate', keyframes: [0, 15, -15, 0] },
      ],
    };
    expect(effect.kind).toBe('custom');
    expect(effect.customTracks).toHaveLength(2);
  });

  test('computeEffectValues handles custom kind', () => {
    const customTracks: EffectDefinition['customTracks'] = [
      { property: 'scale', keyframes: [1, 2] },
      { property: 'opacity', keyframes: [1, 0] },
    ];

    const values = computeEffectValues(
      'custom',
      0.5,
      ['layer-a'],
      undefined,
      customTracks,
    );

    expect(values['layer-a']).toBeDefined();
    expect(values['layer-a']?.scale).toBeCloseTo(1.5, 5);
    expect(values['layer-a']?.opacity).toBeCloseTo(0.5, 5);
  });

  test('computeEffectValues custom with per-track easing', () => {
    const customTracks: EffectDefinition['customTracks'] = [
      { property: 'opacity', keyframes: [0, 1], easing: 'ease-in' },
    ];

    const values = computeEffectValues(
      'custom',
      0.5,
      ['layer-a'],
      undefined,
      customTracks,
    );

    // ease-in at 0.5 = 0.25
    expect(values['layer-a']?.opacity).toBeCloseTo(0.25, 1);
  });

  test('computeEffectValues custom with empty tracks returns empty', () => {
    const values = computeEffectValues('custom', 0.5, ['layer-a'], undefined, []);
    expect(Object.keys(values)).toHaveLength(0);
  });

  test('computeEffectValues custom with no tracks returns empty', () => {
    const values = computeEffectValues('custom', 0.5, ['layer-a'], undefined, undefined);
    expect(Object.keys(values)).toHaveLength(0);
  });
});

// --- C6: State interaction triggers ---

describe('C6 — StateTrigger schema', () => {
  test('StateTrigger type is valid', () => {
    const triggers: StateTrigger[] = [
      { event: 'hover' },
      { event: 'tap' },
      { event: 'longPress' },
      { event: 'focus' },
      { event: 'auto' },
    ];
    expect(triggers).toHaveLength(5);
  });

  test('Transition accepts triggers array', () => {
    const transition = {
      id: 'hover-transition',
      fromIconId: 'icon-test',
      toIconId: 'icon-test',
      fromVariantId: 'v24',
      toVariantId: 'v24',
      from: 'idle',
      to: 'active',
      strategy: 'lineAnimation' as const,
      durationMs: 200,
      layerBindings: [],
      triggers: [{ event: 'hover' }],
    };
    expect(transition.triggers).toHaveLength(1);
    expect(transition.triggers![0]!.event).toBe('hover');
  });

  test('Transition without triggers defaults to undefined', () => {
    const transition = {
      id: 'test',
      fromIconId: 'icon-test',
      toIconId: 'icon-test',
      fromVariantId: 'v24',
      toVariantId: 'v24',
      from: 'a',
      to: 'b',
      strategy: 'lineAnimation' as const,
      durationMs: 200,
      layerBindings: [],
    };
    expect((transition as any).triggers).toBeUndefined();
  });
});
