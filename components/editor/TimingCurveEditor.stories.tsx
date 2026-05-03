import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';

import { TimingCurveEditor } from './TimingCurveEditor';
import type { TimingOverride } from '@/lib/runtime-core/timing-override';

const meta: Meta<typeof TimingCurveEditor> = {
  title: 'Feature/Smoke/TimingCurveEditor',
  component: TimingCurveEditor,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div className="w-[420px] bg-background p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TimingCurveEditor>;

function Interactive() {
  const [value, setValue] = useState<TimingOverride>({
    g: 'ease-in-out',
    alpha: 'ease-out-cubic',
    alphaOffsetRatio: 0.08,
  });
  return <TimingCurveEditor value={value} onChange={setValue} />;
}

export const SoftDefaults: Story = {
  args: {
    value: { g: 'ease-in-out', alpha: 'ease-out-cubic', alphaOffsetRatio: 0.08 },
    onChange: () => {},
  },
};

export const SnappyDefaults: Story = {
  args: {
    value: { g: 'ease-out', alpha: 'ease-out-cubic', alphaOffsetRatio: 0.04 },
    onChange: () => {},
  },
};

export const ZeroOffset: Story = {
  args: {
    value: { g: 'linear', alpha: 'linear', alphaOffsetRatio: 0 },
    onChange: () => {},
  },
};

export const InteractiveStory: Story = {
  render: () => <Interactive />,
};
