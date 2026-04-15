import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Separator } from './separator';

const meta = {
  title: 'Primitives/Separator',
  component: Separator,
  tags: ['autodocs'],
} satisfies Meta<typeof Separator>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Horizontal: Story = {
  render: () => (
    <div style={{ width: 280 }}>
      <div style={{ fontSize: 13 }}>editor</div>
      <Separator style={{ margin: '8px 0' }} />
      <div style={{ fontSize: 13 }}>inspector</div>
    </div>
  ),
};

export const Vertical: Story = {
  render: () => (
    <div style={{ display: 'flex', height: 60, alignItems: 'center', gap: 12 }}>
      <div style={{ fontSize: 13 }}>layers</div>
      <Separator orientation="vertical" />
      <div style={{ fontSize: 13 }}>types</div>
      <Separator orientation="vertical" />
      <div style={{ fontSize: 13 }}>transitions</div>
    </div>
  ),
};
