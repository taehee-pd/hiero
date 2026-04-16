import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Tag } from './tag';

const meta: Meta<typeof Tag> = {
  title: 'DS/Tag',
  component: Tag,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['default', 'muted', 'outline', 'success', 'warning', 'danger'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Tag>;

export const Default: Story = {
  args: { children: 'local-directory', variant: 'outline' },
};

export const Muted: Story = {
  args: { children: 'react', variant: 'muted' },
};

export const Success: Story = {
  args: { children: 'auto-publish', variant: 'success' },
};

export const Warning: Story = {
  args: { children: 'dry-run', variant: 'warning' },
};

export const Danger: Story = {
  args: { children: 'Removed', variant: 'danger' },
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-2">
      <Tag variant="default">Added</Tag>
      <Tag variant="muted">react</Tag>
      <Tag variant="outline">npm-registry</Tag>
      <Tag variant="success">auto-publish</Tag>
      <Tag variant="warning">pending</Tag>
      <Tag variant="danger">Removed</Tag>
    </div>
  ),
};

export const SyncTargetExample: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-1">
      <Tag variant="muted">react</Tag>
      <Tag>npm-registry</Tag>
      <Tag variant="muted">v1.2.0</Tag>
      <Tag>next 1.3.0</Tag>
      <Tag variant="success">auto-publish</Tag>
      <Tag variant="success">server token</Tag>
    </div>
  ),
};

export const DiffPreviewExample: Story = {
  render: () => (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm">
        <span className="font-mono text-xs">icons/arrow-left</span>
        <Tag variant="default">Added</Tag>
      </div>
      <div className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm">
        <span className="font-mono text-xs">icons/check-circle</span>
        <Tag variant="muted">Updated</Tag>
      </div>
      <div className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm">
        <span className="font-mono text-xs">icons/close</span>
        <Tag variant="danger">Removed</Tag>
      </div>
    </div>
  ),
};
