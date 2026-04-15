import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Spinner } from './spinner';

const meta = {
  title: 'Primitives/Spinner',
  component: Spinner,
  tags: ['autodocs'],
} satisfies Meta<typeof Spinner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const InContext: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Spinner />
      <span style={{ fontSize: 13 }}>Compiling icons…</span>
    </div>
  ),
};
