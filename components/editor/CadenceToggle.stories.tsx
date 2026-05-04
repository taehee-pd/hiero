import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { CadenceToggle } from './CadenceToggle';
import type { Cadence } from '@/lib/schema/types';

const meta: Meta<typeof CadenceToggle> = {
  title: 'Feature/Smoke/CadenceToggle',
  component: CadenceToggle,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="p-6 bg-background">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof CadenceToggle>;

function Interactive() {
  const [value, setValue] = useState<Cadence>('soft');
  return <CadenceToggle value={value} onChange={setValue} />;
}

export const Soft: Story = {
  args: { value: 'soft', onChange: () => {} },
};

export const Snappy: Story = {
  args: { value: 'snappy', onChange: () => {} },
};

export const Disabled: Story = {
  args: { value: 'soft', onChange: () => {}, disabled: true },
};

export const KeyboardNav: Story = {
  render: () => <Interactive />,
};
