import { describe, expect, test } from 'bun:test';

import { TransitionScheduler, resolveTransition } from '../lib/runtime-core';
import { isIcon } from '../lib/schema/guards';
import { HAMBURGER_CLOSE_ICON } from '../lib/schema/sample-icons/hamburger-close';

describe('hamburger close sample icon', () => {
  test('icon definition passes the schema icon guard', () => {
    expect(isIcon(HAMBURGER_CLOSE_ICON)).toBeTrue();
  });

  test('resolveTransition maps open to closed bindings as expected', () => {
    const variant = HAMBURGER_CLOSE_ICON.variants['24'];
    const transition = HAMBURGER_CLOSE_ICON.transitions['open-to-closed'];
    const resolved = resolveTransition(
      transition,
      variant.states.open,
      variant.states.closed,
    );

    expect(resolved).toMatchObject({
      strategy: 'track',
      durationMs: 300,
      easing: 'ease-in-out',
    });
    expect(resolved.layerBindings).toHaveLength(3);
    expect(resolved.layerBindings.map((binding) => binding.fromLayer?.id)).toEqual([
      'top',
      'middle',
      'bottom',
    ]);
    expect(resolved.layerBindings[0]?.tracks).toEqual([
      { property: 'rotate', keyframes: [0, 45] },
      { property: 'translateY', keyframes: [0, 5] },
    ]);
    expect(resolved.layerBindings[1]?.tracks).toEqual([
      { property: 'opacity', keyframes: [1, 0] },
    ]);
    expect(resolved.layerBindings[2]?.tracks).toEqual([
      { property: 'rotate', keyframes: [0, -45] },
      { property: 'translateY', keyframes: [0, -5] },
    ]);
  });

  test('scheduler completes after the expected duration', () => {
    const variant = HAMBURGER_CLOSE_ICON.variants['24'];
    const resolved = resolveTransition(
      HAMBURGER_CLOSE_ICON.transitions['open-to-closed'],
      variant.states.open,
      variant.states.closed,
    );

    let nowValue = 0;
    let frameCallback: FrameRequestCallback | null = null;
    let completeCount = 0;
    const progressValues: number[] = [];

    const scheduler = new TransitionScheduler(resolved, {
      now: () => nowValue,
      requestFrame: (callback) => {
        frameCallback = callback;
        return 1;
      },
      cancelFrame: () => {
        frameCallback = null;
      },
      onFrame: (progress) => {
        progressValues.push(progress);
      },
    });

    scheduler.onComplete(() => {
      completeCount += 1;
    });

    scheduler.start();
    expect(progressValues[0]).toBe(0);
    expect(completeCount).toBe(0);

    nowValue = 150;
    frameCallback?.(150);
    expect(progressValues[1]).toBe(0.5);
    expect(completeCount).toBe(0);

    nowValue = 300;
    frameCallback?.(300);
    expect(progressValues[2]).toBe(1);
    expect(completeCount).toBe(1);
  });
});
