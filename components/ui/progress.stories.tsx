import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Progress } from './progress';

const meta = {
  title: 'Primitives/Progress',
  component: Progress,
  tags: ['autodocs'],
} satisfies Meta<typeof Progress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: { value: 40 },
  render: (args) => (
    <div style={{ width: 240 }}>
      <Progress {...args} />
    </div>
  ),
};

export const Full: Story = {
  args: { value: 100 },
  render: (args) => (
    <div style={{ width: 240 }}>
      <Progress {...args} />
    </div>
  ),
};

export const Indeterminate: Story = {
  args: {},
  render: (args) => (
    <div style={{ width: 240 }}>
      <Progress {...args} />
    </div>
  ),
};
