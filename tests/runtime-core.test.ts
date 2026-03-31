import { describe, expect, test } from 'bun:test';

import type { Icon, LayerSnapshot } from '../lib/schema';
import type { TransitionConfig } from '../lib/runtime-core/transition-resolver';
import {
  StateMachine,
  TransitionScheduler,
  EffectScheduler,
  computeDrawOnValues,
  computeDrawOffValues,
  computeVariableDrawValues,
  computeEffectValues,
  getEasingFunction,
  interpolateColor,
  estimateSpringDuration,
  resolveTransition,
  composeValues,
  springProgress,
} from '../lib/runtime-core';
import { parseHex, formatHex, lerpLinearRGB, lerpPalette } from '../lib/runtime-core/color-interpolation';
import type { DrawAnnotation, VariableDrawConfig } from '../lib/runtime-core';

const idleSnapshot: LayerSnapshot = {
  layers: {
    base: {
      id: 'base',
      visible: true,
      style: { fillOpacity: 1 },
      transform: { x: 0, rotate: 0, scaleX: 1, scaleY: 1 },
    },
  },
};

const activeSnapshot: LayerSnapshot = {
  layers: {
    base: {
      id: 'base',
      visible: true,
      style: { fillOpacity: 1 },
      transform: { x: 12, rotate: 90, scaleX: 2, scaleY: 2 },
    },
  },
};

const trackTransitionConfig: TransitionConfig = {
  id: 'idle-active',
  strategy: 'lineAnimation',
  durationMs: 100,
  easing: 'ease-in-out',
  layerBindings: [
    {
      fromLayerId: 'base',
      toLayerId: 'base',
      tracks: [
        { property: 'opacity', keyframes: [0, 1] },
        { property: 'rotate', keyframes: [0, 90] },
        { property: 'scale', keyframes: [1, 2] },
      ],
    },
  ],
};

const replaceTransitionConfig: TransitionConfig = {
  id: 'active-idle',
  strategy: 'replace',
  durationMs: 0,
  easing: 'linear',
  layerBindings: [{ fromLayerId: 'base', toLayerId: 'base' }],
};

function makeIcon(): Icon {
  return {
    id: 'icon-runtime',
    name: 'Runtime Test Icon',
    variants: {
      v24: {
        id: 'v24',
        size: 24,
        viewBox: [0, 0, 24, 24],
        layers: idleSnapshot.layers,
      },
    },
  };
}

