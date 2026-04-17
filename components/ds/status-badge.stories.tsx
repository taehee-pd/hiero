import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StatusBadge } from './status-badge';

const meta: Meta<typeof StatusBadge> = {
  title: 'DS/StatusBadge',
  component: StatusBadge,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['neutral', 'success', 'warning', 'danger', 'info', 'accent'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof StatusBadge>;

export const Neutral: Story = {
  args: { children: 'Saved', variant: 'neutral' },
};

export const Warning: Story = {
  args: { children: 'Unsaved', variant: 'warning' },
};

export const Success: Story = {
  args: { children: 'Connected', variant: 'success' },
};

export const Danger: Story = {
  args: { children: 'Conflict', variant: 'danger' },
};

export const Info: Story = {
  args: { children: 'PR created', variant: 'info' },
};

export const Accent: Story = {
  args: { children: '3 changes', variant: 'accent' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <StatusBadge variant="neutral">Saved</StatusBadge>
      <StatusBadge variant="warning">Unsaved</StatusBadge>
      <StatusBadge variant="success">Connected</StatusBadge>
      <StatusBadge variant="danger">Auth expired</StatusBadge>
      <StatusBadge variant="info">PR created</StatusBadge>
      <StatusBadge variant="accent">Snapshot</StatusBadge>
    </div>
  ),
};
