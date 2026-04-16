import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { SyncDiffPreview } from './SyncDiffPreview';
import type { IconChange } from '@/lib/sync-service/diff-source';

const meta: Meta<typeof SyncDiffPreview> = {
  title: 'Feature/SyncDiffPreview',
  component: SyncDiffPreview,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SyncDiffPreview>;

const mockChanges: IconChange[] = [
  { iconDir: 'icons/arrow-left', kind: 'added' },
  { iconDir: 'icons/arrow-right', kind: 'added' },
  { iconDir: 'icons/check-circle', kind: 'updated' },
  { iconDir: 'icons/close', kind: 'removed' },
  { iconDir: 'icons/settings', kind: 'preview-only' },
  { iconDir: 'icons/user', kind: 'metadata-only' },
];

export const Default: Story = {
  args: {
    iconChanges: mockChanges,
    fileCount: 12,
  },
};

export const Empty: Story = {
  args: {
    iconChanges: [],
    fileCount: 0,
  },
};

export const EmptyWithFiles: Story = {
  args: {
    iconChanges: [],
    fileCount: 3,
  },
};

export const AddedOnly: Story = {
  args: {
    iconChanges: [
      { iconDir: 'icons/new-icon-1', kind: 'added' },
      { iconDir: 'icons/new-icon-2', kind: 'added' },
    ],
    fileCount: 4,
  },
};

export const RemovedOnly: Story = {
  args: {
    iconChanges: [
      { iconDir: 'icons/deprecated-1', kind: 'removed' },
      { iconDir: 'icons/deprecated-2', kind: 'removed' },
    ],
    fileCount: 4,
  },
};
