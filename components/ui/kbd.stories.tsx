import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Kbd, KbdGroup } from './kbd';

const meta = {
  title: 'Primitives/Kbd',
  component: Kbd,
  tags: ['autodocs'],
} satisfies Meta<typeof Kbd>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {
  render: () => <Kbd>⌘</Kbd>,
};

export const Combo: Story = {
  render: () => (
    <KbdGroup>
      <Kbd>⌘</Kbd>
      <Kbd>shift</Kbd>
      <Kbd>k</Kbd>
    </KbdGroup>
  ),
};
