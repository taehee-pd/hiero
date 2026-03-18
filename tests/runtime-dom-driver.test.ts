import { describe, expect, test } from 'bun:test';

import type { ResolvedTransition } from '../lib/runtime-core';
import { planCssTrackTransition } from '../lib/runtime-dom';

function makeResolvedTransition(): ResolvedTransition {
  return {
    strategy: 'track',
    durationMs: 240,
    easing: 'ease-in-out',
    diagnostics: [],
    layerBindings: [
      {
        fromLayer: { id: 'line', style: {}, path: { d: 'M0 0L10 10' } },
        toLayer: { id: 'line', style: {}, path: { d: 'M0 0L10 10' } },
        tracks: [
          { property: 'opacity', keyframes: [0, 1] },
          { property: 'translateX', keyframes: [0, 8] },
        ],
        delayMs: 20,
        durationMs: 120,
        easing: 'linear',
      },
    ],
  };
}

describe('runtime-dom driver css fallback planning', () => {
  test('creates a css track plan for simple opacity/transform tracks', () => {
    const plan = planCssTrackTransition(makeResolvedTransition());
    expect(plan).not.toBeNull();
    expect(plan?.durationMs).toBe(140);
    expect(plan?.bindings).toHaveLength(1);
    expect(plan?.bindings[0]?.layerId).toBe('line');
    expect(plan?.bindings[0]?.fromValues.opacity).toBe(0);
    expect(plan?.bindings[0]?.toValues.opacity).toBe(1);
    expect(plan?.bindings[0]?.toValues.translateX).toBe(8);
  });

  test('returns null when pathLength track requires JS scheduler', () => {
    const resolved = makeResolvedTransition();
    resolved.layerBindings[0]!.tracks.push({ property: 'pathLength', keyframes: [0, 1] });
    expect(planCssTrackTransition(resolved)).toBeNull();
  });

  test('returns null when transition swaps layer ids', () => {
    const resolved = makeResolvedTransition();
    resolved.layerBindings[0]!.toLayer = { id: 'line-next', style: {}, path: { d: 'M0 0L20 20' } };
    expect(planCssTrackTransition(resolved)).toBeNull();
  });
});