describe('runtime core', () => {
  test('StateMachine transitions between variants and notifies listeners', () => {
    const icon: Icon = {
      id: 'icon-runtime',
      name: 'Runtime Test Icon',
      variants: {
        idle: {
          id: 'idle',
          size: 24,
          viewBox: [0, 0, 24, 24],
          layers: idleSnapshot.layers,
        },
        active: {
          id: 'active',
          size: 24,
          viewBox: [0, 0, 24, 24],
          layers: activeSnapshot.layers,
        },
      },
    };
    const machine = new StateMachine(icon, 'idle');
    const observed: Array<{ transitionId: string | null }> = [];

    machine.onStateChange((_snapshot, transition) => {
      observed.push({
        transitionId: transition?.id ?? null,
      });
    });

    expect(machine.currentState.layers).toBeDefined();

    machine.transitionTo('active');
    machine.transitionTo('idle');

    expect(observed).toEqual([
      { transitionId: null },
      { transitionId: null },
    ]);

    machine.dispose();
  });

  test('resolveTransition returns track bindings for track strategy and clears tracks for replace', () => {
    const trackResolved = resolveTransition(
      trackTransitionConfig,
      idleSnapshot,
      activeSnapshot,
    );
    expect(trackResolved).toMatchObject({
      strategy: 'lineAnimation',
      durationMs: 100,
      easing: 'ease-in-out',
    });
    expect(trackResolved.layerBindings).toHaveLength(1);
    expect(trackResolved.layerBindings[0]?.fromLayer?.id).toBe('base');
    expect(trackResolved.layerBindings[0]?.toLayer?.id).toBe('base');

    const replaceResolved = resolveTransition(
      replaceTransitionConfig,
      activeSnapshot,
      idleSnapshot,
    );
    expect(replaceResolved.strategy).toBe('replace');
    expect(replaceResolved.layerBindings[0]?.tracks).toEqual([]);
  });

  test('TransitionScheduler emits an immediate first frame and interpolates by progress', () => {
    const resolved = resolveTransition(
      trackTransitionConfig,
      idleSnapshot,
      activeSnapshot,
    );

    let nowValue = 0;
    let frameCallback: FrameRequestCallback | null = null;
    const frames: Array<{
      progress: number;
      opacity: number | undefined;
      rotate: number | undefined;
      scale: number | undefined;
    }> = [];
    let completed = 0;

    const scheduler = new TransitionScheduler(resolved, {
      now: () => nowValue,
      requestFrame: (callback) => {
        frameCallback = callback;
        return 1;
      },
      cancelFrame: () => {
        frameCallback = null;
      },
      onFrame: (progress, values) => {
        frames.push({
          progress,
          opacity: values.base?.opacity as number | undefined,
          rotate: values.base?.rotate as number | undefined,
          scale: values.base?.scale as number | undefined,
        });
      },
    });

    scheduler.onComplete(() => {
      completed += 1;
    });

    scheduler.start();
    expect(frames).toHaveLength(1);
    expect(frames[0]).toEqual({
      progress: 0,
      opacity: 0,
      rotate: 0,
      scale: 1,
    });

    nowValue = 50;
    (frameCallback as FrameRequestCallback | null)?.(50);
    expect(frames[1]?.progress).toBe(0.5);
    expect(frames[1]?.opacity).toBe(0.5);
    expect(frames[1]?.rotate).toBe(45);
    expect(frames[1]?.scale).toBe(1.5);
    expect(completed).toBe(0);

    nowValue = 100;
    (frameCallback as FrameRequestCallback | null)?.(100);
    expect(frames[2]?.progress).toBe(1);
    expect(frames[2]?.opacity).toBe(1);
    expect(frames[2]?.rotate).toBe(90);
    expect(frames[2]?.scale).toBe(2);
    expect(completed).toBe(1);
  });

  test('resolveTransition assigns fallback or morph to unmatched layers in a replace transition', () => {
    const fromSnapshot: LayerSnapshot = {
      layers: {
        shared: { id: 'shared', path: { d: 'M0 0H24V24H0Z' }, style: {} },
        exitOnly: { id: 'exitOnly', path: { d: 'M10 2L14 2L12 6Z' }, style: {} },
      },
    };
    const toSnapshot: LayerSnapshot = {
      layers: {
        shared: { id: 'shared', path: { d: 'M0 0H24V24H0Z' }, style: {} },
        enterOnly: { id: 'enterOnly', path: { d: 'M3 20 Q12 4 21 20 Z' }, style: {} },
      },
    };
    const transition: TransitionConfig = {
      id: 'replace-test',
      strategy: 'replace',
      durationMs: 200,
      easing: 'linear',
      layerBindings: [],
    };

    const resolved = resolveTransition(transition, fromSnapshot, toSnapshot);
    expect(resolved.strategy).toBe('replace');
    // All layers should be bound (explicit + auto-matched + fallback)
    expect(resolved.layerBindings.length).toBeGreaterThanOrEqual(2);

    // Each binding gets a strategy decision — morph or fallback
    for (const binding of resolved.layerBindings) {
      expect(binding.animationType).toBeDefined();
      // Replace strategy always clears tracks
      expect(binding.tracks).toEqual([]);
    }

    // The shared layer should be explicitly or semantically matched
    const sharedBinding = resolved.layerBindings.find(
      (b) => b.fromLayer?.id === 'shared' && b.toLayer?.id === 'shared',
    );
    expect(sharedBinding).toBeDefined();

    // exitOnly and enterOnly — either auto-matched (with morph/fallback) or
    // unmatched (with fade-out/fade-in fallback). Either way, they get a
    // strategy decision that includes animationType.
    const nonShared = resolved.layerBindings.filter(
      (b) => !(b.fromLayer?.id === 'shared' && b.toLayer?.id === 'shared'),
    );
    expect(nonShared.length).toBeGreaterThanOrEqual(1);
    for (const binding of nonShared) {
      // Must have either morph interpolator or fallback mode
      const hasStrategy = binding.morph !== undefined || binding.fallback !== undefined;
      expect(hasStrategy).toBeTrue();
    }
  });

  test('getEasingFunction returns expected values at 0, 0.5, and 1', () => {
    const cases = [
      ['linear', 0.5],
      ['ease-in', 0.25],
      ['ease-out', 0.75],
      ['ease-in-out', 0.5],
      ['ease-in-cubic', 0.125],
      ['ease-out-cubic', 0.875],
      ['unknown', 0.5],
    ] as const;

    for (const [name, midpoint] of cases) {
      const easing = getEasingFunction(name);
      expect(easing(0)).toBe(0);
      expect(easing(0.5)).toBe(midpoint);
      expect(easing(1)).toBe(1);
    }
  });

  test('getEasingFunction supports cubic-bezier strings and steps', () => {
    const cubicBezier = getEasingFunction('cubic-bezier(0.42, 0, 0.58, 1)');
    expect(cubicBezier(0)).toBe(0);
    expect(cubicBezier(0.5)).toBeGreaterThan(0.45);
    expect(cubicBezier(0.5)).toBeLessThan(0.55);
    expect(cubicBezier(1)).toBe(1);

    const stepsStart = getEasingFunction('steps(4, start)');
    const stepsEnd = getEasingFunction('steps(4, end)');
    expect(stepsStart(0)).toBe(0);
    expect(stepsStart(0.1)).toBe(0.25);
    expect(stepsEnd(0.24)).toBe(0);
    expect(stepsEnd(0.26)).toBe(0.25);
  });

  test('spring helpers produce overshoot and a bounded duration estimate', () => {
    const config = { type: 'spring' as const, stiffness: 220, damping: 12, mass: 1 };
    expect(springProgress(config, 0)).toBe(0);
    expect(springProgress(config, 150)).toBeGreaterThan(1);
    expect(estimateSpringDuration(config)).toBeGreaterThan(0);
    expect(estimateSpringDuration(config)).toBeLessThanOrEqual(5000);
  });

  test('TransitionScheduler interrupt returns a blend scheduler that eases values to rest', () => {
    const resolved = resolveTransition(
      trackTransitionConfig,
      idleSnapshot,
      activeSnapshot,
    );

    let nowValue = 0;
    let frameCallback: FrameRequestCallback | null = null;
    const blendFrames: Array<{ rotate?: number; scale?: number }> = [];

    const scheduler = new TransitionScheduler(resolved, {
      now: () => nowValue,
      requestFrame: (callback) => {
        frameCallback = callback;
        return 1;
      },
      cancelFrame: () => {
        frameCallback = null;
      },
    });

    scheduler.start();
    nowValue = 50;
    (frameCallback as FrameRequestCallback | null)?.(50);

    const blend = scheduler.interrupt(80, {
      now: () => nowValue,
      requestFrame: (callback) => {
        frameCallback = callback;
        return 2;
      },
      cancelFrame: () => {
        frameCallback = null;
      },
      onFrame: (_progress, values) => {
        blendFrames.push({
          rotate: values.base?.rotate as number | undefined,
          scale: values.base?.scale as number | undefined,
        });
      },
    });

    expect(blend).not.toBeNull();
    blend?.start();
    expect(blendFrames[0]?.rotate).toBe(45);
    expect(blendFrames[0]?.scale).toBe(1.5);

    nowValue = 130;
    (frameCallback as FrameRequestCallback | null)?.(130);
    expect(blendFrames[1]?.rotate).toBeLessThan(10);
    expect(blendFrames[1]?.scale).toBeLessThan(1.1);
  });
});

