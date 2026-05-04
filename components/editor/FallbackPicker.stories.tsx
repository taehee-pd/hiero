import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { FallbackPicker } from './FallbackPicker';
import type { FallbackName } from '@/lib/schema/types';

const meta: Meta<typeof FallbackPicker> = {
  title: 'Feature/Smoke/FallbackPicker',
  component: FallbackPicker,
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
type Story = StoryObj<typeof FallbackPicker>;

function Interactive({ resolverPicked }: { resolverPicked: FallbackName }) {
  const [override, setOverride] = useState<FallbackName | undefined>();
  return (
    <FallbackPicker
      resolverPicked={resolverPicked}
      override={override}
      onChange={setOverride}
    />
  );
}

export const AutoPickedRadialPop: Story = {
  args: {
    resolverPicked: 'radial-pop',
    override: undefined,
    onChange: () => {},
  },
};

export const AutoPickedDrawReplace: Story = {
  args: {
    resolverPicked: 'draw-replace',
    override: undefined,
    onChange: () => {},
  },
};

export const ExplicitOverride: Story = {
  args: {
    resolverPicked: 'radial-pop',
    override: 'directional-replace-up',
    onChange: () => {},
  },
};

export const Interactive_RadialAuto: Story = {
  render: () => <Interactive resolverPicked="radial-pop" />,
};
