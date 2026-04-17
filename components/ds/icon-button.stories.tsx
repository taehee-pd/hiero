import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { Save, Undo2, Redo2, Search, Plus, ChevronLeft } from 'lucide-react';
import { IconButton } from './icon-button';

const meta: Meta<typeof IconButton> = {
  title: 'DS/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
    radius: { control: 'select', options: ['toolbar', 'panel', 'pill'] },
    variant: { control: 'select', options: ['ghost', 'secondary', 'primary-soft'] },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Default: Story = {
  args: {
    icon: <Save />,
    'aria-label': 'Save',
  },
};

export const WithKeyboardHint: Story = {
  args: {
    icon: <Save />,
    'aria-label': 'Save',
    kbd: ['Cmd', 'S'],
  },
};

export const SmallSize: Story = {
  args: {
    icon: <Plus />,
    'aria-label': 'Add item',
    size: 'sm',
  },
};

export const LargeSize: Story = {
  args: {
    icon: <Search />,
    'aria-label': 'Search',
    size: 'lg',
  },
};

export const PanelRadius: Story = {
  args: {
    icon: <ChevronLeft />,
    'aria-label': 'Collapse',
    radius: 'panel',
  },
};

export const Loading: Story = {
  args: {
    icon: <Save />,
    'aria-label': 'Save',
    loading: true,
  },
};

export const Disabled: Story = {
  args: {
    icon: <Undo2 />,
    'aria-label': 'Undo',
    disabled: true,
  },
};

export const SecondaryVariant: Story = {
  args: {
    icon: <Save />,
    'aria-label': 'Save',
    variant: 'secondary',
  },
};

export const PrimarySoftVariant: Story = {
  args: {
    icon: <Save />,
    'aria-label': 'Save',
    variant: 'primary-soft',
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <IconButton icon={<Save />} aria-label="Save (small)" size="sm" tooltip="Small (24px)" />
      <IconButton icon={<Save />} aria-label="Save (medium)" size="md" tooltip="Medium (28px)" />
      <IconButton icon={<Save />} aria-label="Save (large)" size="lg" tooltip="Large (32px)" />
    </div>
  ),
};

export const AllVariants: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <IconButton icon={<Save />} aria-label="Ghost" variant="ghost" tooltip="Ghost" />
      <IconButton icon={<Save />} aria-label="Secondary" variant="secondary" tooltip="Secondary" />
      <IconButton icon={<Save />} aria-label="Primary soft" variant="primary-soft" tooltip="Primary soft" />
    </div>
  ),
};

export const ToolbarGroup: Story = {
  render: () => (
    <div className="flex items-center gap-0.5 rounded-lg border border-border/70 bg-background px-1 py-1">
      <IconButton icon={<Save />} aria-label="Save" kbd={['Cmd', 'S']} />
      <IconButton icon={<Undo2 />} aria-label="Undo" kbd={['Cmd', 'Z']} />
      <IconButton icon={<Redo2 />} aria-label="Redo" kbd={['Shift', 'Cmd', 'Z']} />
      <IconButton icon={<Search />} aria-label="Search" kbd={['Cmd', 'K']} />
    </div>
  ),
};
