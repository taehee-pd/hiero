import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { IconGridItem } from './IconGridItem';

const sampleSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>`;

const noop = () => {};

const meta: Meta<typeof IconGridItem> = {
  title: 'Feature/IconGridItem',
  component: IconGridItem,
  tags: ['autodocs'],
  args: {
    onOpen: noop,
    onSelect: noop,
    onShiftClick: noop,
    onToggleFavorite: noop,
    onDuplicate: noop,
    onDelete: noop,
    onRename: noop,
  },
};

export default meta;
type Story = StoryObj<typeof IconGridItem>;

export const Default: Story = {
  args: {
    iconId: 'icon-1',
    iconName: 'plus-icon',
    svg: sampleSvg,
    active: false,
    selected: false,
    favorite: false,
  },
};

export const Active: Story = {
  args: {
    iconId: 'icon-1',
    iconName: 'plus-icon',
    svg: sampleSvg,
    active: true,
    selected: false,
    favorite: false,
  },
};

export const Selected: Story = {
  args: {
    iconId: 'icon-1',
    iconName: 'plus-icon',
    svg: sampleSvg,
    active: false,
    selected: true,
    favorite: false,
  },
};

export const Favorite: Story = {
  args: {
    iconId: 'icon-1',
    iconName: 'plus-icon',
    svg: sampleSvg,
    active: false,
    selected: false,
    favorite: true,
  },
};

export const LongName: Story = {
  args: {
    iconId: 'icon-1',
    iconName: 'a-very-long-icon-name-that-should-truncate',
    svg: sampleSvg,
    active: false,
    selected: false,
    favorite: false,
  },
};

export const Grid: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-1 p-2 max-w-xs">
      {['arrow-up', 'arrow-down', 'arrow-left', 'arrow-right', 'check', 'close'].map(
        (name, i) => (
          <IconGridItem
            key={name}
            iconId={`icon-${i}`}
            iconName={name}
            svg={sampleSvg}
            active={i === 0}
            selected={i === 2}
            favorite={i === 4}
            onOpen={() => {}}
            onSelect={() => {}}
            onShiftClick={() => {}}
            onToggleFavorite={() => {}}
          />
        ),
      )}
    </div>
  ),
};