describe('magic replace', () => {
  test('preserveLayerIds marks bindings as preserved and clears morph/fallback', () => {
    const fromSnapshot: LayerSnapshot = {
      layers: {
        bg: { id: 'bg', path: { d: 'M0 0H24V24H0Z' }, style: {} },
        icon: { id: 'icon', path: { d: 'M4 4H20V20H4Z' }, style: {} },
      },
    };
    const toSnapshot: LayerSnapshot = {
      layers: {
        bg: { id: 'bg', path: { d: 'M0 0H24V24H0Z' }, style: {} },
        icon: { id: 'icon', path: { d: 'M6 6L18 6L12 18Z' }, style: {} },
      },
    };
    const transition: TransitionConfig = {
      id: 'magic',
      strategy: 'replace',
      durationMs: 200,
      easing: 'linear',
      layerBindings: [],
    };

    const resolved = resolveTransition(transition, fromSnapshot, toSnapshot, {
      preserveLayerIds: ['bg'],
    });

    const bgBinding = resolved.layerBindings.find((b) => b.fromLayer?.id === 'bg');
    expect(bgBinding).toBeDefined();
    expect(bgBinding!.preserved).toBeTrue();
    expect(bgBinding!.morph).toBeUndefined();
    expect(bgBinding!.fallback).toBeUndefined();

    const iconBinding = resolved.layerBindings.find((b) => b.fromLayer?.id === 'icon');
    expect(iconBinding).toBeDefined();
    expect(iconBinding!.preserved).toBeUndefined();
  });
});

