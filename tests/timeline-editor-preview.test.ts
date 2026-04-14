import { describe, expect, test } from 'bun:test';

import { buildTimelineTransitionPreview } from '../components/editor/TimelineEditor';
import type { TransitionConfig } from '../lib/runtime-core';
import type { Variant } from '../lib/schema/types';

describe('TimelineEditor preview frames', () => {
  test('builds interpolated values for track-based timeline scrubbing', () => {
    const variant: Variant = {
      id: 'v24',
      size: 24,
      name: '24',
      viewBox: [0, 0, 24, 24],
      layers: {},
      defaultType: 'idle',
      types: {
        idle: {
          id: 'idle',
          layers: {
            layer1: {
              id: 'layer1',
              style: {
                fill: { mode: 'fixed', value: '#000000' },
              },
            },
          },
        },
        active: {
          id: 'active',
          layers: {
            layer1: {
              id: 'layer1',
              style: {
                fill: { mode: 'fixed', value: '#000000' },
              },
            },
          },
        },
      },
    };

    const transition: TransitionConfig = {
      id: 'idle-to-active',
      strategy: 'lineAnimation',
      durationMs: 300,
      easing: 'linear',
      layerBindings: [
        {
          fromLayerId: 'layer1',
          toLayerId: 'layer1',
          tracks: [
            { property: 'opacity', keyframes: [0, 1] },
          ],
        },
      ],
    };

    const preview = buildTimelineTransitionPreview(transition, variant, 0.5);

    expect(preview).not.toBeNull();
    expect(preview?.transitionId).toBe('idle-to-active');
    expect(preview?.progress).toBe(0.5);
    expect(preview?.interpolatedValues.layer1?.opacity).toBeCloseTo(0.5, 5);
  });
});
