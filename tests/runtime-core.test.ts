import { describe, expect, test } from 'bun:test';

import type { Icon, State, Transition } from '../lib/schema';
import {
  StateMachine,
  TransitionScheduler,
  EffectScheduler,
  computeDrawOnValues,
  computeDrawOffValues,
  computeVariableDrawValues,
  computeEffectValues,
  getEasingFunction,
  resolveTransition,
  composeValues,
} from '../lib/runtime-core';
import { parseHex, formatHex, lerpLinearRGB, lerpPalette } from '../lib/runtime-core/color-interpolation';
import type { DrawAnnotation, VariableDrawConfig } from '../lib/runtime-core';

function makeIcon(): Icon {
  const idleState: State = {
    id: 'idle',
    layers: {
      base: {
        id: 'base',
        visible: true,
        style: { fillOpacity: 1 },
        transform: { x: 0, rotate: 0, scaleX: 1, scaleY: 1 },
      },
    },
  };

  const activeState: State = {
    id: 'active',
    layers: {
      base: {
        id: 'base',
        visible: true,
        style: { fillOpacity: 1 },
        transform: { x: 12, rotate: 90, scaleX: 2, scaleY: 2 },
      },
    },
  };

  const trackTransition: Transition = {
    id: 'idle-active',
    from: 'idle',
    to: 'active',
    strategy: 'track',
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

  const replaceTransition: Transition = {
    id: 'active-idle',
    from: 'active',
    to: 'idle',
    strategy: 'replace',
    durationMs: 0,
    easing: 'linear',
    layerBindings: [{ fromLayerId: 'base', toLayerId: 'base' }],
  };

  return {
    id: 'icon-runtime',
    name: 'Runtime Test Icon',
    variants: {
      v24: {
        id: 'v24',
        size: 24,
        viewBox: [0, 0, 24, 24],
        defaultState: 'idle',
        states: {
          idle: idleState,
          active: activeState,
        },
      },
    },
    transitions: {
      [trackTransition.id]: trackTransition,
      [replaceTransition.id]: replaceTransition,
    },
  };
}

describe('runtime core', () => {
  test('StateMachine transitions between states and notifies listeners', () => {
    const icon = makeIcon();
    const machine = new StateMachine(icon, 'v24');
    const observed: Array<{ stateId: string; transitionId: string | null }> = [];

    machine.onStateChange((state, transition) => {
      observed.push({
        stateId: state.id,
        transitionId: transition?.id ?? null,
      });
    });

    expect(machine.currentState.id).toBe('idle');

    const transition = machine.transitionTo('active');
    expect(transition?.id).toBe('idle-active');
    expect(machine.currentState.id).toBe('active');

    const snap = machine.transitionTo('idle');
    expect(snap?.id).toBe('active-idle');
    expect(machine.currentState.id).toBe('idle');

    expect(observed).toEqual([
      { stateId: 'active', transitionId: 'idle-active' },
      { stateId: 'idle', transitionId: 'active-idle' },
    ]);

    machine.dispose();
  });

  test('resolveTransition returns track bindings for track strategy and clears tracks for replace', () => {
    const icon = makeIcon();
    const variant = icon.variants.v24;
    const trackTransition = icon.transitions['idle-active']!;
    const replaceTransition = icon.transitions['active-idle']!;

    const trackResolved = resolveTransition(
      trackTransition,
      variant.states[trackTransition.from]!,
      variant.states[trackTransition.to]!,
    );
    expect(trackResolved).toMatchObject({
      strategy: 'track',
      durationMs: 100,
      easing: 'ease-in-out',
    });
    expect(trackResolved.layerBindings).toHaveLength(1);
    expect(trackResolved.layerBindings[0]?.fromLayer?.id).toBe('base');
    expect(trackResolved.layerBindings[0]?.toLayer?.id).toBe('base');
    expect(trackResolved.layerBindings[0]?.tracks).toEqual(
      trackTransition.layerBindings[0]?.tracks ?? [],
    );

    const replaceResolved = resolveTransition(
      replaceTransition,
      variant.states[replaceTransition.from]!,
      variant.states[replaceTransition.to]!,
    );
    expect(replaceResolved.strategy).toBe('replace');
    expect(replaceResolved.layerBindings[0]?.tracks).toEqual([]);
  });

  test('TransitionScheduler emits an immediate first frame and interpolates by progress', () => {
    const icon = makeIcon();
    const variant = icon.variants.v24;
    const resolved = resolveTransition(
      icon.transitions['idle-active']!,
      variant.states.idle!,
      variant.states.active!,
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
          opacity: values.base?.opacity,
          rotate: values.base?.rotate,
          scale: values.base?.scale,
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
    // State with a layer that only exists in 'from' (exit) and one only in 'to' (enter)
    const fromState: State = {
      id: 'from',
      layers: {
        shared: { id: 'shared', path: { d: 'M0 0H24V24H0Z' }, style: {} },
        exitOnly: { id: 'exitOnly', path: { d: 'M10 2L14 2L12 6Z' }, style: {} },
      },
    };
    const toState: State = {
      id: 'to',
      layers: {
        shared: { id: 'shared', path: { d: 'M0 0H24V24H0Z' }, style: {} },
        enterOnly: { id: 'enterOnly', path: { d: 'M3 20 Q12 4 21 20 Z' }, style: {} },
      },
    };
    const transition: Transition = {
      id: 'replace-test',
      from: 'from',
      to: 'to',
      strategy: 'replace',
      durationMs: 200,
      easing: 'linear',
      layerBindings: [],
    };

    const resolved = resolveTransition(transition, fromState, toState);
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
});

describe('magic replace', () => {
  test('preserveLayerIds marks bindings as preserved and clears morph/fallback', () => {
    const fromState: State = {
      id: 'from',
      layers: {
        bg: { id: 'bg', path: { d: 'M0 0H24V24H0Z' }, style: {} },
        icon: { id: 'icon', path: { d: 'M4 4H20V20H4Z' }, style: {} },
      },
    };
    const toState: State = {
      id: 'to',
      layers: {
        bg: { id: 'bg', path: { d: 'M0 0H24V24H0Z' }, style: {} },
        icon: { id: 'icon', path: { d: 'M6 6L18 6L12 18Z' }, style: {} },
      },
    };
    const transition: Transition = {
      id: 'magic',
      from: 'from',
      to: 'to',
      strategy: 'replace',
      durationMs: 200,
      easing: 'linear',
      layerBindings: [],
    };

    const resolved = resolveTransition(transition, fromState, toState, {
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

    // At progress 0.25, first layer (arrow, sorted) is half revealed, second not started
    const at25 = computeDrawOnValues(draw, 0.25);
    expect(at25.arrow?.pathLength).toBe(0.5);
    expect(at25.circle?.pathLength).toBe(0);

    // At progress 0.5, first layer fully revealed, second not started
    const at50 = computeDrawOnValues(draw, 0.5);
    expect(at50.arrow?.pathLength).toBe(1);
    expect(at50.circle?.pathLength).toBe(0);

    // At progress 0.75, first fully revealed, second half revealed
    const at75 = computeDrawOnValues(draw, 0.75);
    expect(at75.arrow?.pathLength).toBe(1);
    expect(at75.circle?.pathLength).toBe(0.5);

    const at1 = computeDrawOnValues(draw, 1);
    expect(at1.arrow?.pathLength).toBe(1);
    expect(at1.circle?.pathLength).toBe(1);
  });

  test('computeDrawOffValues hides layers in reverse sequence', () => {
    const at0 = computeDrawOffValues(draw, 0);
    // At start all layers are fully visible
    expect(at0.arrow?.pathLength).toBe(1);
    expect(at0.circle?.pathLength).toBe(1);

    const at1 = computeDrawOffValues(draw, 1);
    // At end all layers are hidden
    expect(at1.arrow?.pathLength).toBe(0);
    expect(at1.circle?.pathLength).toBe(0);
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
  test('bounce effect produces translateY values peaking at midpoint', () => {
    const values = computeEffectValues('bounce', 0, ['icon']);
    expect(Math.abs(values.icon?.translateY ?? 0)).toBeLessThan(0.01);

    const mid = computeEffectValues('bounce', 0.5, ['icon']);
    expect(mid.icon?.translateY).toBeLessThan(0); // moves up (negative Y)

    const end = computeEffectValues('bounce', 1, ['icon']);
    expect(Math.abs(end.icon?.translateY ?? 1)).toBeLessThan(0.01); // returns to ~0
  });

  test('pulse effect produces scale values peaking at midpoint', () => {
    const start = computeEffectValues('pulse', 0, ['icon']);
    expect(start.icon?.scale).toBe(1);

    const mid = computeEffectValues('pulse', 0.5, ['icon']);
    expect(mid.icon?.scale).toBeGreaterThan(1); // scale up

    const end = computeEffectValues('pulse', 1, ['icon']);
    expect(Math.abs((end.icon?.scale ?? 2) - 1)).toBeLessThan(0.01);
  });

  test('rotate effect produces 0-360 rotation', () => {
    const start = computeEffectValues('rotate', 0, ['icon']);
    expect(start.icon?.rotate).toBe(0);

    const mid = computeEffectValues('rotate', 0.5, ['icon']);
    expect(mid.icon?.rotate).toBe(180);

    const end = computeEffectValues('rotate', 1, ['icon']);
    expect(end.icon?.rotate).toBe(360);
  });

  test('lineDrawOn effect delegates to draw executor', () => {
    const draw: DrawAnnotation = {
      mode: 'byLayer',
      layers: {
        line: { guidePoints: [{ t: 0 }, { t: 1 }] },
      },
    };

    const values = computeEffectValues('lineDrawOn', 0.5, [], draw);
    expect(values.line?.pathLength).toBe(0.5); // single layer, half revealed at progress 0.5
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
        onFrame: (values) => { frames.push({ opacity: values.icon?.opacity }); },
        targetLayerIds: ['icon'],
      },
    );

    scheduler.onComplete(() => { completed += 1; });
    scheduler.start();

    // Frame 0: progress=0, appear opacity=0
    expect(frames).toHaveLength(1);
    expect(frames[0]?.opacity).toBe(0);

    // Frame at 50ms: progress=0.5
    nowValue = 50;
    (frameCallback as FrameRequestCallback | null)?.(50);
    expect(frames[1]?.opacity).toBe(0.5);

    // Frame at 100ms: progress=1
    nowValue = 100;
    (frameCallback as FrameRequestCallback | null)?.(100);
    expect(frames[2]?.opacity).toBe(1);
    expect(completed).toBe(1);
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
    // In linear RGB, mid-gray is ~188 (not 128) due to gamma
    const parsed = parseHex(mid);
    expect(parsed).not.toBeNull();
    expect(parsed![0]).toBeGreaterThan(170);
    expect(parsed![0]).toBeLessThan(200);
  });

  test('lerpPalette interpolates through multiple colors', () => {
    const palette = ['#ff0000', '#00ff00', '#0000ff'];
    expect(lerpPalette(palette, 0)).toBe('#ff0000');
    expect(lerpPalette(palette, 1)).toBe('#0000ff');
    // At 0.5, should be pure green
    expect(lerpPalette(palette, 0.5)).toBe('#00ff00');
  });

  test('lerpPalette handles single-color palette', () => {
    expect(lerpPalette(['#ff0000'], 0.5)).toBe('#ff0000');
  });

  test('lerpPalette handles empty palette', () => {
    expect(lerpPalette([], 0.5)).toBe('#000000');
  });
});