describe('draw executor', () => {
  const draw: DrawAnnotation = {
    mode: 'byLayer',
    layers: {
      circle: { guidePoints: [{ t: 0, direction: 'forward' }, { t: 1, direction: 'forward' }] },
      arrow: { guidePoints: [{ t: 0, direction: 'forward' }, { t: 1, direction: 'forward' }] },
    },
  };

  test('computeDrawOnValues reveals layers in sequence from 0 to 1', () => {
    const at0 = computeDrawOnValues(draw, 0);
    expect(at0.arrow?.pathLength).toBe(0);
    expect(at0.circle?.pathLength).toBe(0);

    const at25 = computeDrawOnValues(draw, 0.25);
    expect(at25.arrow?.pathLength).toBe(0.5);
    expect(at25.circle?.pathLength).toBe(0);

    const at50 = computeDrawOnValues(draw, 0.5);
    expect(at50.arrow?.pathLength).toBe(1);
    expect(at50.circle?.pathLength).toBe(0);

    const at75 = computeDrawOnValues(draw, 0.75);
    expect(at75.arrow?.pathLength).toBe(1);
    expect(at75.circle?.pathLength).toBe(0.5);

    const at1 = computeDrawOnValues(draw, 1);
    expect(at1.arrow?.pathLength).toBe(1);
    expect(at1.circle?.pathLength).toBe(1);
  });

  test('computeDrawOffValues hides layers in reverse sequence', () => {
    const at0 = computeDrawOffValues(draw, 0);
    expect(at0.arrow?.pathLength).toBe(1);
    expect(at0.circle?.pathLength).toBe(1);

    const at1 = computeDrawOffValues(draw, 1);
    expect(at1.arrow?.pathLength).toBe(0);
    expect(at1.circle?.pathLength).toBe(0);
  });

  test('computeDrawOnValues respects guide point timing ranges', () => {
    const timedDraw: DrawAnnotation = {
      mode: 'byLayer',
      layers: {
        first: { guidePoints: [{ t: 0 }, { t: 0.3 }] },
        second: { guidePoints: [{ t: 0.3 }, { t: 1 }] },
      },
    };

    const at15 = computeDrawOnValues(timedDraw, 0.15);
    expect(at15.first?.pathLength).toBe(0.5);
    expect(at15.second?.pathLength).toBe(0);

    const at65 = computeDrawOnValues(timedDraw, 0.65);
    expect(at65.first?.pathLength).toBe(1);
    expect(at65.second?.pathLength).toBeCloseTo(0.5, 4);
  });
});

describe('variable draw', () => {
  test('computeVariableDrawValues distributes progress across layers in sequence', () => {
    const config: VariableDrawConfig = {
      participatingLayerIds: ['layer-a', 'layer-b'],
    };

    const at0 = computeVariableDrawValues(config, 0);
    expect(at0['layer-a']?.pathLength).toBe(0);
    expect(at0['layer-b']?.pathLength).toBe(0);

    const at25 = computeVariableDrawValues(config, 0.25);
    expect(at25['layer-a']?.pathLength).toBe(0.5);
    expect(at25['layer-b']?.pathLength).toBe(0);

    const at50 = computeVariableDrawValues(config, 0.5);
    expect(at50['layer-a']?.pathLength).toBe(1);
    expect(at50['layer-b']?.pathLength).toBe(0);

    const at1 = computeVariableDrawValues(config, 1);
    expect(at1['layer-a']?.pathLength).toBe(1);
    expect(at1['layer-b']?.pathLength).toBe(1);
  });

  test('computeVariableDrawValues returns empty for no layers', () => {
    const result = computeVariableDrawValues({ participatingLayerIds: [] }, 0.5);
    expect(result).toEqual({});
  });
});

