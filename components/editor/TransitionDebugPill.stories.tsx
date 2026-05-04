import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { TransitionDebugPill } from './TransitionDebugPill';
import type { MorphResolution } from '@/lib/runtime-core/morph-resolution';
import { defaultMotionCurves } from '@/lib/runtime-core/motion-curves';

const continuousResolution: MorphResolution = {
  interpolator: () => 'M0 0 L10 0 L10 10 L0 10 Z',
  motion: defaultMotionCurves('soft'),
  taxonomy: 'T1',
  tier: 'intrinsic-strict',
  distortion: 0.087,
  signal: null,
};

const fallbackResolution: MorphResolution = {
  interpolator: () => 'M0 0 L10 0 L10 10 L0 10 Z',
  motion: defaultMotionCurves('soft'),
  taxonomy: 'T8',
  tier: 'designed-fallback',
  distortion: 0,
  signal: {
    kind: 'distortion-floor-exceeded',
    tier: 'hierarchical-match',
    estimate: 0.74,
    ceiling: 0.5,
    fallbackName: 'draw-replace',
  },
};

const meta: Meta<typeof TransitionDebugPill> = {
  title: 'Feature/Smoke/TransitionDebugPill',
  component: TransitionDebugPill,
  tags: ['autodocs'],
  // Stories render the body unconditionally for visual review;
  // the production gate is exercised by tests/build-time greps.
  parameters: {
    docs: {
      description: {
        component:
          'Engineer-facing debug pill for the resolver cascade. Only rendered when NEXT_PUBLIC_HIERO_DEBUG=1 in production.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof TransitionDebugPill>;

export const ContinuousMorph: Story = {
  args: { resolution: continuousResolution },
};

export const DesignedFallback: Story = {
  args: { resolution: fallbackResolution },
};

export const NoResolution: Story = {
  args: { resolution: null },
};
