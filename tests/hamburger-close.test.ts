import { describe, expect, test } from 'bun:test';

import { TransitionScheduler, resolveTransition } from '../lib/runtime-core';
import type { TransitionConfig } from '../lib/runtime-core/transition-resolver';
import { isIcon } from '../lib/schema/guards';
import { HAMBURGER_CLOSE_ICON, HAMBURGER_CLOSE_BINDINGS } from '../lib/schema/sample-icons/hamburger-close';
import { variantToSnapshot } from '../lib/schema/types';

describe('hamburger close sample icon', () => {
  test('icon definition passes the schema icon guard', () => {
    expect(isIcon(HAMBURGER_CLOSE_ICON)).toBeTrue();
  });

  test('resolveTransition maps open to closed bindings as expected', () => {
    const openSnapshot = variantToSnapshot(HAMBURGER_CLOSE_ICON.variants['24-open']);
    const closedSnapshot = variantToSnapshot(HAMBURGER_CLOSE_ICON.variants['24-closed']);
    const transition: TransitionConfig = {
      id: 'open-to-closed',
      strategy: 'lineAnimation',
      durationMs: 300,
      easing: 'ease-in-out',
      layerBindings: HAMBURGER_CLOSE_BINDINGS,
    };
    const resolved = resolveTransition(
      transition,
      openSnapshot,
      closedSnapshot,
    );

    expect(resolved).toMatchObject({
      strategy: 'lineAnimation',
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
    const openSnapshot = variantToSnapshot(HAMBURGER_CLOSE_ICON.variants['24-open']);
    const closedSnapshot = variantToSnapshot(HAMBURGER_CLOSE_ICON.variants['24-closed']);
    const transition: TransitionConfig = {
      id: 'open-to-closed',
      strategy: 'lineAnimation',
      durationMs: 300,
      easing: 'ease-in-out',
      layerBindings: HAMBURGER_CLOSE_BINDINGS,
    };
    const resolved = resolveTransition(
      transition,
      openSnapshot,
      closedSnapshot,
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
    (frameCallback as FrameRequestCallback | null)?.(150);
    expect(progressValues[1]).toBe(0.5);
    expect(completeCount).toBe(0);

    nowValue = 300;
    (frameCallback as FrameRequestCallback | null)?.(300);
    expect(progressValues[2]).toBe(1);
    expect(completeCount).toBe(1);
  });
});