describe('effect scheduler', () => {
  test('interpolateColor blends hex colors including shorthand input', () => {
    expect(interpolateColor('#000', '#ffffff', 0.5)).toBe('#808080');
    expect(interpolateColor('#ff000080', '#00ff0080', 0.5)).toBe('#80800080');
  });

  test('bounce effect produces translateY values peaking at midpoint', () => {
    const values = computeEffectValues('bounce', 0, ['icon']);
    expect(Math.abs((values.icon?.translateY as number | undefined) ?? 0)).toBeLessThan(0.01);

    const mid = computeEffectValues('bounce', 0.5, ['icon']);
    expect(mid.icon?.translateY as number | undefined).toBeLessThan(0);

    const end = computeEffectValues('bounce', 1, ['icon']);
    expect(Math.abs((end.icon?.translateY as number | undefined) ?? 1)).toBeLessThan(0.01);
  });

  test('pulse effect produces scale values peaking at midpoint', () => {
    const start = computeEffectValues('pulse', 0, ['icon']);
    expect(start.icon?.scale as number | undefined).toBe(1);

    const mid = computeEffectValues('pulse', 0.5, ['icon']);
    expect(mid.icon?.scale as number | undefined).toBeGreaterThan(1);

    const end = computeEffectValues('pulse', 1, ['icon']);
    expect(Math.abs(((end.icon?.scale as number | undefined) ?? 2) - 1)).toBeLessThan(0.01);
  });

  test('rotate effect produces 0-360 rotation', () => {
    const start = computeEffectValues('rotate', 0, ['icon']);
    expect(start.icon?.rotate as number | undefined).toBe(0);

    const mid = computeEffectValues('rotate', 0.5, ['icon']);
    expect(mid.icon?.rotate as number | undefined).toBe(180);

    const end = computeEffectValues('rotate', 1, ['icon']);
    expect(end.icon?.rotate as number | undefined).toBe(360);
  });

  test('lineDrawOn effect delegates to draw executor', () => {
    const draw: DrawAnnotation = {
      mode: 'byLayer',
      layers: {
        line: { guidePoints: [{ t: 0 }, { t: 1 }] },
      },
    };

    const values = computeEffectValues('lineDrawOn', 0.5, [], draw);
    expect(values.line?.pathLength as number | undefined).toBe(0.5);
  });

  test('EffectScheduler emits frames with correct timing', () => {
    const frames: Array<{ opacity?: number }> = [];
    let nowValue = 0;
    let frameCallback: FrameRequestCallback | null = null;
    let completed = 0;

    const scheduler = new EffectScheduler(
      { kind: 'appear', durationMs: 100, easing: 'linear' },
      {
        now: () => nowValue,
        requestFrame: (cb) => { frameCallback = cb; return 1; },
        cancelFrame: () => { frameCallback = null; },
        onFrame: (values) => { frames.push({ opacity: values.icon?.opacity as number | undefined }); },
        targetLayerIds: ['icon'],
      },
    );

    scheduler.onComplete(() => { completed += 1; });
    scheduler.start();

    expect(frames).toHaveLength(1);
    expect(frames[0]?.opacity).toBe(0);

    nowValue = 50;
    (frameCallback as FrameRequestCallback | null)?.(50);
    expect(frames[1]?.opacity).toBe(0.5);

    nowValue = 100;
    (frameCallback as FrameRequestCallback | null)?.(100);
    expect(frames[2]?.opacity).toBe(1);
    expect(completed).toBe(1);
  });

  test('resolveTransition applies stagger delays and explicit binding timing overrides', () => {
    const fromSnapshot: LayerSnapshot = {
      layers: {
        a: { id: 'a', path: { d: 'M0 0H4V4H0Z' }, style: {}, role: 'primary' },
        b: { id: 'b', path: { d: 'M5 0H9V4H5Z' }, style: {}, role: 'secondary' },
      },
    };
    const toSnapshot: LayerSnapshot = {
      layers: {
        a: { id: 'a', path: { d: 'M0 0H4V4H0Z' }, style: {}, role: 'primary' },
        b: { id: 'b', path: { d: 'M5 0H9V4H5Z' }, style: {}, role: 'secondary' },
      },
    };
    const transition: TransitionConfig = {
      id: 'staggered',
      strategy: 'replace',
      durationMs: 200,
      easing: 'linear',
      stagger: { mode: 'linear', perLayerMs: 40 },
      layerBindings: [
        { fromLayerId: 'a', toLayerId: 'a', tracks: [{ property: 'rotate', keyframes: [0, 10] }] },
        {
          fromLayerId: 'b',
          toLayerId: 'b',
          delayMs: 10,
          durationMs: 90,
          tracks: [{ property: 'rotate', keyframes: [0, 20] }],
        },
      ],
    };

    const resolved = resolveTransition(transition, fromSnapshot, toSnapshot);
    expect(resolved.layerBindings[0]?.delayMs).toBe(0);
    expect(resolved.layerBindings[1]?.delayMs).toBe(10);
    expect(resolved.layerBindings[1]?.durationMs).toBe(90);
  });

  test('resolveTransition expands transition duration for individually staggered bindings', () => {
    const fromSnapshot: LayerSnapshot = {
      layers: {
        a: { id: 'a', path: { d: 'M0 0H4V4H0Z' }, style: {} },
        b: { id: 'b', path: { d: 'M5 0H9V4H5Z' }, style: {} },
        c: { id: 'c', path: { d: 'M10 0H14V4H10Z' }, style: {} },
      },
    };
    const toSnapshot: LayerSnapshot = {
      layers: {
        a: { id: 'a', path: { d: 'M0 0H4V4H0Z' }, style: {} },
        b: { id: 'b', path: { d: 'M5 0H9V4H5Z' }, style: {} },
        c: { id: 'c', path: { d: 'M10 0H14V4H10Z' }, style: {} },
      },
    };
    const transition: TransitionConfig = {
      id: 'individually-staggered',
      strategy: 'replace',
      durationMs: 100,
      easing: 'linear',
      stagger: { mode: 'individually', perLayerMs: 0 },
      layerBindings: [
        { fromLayerId: 'a', toLayerId: 'a' },
        { fromLayerId: 'b', toLayerId: 'b' },
        { fromLayerId: 'c', toLayerId: 'c' },
      ],
    };

    const resolved = resolveTransition(transition, fromSnapshot, toSnapshot);
    expect(resolved.layerBindings.map((binding) => binding.delayMs)).toEqual([0, 100, 200]);
    expect(resolved.layerBindings.map((binding) => binding.durationMs)).toEqual([100, 100, 100]);
    expect(resolved.durationMs).toBe(300);
  });

  test('resolveTransition applies from-center stagger order as binding ranks', () => {
    const fromSnapshot: LayerSnapshot = {
      layers: {
        a: { id: 'a', path: { d: 'M0 0H2V2H0Z' }, style: {} },
        b: { id: 'b', path: { d: 'M3 0H5V2H3Z' }, style: {} },
        c: { id: 'c', path: { d: 'M6 0H8V2H6Z' }, style: {} },
      },
    };
    const toSnapshot: LayerSnapshot = {
      layers: {
        a: { id: 'a', path: { d: 'M0 0H2V2H0Z' }, style: {} },
        b: { id: 'b', path: { d: 'M3 0H5V2H3Z' }, style: {} },
        c: { id: 'c', path: { d: 'M6 0H8V2H6Z' }, style: {} },
      },
    };
    const transition: TransitionConfig = {
      strategy: 'replace',
      durationMs: 120,
      stagger: { mode: 'from-center', perLayerMs: 25 },
      layerBindings: [
        { fromLayerId: 'a', toLayerId: 'a' },
        { fromLayerId: 'b', toLayerId: 'b' },
        { fromLayerId: 'c', toLayerId: 'c' },
      ],
    };

    const resolved = resolveTransition(transition, fromSnapshot, toSnapshot);
    expect(resolved.layerBindings.map((binding) => binding.delayMs)).toEqual([25, 0, 50]);
  });

  test('resolveTransition applies from-edges stagger order as binding ranks', () => {
    const fromSnapshot: LayerSnapshot = {
      layers: {
        a: { id: 'a', path: { d: 'M0 0H2V2H0Z' }, style: {} },
        b: { id: 'b', path: { d: 'M3 0H5V2H3Z' }, style: {} },
        c: { id: 'c', path: { d: 'M6 0H8V2H6Z' }, style: {} },
        d: { id: 'd', path: { d: 'M9 0H11V2H9Z' }, style: {} },
      },
    };
    const toSnapshot: LayerSnapshot = {
      layers: {
        a: { id: 'a', path: { d: 'M0 0H2V2H0Z' }, style: {} },
        b: { id: 'b', path: { d: 'M3 0H5V2H3Z' }, style: {} },
        c: { id: 'c', path: { d: 'M6 0H8V2H6Z' }, style: {} },
        d: { id: 'd', path: { d: 'M9 0H11V2H9Z' }, style: {} },
      },
    };
    const transition: TransitionConfig = {
      strategy: 'replace',
      durationMs: 120,
      stagger: { mode: 'from-edges', perLayerMs: 10 },
      layerBindings: [
        { fromLayerId: 'a', toLayerId: 'a' },
        { fromLayerId: 'b', toLayerId: 'b' },
        { fromLayerId: 'c', toLayerId: 'c' },
        { fromLayerId: 'd', toLayerId: 'd' },
      ],
    };

    const resolved = resolveTransition(transition, fromSnapshot, toSnapshot);
    expect(resolved.layerBindings.map((binding) => binding.delayMs)).toEqual([0, 20, 30, 10]);
  });
});

