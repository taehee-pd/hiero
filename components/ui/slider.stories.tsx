import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Slider } from './slider';

const meta = {
  title: 'Primitives/Slider',
  component: Slider,
  tags: ['autodocs'],
} satisfies Meta<typeof Slider>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { defaultValue: [50], max: 100, step: 1 },
  render: (args) => (
    <div style={{ width: 240 }}>
      <Slider {...args} />
    </div>
  ),
};

export const Range: Story = {
  args: { defaultValue: [20, 80], max: 100, step: 1 },
  render: (args) => (
    <div style={{ width: 240 }}>
      <Slider {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: { defaultValue: [50], max: 100, step: 1, disabled: true },
  render: (args) => (
    <div style={{ width: 240 }}>
      <Slider {...args} />
    </div>
  ),
};
