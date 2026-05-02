import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { CompoundLayerSection } from './CompoundLayerSection';
import { buildLeftLeaningCompound } from '@/lib/schema/compound';
import type { Layer } from '@/lib/schema/types';

const SQUARE_OUTER = 'M0 0 L100 0 L100 100 L0 100 Z';
const SQUARE_INNER = 'M30 30 L70 30 L70 70 L30 70 Z';
const ELLIPSE = 'M50 0 A50 50 0 1 1 49 0';

function makeLayer(): Layer {
  return {
    id: 'compound-1',
    style: { fill: { mode: 'fixed', value: '#000' } },
    path: { d: 'M0 0 L100 0 L100 100 L0 100 Z' },
    compound: buildLeftLeaningCompound(
      'subtract',
      [{ d: SQUARE_OUTER }, { d: SQUARE_INNER }],
      'compound-1',
    ),
  } as Layer;
}

function makeMultiOpLayer(): Layer {
  return {
    id: 'compound-multi',
    style: { fill: { mode: 'fixed', value: '#000' } },
    path: { d: SQUARE_OUTER },
    compound: buildLeftLeaningCompound(
      'unite',
      [{ d: SQUARE_OUTER }, { d: SQUARE_INNER }, { d: ELLIPSE }],
      'compound-multi',
    ),
  } as Layer;
}

const meta: Meta<typeof CompoundLayerSection> = {
  title: 'Feature/Smoke/CompoundLayerSection',
  component: CompoundLayerSection,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[360px] border border-border/60 bg-background p-4">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CompoundLayerSection>;

export const SubtractTwoOperands: Story = {
  args: {
    layer: makeLayer(),
    onFlatten: () => {},
    onConvertToGroup: () => {},
  },
};

export const UniteThreeOperands: Story = {
  args: {
    layer: makeMultiOpLayer(),
    onFlatten: () => {},
    onConvertToGroup: () => {},
  },
};