// --- B2: composeValues ---

describe('composeValues', () => {
  test('additive transform properties', () => {
    const transition = { layer1: { translateX: 10, translateY: 5, rotate: 45 } };
    const effect = { layer1: { translateX: 3, translateY: -2, rotate: 10 } };
    const result = composeValues(transition, effect);
    expect(result.layer1!.translateX).toBe(13);
    expect(result.layer1!.translateY).toBe(3);
    expect(result.layer1!.rotate).toBe(55);
  });

  test('multiplicative scale and opacity', () => {
    const transition = { layer1: { scale: 1.5, opacity: 0.8 } };
    const effect = { layer1: { scale: 1.2, opacity: 0.5 } };
    const result = composeValues(transition, effect);
    expect(result.layer1!.scale).toBeCloseTo(1.8);
    expect(result.layer1!.opacity).toBeCloseTo(0.4);
  });

  test('override for other properties', () => {
    const transition = { layer1: { pathLength: 0.5, strokeWidth: 2 } };
    const effect = { layer1: { pathLength: 0.8, strokeWidth: 4 } };
    const result = composeValues(transition, effect);
    expect(result.layer1!.pathLength).toBe(0.8);
    expect(result.layer1!.strokeWidth).toBe(4);
  });

  test('merges layers from both sources', () => {
    const transition = { layer1: { opacity: 1 } };
    const effect = { layer2: { opacity: 0.5 } };
    const result = composeValues(transition, effect);
    expect(result.layer1!.opacity).toBe(1);
    expect(result.layer2!.opacity).toBe(0.5);
  });

  test('empty effect sets return transition values', () => {
    const transition = { layer1: { opacity: 0.7 } };
    const result = composeValues(transition);
    expect(result.layer1!.opacity).toBe(0.7);
  });

  test('multiple effect sets compose sequentially', () => {
    const transition = { layer1: { translateX: 10 } };
    const effect1 = { layer1: { translateX: 5 } };
    const effect2 = { layer1: { translateX: 3 } };
    const result = composeValues(transition, effect1, effect2);
    expect(result.layer1!.translateX).toBe(18);
  });
});

