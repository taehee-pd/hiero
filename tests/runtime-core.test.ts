import { describe, expect, test } from 'bun:test';

import type { Icon, State, Transition } from '../lib/schema';
import {
  StateMachine,
  TransitionScheduler,
  getEasingFunction,
  resolveTransition,
} from '../lib/runtime-core';

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
