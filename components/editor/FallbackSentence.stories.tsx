import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { FallbackSentence } from './FallbackSentence';
import { defaultMotionCurves } from '@/lib/runtime-core/motion-curves';
import type { MorphResolution } from '@/lib/runtime-core/morph-resolution';

const continuous: MorphResolution = {
  interpolator: () => 'M0 0 L10 0 L10 10 L0 10 Z',
  motion: defaultMotionCurves('soft'),
  taxonomy: 'T1',
  tier: 'intrinsic-strict',
  distortion: 0.087,
  signal: null,
};

const fallback: MorphResolution = {
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

const treeMismatch: MorphResolution = {
  ...fallback,
  signal: {
    kind: 'tree-shape-mismatch',
    level: 2,
    fromCount: 3,
    toCount: 1,
    fallbackName: 'radial-pop',
  },
};

const meta: Meta<typeof FallbackSentence> = {
  title: 'Feature/Smoke/FallbackSentence',
  component: FallbackSentence,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-6 bg-background w-[420px]">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof FallbackSentence>;

export const NoSentence_ContinuousMorph: Story = {
  args: { resolution: continuous },
};

export const FallbackSentence_DistortionExceeded: Story = {
  args: { resolution: fallback },
};

export const FallbackSentence_TreeMismatch: Story = {
  args: { resolution: treeMismatch },
};