// --- B4: color interpolation ---

describe('color interpolation', () => {
  test('parseHex parses #RRGGBB', () => {
    expect(parseHex('#ff0000')).toEqual([255, 0, 0]);
    expect(parseHex('#00ff00')).toEqual([0, 255, 0]);
    expect(parseHex('#0000ff')).toEqual([0, 0, 255]);
  });

  test('parseHex parses #RGB shorthand', () => {
    expect(parseHex('#f00')).toEqual([255, 0, 0]);
    expect(parseHex('#0f0')).toEqual([0, 255, 0]);
  });

  test('parseHex parses #RRGGBBAA (ignores alpha)', () => {
    expect(parseHex('#ff000080')).toEqual([255, 0, 0]);
  });

  test('parseHex returns null for invalid input', () => {
    expect(parseHex('')).toBeNull();
    expect(parseHex('not-a-color')).toBeNull();
    expect(parseHex('#xyz')).toBeNull();
  });

  test('formatHex formats to lowercase #rrggbb', () => {
    expect(formatHex([255, 0, 0])).toBe('#ff0000');
    expect(formatHex([0, 128, 255])).toBe('#0080ff');
  });

  test('lerpLinearRGB at t=0 returns first color', () => {
    expect(lerpLinearRGB('#ff0000', '#0000ff', 0)).toBe('#ff0000');
  });

  test('lerpLinearRGB at t=1 returns second color', () => {
    expect(lerpLinearRGB('#ff0000', '#0000ff', 1)).toBe('#0000ff');
  });

  test('lerpLinearRGB at t=0.5 produces mid-tone', () => {
    const mid = lerpLinearRGB('#000000', '#ffffff', 0.5);
    const parsed = parseHex(mid);
    expect(parsed).not.toBeNull();
    expect(parsed![0]).toBeGreaterThan(170);
    expect(parsed![0]).toBeLessThan(200);
  });

  test('lerpPalette interpolates through multiple colors', () => {
    const palette = ['#ff0000', '#00ff00', '#0000ff'];
    expect(lerpPalette(palette, 0)).toBe('#ff0000');
    expect(lerpPalette(palette, 1)).toBe('#0000ff');
    expect(lerpPalette(palette, 0.5)).toBe('#00ff00');
  });

  test('lerpPalette handles single-color palette', () => {
    expect(lerpPalette(['#ff0000'], 0.5)).toBe('#ff0000');
  });

  test('lerpPalette handles empty palette', () => {
    expect(lerpPalette([], 0.5)).toBe('#000000');
  });
});

