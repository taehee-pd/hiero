import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { TransitionConfig } from '@/lib/runtime-core/transition-resolver';
import type { Variant } from '@/lib/schema/types';
import { TimelineEditor } from './TimelineEditor';
import { seedEditorStoryState } from './story-fixtures';

const smokeVariant: Variant = {
  id: 'v24',
  name: '24',
  size: 24,
  viewBox: [0, 0, 24, 24],
  layers: {
    shape: {
      id: 'shape',
      path: { d: 'M4 4 H20 V20 H4 Z' },
      style: {
        fill: { mode: 'fixed', value: '#0ea5e9' },
        stroke: { mode: 'fixed', value: '#0f172a' },
        strokeWidth: 1,
      },
      transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0 },
    },
  },
  defaultType: 'default',
  types: {
    default: {
      id: 'default',
      layers: {
        shape: {
          id: 'shape',
          path: { d: 'M4 4 H20 V20 H4 Z' },
          style: {
            fill: { mode: 'fixed', value: '#0ea5e9' },
            stroke: { mode: 'fixed', value: '#0f172a' },
            strokeWidth: 1,
          },
          transform: { x: 0, y: 0, scaleX: 1, scaleY: 1, rotate: 0 },
        },
      },
    },
  },
};

const smokeTransition: TransitionConfig = {
  id: 'smoke-timeline',
  strategy: 'lineAnimation',
  durationMs: 600,
  easing: 'linear',
  layerBindings: [
    {
      fromLayerId: 'shape',
      toLayerId: 'shape',
      tracks: [
        { property: 'opacity', keyframes: [0, 1] },
        { property: 'scale', keyframes: [0.8, 1] },
      ],
    },
  ],
};

const meta: Meta<typeof TimelineEditor> = {
  title: 'Feature/Smoke/TimelineEditor',
  component: TimelineEditor,
  tags: ['autodocs'],
  args: {
    iconId: 'sample',
    transition: smokeTransition,
    variant: smokeVariant,
  },
  decorators: [
    (Story) => {
      seedEditorStoryState();
      return (
        <div className="h-[420px] w-[760px] border border-border/60 bg-background p-2">
          <Story />
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof TimelineEditor>;

export const Default: Story = {};
