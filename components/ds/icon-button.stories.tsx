import { Icon as UiIcon } from '@hiero/ui-icons';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';

import { IconButton } from './icon-button';

const meta: Meta<typeof IconButton> = {
  title: 'DS/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  argTypes: {
    size: { control: 'select', options: ['sm', 'md', 'lg'] },
  },
  parameters: {
    docs: {
      description: {
        component:
          'Icon-only action button. The earlier `radius` and `variant` props were removed because no caller exercised them — every IconButton in the app used the defaults (`toolbar` radius, `ghost` variant). The visual chrome is now hardcoded to ghost-on-toolbar; redesign by overriding `--btn-icon-*` tokens, not by adding props.',
      },
    },
  },
};

export default meta;
type Story = StoryObj<typeof IconButton>;

export const Default: Story = {
  args: {
    icon: <UiIcon name="save" />,
    'aria-label': 'Save',
  },
};

export const WithKeyboardHint: Story = {
  args: {
    icon: <UiIcon name="save" />,
    'aria-label': 'Save',
    kbd: ['Cmd', 'S'],
  },
};

export const SmallSize: Story = {
  args: {
    icon: <UiIcon name="plus" />,
    'aria-label': 'Add item',
    size: 'sm',
  },
};

export const LargeSize: Story = {
  args: {
    icon: <UiIcon name="search" />,
    'aria-label': 'Search',
    size: 'lg',
  },
};

export const Loading: Story = {
  args: {
    icon: <UiIcon name="save" />,
    'aria-label': 'Save',
    loading: true,
  },
};

export const Disabled: Story = {
  args: {
    icon: <UiIcon name="undo-2" />,
    'aria-label': 'Undo',
    disabled: true,
  },
};

export const AllSizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <IconButton icon={<UiIcon name="save" />} aria-label="Save (small)" size="sm" tooltip="Small (24px)" />
      <IconButton icon={<UiIcon name="save" />} aria-label="Save (medium)" size="md" tooltip="Medium (28px)" />
      <IconButton icon={<UiIcon name="save" />} aria-label="Save (large)" size="lg" tooltip="Large (32px)" />
    </div>
  ),
};

export const ToolbarGroup: Story = {
  render: () => (
    <div className="flex items-center gap-0.5 rounded-lg border border-border/70 bg-background px-1 py-1">
      <IconButton icon={<UiIcon name="save" />} aria-label="Save" kbd={['Cmd', 'S']} />
      <IconButton icon={<UiIcon name="undo-2" />} aria-label="Undo" kbd={['Cmd', 'Z']} />
      <IconButton icon={<UiIcon name="redo-2" />} aria-label="Redo" kbd={['Shift', 'Cmd', 'Z']} />
      <IconButton icon={<UiIcon name="search" />} aria-label="Search" kbd={['Cmd', 'K']} />
    </div>
  ),
};

export const ThemeMatrix: Story = {
  render: () => (
    <div className="grid gap-6">
      {(['classic', 'minimal', 'brutalist'] as const).map((theme) => (
        <div
          key={theme}
          data-theme={theme === 'classic' ? undefined : theme}
          className="grid gap-2"
        >
          <span className="text-xs uppercase tracking-wider text-muted-foreground">
            {theme}
          </span>
          <div className="flex items-center gap-3 rounded-md border border-border/50 p-3">
            <IconButton icon={<UiIcon name="save" />} aria-label="Save (sm)" size="sm" tooltip={false} />
            <IconButton icon={<UiIcon name="save" />} aria-label="Save (md)" size="md" tooltip={false} />
            <IconButton icon={<UiIcon name="save" />} aria-label="Save (lg)" size="lg" tooltip={false} />
            <span className="mx-2 h-6 w-px bg-border/50" />
            <IconButton icon={<UiIcon name="search" />} aria-label="Search" tooltip={false} />
            <IconButton icon={<UiIcon name="undo-2" />} aria-label="Undo" tooltip={false} />
            <IconButton icon={<UiIcon name="redo-2" />} aria-label="Redo" tooltip={false} />
          </div>
        </div>
      ))}
    </div>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Same three sizes under each design theme. Switching is a `data-theme` attribute on a parent — every visual property re-binds via component tokens.',
      },
    },
  },
};