// ---------------------------------------------------------------------------
// Regression tests for variant-centric model fixes
// ---------------------------------------------------------------------------

describe('StateMachine — variant-centric model', () => {
  function makeIconWithTransition(): Icon {
    return {
      id: 'icon-with-transition',
      name: 'Icon with Transition',
      variants: {
        idle: { id: 'idle', size: 24, viewBox: [0, 0, 24, 24], layers: idleSnapshot.layers },
        active: { id: 'active', size: 24, viewBox: [0, 0, 24, 24], layers: activeSnapshot.layers },
      },
      transitions: {
        'idle-active': {
          id: 'idle-active',
          fromIconId: 'icon-with-transition',
          toIconId: 'icon-with-transition',
          fromVariantId: 'idle',
          toVariantId: 'active',
          strategy: 'lineAnimation',
          durationMs: 200,
        },
      },
    };
  }

  test('currentVariantId tracks the variant after transitionTo', () => {
    const icon = makeIconWithTransition();
    const machine = new StateMachine(icon, 'idle');
    expect(machine.currentVariantId).toBe('idle');
    machine.transitionTo('active');
    expect(machine.currentVariantId).toBe('active');
    machine.transitionTo('idle');
    expect(machine.currentVariantId).toBe('idle');
    machine.dispose();
  });

  test('transitionTo emits the matching Transition object when one is defined', () => {
    const icon = makeIconWithTransition();
    const machine = new StateMachine(icon, 'idle');
    const emitted: Array<string | null> = [];
    machine.onStateChange((_snapshot, transition) => {
      emitted.push(transition?.id ?? null);
    });
    machine.transitionTo('active');
    // idle→active has a defined transition
    expect(emitted[0]).toBe('idle-active');
    // active→idle has no reverse transition defined
    machine.transitionTo('idle');
    expect(emitted[1]).toBeNull();
    machine.dispose();
  });

  test('transitionTo is a no-op and returns null for same variant', () => {
    const icon = makeIconWithTransition();
    const machine = new StateMachine(icon, 'idle');
    let callCount = 0;
    machine.onStateChange(() => { callCount++; });
    const result = machine.transitionTo('idle');
    expect(result).toBeNull();
    expect(callCount).toBe(0);
    machine.dispose();
  });

  test('transitionTo throws for unknown variant ID', () => {
    const icon = makeIconWithTransition();
    const machine = new StateMachine(icon, 'idle');
    expect(() => machine.transitionTo('nonexistent')).toThrow(/nonexistent/);
    machine.dispose();
  });
});

describe('EffectScheduler — setTargetLayerIds', () => {
  test('setTargetLayerIds updates layer IDs mid-run so subsequent frames target new layers', () => {
    let capturedLayerIds: string[] | null = null;

    const effect: import('../lib/schema').Effect = {
      id: 'pulse',
      kind: 'pulse',
      durationMs: 100,
    };

    let frameHandle = 0;
    const frames: Array<(time: number) => void> = [];
    const scheduler = new EffectScheduler(effect, {
      requestFrame: (cb) => { frames.push(cb); return ++frameHandle; },
      cancelFrame: () => {},
      targetLayerIds: ['layer-a'],
      onFrame: (values) => {
        capturedLayerIds = Object.keys(values);
      },
    });

    scheduler.start();
    // First frame — should target layer-a
    frames[0]!(0);
    expect(capturedLayerIds!).toContain('layer-a');

    // Simulate variant transition mid-effect
    scheduler.setTargetLayerIds(['layer-b', 'layer-c']);

    // Next frame — should target new layers
    frames[1]!(50);
    expect(capturedLayerIds!).not.toContain('layer-a');
    expect(capturedLayerIds!).toContain('layer-b');
    expect(capturedLayerIds!).toContain('layer-c');
    scheduler.cancel();
  });
});
